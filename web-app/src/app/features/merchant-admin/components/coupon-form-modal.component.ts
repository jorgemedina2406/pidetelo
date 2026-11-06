import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-merchant-coupon-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './coupon-form-modal.component.html'
})
export class MerchantCouponModalComponent {
  @Input() isOpen = false;
  @Input() coupon: any = {};
  @Input() isSaving = false;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<any>();
}

