import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { CartStore } from '../../stores/cart.store';

@Component({
  selector: 'app-order-success-modal',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './order-success-modal.component.html'
})
export class OrderSuccessModalComponent {
  readonly cart = inject(CartStore);
  private readonly router = inject(Router);

  getWhatsAppUrl(order: any): string {
    return this.cart.generateWhatsAppOrderUrl(order);
  }

  goToMarketplace(): void {
    this.cart.closeSuccessModal();
    this.router.navigate(['/explorar']);
  }
}
