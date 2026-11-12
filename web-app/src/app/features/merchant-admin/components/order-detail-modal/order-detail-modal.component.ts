import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order } from '../../../../core/models/order.model';
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

  getModifiersText(modifiers: any[]): string {
    if (!modifiers || !Array.isArray(modifiers)) return '';
    return modifiers
      .map(m => m.optionName || m.option_name || m.name || '')
      .filter((n: string) => typeof n === 'string' && n.trim().length > 0)
      .join(', ');
  }
}
