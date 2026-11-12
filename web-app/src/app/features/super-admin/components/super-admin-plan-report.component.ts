import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Tenant } from '../../../core/models/tenant.model';
import { IconComponent } from '../../../shared/components/icon.component';

export interface PlanRow {
  tenant: Tenant;
  planCode: string;
  planName: string;
  monthlyFee: number;
  expiresAt: string;
  expiresAtDate: Date;
  daysRemaining: number;
  status: 'active' | 'expiring_soon' | 'expired';
  isPaused: boolean;
}

@Component({
  selector: 'app-super-admin-plan-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent],
  templateUrl: './super-admin-plan-report.component.html'
})
export class SuperAdminPlanReportComponent {
  @Input() set merchants(val: Tenant[]) {
    this._merchants.set(val || []);
  }

  @Output() updatePlan = new EventEmitter<{ tenantId: string; planCode: string; expiresAt: string }>();
  @Output() toggleActive = new EventEmitter<string>();

  private readonly _merchants = signal<Tenant[]>([]);
  readonly search = signal('');
  readonly filterPlan = signal<string>('ALL');
  readonly filterStatus = signal<string>('ALL');

  // Modal para edición manual
  readonly isModalOpen = signal(false);
  readonly editingTenant = signal<Tenant | null>(null);
  modalPlanCode = 'COMERCIO_PRO';
  modalExpiresDate = '';

  readonly planRows = computed<PlanRow[]>(() => {
    const list = this._merchants();
    const now = Date.now();

    return list.map(t => {
      let planCode = (t.planCode || t.subscriptionPlanId || 'COMERCIO_PRO').toUpperCase();
      if (planCode === 'COMERCIO') planCode = 'COMERCIO_PRO';
      if (planCode === 'CORPORATIVO') planCode = 'FRANQUICIA';

      const monthlyFee = planCode === 'FRANQUICIA' ? 79 : (planCode === 'COMERCIO_PRO' ? 29 : 9);
      const planName = planCode === 'FRANQUICIA' ? 'Franquicia ($79/m)' : (planCode === 'COMERCIO_PRO' ? 'Comercio Pro ($29/m)' : 'Emprendedor ($9/m)');

      let expStr = t.planExpiresAt;
      if (!expStr && typeof localStorage !== 'undefined') {
        try {
          expStr = localStorage.getItem('pidetelo_tenant_plan_exp_' + t.id) || undefined;
        } catch (_) {}
      }
      if (!expStr) {
        const d = new Date();
        d.setDate(d.getDate() + 25);
        expStr = d.toISOString();
      }

      const expDate = new Date(expStr);
      const expTime = isNaN(expDate.getTime()) ? now + 25 * 86400000 : expDate.getTime();
      const diffMs = expTime - now;
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let status: 'active' | 'expiring_soon' | 'expired' = 'active';
      if (daysRemaining < 0) {
        status = 'expired';
      } else if (daysRemaining <= 5) {
        status = 'expiring_soon';
      }

      const isPaused = status === 'expired' || !t.isActive;

      return {
        tenant: t,
        planCode,
        planName,
        monthlyFee,
        expiresAt: expStr,
        expiresAtDate: new Date(expTime),
        daysRemaining,
        status,
        isPaused
      };
    });
  });

  readonly filteredRows = computed<PlanRow[]>(() => {
    const q = this.search().toLowerCase().trim();
    const p = this.filterPlan();
    const s = this.filterStatus();

    return this.planRows().filter(r => {
      const matchQuery = !q ||
        r.tenant.name.toLowerCase().includes(q) ||
        r.tenant.slug.toLowerCase().includes(q) ||
        (r.tenant.contact?.whatsappNumber || '').includes(q);

      const matchPlan = p === 'ALL' || r.planCode === p;

      let matchStatus = true;
      if (s === 'ACTIVE') matchStatus = r.status === 'active';
      else if (s === 'EXPIRING_SOON') matchStatus = r.status === 'expiring_soon';
      else if (s === 'EXPIRED') matchStatus = r.status === 'expired';

      return matchQuery && matchPlan && matchStatus;
    });
  });

