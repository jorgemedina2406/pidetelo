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
  max_branches: number; // 0, 2, -1 (unlimited)
  has_whatsapp_bot: boolean;
  has_excel_reports: boolean;
  has_featured_banners: boolean;
  max_additional_users: number; // 1, 3, -1
  max_monthly_orders: number; // 20, 50, -1
  max_products: number; // 20, 100, -1
  description: string;
  features: string[];
  is_active: boolean;
}

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_emprendedor',
    code: 'EMPRENDEDOR',
    name: 'Plan Emprendedor',
    price_monthly: 9.00,
    price_annual: 7.00,
    monthly_fee_usd: 9.00,
    max_branches: 0,
    has_whatsapp_bot: false,
    has_excel_reports: false,
    has_featured_banners: false,
    max_additional_users: 1,
    max_monthly_orders: 20,
    max_products: 20,
    description: 'Para negocios y marcas que inician con su sede principal.',
    features: [
      '0 sucursales adicionales (solo sede principal)',
      'Hasta 20 productos en catálogo',
      'Hasta 20 pedidos al mes',
      '1 usuario de equipo adicional',
      'Tienda web y menú digital con código QR',
      'Acceso a la App Móvil de Clientes',
      'Acceso a la App de Repartidores con GPS',
      'Pagos 100% directos (0% comisión sobre ventas)',
      'Tracking de pedidos en tiempo real',
      'Soporte estándar'
    ],
    is_active: true
  },
  {
    id: 'plan_comercio_pro',
    code: 'COMERCIO_PRO',
    name: 'Plan Comercio Pro',
    price_monthly: 29.00,
    price_annual: 23.00,
    monthly_fee_usd: 29.00,
    max_branches: 2,
    has_whatsapp_bot: true,
    has_excel_reports: true,
    has_featured_banners: false,
    max_additional_users: 3,
    max_monthly_orders: 50,
    max_products: 100,
    description: 'Para comercios establecidos que buscan automatización y expansión local.',
    features: [
      'Todo lo incluido en el Plan Emprendedor',
      'Hasta 2 sucursales adicionales (3 sedes en total)',
      'Hasta 100 productos en catálogo',
      'Hasta 50 pedidos al mes',
      'Hasta 3 usuarios de equipo adicionales',
      'Bot automático de WhatsApp y Live Chat 24/7',
      'Reportes avanzados en Excel (.xlsx)',
      'Soporte prioritario'
    ],
    is_active: true
  },
  {
    id: 'plan_franquicia',
    code: 'FRANQUICIA',
    name: 'Plan Franquicia',
    price_monthly: 79.00,
    price_annual: 63.00,
    monthly_fee_usd: 79.00,
    max_branches: -1,
    has_whatsapp_bot: true,
    has_excel_reports: true,
    has_featured_banners: true,
    max_additional_users: -1,
    max_monthly_orders: -1,
    max_products: -1,
    description: 'Para cadenas gastronómicas, franquicias y marcas líderes de alto volumen.',
    features: [
      'Todo lo incluido en el Plan Comercio Pro',
      'Sucursales físicas ilimitadas',
      'Productos en catálogo ilimitados',
      'Pedidos al mes ilimitados',
      'Cuentas de usuarios de equipo ilimitadas',
      'Banners destacados VIP en la App Móvil',
      'Bot automático de WhatsApp ilimitado con IA',
      'Auditoría de inicios de sesión y BI empresarial',
      'Soporte VIP 24/7 con ejecutivo asignado'
    ],
    is_active: true
  }
];

@Injectable()
export class PlansService {
  private localTenantPlansPath = path.join(process.cwd(), 'data', 'tenant_plans.json');

  constructor(private readonly supabase: SupabaseService) {}

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

    const hasBot = rawCode === 'FRANQUICIA' || rawCode === 'COMERCIO_PRO';
    const hasExcel = rawCode === 'FRANQUICIA' || rawCode === 'COMERCIO_PRO';
    const hasBanners = rawCode === 'FRANQUICIA';

