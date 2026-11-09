import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface LoginLogPayload {
  userId?: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  role: 'customer' | 'merchant_owner' | 'branch_manager' | 'cashier' | 'rider' | 'superadmin' | string;
  platform: 'mobile_app_flutter' | 'web_store' | 'merchant_admin' | 'super_admin' | string;
  deviceInfo?: string;
  ipAddress?: string;
  status?: 'success' | 'failed';
}

@Injectable()
export class MetricsService {
  private loginActivityPath = path.join(process.cwd(), 'data', 'login_activity.json');

  constructor(private readonly supabase: SupabaseService) {
    this.ensureStorage();
  }

  private ensureStorage() {
    try {
      const dir = path.dirname(this.loginActivityPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(this.loginActivityPath)) {
        fs.writeFileSync(this.loginActivityPath, '[]', 'utf-8');
      }
    } catch (_) {}
  }

  private loadLocalLogins(): any[] {
    try {
      this.ensureStorage();
      return JSON.parse(fs.readFileSync(this.loginActivityPath, 'utf-8'));
    } catch (_) {
      return [];
    }
  }

  private saveLocalLogins(data: any[]) {
    try {
      this.ensureStorage();
      fs.writeFileSync(this.loginActivityPath, JSON.stringify(data.slice(0, 5000), null, 2), 'utf-8');
    } catch (e) {
      console.warn('[MetricsService] Error guardando login_activity.json:', e);
    }
  }

  // ==========================================
  // 1. REGISTRO & CONTROL DE INICIOS DE SESIÓN
  // ==========================================

  async recordLogin(payload: LoginLogPayload) {
    const record = {
      id: crypto.randomUUID(),
      user_id: payload.userId || null,
      user_name: payload.userName || 'Usuario',
      user_email: payload.userEmail || null,
      user_phone: payload.userPhone || null,
      role: payload.role || 'customer',
      platform: payload.platform || 'web_store',
      device_info: payload.deviceInfo || 'Dispositivo web / móvil',
      ip_address: payload.ipAddress || null,
      status: payload.status || 'success',
      login_at: new Date().toISOString(),
    };

    // 1. Guardar en Supabase si la tabla existe
    try {
      await this.supabase.getClient().from('platform_login_logs').insert(record);
    } catch (_) {}

    // 2. Guardar en almacenamiento local en disco
    const list = this.loadLocalLogins();
    list.unshift(record);
    this.saveLocalLogins(list);

    return { success: true, log: record };
  }

  async getLoginActivity(filter: {
    role?: string;
    platform?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    limit?: number;
  }) {
    let logs: any[] = [];

    // 1. Intentar consultar desde Supabase
    try {
      let query = this.supabase.getClient()
        .from('platform_login_logs')
        .select('*')
        .order('login_at', { ascending: false });

      if (filter.role && filter.role !== 'all') {
        query = query.eq('role', filter.role);
      }
      if (filter.platform && filter.platform !== 'all') {
        query = query.eq('platform', filter.platform);
      }
      if (filter.startDate) {
        query = query.gte('login_at', filter.startDate);
      }
      if (filter.endDate) {
        query = query.lte('login_at', filter.endDate);
      }
      if (filter.search) {
        query = query.or(`user_name.ilike.%${filter.search}%,user_email.ilike.%${filter.search}%,user_phone.ilike.%${filter.search}%`);
      }

      const { data, error } = await query.limit(filter.limit || 500);
      if (!error && Array.isArray(data) && data.length > 0) {
        logs = data;
      }
    } catch (_) {}

    // 2. Fallback a almacenamiento local
    if (logs.length === 0) {
      logs = this.loadLocalLogins();

      if (filter.role && filter.role !== 'all') {
        logs = logs.filter(l => l.role === filter.role);
      }
      if (filter.platform && filter.platform !== 'all') {
        logs = logs.filter(l => l.platform === filter.platform);
      }
      if (filter.startDate) {
        const start = new Date(filter.startDate).getTime();
        logs = logs.filter(l => new Date(l.login_at).getTime() >= start);
      }
      if (filter.endDate) {
        const end = new Date(filter.endDate).getTime();
        logs = logs.filter(l => new Date(l.login_at).getTime() <= end);
      }
      if (filter.search) {
        const s = filter.search.toLowerCase();
        logs = logs.filter(l =>
          (l.user_name && l.user_name.toLowerCase().includes(s)) ||
          (l.user_email && l.user_email.toLowerCase().includes(s)) ||
          (l.user_phone && l.user_phone.toLowerCase().includes(s))
        );
      }
    }

    // Resumen de estadísticas de inicio de sesión
    const totalLogins = logs.length;
    const customerLogins = logs.filter(l => l.role === 'customer').length;
    const merchantLogins = logs.filter(l => l.role === 'merchant_owner' || l.role === 'branch_manager' || l.role === 'cashier').length;
    const riderLogins = logs.filter(l => l.role === 'rider').length;
    const superAdminLogins = logs.filter(l => l.role === 'superadmin' || l.role === 'super_admin').length;

    const mobileAppLogins = logs.filter(l => l.platform === 'mobile_app_flutter').length;
    const webLogins = logs.filter(l => l.platform !== 'mobile_app_flutter').length;

    return {
      summary: {
        totalLogins,
        customerLogins,
        merchantLogins,
        riderLogins,
        superAdminLogins,
        mobileAppLogins,
        webLogins,
      },
      logs: logs.slice(0, filter.limit || 300),
    };
  }

