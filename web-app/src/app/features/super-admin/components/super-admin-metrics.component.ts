import { Component, Input, Output, EventEmitter, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../../core/services/i18n.service';
import { ApiService } from '../../../core/services/api.service';
import { IconComponent } from '../../../shared/components/icon.component';
import { Tenant } from '../../../core/models/tenant.model';

@Component({
  selector: 'app-super-admin-metrics',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './super-admin-metrics.component.html'
})
export class SuperAdminMetricsComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly api = inject(ApiService);
  readonly Math = Math;

  @Input() metricsSummary: any = null;
  @Input() activeMerchantsCount = 0;
  @Input() totalMerchantsCount = 0;
  @Input() merchants: Tenant[] = [];

  @Output() refresh = new EventEmitter<void>();

  // Subtabs de navegación
  readonly activeSubTab = signal<'general' | 'orders' | 'logins' | 'insights'>('general');

  // --- SUBTAB: REPORTES DE PEDIDOS ---
  readonly selectedMerchantId = signal<string>('all');
  readonly selectedStatus = signal<string>('all');
  readonly selectedFulfillment = signal<string>('all');
  readonly selectedPeriod = signal<string>('all');
  readonly ordersSearch = signal<string>('');
  readonly ordersPage = signal<number>(1);
  readonly ordersPerPage = 15;

  readonly loadingOrders = signal<boolean>(false);
  readonly ordersReport = signal<any>(null);

  // --- SUBTAB: INICIOS DE SESIÓN ---
  readonly selectedLoginRole = signal<string>('all');
  readonly selectedLoginPlatform = signal<string>('all');
  readonly loginsSearch = signal<string>('');
  readonly loginsPage = signal<number>(1);
  readonly loginsPerPage = 20;

  readonly loadingLogins = signal<boolean>(false);
  readonly loginsData = signal<any>(null);

  // --- SUBTAB: INSIGHTS & TOMA DE DECISIONES ---
  readonly loadingInsights = signal<boolean>(false);
  readonly insightsData = signal<any>(null);

  ngOnInit(): void {
    // Carga inicial pasiva
    this.loadOrdersReport();
  }

  setSubTab(tab: 'general' | 'orders' | 'logins' | 'insights'): void {
    this.activeSubTab.set(tab);
    if (tab === 'orders' && !this.ordersReport()) {
      this.loadOrdersReport();
    } else if (tab === 'logins' && !this.loginsData()) {
      this.loadLoginActivity();
    } else if (tab === 'insights' && !this.insightsData()) {
      this.loadInsights();
    }
  }

  // ==========================================
  // PEDIDOS: Carga y Filtrado
  // ==========================================
  loadOrdersReport(): void {
    this.loadingOrders.set(true);

    let startDate: string | undefined;
    let endDate: string | undefined;
    const now = new Date();

    if (this.selectedPeriod() === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      startDate = todayStart.toISOString();
      endDate = now.toISOString();
    } else if (this.selectedPeriod() === '7days') {
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate = d7.toISOString();
      endDate = now.toISOString();
    } else if (this.selectedPeriod() === '30days') {
      const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = d30.toISOString();
      endDate = now.toISOString();
    }

    const filters = {
      tenantId: this.selectedMerchantId() === 'all' ? undefined : this.selectedMerchantId(),
      startDate,
      endDate,
      status: this.selectedStatus() === 'all' ? undefined : this.selectedStatus(),
      fulfillmentType: this.selectedFulfillment() === 'all' ? undefined : this.selectedFulfillment()
    };

    this.api.getOrdersReport(filters).subscribe({
      next: (data) => {
        this.ordersReport.set(data);
        this.ordersPage.set(1);
        this.loadingOrders.set(false);
      },
      error: (err) => {
        console.error('Error cargando reporte de pedidos:', err);
        this.loadingOrders.set(false);
      }
    });
  }

  onPeriodChange(val: string): void {
    this.selectedPeriod.set(val);
    this.loadOrdersReport();
  }

  onMerchantChange(val: string): void {
    this.selectedMerchantId.set(val);
    this.loadOrdersReport();
  }

  onStatusChange(val: string): void {
    this.selectedStatus.set(val);
    this.loadOrdersReport();
  }

  onFulfillmentChange(val: string): void {
    this.selectedFulfillment.set(val);
    this.loadOrdersReport();
  }

  // Pedidos filtrados por búsqueda
  readonly filteredOrders = computed(() => {
    const report = this.ordersReport();
    if (!report || !report.orders) return [];
    const q = this.ordersSearch().toLowerCase().trim();
    if (!q) return report.orders;

    return report.orders.filter((o: any) => {
      const id = (o.id || '').toLowerCase();
      const num = (o.orderNumber || o.order_number || '').toString().toLowerCase();
      const merchant = (o.tenantName || o.tenant_name || '').toLowerCase();
      const customer = (o.customerName || o.customer_name || '').toLowerCase();
      const phone = (o.customerPhone || o.customer_phone || '').toLowerCase();
      const rider = (o.riderName || o.rider_name || '').toLowerCase();
      return id.includes(q) || num.includes(q) || merchant.includes(q) || customer.includes(q) || phone.includes(q) || rider.includes(q);
    });
  });

  readonly paginatedOrders = computed(() => {
    const orders = this.filteredOrders();
    const page = this.ordersPage();
    const perPage = this.ordersPerPage;
    const start = (page - 1) * perPage;
    return orders.slice(start, start + perPage);
  });

  readonly totalOrderPages = computed(() => {
    const total = this.filteredOrders().length;
    return Math.max(1, Math.ceil(total / this.ordersPerPage));
  });

  prevOrdersPage(): void {
    if (this.ordersPage() > 1) {
      this.ordersPage.update(p => p - 1);
    }
  }

  nextOrdersPage(): void {
    if (this.ordersPage() < this.totalOrderPages()) {
      this.ordersPage.update(p => p + 1);
    }
  }

  exportOrdersCsv(): void {
    const orders = this.filteredOrders();
    if (!orders || orders.length === 0) return;

    const headers = [
      'ID Pedido',
      'Nro Pedido',
      'Comercio',
      'Sucursal',
      'Cliente',
      'Telefono',
      'Repartidor',
      'Placa Repartidor',
      'Modalidad',
      'Total USD',
      'Total Bs',
      'Metodo Pago',
      'Estado',
      'Fecha Creacion'
    ];

    const rows = orders.map((o: any) => [
      `"${o.id || ''}"`,
      `"${o.orderNumber || o.order_number || ''}"`,
      `"${(o.tenantName || o.tenant_name || '').replace(/"/g, '""')}"`,
      `"${(o.branchName || o.branch_name || '').replace(/"/g, '""')}"`,
      `"${(o.customerName || o.customer_name || '').replace(/"/g, '""')}"`,
      `"${o.customerPhone || o.customer_phone || ''}"`,
      `"${(o.riderName || o.rider_name || '').replace(/"/g, '""')}"`,
      `"${o.riderPlate || o.rider_plate || ''}"`,
      `"${o.fulfillmentType || o.fulfillment_type || 'delivery'}"`,
      (o.totalUsd || o.total || 0).toFixed(2),
      (o.totalBs || 0).toFixed(2),
      `"${o.paymentMethod || o.payment_method || ''}"`,
      `"${o.status || ''}"`,
      `"${o.createdAt || o.created_at || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_pedidos_pidetelo_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ==========================================
  // INICIOS DE SESIÓN: Carga y Filtrado
  // ==========================================
  loadLoginActivity(): void {
    this.loadingLogins.set(true);
    const filters = {
      role: this.selectedLoginRole() === 'all' ? undefined : this.selectedLoginRole(),
      platform: this.selectedLoginPlatform() === 'all' ? undefined : this.selectedLoginPlatform(),
      search: this.loginsSearch().trim() || undefined,
      limit: 200
    };

    this.api.getPlatformLoginActivity(filters).subscribe({
      next: (data) => {
        this.loginsData.set(data);
        this.loginsPage.set(1);
        this.loadingLogins.set(false);
      },
      error: (err) => {
        console.error('Error cargando inicios de sesión:', err);
        this.loadingLogins.set(false);
      }
    });
  }

  onLoginRoleChange(role: string): void {
    this.selectedLoginRole.set(role);
    this.loadLoginActivity();
  }

  onLoginPlatformChange(platform: string): void {
    this.selectedLoginPlatform.set(platform);
    this.loadLoginActivity();
  }

  onLoginSearch(): void {
    this.loadLoginActivity();
  }

  readonly filteredLogins = computed(() => {
    const data = this.loginsData();
    if (!data || !data.logs) return [];
    return data.logs;
  });

  readonly paginatedLogins = computed(() => {
    const logs = this.filteredLogins();
    const page = this.loginsPage();
    const perPage = this.loginsPerPage;
    const start = (page - 1) * perPage;
    return logs.slice(start, start + perPage);
  });

  readonly totalLoginPages = computed(() => {
    const total = this.filteredLogins().length;
    return Math.max(1, Math.ceil(total / this.loginsPerPage));
  });

  prevLoginsPage(): void {
    if (this.loginsPage() > 1) {
      this.loginsPage.update(p => p - 1);
    }
  }

  nextLoginsPage(): void {
    if (this.loginsPage() < this.totalLoginPages()) {
      this.loginsPage.update(p => p + 1);
    }
  }

  exportLoginsCsv(): void {
    const logs = this.filteredLogins();
    if (!logs || logs.length === 0) return;

    const headers = [
      'Fecha / Hora',
      'Usuario',
      'Email',
      'Rol',
      'Plataforma',
      'Dispositivo / OS',
      'IP',
      'Estado'
    ];

    const rows = logs.map((l: any) => [
      `"${l.timestamp || l.created_at || ''}"`,
      `"${(l.userName || l.user_name || '').replace(/"/g, '""')}"`,
      `"${l.userEmail || l.user_email || ''}"`,
      `"${l.role || ''}"`,
      `"${l.platform || ''}"`,
      `"${(l.deviceInfo || l.device_info || '').replace(/"/g, '""')}"`,
      `"${l.ipAddress || l.ip_address || ''}"`,
      `"${l.status || 'success'}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `auditoria_inicios_sesion_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ==========================================
  // INSIGHTS & TOMA DE DECISIONES
  // ==========================================
  loadInsights(): void {
    this.loadingInsights.set(true);
    this.api.getDecisionInsights().subscribe({
      next: (data) => {
        this.insightsData.set(data);
        this.loadingInsights.set(false);
      },
      error: (err) => {
        console.error('Error cargando métricas de decisión:', err);
        this.loadingInsights.set(false);
      }
    });
  }

  // ==========================================
  // HELPERS DE PRESENTACIÓN
  // ==========================================
  formatRole(role?: string): string {
    if (!role) return 'Desconocido';
    switch (role.toLowerCase()) {
      case 'superadmin':
      case 'super_admin':
        return 'Super Admin';
      case 'merchant_owner':
        return 'Dueño Comercio';
      case 'branch_manager':
      case 'merchant_manager':
        return 'Admin Sucursal';
      case 'merchant_kitchen':
        return 'Cocina / Operador';
      case 'merchant_dispatch':
        return 'Despacho';
      case 'rider':
        return 'Repartidor / Rider';
      case 'customer':
        return 'Cliente';
      default:
        return role;
    }
  }

  formatPlatform(platform?: string): string {
    if (!platform) return 'Desconocida';
    switch (platform) {
      case 'mobile_app_flutter':
        return '📱 App Móvil (Flutter)';
      case 'web_store':
        return '🌐 Tienda Web';
      case 'merchant_admin':
        return '💻 Panel Comercio';
      case 'super_admin':
        return '🛡️ Super Admin';
      case 'rider':
        return '🛵 App Repartidor';
      default:
        return platform;
    }
  }

  getStatusBadgeClass(status?: string): string {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800';
      case 'cancelled':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800';
      case 'preparing':
      case 'in_kitchen':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800';
      case 'on_the_way':
      case 'assigned':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700';
    }
  }

  getStatusLabel(status?: string): string {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'Entregado';
      case 'cancelled': return 'Cancelado';
      case 'preparing':
      case 'in_kitchen': return 'En Preparación';
      case 'on_the_way': return 'En Camino';
      case 'assigned': return 'Rider Asignado';
      case 'confirmed': return 'Confirmado';
      case 'pending': return 'Pendiente';
      default: return status || 'Pendiente';
    }
  }
}
