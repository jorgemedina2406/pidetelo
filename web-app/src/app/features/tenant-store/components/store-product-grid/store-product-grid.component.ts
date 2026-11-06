import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../../../../core/models/product.model';

@Component({
  selector: 'app-store-product-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './store-product-grid.component.html'
})
export class StoreProductGridComponent {
  @Input() products: Product[] = [];
  @Input() isLoading = false;
  @Input() viewMode: 'grid' | 'list' = 'grid';
  @Input() accentColor = '#ea580c';
  @Input() formatPriceFn?: (price: number, curr?: 'USD' | 'VES') => { primary: string; secondary: string };

  @Output() openProduct = new EventEmitter<Product>();

  getPrice(price: number, curr: 'USD' | 'VES' = 'USD') {
    if (this.formatPriceFn) {
      return this.formatPriceFn(price, curr);
    }
    return { primary: `$${price.toFixed(2)}`, secondary: '' };
  }
}

