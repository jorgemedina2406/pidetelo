import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../shared/components/icon.component';
import { I18nService } from '../../../../core/services/i18n.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { AuthStore } from '../../../../core/stores/auth.store';

@Component({
  selector: 'app-merchant-sidebar',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './merchant-sidebar.component.html'
})
export class MerchantSidebarComponent {
  readonly i18n = inject(I18nService);
  readonly theme = inject(ThemeService);
  readonly auth = inject(AuthStore);

  @Input() isSidebarExpanded = true;
  @Input() isMobileMenuOpen = false;
  @Input() activeTab: string = 'orders';
  @Input() currentTenant: any = null;
  @Input() merchantLogoUrl: string | null = null;
  @Input() isBranchLocked = false;
  @Input() branchesCount = 0;
  @Input() pendingBranchesCount = 0;
  @Input() activeOrdersCount = 0;
  @Input() productsCount = 0;
  @Input() ownRidersCount = 0;
  @Input() storeUsersCount = 0;
  @Input() reviewsCount = 0;
  @Input() reviewsAverage = 5.0;
  @Input() couponsCount = 0;
  @Input() whatsappConnected = false;

  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() closeMobileMenu = new EventEmitter<void>();
  @Output() tabChange = new EventEmitter<any>();
  @Output() logout = new EventEmitter<void>();

  merchantLogoFailed = false;

  cleanBranchDisplayName(name?: string | null): string {
    if (!name) return '';
    return name.replace(/(\s*\(Sede Principal\))+/gi, '').trim();
  }
}
