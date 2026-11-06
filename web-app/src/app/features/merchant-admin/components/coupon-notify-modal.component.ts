import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-merchant-coupon-notify-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './coupon-notify-modal.component.html'
})
export class MerchantCouponNotifyModalComponent {
  @Input() isOpen = false;
  @Input() coupon: any = null;
  @Input() notificationCondition = 'all';
  @Input() customMessage = '';
  @Input() isSending = false;

  @Output() close = new EventEmitter<void>();
  @Output() conditionChange = new EventEmitter<string>();
  @Output() messageChange = new EventEmitter<string>();
  @Output() send = new EventEmitter<void>();
}

