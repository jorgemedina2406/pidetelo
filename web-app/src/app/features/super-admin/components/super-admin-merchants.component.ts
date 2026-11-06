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

  getBaseFee(m: Tenant): string {
    return ((m.deliverySettings?.baseDeliveryFee) || 0).toFixed(2);
  }
}

