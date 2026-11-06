import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-super-admin-coupons',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './super-admin-coupons.component.html'
})
export class SuperAdminCouponsComponent {
  @Input() allCoupons: any[] = [];
  @Output() createCoupon = new EventEmitter<void>();
  @Output() deleteCoupon = new EventEmitter<any>();
}

