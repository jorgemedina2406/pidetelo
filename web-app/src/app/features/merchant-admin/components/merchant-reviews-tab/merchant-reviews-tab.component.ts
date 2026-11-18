import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../shared/components/icon.component';
import { Branch } from '../../../../core/models/branch.model';

@Component({
  selector: 'app-merchant-reviews-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './merchant-reviews-tab.component.html'
})
export class MerchantReviewsTabComponent {
  @Input() reviews: any[] = [];
  @Input() branches: Branch[] = [];
  @Input() isLoading = false;
  @Input() selectedBranchId = 'all';
  @Input() isBranchLocked = false;
  @Input() reviewsAverage = 5.0;
  @Input() reviewsStarCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  @Output() branchFilterChange = new EventEmitter<string>();
  @Output() refresh = new EventEmitter<void>();

  readonly Math = Math;
}