    return {
      id: row.id || fallback.id,
      code: rawCode as any,
      name: rawCode === 'FRANQUICIA' ? 'Plan Franquicia' : (rawCode === 'COMERCIO_PRO' ? 'Plan Comercio Pro' : 'Plan Emprendedor'),
      price_monthly: Number(row.price_monthly ?? row.monthly_fee_usd ?? fallback.price_monthly),
      price_annual: Number(row.price_annual ?? fallback.price_annual),
      monthly_fee_usd: Number(row.monthly_fee_usd ?? row.price_monthly ?? fallback.monthly_fee_usd),
      max_branches: rawCode === 'FRANQUICIA' ? -1 : (rawCode === 'COMERCIO_PRO' ? 2 : 0),
      has_whatsapp_bot: hasBot,
      has_excel_reports: hasExcel,
      has_featured_banners: hasBanners,
      max_additional_users: rawCode === 'FRANQUICIA' ? -1 : (rawCode === 'COMERCIO_PRO' ? 3 : 1),
      max_monthly_orders: rawCode === 'FRANQUICIA' ? -1 : (rawCode === 'COMERCIO_PRO' ? 50 : 20),
      max_products: rawCode === 'FRANQUICIA' ? -1 : (rawCode === 'COMERCIO_PRO' ? 100 : 20),
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

    // Default: Si es Burger Lab demo le asignamos COMERCIO_PRO; por defecto EMPRENDEDOR
    return this.getPlanByCode('COMERCIO_PRO');
  }

  async getTenantPlanAndUsage(tenantId: string) {
    const plan = await this.getTenantPlan(tenantId);
    const client = this.supabase.getClient();

    let branchesCount = 0;
    let productsCount = 0;
    let usersCount = 0;
    let monthlyOrdersCount = 0;

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
    } catch (e) {
      console.warn('[PlansService] Error counting tenant usage:', e);
    }

    return {
      plan,
      usage: {
        branchesCount,
        productsCount,
        usersCount,
        monthlyOrdersCount,
        limits: {
          maxBranches: plan.max_branches,
          maxProducts: plan.max_products,
          maxUsers: plan.max_additional_users,
          maxOrders: plan.max_monthly_orders,
          hasWhatsappBot: plan.has_whatsapp_bot,
          hasExcelReports: plan.has_excel_reports,
          hasFeaturedBanners: plan.has_featured_banners
        }
      }
    };
  }

  async checkLimit(tenantId: string, resource: 'branch' | 'product' | 'user' | 'order' | 'whatsapp' | 'excel' | 'banner') {
    const { plan, usage } = await this.getTenantPlanAndUsage(tenantId);

    switch (resource) {
      case 'branch':
        if (plan.max_branches !== -1 && usage.branchesCount >= plan.max_branches) {
          throw new ForbiddenException(
            `Has alcanzado el límite de sucursales adicionales de tu ${plan.name} (${plan.max_branches} sucursales permitidas aparte de la sede principal). Actualiza tu plan a Franquicia para sucursales ilimitadas.`
          );
        }
        break;

      case 'product':
        if (plan.max_products !== -1 && usage.productsCount >= plan.max_products) {
          throw new ForbiddenException(
            `Has alcanzado el límite de ${plan.max_products} productos de tu ${plan.name}. Actualiza a un plan superior para publicar más artículos en tu catálogo.`
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
            `Este comercio ha completado su cupo mensual de ${plan.max_monthly_orders} pedidos permitidos en su ${plan.name}. Por favor contacta al comercio para más información.`
          );
        }
        break;

      case 'whatsapp':
        if (!plan.has_whatsapp_bot) {
          throw new ForbiddenException(
            `El Bot Automático de WhatsApp está reservado para los planes Comercio Pro y Franquicia. Actualiza tu plan para activar respuestas automáticas y live chat.`
          );
        }
        break;

      case 'excel':
        if (!plan.has_excel_reports) {
          throw new ForbiddenException(
            `La exportación de reportes avanzados a Excel (.xlsx) está disponible únicamente en los planes Comercio Pro y Franquicia.`
          );
        }
        break;

      case 'banner':
        if (!plan.has_featured_banners) {
          throw new ForbiddenException(
            `Los banners destacados en la App Móvil son exclusivos para comercios en Plan Franquicia.`
          );
        }
        break;
    }

    return { allowed: true, plan };
  }

  async assignPlanToTenant(tenantId: string, planCode: string) {
    const plan = await this.getPlanByCode(planCode);
    this.saveLocalTenantPlan(tenantId, plan.code);

    // Guardar también en tenant_metadata.json
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
      // Intentar actualizar con plan_code y subscription_plan_id
      const { error: err1 } = await client
        .from('tenants')
        .update({
          subscription_plan_id: plan.id.startsWith('plan_') ? null : plan.id,
          plan_code: plan.code,
          updated_at: new Date().toISOString()
        })
        .eq('id', tenantId);

      if (err1) {
        // Fallback por si la columna plan_code no existe todavía en Supabase
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

