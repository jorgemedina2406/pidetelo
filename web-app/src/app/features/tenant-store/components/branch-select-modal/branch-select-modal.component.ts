import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Branch } from '../../../../core/models/branch.model';

@Component({
  selector: 'app-branch-select-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './branch-select-modal.component.html'
})
export class BranchSelectModalComponent {
  @Input() isOpen = false;
  @Input() branches: Branch[] = [];
  @Input() selectedBranchId?: string;

  @Output() close = new EventEmitter<void>();
  @Output() selectBranch = new EventEmitter<Branch>();

  getDeliveryFee(fee?: number): string {
    return (fee != null && fee > 0 ? fee : 2.5).toFixed(2);
  }
}

