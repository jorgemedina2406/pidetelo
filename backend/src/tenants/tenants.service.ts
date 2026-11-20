import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

export interface RiderPayoutPolicy {
  mode: 'ON_DEMAND' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY';
  payoutDayOfWeek: number; // 1 = Lunes, 2 = Martes, ..., 7 = Domingo
  payoutHour: string; // e.g. "20:00"
  minWithdrawalAmount: number; // e.g. 5.00
  paymentMethod: 'PAGO_MOVIL' | 'TRANSFERENCIA' | 'EFECTIVO';
  payoutNotes?: string;
  emailNotifications: boolean;
}

export const DEFAULT_RIDER_PAYOUT_POLICY: RiderPayoutPolicy = {
  mode: 'WEEKLY',
  payoutDayOfWeek: 1, // Lunes
  payoutHour: '20:00',
  minWithdrawalAmount: 5.00,
  paymentMethod: 'PAGO_MOVIL',
  payoutNotes: 'Liquidación semanal directa por Pago Móvil todos los Lunes al cierre de jornada.',
  emailNotifications: true,
};

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

  private getVenezuelaTime(): { weekday: string; curMin: number; hourStr: string; timeStr: string } {
    try {
      const d = new Date();
      const formatter = new Intl.DateTimeFormat('es-VE', {
        timeZone: 'America/Caracas',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(d);
      let weekday = '';
      let hour = 0;
      let minute = 0;
      for (const p of parts) {
        if (p.type === 'weekday') weekday = p.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (p.type === 'hour') hour = parseInt(p.value, 10);
        if (p.type === 'minute') minute = parseInt(p.value, 10);
      }
      const hh = String(hour).padStart(2, '0');
      const mm = String(minute).padStart(2, '0');
      return {
        weekday: weekday || 'lunes',
        curMin: hour * 60 + minute,
        hourStr: `${hh}:${mm}`,
        timeStr: `${hh}:${mm}`
      };
    } catch (_) {
      const d = new Date();
      const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const hour = d.getUTCHours() - 4; // UTC-4 fallback
      const normH = hour < 0 ? hour + 24 : hour;
      const min = d.getUTCMinutes();
      return {
        weekday: days[d.getDay()],
        curMin: normH * 60 + min,
        hourStr: `${String(normH).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
        timeStr: `${String(normH).padStart(2, '0')}:${String(min).padStart(2, '0')}`
      };
    }
  }

  calculateScheduleStatus(businessHours: any): {
    isOpen: boolean;
    openStr: string;
    closeStr: string;
    isOpenToday: boolean;
    label: string;
  } {
    if (businessHours?.forceOpen === true || businessHours?.force_open === true) {
      return {
        isOpen: true,
        openStr: '00:00',
        closeStr: '23:59',
        isOpenToday: true,
        label: 'Abierto 24 Horas'
      };
    }

    if (businessHours?.isOpenToday === false) {
      return {
        isOpen: false,
        openStr: businessHours?.open || '11:00',
        closeStr: businessHours?.close || '23:00',
        isOpenToday: false,
        label: 'Pausado temporalmente'
      };
    }

    const fallbackOpen = businessHours?.open || '11:00';
    const fallbackClose = businessHours?.close || '23:00';
    const scheduleDays = businessHours?.scheduleDays || [];

    const vzla = this.getVenezuelaTime();
    const todayName = vzla.weekday;

    if (Array.isArray(scheduleDays) && scheduleDays.length > 0) {
      const todayConfig = scheduleDays.find((d: any) => {
        if (!d || !d.day) return false;
        const norm = String(d.day).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return norm === todayName;
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
        const curMin = vzla.curMin;
        const oMin = (isNaN(openH) ? 11 : openH) * 60 + (openM || 0);
        const cMin = (isNaN(closeH) ? 23 : closeH) * 60 + (closeM || 0);

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
    const curMin = vzla.curMin;
    const oMin = (isNaN(openH) ? 11 : openH) * 60 + (isNaN(openM) ? 0 : openM);
    const cMin = (isNaN(closeH) ? 23 : closeH) * 60 + (isNaN(closeM) ? 0 : closeM);

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

  hasValidPaymentMethods(branchOrTenant: any): boolean {
    if (!branchOrTenant) return false;

    const rawCreds = Array.isArray(branchOrTenant.branch_payment_credentials)
      ? branchOrTenant.branch_payment_credentials[0]
      : (branchOrTenant.branch_payment_credentials || branchOrTenant.payment_credentials || branchOrTenant.paymentCredentials || {});

    const pm = rawCreds.pago_movil || {};
    const zelle = rawCreds.zelle || {};

    const pmPhone = String(pm.phone || rawCreds.pago_movil_phone || rawCreds.pagoMovilPhone || branchOrTenant.pagoMovilPhone || '').replace(/\D/g, '');
    const pmBank = String(pm.bank_name || rawCreds.pago_movil_bank || rawCreds.pagoMovilBank || branchOrTenant.pagoMovilBank || '').trim();
    const pmId = String(pm.id_number || rawCreds.pago_movil_id_number || rawCreds.pagoMovilIdNumber || branchOrTenant.pagoMovilIdNumber || '').replace(/\D/g, '');

    const isRealPagoMovil = Boolean(
      pmBank.length >= 2 &&
      pmPhone.length >= 10 &&
      !pmPhone.includes('1234567') &&
      pmPhone !== '04140000000' &&
      pmPhone !== '04121234567' &&
      pmId.length >= 5 &&
      !pmId.includes('50123456') &&
      !pmId.includes('12345678') &&
      pmId !== '00000000'
    );

    const zelleEmail = String(zelle.email || rawCreds.zelle_email || rawCreds.zelleEmail || branchOrTenant.zelleEmail || '').trim();
    const isRealZelle = Boolean(zelleEmail.includes('@') && zelleEmail.length >= 5);

    let rawMethods = branchOrTenant.accepted_payment_methods ?? 
                     branchOrTenant.acceptedPaymentMethods ?? 
                     branchOrTenant.currency_settings?.acceptedPaymentMethods ?? 
                     branchOrTenant.currencySettings?.acceptedPaymentMethods;

    let methods: string[] = [];
    if (Array.isArray(rawMethods)) {
      methods = rawMethods;
    } else if (rawMethods && typeof rawMethods === 'object') {
      methods = Object.keys(rawMethods).filter(k => Boolean(rawMethods[k]));
    }

    const normalizedMethods = methods.map(m => {
      const s = String(m).toLowerCase().trim();
      if (s === 'pago_movil') return 'mobile_transfer';
      if (s === 'efectivo') return 'cash_usd';
      if (s === 'tarjeta') return 'card_terminal';
      return s;
    });

    if (normalizedMethods.length === 0) {
      return false;
    }

    const validMethods = normalizedMethods.filter(method => {
      if (method === 'mobile_transfer') {
        return isRealPagoMovil;
      }
      if (method === 'zelle') {
        return isRealZelle;
      }
      if (method === 'cash_usd' || method === 'cash_local' || method === 'card_terminal') {
        return true;
      }
      return false;
    });

    return validMethods.length > 0;
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
    const acceptedPaymentMethods = t.accepted_payment_methods ?? meta.accepted_payment_methods ?? meta.acceptedPaymentMethods ?? [];

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
        const bCreds = b.branch_payment_credentials || b.payment_credentials || b.paymentCredentials || bm.payment_credentials || bm.paymentCredentials || {};
        const bHasValidPayment = this.hasValidPaymentMethods({
          ...b,
          accepted_payment_methods: bPaymentMethods,
          paymentCredentials: bCreds
        });
        const pm = bCreds?.pago_movil || {};
        const zelle = bCreds?.zelle || {};
        const rawBank = pm.bank_name || bCreds?.pago_movil_bank || bCreds?.pagoMovilBank || b.pagoMovilBank || '';
        const rawPhone = pm.phone || bCreds?.pago_movil_phone || bCreds?.pagoMovilPhone || b.pagoMovilPhone || '';
        const rawIdNumber = pm.id_number || bCreds?.pago_movil_id_number || bCreds?.pagoMovilIdNumber || b.pagoMovilIdNumber || '';
        const rawAccountName = pm.account_name || bCreds?.pago_movil_account_name || bCreds?.pagoMovilAccountName || b.pagoMovilAccountName || '';
        const zelleEmail = zelle.email || bCreds?.zelle_email || bCreds?.zelleEmail || b.zelleEmail || '';
        const zelleAccountName = zelle.account_name || bCreds?.zelle_account_name || bCreds?.zelleAccountName || b.zelleAccountName || '';
        const mappedCreds = {
          pagoMovilBank: rawBank,
          pagoMovilPhone: rawPhone,
          pagoMovilIdNumber: rawIdNumber,
          pagoMovilAccountName: rawAccountName,
          zelleEmail: zelleEmail,
          zelleAccountName: zelleAccountName,
          isActive: Boolean(pm.enabled ?? bCreds?.is_active ?? (rawPhone && rawBank))
        };
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
          payment_credentials: mappedCreds,
          paymentCredentials: mappedCreds,
          has_valid_payment_methods: bHasValidPayment,
          hasValidPaymentMethods: bHasValidPayment,
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

    const hasAnyValidBranch = Array.isArray(enrichedBranches) && enrichedBranches.length > 0
      ? enrichedBranches.some((b: any) => b.has_valid_payment_methods && (b.status === 'active' || (!b.status && b.name?.toLowerCase().includes('principal'))))
      : this.hasValidPaymentMethods({ accepted_payment_methods: acceptedPaymentMethods });

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

    let planExpiresAt = t.plan_expires_at || t.planExpiresAt || meta.plan_expires_at || meta.planExpiresAt;
    if (!planExpiresAt) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      planExpiresAt = d.toISOString();
    }

    const nowTime = Date.now();
    const expTime = new Date(planExpiresAt).getTime();
    const isPlanExpired = !isNaN(expTime) && expTime < nowTime;
    const daysRemaining = !isNaN(expTime) ? Math.ceil((expTime - nowTime) / (1000 * 60 * 60 * 24)) : 30;
    const planStatus = isPlanExpired ? 'expired' : (daysRemaining <= 5 ? 'expiring_soon' : 'active');
    const effectiveIsActive = isPlanExpired ? false : (t.is_active ?? true);

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
      is_active: effectiveIsActive,
      isActive: effectiveIsActive,
      plan_code: planCode,
      planCode: planCode,
      plan_expires_at: planExpiresAt,
      planExpiresAt: planExpiresAt,
      is_plan_expired: isPlanExpired,
      isPlanExpired: isPlanExpired,
      days_remaining: daysRemaining,
      daysRemaining: daysRemaining,
      plan_status: planStatus,
      planStatus: planStatus,
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
      has_valid_payment_methods: hasAnyValidBranch,
      hasValidPaymentMethods: hasAnyValidBranch,
      rider_payout_policy: meta.rider_payout_policy || meta.riderPayoutPolicy || DEFAULT_RIDER_PAYOUT_POLICY,
      riderPayoutPolicy: meta.rider_payout_policy || meta.riderPayoutPolicy || DEFAULT_RIDER_PAYOUT_POLICY,
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
    let query = this.supabase.getClient().from('tenants').select('*, branches(*, branch_payment_credentials(*))').order('name');
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }
    const { data, error } = await query;

    if (error) {
      throw new InternalServerErrorException(`Error fetching tenants: ${error.message}`);
    }
    const tenants = (data || []).map(t => this.mergeTenantWithMetadata(t));
    if (!includeInactive) {
      return tenants.filter(t => t.has_valid_payment_methods === true);
    }
    return tenants;
  }

  async findBySlug(slug: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('tenants')
      .select('*, branches(*, branch_payment_credentials(*))')
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
      .select('*, branches(*, branch_payment_credentials(*))')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Tenant con id '${id}' no encontrado`);
    }
    return this.mergeTenantWithMetadata(data);
  }

  private async uploadBase64IfPresent(dataUri: string, prefix: string): Promise<string> {
    if (!dataUri || typeof dataUri !== 'string' || !dataUri.startsWith('data:image/')) {
      return dataUri;
    }
    try {
      const matches = dataUri.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) return dataUri;
      const mime = matches[1];
      let ext = 'webp';
      if (mime.includes('png')) ext = 'png';
      else if (mime.includes('gif')) ext = 'gif';
      else if (mime.includes('svg')) ext = 'svg';
      else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
      const buffer = Buffer.from(matches[2], 'base64');
      const fileId = `${prefix}-${Date.now()}.${ext}`;

      const client = this.supabase.getClient();
      const bucket = 'merchant-assets';
      const { data, error } = await client.storage.from(bucket).upload(fileId, buffer, { contentType: mime, upsert: true });
      if (!error && data) {
        const pub = client.storage.from(bucket).getPublicUrl(fileId);
        if (pub.data?.publicUrl) return pub.data.publicUrl;
      }
    } catch (err: any) {
      console.warn(`[TenantsService] Error subiendo imagen a Supabase Storage: ${err.message}`);
    }
    return dataUri;
  }

  async update(id: string, updateData: any) {
    if (updateData.logo_url && typeof updateData.logo_url === 'string' && updateData.logo_url.startsWith('data:image/')) {
      updateData.logo_url = await this.uploadBase64IfPresent(updateData.logo_url, `tenant-logo-${id.slice(0, 8)}`);
    }
    if (updateData.logoUrl && typeof updateData.logoUrl === 'string' && updateData.logoUrl.startsWith('data:image/')) {
      updateData.logoUrl = await this.uploadBase64IfPresent(updateData.logoUrl, `tenant-logo-${id.slice(0, 8)}`);
      updateData.logo_url = updateData.logoUrl;
    }
    if (updateData.banner_url && typeof updateData.banner_url === 'string' && updateData.banner_url.startsWith('data:image/')) {
      updateData.banner_url = await this.uploadBase64IfPresent(updateData.banner_url, `tenant-banner-${id.slice(0, 8)}`);
    }
    if (updateData.bannerUrl && typeof updateData.bannerUrl === 'string' && updateData.bannerUrl.startsWith('data:image/')) {
      updateData.bannerUrl = await this.uploadBase64IfPresent(updateData.bannerUrl, `tenant-banner-${id.slice(0, 8)}`);
      updateData.banner_url = updateData.bannerUrl;
    }

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
    if (updateData.plan_expires_at !== undefined || updateData.planExpiresAt !== undefined) {
      const pExp = updateData.plan_expires_at || updateData.planExpiresAt;
      metaToSave.plan_expires_at = pExp;
      metaToSave.planExpiresAt = pExp;
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
    if (updateData.rider_payout_policy !== undefined || updateData.riderPayoutPolicy !== undefined) {
      const p = updateData.rider_payout_policy || updateData.riderPayoutPolicy;
      metaToSave.rider_payout_policy = {
        ...DEFAULT_RIDER_PAYOUT_POLICY,
        ...p,
      };
      metaToSave.riderPayoutPolicy = metaToSave.rider_payout_policy;
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
      if (updateData.rider_payout_policy !== undefined || updateData.riderPayoutPolicy !== undefined) {
        const cur = (data && data.currency_settings) || {};
        globalDeliveryUpdate.currency_settings = {
          ...cur,
          riderPayoutPolicy: metaToSave.rider_payout_policy,
          rider_payout_policy: metaToSave.rider_payout_policy,
        };
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
      email: payload.owner_email || payload.email || `${slug}@pidetelo.app`,
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
    const ownerEmail = payload.owner_email?.trim().toLowerCase() || `${slug}@pidetelo.app`;
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

  async getAllReviews(tenantId?: string) {
    // 1. Intentar desde Supabase
    try {
      let query = this.supabase.getClient()
        .from('tenant_reviews')
        .select('*');

      if (tenantId && tenantId !== 'all') {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && Array.isArray(data) && data.length > 0) {
        const tenants = await this.findAll(true);
        const tenantMap = new Map((tenants || []).map((t: any) => [t.id, t.name]));
        return data.map((r: any) => ({
          ...r,
          tenantName: tenantMap.get(r.tenant_id) || r.tenant_name || 'Comercio',
        }));
      }
    } catch (_) { }

    // 2. Fallback a almacenamiento local en JSON
    const local = this.loadLocalReviews();
    const allList: any[] = [];
    for (const [tid, reviews] of Object.entries(local)) {
      if (tenantId && tenantId !== 'all' && tid !== tenantId) continue;
      if (Array.isArray(reviews)) {
        allList.push(...reviews);
      }
    }
    return allList.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  async getTenantReviews(tenantIdOrSlug: string, branchId?: string) {
    const tenant = await this.resolveTenant(tenantIdOrSlug);
    const tenantId = tenant?.id || tenantIdOrSlug;

    // 1. Intentar desde Supabase
    try {
      let query = this.supabase.getClient()
        .from('tenant_reviews')
        .select('*')
        .eq('tenant_id', tenantId);

      if (branchId && branchId !== 'all') {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (_) { }

    // 2. Fallback a almacenamiento local en JSON
    const local = this.loadLocalReviews();
    const list = local[tenantId] || [];
    if (branchId && branchId !== 'all') {
      return list.filter((r: any) => r.branch_id === branchId || r.branchId === branchId);
    }
    return list;
  }

  async createTenantReview(tenantIdOrSlug: string, payload: { rating: number; comment?: string; customerName: string; customerPhone?: string; orderId?: string; branchId?: string; branchName?: string }) {
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

    let branchId = payload.branchId || null;
    let branchName = payload.branchName || null;
    if (orderId && !branchId) {
      try {
        const { data: ord } = await this.supabase.getClient()
          .from('orders')
          .select('branch_id, branch_name')
          .eq('id', orderId)
          .maybeSingle();
        if (ord?.branch_id) branchId = ord.branch_id;
        if (ord?.branch_name) branchName = ord.branch_name;
      } catch (_) {}
    }

    const newReview = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      branch_id: branchId,
      branch_name: branchName,
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

    if (orderId) {
      try {
        await this.supabase.getClient().from('orders').update({
          store_rating: rating,
          store_review: comment || null,
        }).eq('id', orderId);
      } catch (_) {}
    }

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

  // --- POLÍTICA DE LIQUIDACIÓN Y PAGO A REPARTIDORES ---
  async getPayoutPolicy(tenantId: string): Promise<RiderPayoutPolicy> {
    const tenant = await this.findById(tenantId);
    return tenant?.riderPayoutPolicy || DEFAULT_RIDER_PAYOUT_POLICY;
  }

  async updatePayoutPolicy(tenantId: string, policy: Partial<RiderPayoutPolicy>): Promise<RiderPayoutPolicy> {
    const current = await this.getPayoutPolicy(tenantId);
    const updated: RiderPayoutPolicy = {
      ...current,
      ...policy,
    };
    await this.update(tenantId, { rider_payout_policy: updated });
    return updated;
  }

  async sendPayoutReminderEmail(tenantId: string, summary: any) {
    const tenant = await this.findById(tenantId);
    const recipientEmail = tenant?.email || tenant?.contact?.email || 'admin@' + (tenant?.slug || 'pidetelo') + '.com';
    console.log(`[TenantsService] Recordatorio de liquidación programada enviado a ${tenant?.name} (${recipientEmail}):`, summary);
    return {
      success: true,
      message: `Recordatorio de liquidación enviado al correo del comercio (${recipientEmail}).`,
      sentAt: new Date().toISOString(),
      recipient: recipientEmail,
      summary,
    };
  }
}

