import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-super-admin-branches',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './super-admin-branches.component.html'
})
export class SuperAdminBranchesComponent {
  @Input() pendingBranches: any[] = [];
  @Input() branchApprovalNotice: string | null = null;

  @Output() approve = new EventEmitter<any>();
  @Output() reject = new EventEmitter<any>();
  @Output() closeNotice = new EventEmitter<void>();
}

