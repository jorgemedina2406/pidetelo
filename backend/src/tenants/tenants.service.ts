import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

@Injectable()
export class TenantsService {
  private metadataFilePath = path.join(process.cwd(), 'data', 'tenants_metadata.json');
  private reviewsStoragePath = path.join(process.cwd(), 'data', 'tenant_reviews.json');

  private loadLocalReviews(): Record<string, any[]> {
    try {
      if (fs.existsSync(this.reviewsStoragePath)) {
        return JSON.parse(fs.readFileSync(this.reviewsStoragePath, 'utf-8'));
      }
    } catch (_) {}
    return {};
  }

  private saveLocalReviews(data: Record<string, any[]>) {
    try {
      const dir = path.dirname(this.reviewsStoragePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.reviewsStoragePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[TenantsService] Error saving local reviews:', e);
    }
  }

  constructor(private supabase: SupabaseService) {}

  private loadMetadata(): Record<string, any> {
    try {
      if (fs.existsSync(this.metadataFilePath)) {
        return JSON.parse(fs.readFileSync(this.metadataFilePath, 'utf-8'));
      }
    } catch (_) {}
    return {};
  }

  private saveTagline(tenantId: string, tagline: string) {
    try {
      const data = this.loadMetadata();
      data[tenantId] = { ...(data[tenantId] || {}), tagline };
      const dir = path.dirname(this.metadataFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.metadataFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[TenantsService] Error saving tenant metadata:', e);
    }
  }

  private getTagline(tenantId: string): string | undefined {
    try {
      const data = this.loadMetadata();
      return data[tenantId]?.tagline;
    } catch (_) {
      return undefined;
    }
  }

  private saveTenantMetadata(tenantId: string, metadata: Record<string, any>) {
    try {
      const data = this.loadMetadata();
      data[tenantId] = { ...(data[tenantId] || {}), ...metadata };
      const dir = path.dirname(this.metadataFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.metadataFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[TenantsService] Error saving tenant metadata:', e);
    }
  }

  private getTenantMetadata(tenantId: string): Record<string, any> {
    try {
      const data = this.loadMetadata();
      return data[tenantId] || {};
    } catch (_) {
      return {};
    }
  }

  calculateScheduleStatus(businessHours: any): {
    isOpen: boolean;
    openStr: string;
    closeStr: string;
    isOpenToday: boolean;
    label: string;
  } {
    const fallbackOpen = businessHours?.open || '11:00';
    const fallbackClose = businessHours?.close || '23:00';
    const scheduleDays = businessHours?.scheduleDays || [];

    let now = new Date();
    try {
      const vzlaStr = new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' });
      now = new Date(vzlaStr);
    } catch (_) {}
    const daysMap = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const todayName = daysMap[now.getDay()];

    if (Array.isArray(scheduleDays) && scheduleDays.length > 0) {
      const todayConfig = scheduleDays.find((d: any) => {
        if (!d || !d.day) return false;
        const norm = String(d.day).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const target = todayName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return norm === target;
      });

      if (todayConfig) {
        if (todayConfig.open === false) {
          return {
            isOpen: false,
            openStr: todayConfig.from || fallbackOpen,
            closeStr: todayConfig.to || fallbackClose,
            isOpenToday: false,
            label: 'Cerrado hoy'
          };
        }

        const openStr = todayConfig.from || fallbackOpen;
        const closeStr = todayConfig.to || fallbackClose;
        const [openH, openM] = openStr.split(':').map(Number);
        const [closeH, closeM] = closeStr.split(':').map(Number);
        const curMin = now.getHours() * 60 + now.getMinutes();
        const oMin = (openH || 11) * 60 + (openM || 0);
        const cMin = (closeH || 23) * 60 + (closeM || 0);

        let isOpen = false;
        if (cMin > oMin) {
          isOpen = curMin >= oMin && curMin < cMin;
        } else {
          isOpen = curMin >= oMin || curMin < cMin;
        }

        return {
          isOpen,
          openStr,
          closeStr,
          isOpenToday: true,
          label: isOpen ? `Abierto • Cierra a las ${closeStr}` : `Cerrado • Abre a las ${openStr}`
        };
      }
    }

    const [openH, openM] = fallbackOpen.split(':').map(Number);
    const [closeH, closeM] = fallbackClose.split(':').map(Number);
    const curMin = now.getHours() * 60 + now.getMinutes();
    const oMin = (openH || 11) * 60 + (openM || 0);
    const cMin = (closeH || 23) * 60 + (closeM || 0);

    let isOpen = false;
    if (cMin > oMin) {
      isOpen = curMin >= oMin && curMin < cMin;
    } else {
      isOpen = curMin >= oMin || curMin < cMin;
    }

    return {
      isOpen,
      openStr: fallbackOpen,
      closeStr: fallbackClose,
      isOpenToday: true,
      label: isOpen ? `Abierto • Cierra a las ${fallbackClose}` : `Cerrado • Abre a las ${fallbackOpen}`
    };
  }

  private mergeTenantWithMetadata(t: any): any {
    if (!t) return t;
    const meta = this.getTenantMetadata(t.id);
    const exchangeRate = Number(t.exchange_rate ?? meta.exchange_rate ?? meta.currency_settings?.exchangeRate) || 45.50;
    const baseCurrency = t.base_currency ?? meta.base_currency ?? meta.currency_settings?.baseCurrency ?? 'USD';
    const displayMode = t.display_mode ?? meta.display_mode ?? meta.currency_settings?.displayMode ?? 'usd_and_bs';
    const tagline = t.tagline ?? meta.tagline ?? '';
    const category = t.category ?? meta.category ?? 'Restaurantes';
    const subcategories = t.subcategories ?? meta.subcategories ?? [];

    const currencySettings = {
      baseCurrency,
      displayMode,
      exchangeRate,
      lastRateUpdate: meta.currency_settings?.lastRateUpdate || new Date().toISOString()
    };

    const defaultDeliveryTiers = [
      { id: 'tier_1', minKm: 0, maxKm: 2, price: 1.50 },
      { id: 'tier_2', minKm: 2, maxKm: 5, price: 3.00 },
      { id: 'tier_3', minKm: 5, maxKm: 8, price: 4.50 }
    ];
    const deliveryTiers = t.delivery_tiers ?? meta.delivery_tiers ?? meta.deliveryTiers ?? defaultDeliveryTiers;
    const isFeatured = Boolean(t.is_featured ?? meta.is_featured ?? meta.isFeatured ?? false);
    const acceptedPaymentMethods = t.accepted_payment_methods ?? meta.accepted_payment_methods ?? meta.acceptedPaymentMethods ?? ['mobile_transfer', 'cash_usd', 'cash_local'];

    let enrichedBranches = t.branches;
    if (Array.isArray(t.branches)) {
      let branchMeta: Record<string, any> = {};
      try {
        const bMetaPath = path.resolve(process.cwd(), 'data', 'branch_metadata.json');
        if (fs.existsSync(bMetaPath)) {
          branchMeta = JSON.parse(fs.readFileSync(bMetaPath, 'utf-8'));
        }
      } catch (_) {}

      enrichedBranches = t.branches.map((b: any) => {
        const bm = branchMeta[b.id] || {};
        const bPaymentMethods = b.accepted_payment_methods ?? bm.accepted_payment_methods ?? bm.acceptedPaymentMethods ?? acceptedPaymentMethods;
        const bTiers = b.delivery_tiers ?? bm.delivery_tiers ?? bm.deliveryTiers ?? deliveryTiers;
        const bRate = Number(b.exchange_rate ?? bm.exchange_rate ?? bm.currency_settings?.exchangeRate ?? exchangeRate);
        const bCurrSettings = {
          baseCurrency: b.base_currency ?? bm.base_currency ?? bm.currency_settings?.baseCurrency ?? baseCurrency,
          displayMode: b.display_mode ?? bm.display_mode ?? bm.currency_settings?.displayMode ?? displayMode,
          exchangeRate: bRate,
          lastRateUpdate: bm.currency_settings?.lastRateUpdate || new Date().toISOString(),
          acceptedPaymentMethods: bPaymentMethods
        };
        const rawBh = b.business_hours ?? bm.business_hours ?? { open: '11:00', close: '23:00', isOpenToday: true };
        const sDays = rawBh?.scheduleDays || bm.business_hours?.scheduleDays || null;
        const bHours = {
          open: rawBh?.open || '11:00',
          close: rawBh?.close || '23:00',
          isOpenToday: rawBh?.isOpenToday ?? true,
          scheduleDays: sDays
        };
        const bStatus = this.calculateScheduleStatus(bHours);
        const bLogo = b.logo_url || bm.logo_url || meta.logo_url || t.logo_url || 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=500&auto=format&fit=crop&q=80';
        const bBanner = b.banner_url || bm.banner_url || meta.banner_url || t.banner_url || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&auto=format&fit=crop&q=80';
        const bAccent = b.accent_color || bm.accent_color || meta.accent_color || t.accent_color || '#f97316';

        return {
          ...b,
          logo_url: bLogo,
          logoUrl: bLogo,
          banner_url: bBanner,
          bannerUrl: bBanner,
          accent_color: bAccent,
          accentColor: bAccent,
          branding: {
            accentColor: bAccent,
            logoUrl: bLogo,
            bannerUrl: bBanner
          },
          exchange_rate: bRate,
          exchangeRate: bRate,
          delivery_tiers: bTiers,
          deliveryTiers: bTiers,
          accepted_payment_methods: bPaymentMethods,
          acceptedPaymentMethods: bPaymentMethods,
          currency_settings: bCurrSettings,
          currencySettings: bCurrSettings,
          business_hours: {
            ...bHours,
            open: bStatus.openStr,
            close: bStatus.closeStr,
            isOpenNow: bStatus.isOpen,
            isOpenToday: bStatus.isOpenToday,
            label: bStatus.label
          },
          businessHours: {
            ...bHours,
            open: bStatus.openStr,
            close: bStatus.closeStr,
            isOpenNow: bStatus.isOpen,
            isOpenToday: bStatus.isOpenToday,
            label: bStatus.label
          },
          openTime: bStatus.openStr,
          closeTime: bStatus.closeStr,
          open_time: bStatus.openStr,
          close_time: bStatus.closeStr,
          is_open_now: bStatus.isOpen,
          isOpenNow: bStatus.isOpen
        };
      });
    }

    const localReviews = this.loadLocalReviews();
    const reviews = localReviews[t.id] || [];
    let calculatedRating = Number(t.rating ?? meta.rating);
    let calculatedReviewCount = Number(t.review_count ?? meta.review_count ?? meta.reviewCount);

    if (reviews.length > 0) {
      calculatedReviewCount = reviews.length;
      calculatedRating = Number((reviews.reduce((acc: number, r: any) => acc + (Number(r.rating) || 5), 0) / reviews.length).toFixed(1));
    } else if (isNaN(calculatedRating) || calculatedRating === 0) {
      calculatedRating = 5.0;
      calculatedReviewCount = 0;
    }

    let planCode = t.plan_code || t.planCode || meta.plan_code || meta.planCode;
    if (!planCode) {
      try {
        const tpPath = path.resolve(process.cwd(), 'data', 'tenant_plans.json');
        if (fs.existsSync(tpPath)) {
          const tpMap = JSON.parse(fs.readFileSync(tpPath, 'utf-8'));
          planCode = tpMap[t.id];
        }
      } catch (_) {}
    }
    if (!planCode) {
      planCode = t.slug === 'burger-lab' ? 'COMERCIO_PRO' : 'EMPRENDEDOR';
    }

    const firstBranch = Array.isArray(enrichedBranches) && enrichedBranches.length > 0 ? enrichedBranches[0] : null;
    const defaultLogo = 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=500&auto=format&fit=crop&q=80';
    const defaultBanner = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&auto=format&fit=crop&q=80';
    const resolvedLogo = t.logo_url || meta.logo_url || firstBranch?.logoUrl || firstBranch?.logo_url || defaultLogo;
    const resolvedBanner = t.banner_url || meta.banner_url || firstBranch?.bannerUrl || firstBranch?.banner_url || defaultBanner;
    const resolvedAccent = t.accent_color || meta.accent_color || firstBranch?.accentColor || firstBranch?.accent_color || '#f97316';

    const rawTenantBh = t.business_hours ?? meta.business_hours ?? firstBranch?.business_hours ?? { open: '08:00', close: '23:00', isOpenToday: true };
    const tenantSDays = rawTenantBh?.scheduleDays || firstBranch?.business_hours?.scheduleDays || null;
    const tenantHours = {
      open: rawTenantBh?.open || firstBranch?.openTime || '08:00',
      close: rawTenantBh?.close || firstBranch?.closeTime || '23:00',
      isOpenToday: rawTenantBh?.isOpenToday ?? firstBranch?.isOpenToday ?? true,
      scheduleDays: tenantSDays
    };
    const tenantScheduleStatus = this.calculateScheduleStatus(tenantHours);

    return {
      ...t,
      logo_url: resolvedLogo,
      logoUrl: resolvedLogo,
      banner_url: resolvedBanner,
      bannerUrl: resolvedBanner,
      accent_color: resolvedAccent,
      accentColor: resolvedAccent,
      plan_code: planCode,
      planCode: planCode,
      subscription_plan_id: t.subscription_plan_id || planCode,
      subscriptionPlanId: planCode,
      category,
      subcategories,
      tagline,
      is_featured: isFeatured,
      isFeatured,
      rating: calculatedRating,
      review_count: calculatedReviewCount,
      reviewCount: calculatedReviewCount,
      exchange_rate: exchangeRate,
      base_currency: baseCurrency,
      display_mode: displayMode,
      currency_settings: currencySettings,
      currencySettings,
      delivery_tiers: deliveryTiers,
      deliveryTiers,
      accepted_payment_methods: acceptedPaymentMethods,
      acceptedPaymentMethods,
      business_hours: {
        ...tenantHours,
        open: tenantScheduleStatus.openStr,
        close: tenantScheduleStatus.closeStr,
        isOpenNow: tenantScheduleStatus.isOpen,
        isOpenToday: tenantScheduleStatus.isOpenToday,
        label: tenantScheduleStatus.label
      },
      businessHours: {
        ...tenantHours,
        open: tenantScheduleStatus.openStr,
        close: tenantScheduleStatus.closeStr,
        isOpenNow: tenantScheduleStatus.isOpen,
        isOpenToday: tenantScheduleStatus.isOpenToday,
        label: tenantScheduleStatus.label
      },
      open_time: tenantScheduleStatus.openStr,
      openTime: tenantScheduleStatus.openStr,
      close_time: tenantScheduleStatus.closeStr,
      closeTime: tenantScheduleStatus.closeStr,
      is_open_now: tenantScheduleStatus.isOpen,
      isOpenNow: tenantScheduleStatus.isOpen,
      deliverySettings: {
        baseDeliveryFee: Number(t.base_delivery_fee ?? 2.50),
        deliveryRadiusKm: Number(t.delivery_radius_km ?? 15.0),
        deliveryTiers: deliveryTiers,
        businessHours: {
          ...tenantHours,
          open: tenantScheduleStatus.openStr,
          close: tenantScheduleStatus.closeStr,
          isOpenNow: tenantScheduleStatus.isOpen,
          isOpenToday: tenantScheduleStatus.isOpenToday,
          label: tenantScheduleStatus.label
        }
      },
      branches: enrichedBranches,
      contact: {
        address: t.address || (firstBranch && firstBranch.address) || '',
        phone: t.phone || (firstBranch && firstBranch.phone) || '',
        whatsappNumber: t.whatsapp_number || t.phone || (firstBranch && (firstBranch.whatsapp_number || firstBranch.phone)) || '',
        whatsapp_number: t.whatsapp_number || t.phone || (firstBranch && (firstBranch.whatsapp_number || firstBranch.phone)) || '',
        coordinates: {
          lat: Number(t.latitude) || Number(firstBranch?.latitude) || 10.0633,
          lng: Number(t.longitude) || Number(firstBranch?.longitude) || -69.2865
        }
      },
      branding: {
        accentColor: resolvedAccent,
        logoUrl: resolvedLogo,
        bannerUrl: resolvedBanner
      }
    };
  }

  async findAll(includeInactive = false) {
    let query = this.supabase.getClient().from('tenants').select('*, branches(*)').order('name');
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }
    const { data, error } = await query;

    if (error) {
      throw new InternalServerErrorException(`Error fetching tenants: ${error.message}`);
    }
    return (data || []).map(t => this.mergeTenantWithMetadata(t));
  }

  async findBySlug(slug: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('tenants')
      .select('*, branches(*)')
      .eq('slug', slug)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Tenant con slug '${slug}' no encontrado`);
    }
    return this.mergeTenantWithMetadata(data);
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('tenants')
      .select('*, branches(*)')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Tenant con id '${id}' no encontrado`);
    }
    return this.mergeTenantWithMetadata(data);
  }

