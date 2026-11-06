import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductCategory } from '../../../../core/models/product.model';
import { IconComponent } from '../../../../shared/components/icon.component';

@Component({
  selector: 'app-store-filters',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './store-filters.component.html'
})
export class StoreFiltersComponent {
  @Input() categories: ProductCategory[] = [];
  @Input() selectedCategory: string | null = null;
  @Input() specialFilter: 'all' | 'offers' | 'featured' = 'all';
  @Input() viewMode: 'grid' | 'list' = 'grid';
  @Input() searchQuery = '';
  @Input() accentColor = '#ea580c';

  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() viewModeChange = new EventEmitter<'grid' | 'list'>();
  @Output() categoryChange = new EventEmitter<string | null>();
  @Output() specialFilterChange = new EventEmitter<'all' | 'offers' | 'featured'>();
}

