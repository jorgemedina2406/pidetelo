import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Branch } from '../../../core/models/branch.model';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-delete-branch-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './delete-branch-modal.component.html'
})
export class DeleteBranchModalComponent {
  @Input() isOpen = false;
  @Input() branch: Branch | null = null;
  @Input() isDeleting = false;
  @Input() errorMessage: string | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<Branch>();
}
