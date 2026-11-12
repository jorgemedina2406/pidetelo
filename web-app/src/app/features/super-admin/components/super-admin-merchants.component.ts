import { Component, Input, Output, EventEmitter, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Tenant } from '../../../core/models/tenant.model';
import { I18nService } from '../../../core/services/i18n.service';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-super-admin-merchants',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent],
  templateUrl: './super-admin-merchants.component.html'
})
export class SuperAdminMerchantsComponent {
  readonly i18n = inject(I18nService);

  @Input() set merchants(value: Tenant[]) {
    this._merchants.set(value || []);
  }
  @Output() createMerchant = new EventEmitter<void>();
  @Output() editMerchant = new EventEmitter<Tenant>();
  @Output() toggleActive = new EventEmitter<string>();
  @Output() changePlan = new EventEmitter<{ tenantId: string; planCode: string }>();

  private readonly _merchants = signal<Tenant[]>([]);
  readonly searchMerchant = signal('');

  readonly filteredMerchants = computed(() => {
    const q = this.searchMerchant().toLowerCase().trim();
    if (!q) return this._merchants();
    return this._merchants().filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.slug.toLowerCase().includes(q) ||
      (m.category && m.category.toLowerCase().includes(q))
    );
  });

  getMerchantPlan(m: any): string {
    let p = m.planCode || m.plan_code || m.subscriptionPlanId;
    if (!p && typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('pidetelo_tenant_plans');
        if (stored) {
          const map = JSON.parse(stored);
          p = map[m.id] || (m.slug ? map[m.slug] : null);
        }
      } catch (_) {}
    }
    const raw = (p || 'COMERCIO_PRO').toUpperCase();
    if (raw === 'COMERCIO') return 'COMERCIO_PRO';
    if (raw === 'CORPORATIVO') return 'FRANQUICIA';
    return raw;
  }

  onPlanSelect(m: any, planCode: string): void {
    m.planCode = planCode;
    m.plan_code = planCode;
    m.subscriptionPlanId = planCode;
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('pidetelo_tenant_plans');
        const map = stored ? JSON.parse(stored) : {};
        map[m.id] = planCode;
        if (m.slug) map[m.slug] = planCode;
        localStorage.setItem('pidetelo_tenant_plans', JSON.stringify(map));
      }
    } catch (_) {}
    this._merchants.update(list => list.map(item => item.id === m.id ? { ...item, planCode, plan_code: planCode, subscriptionPlanId: planCode } as any : item));
    this.changePlan.emit({ tenantId: m.id, planCode });
  }

  getPlanExpiration(m: any): { dateStr: string; daysRemaining: number; isExpired: boolean; isExpiringSoon: boolean } {
    let expStr = m.planExpiresAt || m.plan_expires_at;
    if (!expStr && typeof localStorage !== 'undefined') {
      try {
        expStr = localStorage.getItem('pidetelo_tenant_plan_exp_' + m.id);
      } catch (_) {}
    }
    if (!expStr) {
      const d = new Date();
      d.setDate(d.getDate() + 25);
      expStr = d.toISOString();
    }
    const expDate = new Date(expStr);
    const now = Date.now();
    const daysRemaining = Math.ceil((expDate.getTime() - now) / (1000 * 60 * 60 * 24));
    const isExpired = daysRemaining < 0;
    const isExpiringSoon = daysRemaining >= 0 && daysRemaining <= 5;
    const dateStr = !isNaN(expDate.getTime()) 
      ? expDate.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })
      : '30 días';

    return { dateStr, daysRemaining, isExpired, isExpiringSoon };
  }

  getBaseFee(m: Tenant): string {
    return ((m.deliverySettings?.baseDeliveryFee) || 0).toFixed(2);
  }
}

