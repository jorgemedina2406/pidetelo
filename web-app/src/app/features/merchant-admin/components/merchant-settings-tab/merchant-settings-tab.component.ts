import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../shared/components/icon.component';
import { Branch } from '../../../../core/models/branch.model';

@Component({
  selector: 'app-merchant-settings-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './merchant-settings-tab.component.html'
})
export class MerchantSettingsTabComponent {
  @Input() brandingForm: any = {};
  @Input() isSavingBranding = false;
  @Input() isSavedNotificationVisible = false;
  @Input() isUploadingLogo = false;
  @Input() isUploadingBanner = false;
  showLogoUrlInput = false;
  showBannerUrlInput = false;
  @Input() isDetectingStoreGps = false;
  @Input() storeGpsMessage: string | null = null;
  @Input() isFetchingBcv = false;
  @Input() bcvLastUpdated: string | null = null;
  @Input() bcvRateSource: string | null = null;
  @Input() colorPresets: { name: string; hex: string }[] = [];
  @Input() visibleBranches: Branch[] = [];
  @Input() selectedConfigBranchId = 'all';
  @Input() isBranchLocked = false;
  @Input() currentVzlaTimeFormatted = '';
  @Input() isCurrentScheduleOpenNow = true;

  @Output() saveSettings = new EventEmitter<void>();
  @Output() imageFileSelected = new EventEmitter<{ event: Event, type: 'logo' | 'banner' }>();
  @Output() colorPresetSelected = new EventEmitter<string>();
  @Output() captureStoreGps = new EventEmitter<void>();
  @Output() updateLocation = new EventEmitter<void>();
  @Output() fetchBcvRate = new EventEmitter<'oficial' | 'paralelo'>();
  @Output() copyGeneralHours = new EventEmitter<void>();
  @Output() schedulePreset = new EventEmitter<'all' | 'weekdays' | 'weekends' | '24h'>();
  @Output() addDeliveryTier = new EventEmitter<void>();
  @Output() removeDeliveryTier = new EventEmitter<number>();
  @Output() togglePaymentMethod = new EventEmitter<string>();
  @Output() configBranchChange = new EventEmitter<string>();

  toggleLogoUrl(): void {
    this.showLogoUrlInput = !this.showLogoUrlInput;
  }

  toggleBannerUrl(): void {
    this.showBannerUrlInput = !this.showBannerUrlInput;
  }

  cleanBranchDisplayName(name?: string | null): string {
    if (!name) return '';
    return name.replace(/(\s*\(Sede Principal\))+/gi, '').trim();
  }
}
