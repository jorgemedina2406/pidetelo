import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../shared/components/icon.component';
import { I18nService } from '../../../../core/services/i18n.service';
import { Product } from '../../../../core/models/product.model';
import { Branch } from '../../../../core/models/branch.model';

export interface ProductCategoryItem {
  id: string;
  name: string;
}

@Component({
  selector: 'app-merchant-products-tab',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './merchant-products-tab.component.html'
})
export class MerchantProductsTabComponent {
  readonly i18n = inject(I18nService);

  @Input() products: Product[] = [];
  @Input() filteredProducts: Product[] = [];
  @Input() productCategories: ProductCategoryItem[] = [];
  @Input() selectedCategoryFilter = 'all';
  @Input() productViewMode: 'grid' | 'list' = 'grid';
  @Input() selectedBranch: Branch | null = null;
  @Input() activeBranch: Branch | null = null;
  @Input() activeExchangeRate = 1;
  @Input() isProductLimitReached = false;

  @Output() categoryFilterChange = new EventEmitter<string>();
  @Output() viewModeChange = new EventEmitter<'grid' | 'list'>();
  @Output() openProductModal = new EventEmitter<Product | undefined>();
  @Output() openBulkImportModal = new EventEmitter<void>();
  @Output() toggleProductStock = new EventEmitter<string>();

  getCategoryName(categoryId?: string): string {
    if (!categoryId) return 'General';
    const cat = this.productCategories.find(c => c.id === categoryId);
    return cat ? cat.name : 'General';
  }
}
