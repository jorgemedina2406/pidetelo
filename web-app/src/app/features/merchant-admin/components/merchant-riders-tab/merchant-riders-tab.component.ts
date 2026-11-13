import { Component, Input, Output, EventEmitter, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Rider } from '../../merchant-admin.component';
import { I18nService } from '../../../../core/services/i18n.service';
import { IconComponent } from '../../../../shared/components/icon.component';
import { RiderWithdrawal } from '../../../../core/models/rider-withdrawal.model';

@Component({
  selector: 'app-merchant-riders-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './merchant-riders-tab.component.html'
})
export class MerchantRidersTabComponent {
  readonly i18n = inject(I18nService);

  @Input() riders: Rider[] = [];
  @Input() withdrawals: RiderWithdrawal[] = [];
  @Input() selectedBranchName?: string;
  @Input() bcvRate: number = 45.50;

  @Output() newRider = new EventEmitter<void>();
  @Output() deleteRider = new EventEmitter<Rider>();
  @Output() locateRider = new EventEmitter<Rider>();
  @Output() processWithdrawal = new EventEmitter<{
    withdrawal: RiderWithdrawal;
    status: 'completed' | 'rejected';
    referenceCode?: string;
    rejectionReason?: string;
  }>();

  readonly activeSubTab = signal<'fleet' | 'withdrawals'>('fleet');
  readonly selectedWithdrawalForPay = signal<RiderWithdrawal | null>(null);
  readonly paymentRefCodeInput = signal<string>('');
  readonly isRejectModalOpen = signal(false);
  readonly selectedWithdrawalForReject = signal<RiderWithdrawal | null>(null);
  readonly rejectionReasonInput = signal<string>('');

  get pendingWithdrawalsCount(): number {
    return this.withdrawals.filter(w => w.status === 'pending').length;
  }

  openPayModal(w: RiderWithdrawal): void {
    this.selectedWithdrawalForPay.set(w);
    this.paymentRefCodeInput.set('');
  }

  closePayModal(): void {
    this.selectedWithdrawalForPay.set(null);
    this.paymentRefCodeInput.set('');
  }

  confirmPay(): void {
    const w = this.selectedWithdrawalForPay();
    const ref = this.paymentRefCodeInput().trim();
    if (!w || !ref) return;

    this.processWithdrawal.emit({
      withdrawal: w,
      status: 'completed',
      referenceCode: ref
    });
    this.closePayModal();
  }

  openRejectModal(w: RiderWithdrawal): void {
    this.selectedWithdrawalForReject.set(w);
    this.rejectionReasonInput.set('');
    this.isRejectModalOpen.set(true);
  }

  closeRejectModal(): void {
    this.selectedWithdrawalForReject.set(null);
    this.rejectionReasonInput.set('');
    this.isRejectModalOpen.set(false);
  }

  confirmReject(): void {
    const w = this.selectedWithdrawalForReject();
    if (!w) return;

    this.processWithdrawal.emit({
      withdrawal: w,
      status: 'rejected',
      rejectionReason: this.rejectionReasonInput().trim() || 'No procesable por el comercio'
    });
    this.closeRejectModal();
  }

  getWhatsAppRiderUrl(w: RiderWithdrawal): string {
    const phone = w.paymentAccount?.phone || w.riderPhone || '';
    const cleanPhone = phone.replace(/\D/g, '') || '584245065032';
    const text = encodeURIComponent(
      `Hola ${w.riderName}, te escribimos de ${w.merchantName} respecto a tu solicitud de retiro de $${w.amount.toFixed(2)}.`
    );
    return `https://wa.me/${cleanPhone}?text=${text}`;
  }
}