  // ==========================================
  // 2. REPORTE FILTRABLE DE PEDIDOS POR COMERCIO
  // ==========================================

  async getOrdersReport(filter: {
    tenantId?: string;
    branchId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    fulfillmentType?: string;
  }) {
    const client = this.supabase.getClient();

    // 1. Obtener Comercios y Sucursales para resolver nombres
    let tenants: any[] = [];
    try {
      const { data } = await client.from('tenants').select('id, name, slug, commission, is_active');
      if (data) tenants = data;
    } catch (_) {}

    let branches: any[] = [];
    try {
      const { data } = await client.from('branches').select('id, company_id, name, is_active');
      if (data) branches = data;
    } catch (_) {}

    let riders: any[] = [];
    try {
      const { data } = await client.from('riders').select('id, name, vehicle_plate, phone, rating');
      if (data) riders = data;
    } catch (_) {}

    const tenantMap = new Map<string, any>(tenants.map(t => [t.id, t]));
    const branchMap = new Map<string, any>(branches.map(b => [b.id, b]));
    const riderMap = new Map<string, any>(riders.map(r => [r.id, r]));

    // 2. Consultar pedidos con filtros dinámicos
    let ordersQuery = client.from('orders').select('*').order('created_at', { ascending: false });

    if (filter.tenantId && filter.tenantId !== 'all') {
      ordersQuery = ordersQuery.eq('tenant_id', filter.tenantId);
    }
    if (filter.branchId && filter.branchId !== 'all') {
      ordersQuery = ordersQuery.eq('branch_id', filter.branchId);
    }
    if (filter.status && filter.status !== 'all') {
      ordersQuery = ordersQuery.eq('status', filter.status);
    }
    if (filter.fulfillmentType && filter.fulfillmentType !== 'all') {
      ordersQuery = ordersQuery.eq('fulfillment_type', filter.fulfillmentType);
    }
    if (filter.startDate) {
      ordersQuery = ordersQuery.gte('created_at', filter.startDate);
    }
    if (filter.endDate) {
      ordersQuery = ordersQuery.lte('created_at', filter.endDate);
    }

    let rawOrders: any[] = [];
    try {
      const { data, error } = await ordersQuery;
      if (!error && data) rawOrders = data;
    } catch (_) {}

    const defaultRate = 54.50;

    // 3. Enriquecer cada pedido con nombres de comercio, sucursal y repartidor
    const enrichedOrders = rawOrders.map(o => {
      const t = o.tenant_id ? tenantMap.get(o.tenant_id) : null;
      const b = o.branch_id ? branchMap.get(o.branch_id) : null;
      const r = o.rider_id ? riderMap.get(o.rider_id) : null;
      const totalUsd = Number(o.total) || 0;
      const commPct = t?.commission != null ? Number(t.commission) : 5.0;
      const commissionUsd = Number((totalUsd * (commPct / 100)).toFixed(2));

      return {
        id: o.id,
        orderNumber: o.order_number || `#${o.id.slice(0, 8).toUpperCase()}`,
        tenantId: o.tenant_id,
        tenantName: t?.name || 'Comercio',
        branchId: o.branch_id,
        branchName: b?.name || 'Sede Principal',
        customerName: o.customer_name || 'Cliente',
        customerPhone: o.customer_phone || '',
        deliveryAddress: o.delivery_address || '',
        riderId: o.rider_id,
        riderName: r?.name || (o.rider_id ? 'Repartidor asignado' : 'Sin asignar'),
        riderPlate: r?.vehicle_plate || '',
        status: o.status || 'pending',
        fulfillmentType: o.fulfillment_type || 'delivery',
        paymentMethod: o.payment_method || 'pago_movil',
        totalUsd,
        totalBs: Number((totalUsd * defaultRate).toFixed(2)),
        commissionUsd,
        itemsCount: Array.isArray(o.items) ? o.items.length : 1,
        createdAt: o.created_at,
      };
    });

    // 4. Calcular métricas consolidadas del filtro seleccionado
    const totalOrders = enrichedOrders.length;
    const deliveredOrders = enrichedOrders.filter(o => o.status === 'delivered');
    const cancelledOrders = enrichedOrders.filter(o => o.status === 'cancelled');
    const activeOrders = enrichedOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');

    const totalRevenueUsd = deliveredOrders.reduce((sum, o) => sum + o.totalUsd, 0);
    const totalRevenueBs = totalRevenueUsd * defaultRate;
    const totalCommissionUsd = deliveredOrders.reduce((sum, o) => sum + o.commissionUsd, 0);
    const averageTicketUsd = deliveredOrders.length > 0 ? (totalRevenueUsd / deliveredOrders.length) : 0;
    const deliveryRate = totalOrders > 0 ? Number(((deliveredOrders.length / totalOrders) * 100).toFixed(1)) : 100;
    const cancellationRate = totalOrders > 0 ? Number(((cancelledOrders.length / totalOrders) * 100).toFixed(1)) : 0;

    // 5. Agrupación por Comercios para tabla comparativa
    const merchantMap = new Map<string, {
      tenantId: string;
      tenantName: string;
      totalOrders: number;
      deliveredOrders: number;
      cancelledOrders: number;
      grossRevenueUsd: number;
      commissionUsd: number;
      averageTicket: number;
    }>();

    enrichedOrders.forEach(o => {
      const tid = o.tenantId || 'unknown';
      if (!merchantMap.has(tid)) {
        merchantMap.set(tid, {
          tenantId: tid,
          tenantName: o.tenantName,
          totalOrders: 0,
          deliveredOrders: 0,
          cancelledOrders: 0,
          grossRevenueUsd: 0,
          commissionUsd: 0,
          averageTicket: 0,
        });
      }
      const m = merchantMap.get(tid)!;
      m.totalOrders++;
      if (o.status === 'delivered') {
        m.deliveredOrders++;
        m.grossRevenueUsd += o.totalUsd;
        m.commissionUsd += o.commissionUsd;
      } else if (o.status === 'cancelled') {
        m.cancelledOrders++;
      }
    });

    const merchantSummaries = Array.from(merchantMap.values()).map(m => ({
      ...m,
      grossRevenueUsd: Number(m.grossRevenueUsd.toFixed(2)),
      commissionUsd: Number(m.commissionUsd.toFixed(2)),
      averageTicket: m.deliveredOrders > 0 ? Number((m.grossRevenueUsd / m.deliveredOrders).toFixed(2)) : 0,
    })).sort((a, b) => b.totalOrders - a.totalOrders);

    // 6. Distribución Horaria de Demanda (0h a 23h)
    const hourlyDistribution: { [hour: string]: number } = {};
    for (let h = 0; h < 24; h++) {
      const label = `${h.toString().padStart(2, '0')}:00`;
      hourlyDistribution[label] = 0;
    }
    enrichedOrders.forEach(o => {
      if (o.createdAt) {
        const hour = new Date(o.createdAt).getHours();
        const label = `${hour.toString().padStart(2, '0')}:00`;
        hourlyDistribution[label] = (hourlyDistribution[label] || 0) + 1;
      }
    });

    // 7. Métodos de Pago más utilizados
    const paymentMethodsStats: { [method: string]: number } = {};
    enrichedOrders.forEach(o => {
      const pm = o.paymentMethod || 'pago_movil';
      paymentMethodsStats[pm] = (paymentMethodsStats[pm] || 0) + 1;
    });

    return {
      kpi: {
        totalOrders,
        deliveredCount: deliveredOrders.length,
        cancelledCount: cancelledOrders.length,
        activeCount: activeOrders.length,
        totalRevenueUsd: Number(totalRevenueUsd.toFixed(2)),
        totalRevenueBs: Number(totalRevenueBs.toFixed(2)),
        totalCommissionUsd: Number(totalCommissionUsd.toFixed(2)),
        averageTicketUsd: Number(averageTicketUsd.toFixed(2)),
        deliveryRate,
        cancellationRate,
      },
      merchantSummaries,
      hourlyDistribution,
      paymentMethodsStats,
      orders: enrichedOrders,
    };
  }

