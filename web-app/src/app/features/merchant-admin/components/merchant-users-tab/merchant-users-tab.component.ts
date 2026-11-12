import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../shared/components/icon.component';

@Component({
  selector: 'app-merchant-users-tab',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './merchant-users-tab.component.html'
})
export class MerchantUsersTabComponent {
  @Input() users: any[] = [];
  @Input() activeBranchName?: string;
  @Input() filterRole = 'all';

  @Output() filterRoleChange = new EventEmitter<string>();
  @Output() createUser = new EventEmitter<void>();
  @Output() editUser = new EventEmitter<any>();
  @Output() deleteUser = new EventEmitter<any>();
  @Output() toggleStatus = new EventEmitter<any>();
}

