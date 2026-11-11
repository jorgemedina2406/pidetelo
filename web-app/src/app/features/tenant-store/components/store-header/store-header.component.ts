import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Tenant } from '../../../../core/models/tenant.model';
import { Branch } from '../../../../core/models/branch.model';
import { ThemeService } from '../../../../core/services/theme.service';
import { FavoritesService } from '../../../../core/services/favorites.service';
import { IconComponent } from '../../../../shared/components/icon.component';

@Component({
  selector: 'app-store-header',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent],
  templateUrl: './store-header.component.html'
})
export class StoreHeaderComponent {
  readonly theme = inject(ThemeService);
  readonly favorites = inject(FavoritesService);

  toggleFavorite(slug: string) {
    this.favorites.toggleFavorite(slug);
  }

  @Input() tenant: Tenant | null = null;
  @Input() selectedBranch: Branch | null = null;
  @Input() isStoreOpen: { isOpen: boolean; label: string; openStr: string; closeStr: string } = {
    isOpen: true,
    label: 'Abierto',
    openStr: '09:00',
    closeStr: '23:00'
  };
  @Input() activeBranchRate: number = 52.80;

  @Output() openBranchModal = new EventEmitter<void>();
  @Output() openReviewsModal = new EventEmitter<void>();

  getDeliveryFee(store: Tenant): string {
    const fee = this.selectedBranch?.baseDeliveryFee ?? store.deliverySettings?.baseDeliveryFee ?? 0;
    return fee.toFixed(2);
  }

  getFallbackLogo(name?: string): string {
    const initial = (name || 'P').trim().charAt(0).toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="#f97316"/><text x="50%" y="54%" font-family="system-ui,sans-serif" font-weight="900" font-size="52" fill="white" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  onLogoError(event: Event, name?: string): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.onerror = null;
      target.src = this.getFallbackLogo(name);
    }
  }

  onBannerError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.onerror = null;
      target.src = '/assets/delivery_courier.jpg';
    }
  }

  get activeGuestOrder(): any {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('pidetelo_recent_web_orders');
      if (!raw) return null;
      const list = JSON.parse(raw);
      if (!Array.isArray(list) || list.length === 0) return null;
      const latest = list[0];
      const hoursAgo = (Date.now() - new Date(latest.createdAt).getTime()) / (1000 * 60 * 60);
      if (hoursAgo < 24) return latest;
    } catch (_) {}
    return null;
  }
}

