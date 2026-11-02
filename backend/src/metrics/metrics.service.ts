import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';

@Injectable()
export class MetricsService {
  constructor(private readonly supabase: SupabaseService) {}

  async getGlobalSummary() {
    const client = this.supabase.getClient();

    // 1. Obtener todas las órdenes
    let orders: any[] = [];
    try {
      const { data } = await client
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) orders = data;
    } catch (_) {}

    // 2. Obtener comercios y sucursales
    let tenants: any[] = [];
    try {
      const { data } = await client.from('tenants').select('id, name, commission, is_active');
      if (data) tenants = data;
    } catch (_) {}

    let branches: any[] = [];
    try {
      const { data } = await client.from('branches').select('id, company_id, name, is_active, status, exchange_rate');
      if (data) branches = data;
    } catch (_) {}

    const defaultRate = 54.50;

    // Métricas globales
    const totalOrders = orders.length;
    const deliveredOrders = orders.filter(o => o.status === 'delivered');
    const cancelledOrders = orders.filter(o => o.status === 'cancelled');
    const activeOrders = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');

    const totalRevenueUsd = deliveredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const totalRevenueBs = totalRevenueUsd * defaultRate;

    // Calcular comisiones de la plataforma
    const tenantCommissionMap = new Map<string, number>();
    tenants.forEach(t => {
      tenantCommissionMap.set(t.id, Number(t.commission) || 5.0);
    });

    let totalCommissionUsd = 0;
    deliveredOrders.forEach(o => {
      const commPct = (o.tenant_id && tenantCommissionMap.get(o.tenant_id)) ?? 5.0;
      totalCommissionUsd += (Number(o.total) || 0) * (commPct / 100);
    });

    const averageTicketUsd = deliveredOrders.length > 0 ? (totalRevenueUsd / deliveredOrders.length) : 0;

    // Reportes detallados por Sede / Sucursal
    const branchStatsMap = new Map<string, {
      branchId: string;
      branchName: string;
      companyId: string;
      companyName: string;
      totalOrders: number;
      deliveredOrders: number;
      cancelledOrders: number;
      grossRevenueUsd: number;
      grossRevenueBs: number;
      commissionEarnedUsd: number;
      status: string;
    }>();

    // Inicializar con todas las sedes registradas
    branches.forEach(b => {
      const company = tenants.find(t => t.id === b.company_id);
      branchStatsMap.set(b.id, {
        branchId: b.id,
        branchName: b.name || 'Sede Principal',
        companyId: b.company_id,
        companyName: company?.name || 'Comercio',
        totalOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        grossRevenueUsd: 0,
        grossRevenueBs: 0,
        commissionEarnedUsd: 0,
        status: b.status || (b.is_active ? 'active' : 'inactive')
      });
    });

    // Agregar pedidos a sus sedes
    orders.forEach(o => {
      let bStat = o.branch_id ? branchStatsMap.get(o.branch_id) : null;
      if (!bStat && o.tenant_id) {
        // Encontrar primera sede de ese tenant
        const matchingBranch = branches.find(b => b.company_id === o.tenant_id);
        if (matchingBranch) {
          bStat = branchStatsMap.get(matchingBranch.id);
        }
      }

      if (bStat) {
        bStat.totalOrders++;
        const oTotal = Number(o.total) || 0;
        const commPct = tenantCommissionMap.get(bStat.companyId) ?? 5.0;

        if (o.status === 'delivered') {
          bStat.deliveredOrders++;
          bStat.grossRevenueUsd += oTotal;
          bStat.grossRevenueBs += oTotal * defaultRate;
          bStat.commissionEarnedUsd += oTotal * (commPct / 100);
        } else if (o.status === 'cancelled') {
          bStat.cancelledOrders++;
        }
      }
    });

    const branchReports = Array.from(branchStatsMap.values()).map(b => ({
      ...b,
      grossRevenueUsd: Number(b.grossRevenueUsd.toFixed(2)),
      grossRevenueBs: Number(b.grossRevenueBs.toFixed(2)),
      commissionEarnedUsd: Number(b.commissionEarnedUsd.toFixed(2)),
      averageTicket: b.deliveredOrders > 0 ? Number((b.grossRevenueUsd / b.deliveredOrders).toFixed(2)) : 0,
      completionRate: b.totalOrders > 0 ? Number(((b.deliveredOrders / b.totalOrders) * 100).toFixed(1)) : 100
    }));

    return {
      totalOrders,
      deliveredOrdersCount: deliveredOrders.length,
      cancelledOrdersCount: cancelledOrders.length,
      activeOrdersCount: activeOrders.length,
      totalRevenueUsd: Number(totalRevenueUsd.toFixed(2)),
      totalRevenueBs: Number(totalRevenueBs.toFixed(2)),
      totalCommissionUsd: Number(totalCommissionUsd.toFixed(2)),
      averageTicketUsd: Number(averageTicketUsd.toFixed(2)),
      activeMerchantsCount: tenants.filter(t => t.is_active).length,
      totalMerchantsCount: tenants.length,
      activeBranchesCount: branches.filter(b => b.is_active && b.status !== 'rejected').length,
      totalBranchesCount: branches.length,
      branchReports
    };
  }
}