  async update(id: string, updateData: any) {
    // 1. Guardar metadata local (tagline, moneda, tasa, modo, etc.)
    const metaToSave: Record<string, any> = {};
    if (updateData.tagline !== undefined) metaToSave.tagline = updateData.tagline;
    if (updateData.category !== undefined) metaToSave.category = updateData.category;
    if (updateData.subcategories !== undefined) metaToSave.subcategories = updateData.subcategories;
    if (updateData.exchange_rate !== undefined) metaToSave.exchange_rate = Number(updateData.exchange_rate);
    if (updateData.base_currency !== undefined) metaToSave.base_currency = updateData.base_currency;
    if (updateData.display_mode !== undefined) metaToSave.display_mode = updateData.display_mode;
    if (updateData.is_featured !== undefined || updateData.isFeatured !== undefined) {
      metaToSave.is_featured = Boolean(updateData.is_featured ?? updateData.isFeatured);
    }
    if (updateData.delivery_tiers !== undefined || updateData.deliveryTiers !== undefined) {
      metaToSave.delivery_tiers = updateData.delivery_tiers || updateData.deliveryTiers;
    }
    if (updateData.accepted_payment_methods !== undefined || updateData.acceptedPaymentMethods !== undefined) {
      metaToSave.accepted_payment_methods = updateData.accepted_payment_methods || updateData.acceptedPaymentMethods;
      metaToSave.acceptedPaymentMethods = metaToSave.accepted_payment_methods;
    }
    if (updateData.currency_settings !== undefined || updateData.currencySettings !== undefined) {
      metaToSave.currency_settings = updateData.currency_settings || updateData.currencySettings;
      if (metaToSave.currency_settings?.exchangeRate) {
        metaToSave.exchange_rate = Number(metaToSave.currency_settings.exchangeRate);
      }
      if (metaToSave.currency_settings?.baseCurrency) {
        metaToSave.base_currency = metaToSave.currency_settings.baseCurrency;
      }
      if (metaToSave.currency_settings?.displayMode) {
        metaToSave.display_mode = metaToSave.currency_settings.displayMode;
      }
    }
    if (updateData.business_hours || updateData.businessHours || updateData.openTime || updateData.closeTime || updateData.scheduleDays) {
      const bh = updateData.business_hours || updateData.businessHours || {};
      const sDays = updateData.scheduleDays || bh.scheduleDays || null;
      metaToSave.business_hours = {
        open: updateData.openTime || bh.open || '11:00',
        close: updateData.closeTime || bh.close || '23:00',
        isOpenToday: bh.isOpenToday ?? true,
        scheduleDays: sDays
      };
    }
    if (updateData.plan_code || updateData.planCode || updateData.subscriptionPlanId) {
      const pCode = updateData.plan_code || updateData.planCode || updateData.subscriptionPlanId;
      metaToSave.plan_code = pCode;
      metaToSave.planCode = pCode;
      try {
        const tpPath = path.resolve(process.cwd(), 'data', 'tenant_plans.json');
        let tpMap: Record<string, any> = {};
        if (fs.existsSync(tpPath)) {
          tpMap = JSON.parse(fs.readFileSync(tpPath, 'utf-8'));
        }
        tpMap[id] = pCode;
        fs.writeFileSync(tpPath, JSON.stringify(tpMap, null, 2), 'utf-8');
      } catch (_) {}
    }
    if (Object.keys(metaToSave).length > 0) {
      this.saveTenantMetadata(id, metaToSave);
    }

    // 2. Filtrar únicamente las columnas válidas existentes en la tabla tenants de Supabase
    const allowedColumns = new Set([
      'name', 'slug', 'business_name', 'tax_id', 'phone', 'whatsapp_number',
      'email', 'logo_url', 'banner_url', 'accent_color', 'address',
      'latitude', 'longitude', 'delivery_radius_km', 'base_delivery_fee',
      'delivery_tiers', 'min_order_amount', 'commission_percentage', 'is_active',
      'is_featured', 'subscription_plan_id', 'subscription_status',
      'category', 'subcategories'
    ]);

    const cleanPayload: any = { updated_at: new Date().toISOString() };
    for (const [key, value] of Object.entries(updateData)) {
      if (allowedColumns.has(key) && value !== undefined) {
        cleanPayload[key] = value;
      }
    }
    if (updateData.deliveryTiers !== undefined && cleanPayload.delivery_tiers === undefined) {
      cleanPayload.delivery_tiers = updateData.deliveryTiers;
    }

    // Validar que subscription_plan_id sea un UUID real antes de enviarlo a Supabase
    const isUuid = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    if (cleanPayload.subscription_plan_id && !isUuid(cleanPayload.subscription_plan_id)) {
      delete cleanPayload.subscription_plan_id;
    }

    let data: any = null;
    try {
      const res = await this.supabase
        .getClient()
        .from('tenants')
        .update(cleanPayload)
        .eq('id', id)
        .select('*, branches(*)')
        .maybeSingle();

      if (res.error) {
        console.warn(`[TenantsService] Error updating tenant on Supabase: ${res.error.message}`);
      } else {
        data = res.data;
      }
    } catch (e: any) {
      console.warn(`[TenantsService] Exception updating tenant on Supabase: ${e.message}`);
    }

    if (!data) {
      try {
        data = await this.findById(id);
      } catch (_) {
        data = { id, ...cleanPayload };
      }
    }

    // Sincronizar automáticamente sucursales en la tabla branches si se modificó radio, tarifas, ubicación o teléfono
    try {
      // 1. Parámetros de cobertura y tarifas que aplican a todas las sucursales de la empresa
      const globalDeliveryUpdate: any = { updated_at: new Date().toISOString() };
      if (updateData.delivery_radius_km !== undefined) globalDeliveryUpdate.delivery_radius_km = Number(updateData.delivery_radius_km);
      if (updateData.base_delivery_fee !== undefined) globalDeliveryUpdate.base_delivery_fee = Number(updateData.base_delivery_fee);
      if (updateData.delivery_tiers !== undefined || updateData.deliveryTiers !== undefined) {
        globalDeliveryUpdate.delivery_tiers = updateData.delivery_tiers || updateData.deliveryTiers;
      }

      if (Object.keys(globalDeliveryUpdate).length > 1) {
        await this.supabase
          .getClient()
          .from('branches')
          .update(globalDeliveryUpdate)
          .eq('company_id', id);
      }

      // 2. Parámetros específicos de la sede principal (contacto, dirección y coordenadas matriz)
      const mainBranchUpdate: any = { updated_at: new Date().toISOString() };
      if (updateData.name !== undefined) {
        const cleanBaseName = updateData.name.replace(/(\s*\(Sede Principal\))+/gi, '').trim();
        mainBranchUpdate.name = `${cleanBaseName} (Sede Principal)`;
      }
      if (updateData.address !== undefined) mainBranchUpdate.address = updateData.address;
      if (updateData.latitude !== undefined) mainBranchUpdate.latitude = Number(updateData.latitude);
      if (updateData.longitude !== undefined) mainBranchUpdate.longitude = Number(updateData.longitude);
      if (updateData.phone !== undefined) mainBranchUpdate.phone = updateData.phone;
      if (updateData.whatsapp_number !== undefined) mainBranchUpdate.whatsapp_number = updateData.whatsapp_number;

      if (Object.keys(mainBranchUpdate).length > 1) {
        await this.supabase
          .getClient()
          .from('branches')
          .update(mainBranchUpdate)
          .eq('company_id', id)
          .or('is_main.eq.true,name.ilike.%principal%');
      }
    } catch (bErr) {
      console.warn('[TenantsService] Error sincronizando sucursales en branches:', bErr);
    }

    return this.mergeTenantWithMetadata(data);
  }

