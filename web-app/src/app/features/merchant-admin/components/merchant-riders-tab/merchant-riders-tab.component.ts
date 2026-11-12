import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Rider } from '../../merchant-admin.component';
import { I18nService } from '../../../../core/services/i18n.service';
import { IconComponent } from '../../../../shared/components/icon.component';

@Component({
  selector: 'app-merchant-riders-tab',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './merchant-riders-tab.component.html'
})
export class MerchantRidersTabComponent {
  readonly i18n = inject(I18nService);

  @Input() riders: Rider[] = [];
  @Input() selectedBranchName?: string;

  @Output() newRider = new EventEmitter<void>();
  @Output() deleteRider = new EventEmitter<Rider>();
  @Output() locateRider = new EventEmitter<Rider>();
}

