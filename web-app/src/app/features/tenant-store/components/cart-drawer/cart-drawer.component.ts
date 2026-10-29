import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CartStore } from '../../stores/cart.store';

@Component({
  selector: 'app-cart-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cart-drawer.component.html'
})
export class CartDrawerComponent {
  readonly cart = inject(CartStore);
}
