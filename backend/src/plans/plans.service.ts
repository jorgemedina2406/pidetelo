import { Injectable, ForbiddenException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import * as fs from 'fs';
import * as path from 'path';

export interface SubscriptionPlan {
  id: string;
  code: 'EMPRENDEDOR' | 'COMERCIO_PRO' | 'FRANQUICIA';
  name: string;
  price_monthly: number;
  price_annual: number;
  monthly_fee_usd: number;
  max_branches: number; // 0 (1 tienda), 2 (3 tiendas), 4 (5 tiendas)
  max_riders: number; // 3, 6, 10
  has_whatsapp_bot: boolean;
  has_excel_reports: boolean;
  has_featured_banners: boolean;
  max_additional_users: number; // 1, 3, 10
  max_monthly_orders: number; // -1 (ilimitados)
  max_products: number; // 150, 500, 500
  extra_branch_price: number; // 12.00
  mass_catalog_price: number; // 5.00
  onboarding_fee: number; // 150.00
  description: string;
  features: string[];
  is_active: boolean;
}

export interface PlatformSettings {
  riderCommissionMode: 'RIDER_PREPAID' | 'MERCHANT_POSTPAID';
  riderCommissionType: 'FIXED' | 'PERCENTAGE';
  riderCommissionValue: number;
  extraBranchPrice: number;
  massCatalogPricePerBranch: number;
  onboardingFee: number;
  updatedAt: string;
}

export interface TenantAddons {
  extraBranches: number;
  hasMassCatalog: boolean;
  hasOnboardingAssistance?: boolean;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  riderCommissionMode: 'RIDER_PREPAID', // Opción A por defecto
  riderCommissionType: 'FIXED',
  riderCommissionValue: 0.50, // $0.50 por carrera de repartidor externo
  extraBranchPrice: 12.00, // $12/mes por sucursal extra (a partir de la 6ta)
  massCatalogPricePerBranch: 5.00, // $5/mes por sucursal para >500 productos
  onboardingFee: 150.00, // $150 tarifa única de migración/onboarding
  updatedAt: new Date().toISOString()
};

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_emprendedor',
    code: 'EMPRENDEDOR',
    name: 'Plan Básico',
    price_monthly: 20.00,
    price_annual: 16.00,
    monthly_fee_usd: 20.00,
    max_branches: 0, // Solo sede principal (1 tienda)
    max_riders: 3, // Hasta 3 motorizados propios
    has_whatsapp_bot: true, // Habilitado para todos los planes
    has_excel_reports: false,
    has_featured_banners: false,
    max_additional_users: 1,
    max_monthly_orders: -1,
    max_products: 150,
    extra_branch_price: 12.00,
    mass_catalog_price: 5.00,
    onboarding_fee: 150.00,
    description: 'Para restaurantes únicos, dark kitchens o comercios que inician con su sede principal.',
    features: [
      '1 tienda / sede incluida (sede principal)',
      'Hasta 150 productos en catálogo',
      'Hasta 3 motorizados propios registrados',
      'Bot automático de WhatsApp 24/7 y Live Chat',
      'Pedidos mensuales ilimitados',
      '1 usuario de equipo adicional (+ dueño)',
      'Tienda web y menú digital QR para mesas',
      'Acceso a la App Móvil de Clientes',
      'Acceso a la App de Repartidores con GPS',
      '0% comisión sobre ventas (pagos 100% directos)',
      'Tracking de entregas en tiempo real',
      'Soporte estándar'
    ],
    is_active: true
  },
  {
    id: 'plan_comercio_pro',
    code: 'COMERCIO_PRO',
    name: 'Plan Mediano',
    price_monthly: 50.00,
    price_annual: 40.00,
    monthly_fee_usd: 50.00,
    max_branches: 2, // 1 principal + 2 sucursales = 3 sedes ($16.67/tienda)
    max_riders: 6, // Hasta 6 motorizados propios
    has_whatsapp_bot: true,
    has_excel_reports: true,
    has_featured_banners: false,
    max_additional_users: 3,
    max_monthly_orders: -1,
    max_products: 500,
    extra_branch_price: 12.00,
    mass_catalog_price: 5.00,
    onboarding_fee: 150.00,
    description: 'Para comercios consolidados que buscan expansión a 3 tiendas y automatización con bot.',
    features: [
      'Hasta 3 tiendas (1 principal + 2 sucursales a $16.67/sede)',
      'Hasta 500 productos por tienda',
      'Hasta 6 motorizados propios registrados',
      'Pedidos mensuales ilimitados',
      'Hasta 3 usuarios de equipo adicionales',
      'Bot automático de WhatsApp 24/7 y Live Chat',
      'Reportes avanzados en Excel (.xlsx)',
      'Pantalla interactiva de Cocina / KDS',
      'Soporte prioritario'
    ],
    is_active: true
  },
  {
    id: 'plan_franquicia',
    code: 'FRANQUICIA',
    name: 'Plan Pro',
    price_monthly: 80.00,
    price_annual: 64.00,
    monthly_fee_usd: 80.00,
    max_branches: 4, // 1 principal + 4 sucursales = 5 sedes ($16.00/tienda)
    max_riders: 10, // Hasta 10 motorizados propios
    has_whatsapp_bot: true,
    has_excel_reports: true,
    has_featured_banners: true,
    max_additional_users: 10,
    max_monthly_orders: -1,
    max_products: 500,
    extra_branch_price: 12.00,
    mass_catalog_price: 5.00,
    onboarding_fee: 150.00,
    description: 'Para cadenas y marcas líderes: hasta 5 tiendas base y escalabilidad ilimitada con add-ons.',
    features: [
      'Hasta 5 tiendas base (1 principal + 4 sucursales a $16.00/sede)',
      'Hasta 500 productos por tienda',
      'Hasta 10 motorizados propios registrados',
      'Pedidos mensuales ilimitados',
      'Hasta 10 usuarios de equipo adicionales',
      'Banners destacados VIP en la App Móvil',
      'Bot WhatsApp con IA y Live Chat Multi-operador',
      'Auditoría de inicios de sesión y BI empresarial',
      'Add-on de sucursales extra por solo +$12/mes a partir de la 6ta',
      'Módulo de catálogo masivo disponible (+500 productos)',
      'Soporte VIP 24/7 con ejecutivo asignado'
    ],
    is_active: true
  }
];

