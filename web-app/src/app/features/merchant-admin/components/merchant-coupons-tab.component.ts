import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Coupon } from '../../../core/models/coupon.model';

@Component({
  selector: 'app-merchant-coupons-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './merchant-coupons-tab.component.html'
})
export class MerchantCouponsTabComponent {
  @Input() coupons: Coupon[] = [];
  @Input() couponActionNotice: string | null = null;

  @Output() newCoupon = new EventEmitter<void>();
  @Output() editCoupon = new EventEmitter<Coupon>();
  @Output() deleteCoupon = new EventEmitter<Coupon>();
  @Output() toggleActive = new EventEmitter<Coupon>();
  @Output() notifyCoupon = new EventEmitter<Coupon>();
  @Output() closeNotice = new EventEmitter<void>();
}