  async create(payload: any) {
    const name = payload.name?.trim();
    if (!name) {
      throw new InternalServerErrorException('El nombre del comercio es requerido');
    }

    const slug = (payload.slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-') || `comercio-${Date.now()}`).trim();
    const tenantId = payload.id || crypto.randomUUID();

    // 1. Insertar el comercio en Supabase
    const tenantRecord = {
      id: tenantId,
      slug,
      name,
      business_name: payload.business_name || name,
      phone: payload.whatsapp || payload.phone || '+584120000000',
      whatsapp_number: payload.whatsapp || payload.whatsapp_number || '+584120000000',
      email: payload.owner_email || payload.email || `${slug}@deliveryhub.io`,
      address: payload.address || 'Sede Principal',
      latitude: payload.latitude !== undefined && !isNaN(Number(payload.latitude)) ? Number(payload.latitude) : 10.0777,
      longitude: payload.longitude !== undefined && !isNaN(Number(payload.longitude)) ? Number(payload.longitude) : -69.2812,
      base_delivery_fee: payload.delivery_fee || payload.deliveryFee || 2.50,
      commission_percentage: payload.commission || payload.commission_percentage || 5.0,
      category: payload.category || 'Restaurantes',
      subcategories: payload.subcategories || [],
      is_active: true,
      logo_url: payload.logo_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&auto=format&fit=crop&q=80',
      banner_url: payload.banner_url || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&auto=format&fit=crop&q=80',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: createdTenant, error: tErr } = await this.supabase
      .getClient()
      .from('tenants')
      .insert(tenantRecord)
      .select()
      .single();

    if (tErr) {
      throw new InternalServerErrorException(`Error creando comercio en base de datos: ${tErr.message}`);
    }

    this.saveTenantMetadata(tenantId, {
      category: payload.category || 'Restaurantes',
      subcategories: payload.subcategories || []
    });

    // 1.1 Crear automáticamente la Sede Principal en la tabla branches
    const cleanTenantName = name.replace(/(\s*\(Sede Principal\))+/gi, '').trim();
    const mainBranchId = crypto.randomUUID();
    const mainBranchRecord = {
      id: mainBranchId,
      company_id: tenantId,
      name: `${cleanTenantName} (Sede Principal)`,
      slug: `${slug}-sede-principal`,
      phone: payload.whatsapp || payload.phone || '+584120000000',
      whatsapp_number: payload.whatsapp || payload.whatsapp_number || '+584120000000',
      address: payload.address || 'Sede Principal',
      latitude: payload.latitude !== undefined && !isNaN(Number(payload.latitude)) ? Number(payload.latitude) : 10.0777,
      longitude: payload.longitude !== undefined && !isNaN(Number(payload.longitude)) ? Number(payload.longitude) : -69.2812,
      delivery_radius_km: payload.delivery_radius_km || 8.0,
      base_delivery_fee: payload.delivery_fee || payload.deliveryFee || 2.50,
      min_order_amount: payload.min_order_amount || 5.00,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      await this.supabase.getClient().from('branches').insert(mainBranchRecord);
    } catch (bErr) {
      console.warn('[TenantsService] Error creando sucursal principal:', bErr);
    }

    // 2. Crear automáticamente la cuenta del dueño en Supabase Auth (auth.users)
    const ownerName = payload.owner_name?.trim() || `${name} (Dueño)`;
    const ownerEmail = payload.owner_email?.trim().toLowerCase() || `${slug}@deliveryhub.io`;
    const ownerPassword = payload.owner_password || '123456';
    const ownerPhone = payload.owner_phone || tenantRecord.phone;

    let authUserId: string | null = null;

    // A. Intentar con clave administrativa si está configurada (service_role)
    try {
      const adminAuth = (this.supabase.getClient().auth as any)?.admin;
      if (adminAuth && typeof adminAuth.createUser === 'function') {
        const { data: adminData } = await adminAuth.createUser({
          email: ownerEmail,
          password: ownerPassword,
          email_confirm: true,
          user_metadata: {
            full_name: ownerName,
            role: 'MERCHANT_OWNER',
            tenant_id: tenantId,
            tenant_name: name
          }
        });
        if (adminData?.user) {
          authUserId = adminData.user.id;
        }
      }
    } catch (_) {}

    // B. Alternativa B: Registrar cuenta vía signUp de Supabase Auth
    if (!authUserId) {
      try {
        const { data: suData } = await this.supabase.getClient().auth.signUp({
          email: ownerEmail,
          password: ownerPassword,
          options: {
            data: {
              full_name: ownerName,
              role: 'MERCHANT_OWNER',
              tenant_id: tenantId,
              tenant_name: name
            }
          }
        });
        if (suData?.user) {
          authUserId = suData.user.id;
        }
      } catch (suErr) {
        console.warn('[TenantsService] Error registrando en Supabase Auth:', suErr);
      }
    }

    // 3. Crear registro en la tabla public.profiles
    if (authUserId) {
      try {
        await this.supabase.getClient().from('profiles').upsert({
          id: authUserId,
          tenant_id: tenantId,
          full_name: ownerName,
          email: ownerEmail,
          phone: ownerPhone,
          role: 'MERCHANT_OWNER',
          is_active: true,
          updated_at: new Date().toISOString()
        });
      } catch (pErr) {
        console.warn('[TenantsService] Error creando profile en Supabase:', pErr);
      }
    }

    // 4. Crear registro en store_collaborators
    const finalUserId = authUserId || crypto.randomUUID();
    const ownerRecord = {
      id: finalUserId,
      tenant_id: tenantId,
      branch_id: null,
      name: ownerName,
      email: ownerEmail,
      phone: ownerPhone,
      role: 'MERCHANT_OWNER',
      password_hash: ownerPassword,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      await this.supabase.getClient().from('store_collaborators').upsert(ownerRecord);
    } catch (e) {
      console.warn('[TenantsService] Error creando colaborador dueño:', e);
    }

    // 5. Guardar en almacenamiento local para acceso inmediato
    try {
      const usersPath = path.resolve(process.cwd(), 'data', 'users_storage.json');
      let existingUsers: any[] = [];
      if (fs.existsSync(usersPath)) {
        existingUsers = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
      }
      existingUsers = existingUsers.filter((u: any) => u.email?.toLowerCase() !== ownerEmail);
      existingUsers.push({
        id: finalUserId,
        tenant_id: tenantId,
        branch_id: null,
        branch_name: 'Todas las Sedes (Acceso Global)',
        name: ownerName,
        email: ownerEmail,
        phone: ownerPhone,
        role: 'MERCHANT_OWNER',
        password: ownerPassword,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      fs.writeFileSync(usersPath, JSON.stringify(existingUsers, null, 2), 'utf-8');
    } catch (storageErr) {
      console.warn('[TenantsService] Error actualizando users_storage.json:', storageErr);
    }

    return {
      tenant: createdTenant || tenantRecord,
      owner: {
        id: finalUserId,
        name: ownerName,
        email: ownerEmail,
        password: ownerPassword,
        role: 'MERCHANT_OWNER'
      }
    };
  }

  // ==========================================
  // VALORACIONES, ESTRELLAS Y RESEÑAS REALES
  // ==========================================

  private async resolveTenant(tenantIdOrSlug: string): Promise<any> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantIdOrSlug);
    try {
      if (isUuid) {
        return await this.findById(tenantIdOrSlug);
      }
      return await this.findBySlug(tenantIdOrSlug);
    } catch (_) {
      // Intentar búsqueda rápida directa
      const query = isUuid
        ? this.supabase.getClient().from('tenants').select('*').eq('id', tenantIdOrSlug).maybeSingle()
        : this.supabase.getClient().from('tenants').select('*').eq('slug', tenantIdOrSlug).maybeSingle();
      const { data } = await query;
      return data || null;
    }
  }

  async getTenantReviews(tenantIdOrSlug: string) {
    const tenant = await this.resolveTenant(tenantIdOrSlug);
    const tenantId = tenant?.id || tenantIdOrSlug;

    // 1. Intentar desde Supabase
    try {
      const { data, error } = await this.supabase.getClient()
        .from('tenant_reviews')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (_) { }

    // 2. Fallback a almacenamiento local en JSON
    const local = this.loadLocalReviews();
    return local[tenantId] || [];
  }

  async createTenantReview(tenantIdOrSlug: string, payload: { rating: number; comment?: string; customerName: string; customerPhone?: string; orderId?: string }) {
    const tenant = await this.resolveTenant(tenantIdOrSlug);
    if (!tenant) {
      throw new BadRequestException('Comercio no encontrado para valorar');
    }
    const tenantId = tenant.id;

    const rating = Math.min(5, Math.max(1, Math.round(Number(payload.rating) || 5)));
    const comment = (payload.comment || '').trim();
    const customerName = (payload.customerName || '').trim() || 'Cliente Satisfecho';
    const customerPhone = (payload.customerPhone || '').trim();
    const orderId = payload.orderId || null;

    const newReview = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      order_id: orderId,
      customer_name: customerName,
      customer_phone: customerPhone,
      rating,
      comment,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Guardar en Supabase si la tabla existe
    try {
      await this.supabase.getClient().from('tenant_reviews').insert(newReview);
    } catch (_) { }

    // 2. Guardar en almacenamiento local persistente
    const local = this.loadLocalReviews();
    if (!local[tenantId]) local[tenantId] = [];
    local[tenantId].unshift(newReview);
    this.saveLocalReviews(local);

    // 3. Recalcular promedio y cantidad real de reseñas
    const allReviews = local[tenantId];
    const totalCount = allReviews.length;
    const sumRatings = allReviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0);
    const avgRating = totalCount > 0 ? Number((sumRatings / totalCount).toFixed(1)) : 5.0;

    // 4. Actualizar tabla tenants en Supabase
    try {
      await this.supabase.getClient()
        .from('tenants')
        .update({
          rating: avgRating,
          review_count: totalCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId);
    } catch (_) { }

    // 5. Guardar en metadata
    this.saveTenantMetadata(tenantId, {
      rating: avgRating,
      review_count: totalCount,
      reviewCount: totalCount,
    });

    return {
      success: true,
      message: '¡Valoración enviada exitosamente!',
      review: newReview,
      rating: avgRating,
      reviewCount: totalCount,
    };
  }
}

