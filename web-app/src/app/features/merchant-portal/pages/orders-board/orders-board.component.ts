import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MockDataService } from '../../../../core/services/mock-data.service';
import { Order, OrderStatus } from '../../../../core/models/order.model';

@Component({
  selector: 'app-orders-board',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './orders-board.component.html'
})
export class OrdersBoardComponent {
  private readonly mockData = inject(MockDataService);

  readonly orders = signal<Order[]>([]);

  readonly receivedOrders = computed(() => this.orders().filter(o => o.status === 'received'));
  readonly kitchenOrders = computed(() => this.orders().filter(o => o.status === 'in_kitchen'));
  readonly transitOrders = computed(() => this.orders().filter(o => o.status === 'on_the_way'));

  updateStatus(orderId: string, status: OrderStatus): void {
    this.orders.update(list => 
      list.map(o => o.id === orderId ? { ...o, status, updatedAt: new Date().toISOString() } : o)
    );
  }

  simulateNewOrder(): void {
    const num = Math.floor(1000 + Math.random() * 9000);
    const newOrder: Order = {
      id: `ord_${Date.now()}`,
      orderNumber: `ORD-${num}`,
      tenantId: 'tenant-1',
      tenantName: 'Comercio',
      source: 'whatsapp_link',
      status: 'received',
      fulfillmentType: 'delivery',
      paymentMethod: 'cash_usd',
      customer: {
        name: 'Cliente WhatsApp Simulado',
        phone: '+584128889900',
        deliveryAddress: 'Av. Libertador, Edif. Centro, Piso 5'
      },
      items: [
        {
          cartItemId: `item_${Date.now()}`,
          productId: 'prod-101',
          name: 'Combo Doble Bacon Smash + Papas',
          unitPrice: 9.99,
          quantity: 1,
          selectedModifiers: [],
          itemTotal: 9.99
        }
      ],
      subtotal: 9.99,
      deliveryFee: 2.50,
      discount: 0,
      total: 12.49,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.orders.update(list => [newOrder, ...list]);
  }
}
