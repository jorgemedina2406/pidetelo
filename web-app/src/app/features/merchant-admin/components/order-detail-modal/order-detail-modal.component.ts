import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order, parseOrderAdditions, OrderAddition } from '../../../../core/models/order.model';
import { IconComponent } from '../../../../shared/components/icon.component';

@Component({
  selector: 'app-order-detail-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './order-detail-modal.component.html'
})
export class OrderDetailModalComponent {
  @Input() isOpen = false;
  @Input() order: Order | null = null;
  @Input() activeExchangeRate = 45.50;

  @Output() close = new EventEmitter<void>();
  @Output() viewRoute = new EventEmitter<Order>();

  get effectiveRate(): number {
    return this.order?.exchangeRate || this.activeExchangeRate || 45.50;
  }

  get additions(): OrderAddition[] {
    return parseOrderAdditions(this.order?.notes);
  }

  get additionsTotalUsd(): number {
    return this.additions.reduce((sum, a) => sum + a.amountUsd, 0);
  }

  get initialSubtotalUsd(): number {
    const sub = this.order?.subtotal || 0;
    return Math.max(0, Number((sub - this.additionsTotalUsd).toFixed(2)));
  }

  isAdditionItem(item: any): boolean {
    if (item.name?.includes('(Adición)')) return true;
    if (item.selectedModifiers && Array.isArray(item.selectedModifiers)) {
      return item.selectedModifiers.some((m: any) => 
        (m.name || m.optionName || '').toLowerCase().includes('adici')
      );
    }
    return false;
  }

  get totalBs(): number {
    if (this.order?.totalBs !== undefined && this.order.totalBs !== null) return this.order.totalBs;
    return Number(((this.order?.total || 0) * this.effectiveRate).toFixed(2));
  }

  get deliveryFeeBs(): number {
    if (this.order?.deliveryFeeBs !== undefined && this.order.deliveryFeeBs !== null) return this.order.deliveryFeeBs;
    return Number(((this.order?.deliveryFee || 0) * this.effectiveRate).toFixed(2));
  }

  get subtotalBs(): number {
    if (this.order?.subtotalBs !== undefined && this.order.subtotalBs !== null) return this.order.subtotalBs;
    return Number(((this.order?.subtotal || 0) * this.effectiveRate).toFixed(2));
  }

  get discountBs(): number {
    if (this.order?.discountBs !== undefined && this.order.discountBs !== null) return this.order.discountBs;
    return Number(((this.order?.discount || 0) * this.effectiveRate).toFixed(2));
  }

  getModifiersText(modifiers: any[]): string {
    if (!modifiers || !Array.isArray(modifiers)) return '';
    return modifiers
      .map(m => m.optionName || m.option_name || m.name || '')
      .filter((n: string) => typeof n === 'string' && n.trim().length > 0)
      .join(', ');
  }
}