  // ==========================================
  // 3. DATOS DE DECISIÓN & TOMA DE ACCIÓN ESTRATÉGICA
  // ==========================================

  async getDecisionInsights() {
    const report = await this.getOrdersReport({});

    // Top 5 Comercios con más ventas
    const topMerchants = [...report.merchantSummaries]
      .sort((a, b) => b.grossRevenueUsd - a.grossRevenueUsd)
      .slice(0, 5);

    // Top Horarios Pico (Top 3 horas con más tráfico)
    const peakHours = Object.entries(report.hourlyDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour, count]) => ({ hour, ordersCount: count }));

    // Calcular Riders con más entregas
    const riderDeliveriesMap = new Map<string, { riderName: string; deliveries: number; totalVolume: number }>();
    report.orders.filter(o => o.status === 'delivered' && o.riderName !== 'Sin asignar').forEach(o => {
      const name = o.riderName;
      if (!riderDeliveriesMap.has(name)) {
        riderDeliveriesMap.set(name, { riderName: name, deliveries: 0, totalVolume: 0 });
      }
      const r = riderDeliveriesMap.get(name)!;
      r.deliveries++;
      r.totalVolume += o.totalUsd;
    });

    const topRiders = Array.from(riderDeliveriesMap.values())
      .sort((a, b) => b.deliveries - a.deliveries)
      .slice(0, 5)
      .map(r => ({ ...r, totalVolume: Number(r.totalVolume.toFixed(2)) }));

    return {
      topMerchants,
      topRiders,
      peakHours,
      cancellationRate: report.kpi.cancellationRate,
      deliverySuccessRate: report.kpi.deliveryRate,
      totalOrders: report.kpi.totalOrders,
      totalRevenueUsd: report.kpi.totalRevenueUsd,
      paymentMethodsBreakdown: report.paymentMethodsStats,
    };
  }

  // ==========================================
  // 4. RESUMEN GLOBAL COMPLETO (COMPATIBILIDAD)
  // ==========================================

  async getGlobalSummary() {
    const report = await this.getOrdersReport({});
    const client = this.supabase.getClient();

    let tenants: any[] = [];
    try {
      const { data } = await client.from('tenants').select('id, name, is_active');
      if (data) tenants = data;
    } catch (_) {}

    let branches: any[] = [];
    try {
      const { data } = await client.from('branches').select('id, is_active, status');
      if (data) branches = data;
    } catch (_) {}

    return {
      totalOrders: report.kpi.totalOrders,
      deliveredOrders: report.kpi.deliveredCount,
      deliveredOrdersCount: report.kpi.deliveredCount,
      cancelledOrdersCount: report.kpi.cancelledCount,
      activeOrders: report.kpi.activeCount,
      activeOrdersCount: report.kpi.activeCount,
      totalRevenueUsd: report.kpi.totalRevenueUsd,
      totalRevenueBs: report.kpi.totalRevenueBs,
      totalCommissionUsd: report.kpi.totalCommissionUsd,
      averageTicketUsd: report.kpi.averageTicketUsd,
      activeMerchantsCount: tenants.filter(t => t.is_active).length,
      totalMerchantsCount: tenants.length,
      activeBranchesCount: branches.filter(b => b.is_active && b.status !== 'rejected').length,
      totalBranchesCount: branches.length,
      branchReports: report.merchantSummaries.map(m => ({
        branchId: m.tenantId,
        branchName: m.tenantName,
        companyName: m.tenantName,
        totalOrders: m.totalOrders,
        deliveredOrders: m.deliveredOrders,
        cancelledOrders: m.cancelledOrders,
        grossRevenueUsd: m.grossRevenueUsd,
        grossRevenueBs: Number((m.grossRevenueUsd * 54.50).toFixed(2)),
        commissionEarnedUsd: m.commissionUsd,
        averageTicket: m.averageTicket,
        status: 'active',
        completionRate: m.totalOrders > 0 ? Number(((m.deliveredOrders / m.totalOrders) * 100).toFixed(1)) : 100,
      }))
    };
  }
}