  // KPI Metrics
  readonly metrics = computed(() => {
    const rows = this.planRows();
    const total = rows.length;
    const active = rows.filter(r => r.status === 'active').length;
    const expiringSoon = rows.filter(r => r.status === 'expiring_soon').length;
    const expired = rows.filter(r => r.status === 'expired').length;
    const mrr = rows.filter(r => r.status !== 'expired').reduce((acc, r) => acc + r.monthlyFee, 0);

    return { total, active, expiringSoon, expired, mrr };
  });

  openEditModal(row: PlanRow): void {
    this.editingTenant.set(row.tenant);
    this.modalPlanCode = row.planCode;
    const d = row.expiresAtDate;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    this.modalExpiresDate = `${yyyy}-${mm}-${dd}`;
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.editingTenant.set(null);
  }

  saveModal(): void {
    const t = this.editingTenant();
    if (!t || !this.modalExpiresDate) return;

    const isoExp = new Date(this.modalExpiresDate + 'T23:59:59.000Z').toISOString();
    this.applyPlanUpdate(t.id, this.modalPlanCode, isoExp);
    this.closeModal();
  }

  quickExtend(row: PlanRow, days: number): void {
    let base = row.expiresAtDate;
    if (isNaN(base.getTime()) || base.getTime() < Date.now()) {
      base = new Date();
    }
    const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    this.applyPlanUpdate(row.tenant.id, row.planCode, next.toISOString());
  }

  addDaysToModal(days: number): void {
    let current = this.modalExpiresDate ? new Date(this.modalExpiresDate + 'T00:00:00') : new Date();
    if (isNaN(current.getTime()) || current.getTime() < Date.now()) {
      current = new Date();
    }
    const next = new Date(current.getTime() + days * 24 * 60 * 60 * 1000);
    const yyyy = next.getFullYear();
    const mm = String(next.getMonth() + 1).padStart(2, '0');
    const dd = String(next.getDate()).padStart(2, '0');
    this.modalExpiresDate = `${yyyy}-${mm}-${dd}`;
  }

  private applyPlanUpdate(tenantId: string, planCode: string, expiresAt: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('pidetelo_tenant_plan_exp_' + tenantId, expiresAt);
        const storedPlans = localStorage.getItem('pidetelo_tenant_plans');
        const map = storedPlans ? JSON.parse(storedPlans) : {};
        map[tenantId] = planCode;
        localStorage.setItem('pidetelo_tenant_plans', JSON.stringify(map));
      }
    } catch (_) {}

    // Actualizar estado local
    this._merchants.update(list => list.map(t => {
      if (t.id === tenantId) {
        const isExp = new Date(expiresAt).getTime() < Date.now();
        return {
          ...t,
          planCode,
          planExpiresAt: expiresAt,
          isPlanExpired: isExp,
          isActive: isExp ? false : t.isActive
        } as Tenant;
      }
      return t;
    }));

    this.updatePlan.emit({ tenantId, planCode, expiresAt });
  }

  formatDate(d: Date): string {
    if (!d || isNaN(d.getTime())) return 'Sin fecha';
    return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  exportToCsv(): void {
    const rows = this.filteredRows();
    if (rows.length === 0) return;

    const headers = [
      'ID',
      'Comercio',
      'Slug',
      'Categoria',
      'WhatsApp',
      'Plan',
      'Cuota Mensual USD',
      'Fecha Vencimiento',
      'Dias Restantes',
      'Estado Plan',
      'Comercio Pausado'
    ];

    const csvLines = [headers.join(',')];

    for (const r of rows) {
      const line = [
        `"${r.tenant.id}"`,
        `"${(r.tenant.name || '').replace(/"/g, '""')}"`,
        `"${r.tenant.slug}"`,
        `"${r.tenant.category || ''}"`,
        `"${r.tenant.contact?.whatsappNumber || ''}"`,
        `"${r.planCode}"`,
        r.monthlyFee,
        `"${this.formatDate(r.expiresAtDate)}"`,
        r.daysRemaining,
        `"${r.status === 'expired' ? 'VENCIDO' : (r.status === 'expiring_soon' ? 'POR_VENCER' : 'ACTIVO')}"`,
        `"${r.isPaused ? 'SI' : 'NO'}"`
      ];
      csvLines.push(line.join(','));
    }

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `Reporte_Membresias_Pidetelo_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
