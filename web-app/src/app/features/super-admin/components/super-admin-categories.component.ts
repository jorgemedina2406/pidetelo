import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-super-admin-categories',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './super-admin-categories.component.html'
})
export class SuperAdminCategoriesComponent {
  @Input() businessCategories: any[] = [];
  @Input() categoryActionNotice: string | null = null;

  @Output() createCategory = new EventEmitter<void>();
  @Output() editCategory = new EventEmitter<any>();
  @Output() deleteCategory = new EventEmitter<any>();
  @Output() toggleCategoryActive = new EventEmitter<any>();
  @Output() closeNotice = new EventEmitter<void>();
}

