import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../shared/components/icon.component';
import { I18nService } from '../../../../core/services/i18n.service';
import { AuthStore } from '../../../../core/stores/auth.store';
import { Branch } from '../../../../core/models/branch.model';

@Component({
  selector: 'app-merchant-header',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './merchant-header.component.html'
})
export class MerchantHeaderComponent {
  readonly i18n = inject(I18nService);
  readonly auth = inject(AuthStore);

  @Input() currentTenant: any = null;
  @Input() activeBranch: Branch | null = null;
  @Input() activeTab: string = 'orders';
  @Input() isBranchLocked = false;
  @Input() notificationPermission: NotificationPermission = 'default';
  @Input() isMobileMenuOpen = false;

  @Output() toggleMobileMenu = new EventEmitter<void>();
  @Output() requestNotificationPermission = new EventEmitter<void>();
  @Output() toggleBranch = new EventEmitter<Branch>();

  cleanBranchDisplayName(name?: string | null): string {
    if (!name) return '';
    return name.replace(/(\s*\(Sede Principal\))+/gi, '').trim();
  }
}
