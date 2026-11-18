import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../shared/components/icon.component';

@Component({
  selector: 'app-super-admin-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './super-admin-reviews.component.html'
})
export class SuperAdminReviewsComponent {
  @Input() reviews: any[] = [];
  @Input() merchants: any[] = [];
  @Input() isLoading = false;
  @Input() merchantFilter = 'all';
  @Input() searchQuery = '';
  @Input() avgRating = 5.0;
  @Input() starCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  @Output() filterChange = new EventEmitter<string>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() refresh = new EventEmitter<void>();

  readonly Math = Math;
}
