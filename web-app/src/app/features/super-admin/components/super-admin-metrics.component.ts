import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../../core/services/i18n.service';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-super-admin-metrics',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './super-admin-metrics.component.html'
})
export class SuperAdminMetricsComponent {
  readonly i18n = inject(I18nService);

  @Input() metricsSummary: any = null;
  @Input() activeMerchantsCount = 0;
  @Input() totalMerchantsCount = 0;

  @Output() refresh = new EventEmitter<void>();
}

