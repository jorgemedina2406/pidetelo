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
    const raw = (m.planCode || m.plan_code || m.subscriptionPlanId || 'COMERCIO_PRO').toUpperCase();
    if (raw === 'COMERCIO') return 'COMERCIO_PRO';
    if (raw === 'CORPORATIVO') return 'FRANQUICIA';
    return raw;
  }

  onPlanSelect(m: any, planCode: string): void {
    m.planCode = planCode;
    m.plan_code = planCode;
    m.subscriptionPlanId = planCode;
    this._merchants.update(list => list.map(item => item.id === m.id ? { ...item, planCode, plan_code: planCode, subscriptionPlanId: planCode } as any : item));
    this.changePlan.emit({ tenantId: m.id, planCode });
  }

  getBaseFee(m: Tenant): string {
    return ((m.deliverySettings?.baseDeliveryFee) || 0).toFixed(2);
  }
}

