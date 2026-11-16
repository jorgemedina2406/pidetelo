import { Component, Input, Output, EventEmitter, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Rider } from '../../merchant-admin.component';
import { I18nService } from '../../../../core/services/i18n.service';
import { IconComponent } from '../../../../shared/components/icon.component';
import { RiderWithdrawal } from '../../../../core/models/rider-withdrawal.model';

export interface RiderReportSummary {
  riderId: string;
  riderName: string;
  riderPhone: string;
  vehiclePlate: string;
  vehicleType: string;
  isIndependent: boolean;
  totalDeliveries: number;
  totalDeliveryFees: number;
  walletBalance: number;
  deliveredOrders: any[];
}

@Component({
  selector: 'app-merchant-riders-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './merchant-riders-tab.component.html'
})
export class MerchantRidersTabComponent {
  readonly i18n = inject(I18nService);

  @Input() riders: Rider[] = []; // Flota Propia de la Sede
  @Input() networkRiders: Rider[] = []; // Red Libre / Repartidores Independientes de Pídetelo
  @Input() orders: any[] = []; // Historial de órdenes para auditoría
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

  readonly activeSubTab = signal<'fleet' | 'network' | 'deliveries_report' | 'withdrawals'>('fleet');
  readonly selectedRiderFilter = signal<string>('all');
  readonly selectedWithdrawalForPay = signal<RiderWithdrawal | null>(null);
  readonly paymentRefCodeInput = signal<string>('');
  readonly isRejectModalOpen = signal(false);
  readonly selectedWithdrawalForReject = signal<RiderWithdrawal | null>(null);
  readonly rejectionReasonInput = signal<string>('');

  get pendingWithdrawalsCount(): number {
    return this.withdrawals.filter(w => w.status === 'pending').length;
  }

  // --- REPORTE DE ENTREGAS Y AUDITORÍA ---
  get deliveredOrders(): any[] {
    return (this.orders || []).filter(o => o.status === 'delivered' && o.driverId);
  }

  get riderReportSummaries(): RiderReportSummary[] {
    const map = new Map<string, RiderReportSummary>();

    // 1. Registrar primero todos los riders conocidos (propios y de red)
    const allKnownRiders = [...(this.riders || []), ...(this.networkRiders || [])];
    allKnownRiders.forEach(r => {
      if (!map.has(r.id)) {
        map.set(r.id, {
          riderId: r.id,
          riderName: r.name,
          riderPhone: r.phone,
          vehiclePlate: r.vehiclePlate || 'S/P',
          vehicleType: r.vehicleType || 'moto',
          isIndependent: !!r.isIndependent,
          totalDeliveries: 0,
          totalDeliveryFees: 0,
          walletBalance: r.walletBalance || 0,
          deliveredOrders: []
        });
      }
    });

    // 2. Asociar órdenes entregadas
    this.deliveredOrders.forEach(o => {
      const dId = o.driverId;
      if (!dId) return;

      let entry = map.get(dId);
      if (!entry) {
        entry = {
          riderId: dId,
          riderName: o.driverName || 'Repartidor',
          riderPhone: o.driverPhone || 'N/D',
          vehiclePlate: o.driverPlate || 'S/P',
          vehicleType: o.driverVehicle || 'moto',
          isIndependent: true,
          totalDeliveries: 0,
          totalDeliveryFees: 0,
          walletBalance: 0,
          deliveredOrders: []
        };
        map.set(dId, entry);
      }

      entry.totalDeliveries += 1;
      entry.totalDeliveryFees += Number(o.deliveryFee || 0);
      entry.deliveredOrders.push(o);
    });

    return Array.from(map.values()).sort((a, b) => b.totalDeliveries - a.totalDeliveries);
  }

  get filteredDeliveredOrders(): any[] {
    const filterId = this.selectedRiderFilter();
    if (filterId === 'all') {
      return this.deliveredOrders;
    }
    return this.deliveredOrders.filter(o => o.driverId === filterId);
  }

  get totalDeliveryFeesSum(): number {
    return this.deliveredOrders.reduce((acc, o) => acc + (Number(o.deliveryFee) || 0), 0);
  }

  get totalWalletBalancesSum(): number {
    return this.riderReportSummaries.reduce((acc, r) => acc + (r.walletBalance || 0), 0);
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
