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
  @Input() payoutPolicy: any = {
    mode: 'WEEKLY',
    payoutDayOfWeek: 1,
    payoutHour: '20:00',
    minWithdrawalAmount: 5.0,
    paymentMethod: 'PAGO_MOVIL',
    payoutNotes: 'Liquidación semanal directa por Pago Móvil todos los Lunes.',
    emailNotifications: true
  };
  @Input() tenantId?: string;

  @Output() newRider = new EventEmitter<void>();
  @Output() deleteRider = new EventEmitter<Rider>();
  @Output() locateRider = new EventEmitter<Rider>();
  @Output() updatePayoutPolicy = new EventEmitter<any>();
  @Output() sendEmailReminder = new EventEmitter<any>();
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

  // --- POLÍTICA DE LIQUIDACIÓN ---
  readonly isPolicyModalOpen = signal(false);
  readonly isSendingEmailReminder = signal(false);
  readonly emailReminderSuccess = signal(false);
  policyForm: any = {
    mode: 'WEEKLY',
    payoutDayOfWeek: 1,
    payoutHour: '20:00',
    minWithdrawalAmount: 5.0,
    paymentMethod: 'PAGO_MOVIL',
    payoutNotes: '',
    emailNotifications: true
  };

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

  // --- MÉTODOS DE POLÍTICA DE LIQUIDACIÓN ---
  openPolicyModal(): void {
    const cur = this.payoutPolicy || {};
    this.policyForm = {
      mode: cur.mode || 'WEEKLY',
      payoutDayOfWeek: cur.payoutDayOfWeek != null ? cur.payoutDayOfWeek : 1,
      payoutHour: cur.payoutHour || '20:00',
      minWithdrawalAmount: cur.minWithdrawalAmount != null ? cur.minWithdrawalAmount : 5.0,
      paymentMethod: cur.paymentMethod || 'PAGO_MOVIL',
      payoutNotes: cur.payoutNotes || '',
      emailNotifications: cur.emailNotifications !== false
    };
    this.isPolicyModalOpen.set(true);
  }

  closePolicyModal(): void {
    this.isPolicyModalOpen.set(false);
  }

  savePolicy(): void {
    this.updatePayoutPolicy.emit(this.policyForm);
    this.closePolicyModal();
  }

  get policyModeLabel(): string {
    const m = this.payoutPolicy?.mode || 'WEEKLY';
    switch (m) {
      case 'ON_DEMAND': return 'Libre Demanda (Cuando el Rider lo solicite)';
      case 'DAILY': return `Diario al Cierre (${this.payoutPolicy?.payoutHour || '22:00'})`;
      case 'WEEKLY': {
        const days = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const day = days[this.payoutPolicy?.payoutDayOfWeek] || 'Lunes';
        return `Semanal los ${day}s (${this.payoutPolicy?.payoutHour || '20:00'})`;
      }
      case 'BIWEEKLY': return 'Quincenal (Días 15 y fin de mes)';
      default: return 'Semanal (Lunes)';
    }
  }

  get isTodayScheduledPayoutDay(): boolean {
    const m = this.payoutPolicy?.mode || 'WEEKLY';
    if (m === 'DAILY') return true;
    if (m === 'ON_DEMAND') return false;
    const now = new Date();
    if (m === 'WEEKLY') {
      const day = now.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sabado
      const isoDay = day === 0 ? 7 : day;
      return isoDay === (this.payoutPolicy?.payoutDayOfWeek || 1);
    }
    if (m === 'BIWEEKLY') {
      const d = now.getDate();
      return d === 15 || d === 30 || d === 31 || d === 28;
    }
    return false;
  }

  get pendingScheduledPayouts(): RiderReportSummary[] {
    return this.riderReportSummaries.filter(r => r.totalDeliveryFees > 0);
  }

  triggerSendEmailReminder(): void {
    if (this.isSendingEmailReminder()) return;
    this.isSendingEmailReminder.set(true);
    this.emailReminderSuccess.set(false);

    const summary = {
      policy: this.payoutPolicy,
      date: new Date().toISOString(),
      ridersCount: this.pendingScheduledPayouts.length,
      totalAmountUsd: this.totalDeliveryFeesSum,
      totalAmountBs: Number((this.totalDeliveryFeesSum * this.bcvRate).toFixed(2)),
      riders: this.pendingScheduledPayouts.map(r => ({
        riderId: r.riderId,
        riderName: r.riderName,
        phone: r.riderPhone,
        totalDeliveries: r.totalDeliveries,
        amountUsd: r.totalDeliveryFees,
        amountBs: Number((r.totalDeliveryFees * this.bcvRate).toFixed(2))
      }))
    };

    this.sendEmailReminder.emit(summary);

    setTimeout(() => {
      this.isSendingEmailReminder.set(false);
      this.emailReminderSuccess.set(true);
      setTimeout(() => this.emailReminderSuccess.set(false), 5000);
    }, 1200);
  }
}
