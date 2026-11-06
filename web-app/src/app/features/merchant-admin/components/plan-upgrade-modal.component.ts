import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SubscriptionPlan } from '../../../core/models/branch.model';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-plan-upgrade-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './plan-upgrade-modal.component.html'
})
export class PlanUpgradeModalComponent {
  @Input() isOpen = false;
  @Input() currentSubscriptionPlan: SubscriptionPlan | null = null;
  @Input() activeBranchesCount = 0;

  @Output() close = new EventEmitter<void>();
}
