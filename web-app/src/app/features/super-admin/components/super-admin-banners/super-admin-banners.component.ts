import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../shared/components/icon.component';

@Component({
  selector: 'app-super-admin-banners',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './super-admin-banners.component.html'
})
export class SuperAdminBannersComponent {
  @Input() banners: any[] = [];
  @Input() bannerActionNotice: string | null = null;

  @Output() createBanner = new EventEmitter<void>();
  @Output() editBanner = new EventEmitter<any>();
  @Output() deleteBanner = new EventEmitter<any>();
  @Output() toggleBannerActive = new EventEmitter<any>();
}

