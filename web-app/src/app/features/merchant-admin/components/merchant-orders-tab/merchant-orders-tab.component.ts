import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../shared/components/icon.component';
import { I18nService } from '../../../../core/services/i18n.service';
import { Order, OrderStatus } from '../../../../core/models/order.model';
import { Branch } from '../../../../core/models/branch.model';
import { Rider } from '../../merchant-admin.component';

@Component({
  selector: 'app-merchant-orders-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './merchant-orders-tab.component.html'
})
export class MerchantOrdersTabComponent {
  readonly i18n = inject(I18nService);

  @Input() ordersSubTab: 'kanban' | 'history' = 'kanban';
  @Input() selectedBranch: Branch | null = null;
  @Input() receivedOrders: Order[] = [];
  @Input() kitchenOrders: Order[] = [];
  @Input() transitOrders: Order[] = [];
  @Input() completedOrders: Order[] = [];
  @Input() filteredOrders: Order[] = [];
  @Input() historySearchQuery = '';
  @Input() historyStatusFilter: 'all' | 'delivered' | 'cancelled' = 'all';
  @Input() deliveredCount = 0;
  @Input() cancelledCount = 0;
  @Input() completedRevenueUsd = 0;
  @Input() completedRevenueBs = 0;
  @Input() currentSubscriptionPlan: any = null;
  @Input() rejectedAlert: any = null;
  @Input() activeExchangeRate = 1;
  @Input() riders: Rider[] = [];
  @Input() getOwnRidersForOrder!: (order: Order) => Rider[];
  @Input() getNearbyRidersForOrder!: (order: Order) => Rider[];

  @Output() ordersSubTabChange = new EventEmitter<'kanban' | 'history'>();
  @Output() historySearchQueryChange = new EventEmitter<string>();
  @Output() historyStatusFilterChange = new EventEmitter<'all' | 'delivered' | 'cancelled'>();
  @Output() advanceStatus = new EventEmitter<{ orderId: string, status: OrderStatus }>();
  @Output() sendToKitchen = new EventEmitter<Order>();
  @Output() assignRider = new EventEmitter<{ orderId: string, riderId: string }>();
  @Output() openNearbyRiders = new EventEmitter<Order>();
  @Output() openDetail = new EventEmitter<Order>();
  @Output() openRoute = new EventEmitter<Order>();
  @Output() openPaymentVerification = new EventEmitter<Order>();
  @Output() openDispatchConfig = new EventEmitter<void>();
  @Output() exportExcel = new EventEmitter<void>();
  @Output() dismissAlert = new EventEmitter<void>();

  getModifiersText(modifiers: any[]): string {
    if (!modifiers || !Array.isArray(modifiers)) return '';
    return modifiers
      .map(m => m.optionName || m.option_name || m.name || '')
      .filter((n: string) => typeof n === 'string' && n.trim().length > 0)
      .join(', ');
  }

  getOrderBsTotal(usd: number, order?: Order | null): string {
    if (order?.totalBs !== undefined && order?.totalBs !== null) {
      return order.totalBs.toFixed(2);
    }
    return (usd * this.activeExchangeRate).toFixed(2);
  }
}