@Injectable()
export class PlansService {
  private localTenantPlansPath = path.join(process.cwd(), 'data', 'tenant_plans.json');
  private platformSettingsPath = path.join(process.cwd(), 'data', 'platform_settings.json');
  private tenantAddonsPath = path.join(process.cwd(), 'data', 'tenant_addons.json');

  constructor(private readonly supabase: SupabaseService) {}

  // -------------------------------------------------------------
  // PLATFORM SETTINGS (Comisión Motorizados y Precios de Add-ons)
  // -------------------------------------------------------------
  getPlatformSettings(): PlatformSettings {
    try {
      if (fs.existsSync(this.platformSettingsPath)) {
        const raw = fs.readFileSync(this.platformSettingsPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_PLATFORM_SETTINGS,
          ...parsed
        };
      }
    } catch (e) {
      console.warn('[PlansService] Error reading platform settings:', e);
    }
    return { ...DEFAULT_PLATFORM_SETTINGS };
  }

  updatePlatformSettings(newSettings: Partial<PlatformSettings>): PlatformSettings {
    try {
      const dir = path.dirname(this.platformSettingsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const current = this.getPlatformSettings();
      const updated: PlatformSettings = {
        ...current,
        ...newSettings,
        updatedAt: new Date().toISOString()
      };

      fs.writeFileSync(this.platformSettingsPath, JSON.stringify(updated, null, 2), 'utf-8');
      return updated;
    } catch (e) {
      console.error('[PlansService] Error saving platform settings:', e);
      throw new InternalServerErrorException('No se pudieron guardar las configuraciones de la plataforma');
    }
  }

  // -------------------------------------------------------------
  // TENANT ADDONS (Sucursales extras & Catálogo Masivo)
  // -------------------------------------------------------------
  private loadAllTenantAddons(): Record<string, TenantAddons> {
    try {
      if (fs.existsSync(this.tenantAddonsPath)) {
        return JSON.parse(fs.readFileSync(this.tenantAddonsPath, 'utf-8'));
      }
    } catch (_) {}
    return {};
  }

  getTenantAddons(tenantId: string): TenantAddons {
    const all = this.loadAllTenantAddons();
    return all[tenantId] || { extraBranches: 0, hasMassCatalog: false, hasOnboardingAssistance: false };
  }

  updateTenantAddons(tenantId: string, addons: Partial<TenantAddons>): TenantAddons {
    try {
      const dir = path.dirname(this.tenantAddonsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const all = this.loadAllTenantAddons();
      const current = all[tenantId] || { extraBranches: 0, hasMassCatalog: false, hasOnboardingAssistance: false };
      const updated: TenantAddons = {
        ...current,
        ...addons
      };
      all[tenantId] = updated;

      fs.writeFileSync(this.tenantAddonsPath, JSON.stringify(all, null, 2), 'utf-8');
      return updated;
    } catch (e) {
      console.error('[PlansService] Error saving tenant addons:', e);
      throw new InternalServerErrorException('No se pudieron guardar los add-ons del comercio');
    }
  }

  // -------------------------------------------------------------
  // TENANT PLANS
  // -------------------------------------------------------------
  private loadLocalTenantPlans(): Record<string, string> {
    try {
      if (fs.existsSync(this.localTenantPlansPath)) {
        return JSON.parse(fs.readFileSync(this.localTenantPlansPath, 'utf-8'));
      }
    } catch (_) {}
    return {};
  }

  private saveLocalTenantPlan(tenantId: string, planCode: string) {
    try {
      const dir = path.dirname(this.localTenantPlansPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const current = this.loadLocalTenantPlans();
      current[tenantId] = planCode;
      fs.writeFileSync(this.localTenantPlansPath, JSON.stringify(current, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[PlansService] Error saving local tenant plan:', e);
    }
  }

  async getAllPlans(): Promise<SubscriptionPlan[]> {
    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        const validCodes = new Set(['EMPRENDEDOR', 'COMERCIO_PRO', 'FRANQUICIA']);
        const valid = data.filter(r => validCodes.has((r.code || '').toUpperCase()));
        if (valid.length > 0) {
          return valid.map(row => this.normalizePlan(row));
        }
      }
    } catch (_) {}

    return DEFAULT_SUBSCRIPTION_PLANS;
  }

  normalizePlan(row: any): SubscriptionPlan {
    let rawCode = (row.code || '').toUpperCase();
    if (rawCode === 'COMERCIO') rawCode = 'COMERCIO_PRO';
    if (rawCode === 'CORPORATIVO') rawCode = 'FRANQUICIA';

    const fallback = DEFAULT_SUBSCRIPTION_PLANS.find(p => p.code === rawCode) || DEFAULT_SUBSCRIPTION_PLANS[0];

    const hasBot = true; // Bot de WhatsApp incluido en todos los planes
    const hasExcel = rawCode === 'FRANQUICIA' || rawCode === 'COMERCIO_PRO';
    const hasBanners = rawCode === 'FRANQUICIA';

    const maxBranches = rawCode === 'FRANQUICIA' ? 4 : (rawCode === 'COMERCIO_PRO' ? 2 : 0);
    const maxRiders = rawCode === 'FRANQUICIA' ? 10 : (rawCode === 'COMERCIO_PRO' ? 6 : 3);
    const maxProducts = rawCode === 'EMPRENDEDOR' ? 150 : 500;
    const priceMonthly = rawCode === 'FRANQUICIA' ? 80.00 : (rawCode === 'COMERCIO_PRO' ? 50.00 : 20.00);
    const priceAnnual = rawCode === 'FRANQUICIA' ? 64.00 : (rawCode === 'COMERCIO_PRO' ? 40.00 : 16.00);

    return {
      id: row.id || fallback.id,
      code: rawCode as any,
      name: rawCode === 'FRANQUICIA' ? 'Plan Pro' : (rawCode === 'COMERCIO_PRO' ? 'Plan Mediano' : 'Plan Básico'),
      price_monthly: Number(row.price_monthly ?? row.monthly_fee_usd ?? priceMonthly),
      price_annual: Number(row.price_annual ?? priceAnnual),
      monthly_fee_usd: Number(row.monthly_fee_usd ?? row.price_monthly ?? priceMonthly),
      max_branches: maxBranches,
      max_riders: maxRiders,
      has_whatsapp_bot: hasBot,
      has_excel_reports: hasExcel,
      has_featured_banners: hasBanners,
      max_additional_users: rawCode === 'FRANQUICIA' ? 10 : (rawCode === 'COMERCIO_PRO' ? 3 : 1),
      max_monthly_orders: -1,
      max_products: maxProducts,
      extra_branch_price: 12.00,
      mass_catalog_price: 5.00,
      onboarding_fee: 150.00,
      description: row.description || fallback.description,
      features: Array.isArray(row.features) && row.features.length > 0 ? row.features : fallback.features,
      is_active: row.is_active !== undefined ? Boolean(row.is_active) : true
    };
  }

  async getPlanByCode(code: string): Promise<SubscriptionPlan> {
    const plans = await this.getAllPlans();
    let norm = (code || '').toUpperCase();
    if (norm === 'COMERCIO') norm = 'COMERCIO_PRO';
    if (norm === 'CORPORATIVO') norm = 'FRANQUICIA';

    const match = plans.find(p => p.code === norm);
    return match || DEFAULT_SUBSCRIPTION_PLANS[0];
  }

  async getTenantPlan(tenantId: string): Promise<SubscriptionPlan> {
    const localPlans = this.loadLocalTenantPlans();
    let planCode = localPlans[tenantId];

    try {
      const client = this.supabase.getClient();
      const { data: tenant } = await client
        .from('tenants')
        .select('id, slug, subscription_plan_id, plan_code, subscription_plans(*)')
        .eq('id', tenantId)
        .maybeSingle();

      if (tenant) {
        if (tenant.plan_code) {
          return this.getPlanByCode(tenant.plan_code);
        }
        if (tenant.subscription_plans) {
          return this.normalizePlan(tenant.subscription_plans);
        }
      }
    } catch (_) {}

    if (planCode) {
      return this.getPlanByCode(planCode);
    }

    return this.getPlanByCode('COMERCIO_PRO');
  }

  async getTenantPlanAndUsage(tenantId: string) {
    const plan = await this.getTenantPlan(tenantId);
    const addons = this.getTenantAddons(tenantId);
    const client = this.supabase.getClient();

    let branchesCount = 0;
    let productsCount = 0;
    let usersCount = 0;
    let monthlyOrdersCount = 0;
    let ownRidersCount = 0;

    try {
      // 1. Contar sucursales adicionales (excluyendo sede principal)
      const { data: branches } = await client
        .from('branches')
        .select('id, is_main')
        .eq('company_id', tenantId);

      if (branches) {
        const additional = branches.filter(b => !b.is_main);
        branchesCount = additional.length;
      }

      // 2. Contar productos
      const { count: prodCount } = await client
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      productsCount = prodCount || 0;

      // 3. Contar usuarios adicionales (excluyendo al dueño)
      const { data: users } = await client
        .from('store_users')
        .select('id, role')
        .eq('company_id', tenantId);
      if (users) {
        usersCount = users.filter(u => u.role !== 'MERCHANT_OWNER').length;
      }

      // 4. Contar pedidos del mes en curso
      const now = new Date();
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      const { count: ordersCount } = await client
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', startOfMonth);
      monthlyOrdersCount = ordersCount || 0;

      // 5. Contar motorizados propios
      const { count: ridersCount } = await client
        .from('riders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      ownRidersCount = ridersCount || 0;
    } catch (e) {
      console.warn('[PlansService] Error counting tenant usage:', e);
    }

    // Límites efectivos considerando Add-ons adquiridos
    const effectiveMaxBranches = plan.max_branches === -1 ? -1 : (plan.max_branches + (addons.extraBranches || 0));
    const effectiveMaxProducts = addons.hasMassCatalog ? 5000 : plan.max_products;
    const effectiveMaxRiders = plan.max_riders;

    return {
      plan,
      addons,
      usage: {
        branchesCount,
        productsCount,
        usersCount,
        monthlyOrdersCount,
        ownRidersCount,
        limits: {
          maxBranches: effectiveMaxBranches,
          baseMaxBranches: plan.max_branches,
          extraBranchesAdded: addons.extraBranches || 0,
          maxProducts: effectiveMaxProducts,
          hasMassCatalog: addons.hasMassCatalog,
          maxRiders: effectiveMaxRiders,
          maxUsers: plan.max_additional_users,
          maxOrders: plan.max_monthly_orders,
          hasWhatsappBot: plan.has_whatsapp_bot,
          hasExcelReports: plan.has_excel_reports,
          hasFeaturedBanners: plan.has_featured_banners
        }
      }
    };
  }

  async checkLimit(tenantId: string, resource: 'branch' | 'product' | 'user' | 'order' | 'rider' | 'whatsapp' | 'excel' | 'banner') {
    const { plan, addons, usage } = await this.getTenantPlanAndUsage(tenantId);
    const settings = this.getPlatformSettings();

    switch (resource) {
      case 'branch':
        const maxBranches = usage.limits.maxBranches;
        if (maxBranches !== -1 && usage.branchesCount >= maxBranches) {
          throw new ForbiddenException(
            `Has alcanzado el límite de sucursales adicionales de tu ${plan.name} (${maxBranches} sucursales permitidas). Puedes habilitar sucursales extras por $${settings.extraBranchPrice}/mes por sede contactando a soporte.`
          );
        }
        break;

      case 'product':
        const maxProducts = usage.limits.maxProducts;
        if (maxProducts !== -1 && usage.productsCount >= maxProducts) {
          throw new ForbiddenException(
            `Has alcanzado el límite de ${maxProducts} productos de tu catálogo. Activa el Módulo de Catálogo Masivo por solo $${settings.massCatalogPricePerBranch}/mes por sucursal para ampliar hasta 5,000 productos.`
          );
        }
        break;

      case 'rider':
        const maxRiders = usage.limits.maxRiders;
        if (maxRiders !== -1 && usage.ownRidersCount >= maxRiders) {
          throw new ForbiddenException(
            `Has alcanzado el límite de ${maxRiders} motorizados propios de tu ${plan.name}. Sube a un plan superior para registrar más repartidores dedicados.`
          );
        }
        break;

      case 'user':
        if (plan.max_additional_users !== -1 && usage.usersCount >= plan.max_additional_users) {
          throw new ForbiddenException(
            `Has alcanzado el límite de ${plan.max_additional_users} usuarios adicionales de tu ${plan.name}. Actualiza a un plan superior para agregar más miembros a tu equipo.`
          );
        }
        break;

      case 'order':
        if (plan.max_monthly_orders !== -1 && usage.monthlyOrdersCount >= plan.max_monthly_orders) {
          throw new ForbiddenException(
            `Este comercio ha completado su cupo mensual de ${plan.max_monthly_orders} pedidos permitidos en su ${plan.name}.`
          );
        }
        break;

      case 'whatsapp':
        // El Bot Automático de WhatsApp está habilitado para todos los planes
        break;

      case 'excel':
        if (!plan.has_excel_reports) {
          throw new ForbiddenException(
            `La exportación de reportes avanzados a Excel (.xlsx) está disponible a partir del Plan Mediano y Plan Pro.`
          );
        }
        break;

      case 'banner':
        if (!plan.has_featured_banners) {
          throw new ForbiddenException(
            `Los banners destacados en la App Móvil son exclusivos para comercios en el Plan Pro.`
          );
        }
        break;
    }

    return { allowed: true, plan, addons };
  }

  async assignPlanToTenant(tenantId: string, planCode: string) {
    const plan = await this.getPlanByCode(planCode);
    this.saveLocalTenantPlan(tenantId, plan.code);

    try {
      const metaPath = path.join(process.cwd(), 'data', 'tenant_metadata.json');
      let meta: Record<string, any> = {};
      if (fs.existsSync(metaPath)) {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      }
      meta[tenantId] = { ...(meta[tenantId] || {}), plan_code: plan.code, planCode: plan.code, subscription_plan_id: plan.code };
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    } catch (_) {}

    try {
      const client = this.supabase.getClient();
      const { error: err1 } = await client
        .from('tenants')
        .update({
          subscription_plan_id: plan.id.startsWith('plan_') ? null : plan.id,
          plan_code: plan.code,
          updated_at: new Date().toISOString()
        })
        .eq('id', tenantId);

      if (err1) {
        await client
          .from('tenants')
          .update({
            subscription_plan_id: plan.id.startsWith('plan_') ? null : plan.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', tenantId);
      }
    } catch (e) {
      console.warn('[PlansService] Error updating plan on supabase tenant:', e);
    }

    return {
      success: true,
      message: `Plan ${plan.name} asignado exitosamente al comercio`,
      planCode: plan.code,
      plan
    };
  }
}
