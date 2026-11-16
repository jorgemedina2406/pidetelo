import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../shared/components/icon.component';

export interface RiderPayoutPolicyData {
  mode: 'WEEKLY' | 'DAILY' | 'BIWEEKLY' | 'ON_DEMAND';
  payoutDayOfWeek: number;
  payoutHour: string;
  minWithdrawalAmount: number;
  paymentMethod: string;
  payoutNotes: string;
  emailNotifications: boolean;
}

@Component({
  selector: 'app-payout-policy-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './payout-policy-modal.component.html'
})
export class PayoutPolicyModalComponent {
  @Input() isOpen = false;

  @Input() set policy(val: any) {
    const cur = val || {};
    const mode = cur.mode || 'WEEKLY';
    const payoutDayOfWeek = cur.payoutDayOfWeek != null ? cur.payoutDayOfWeek : 1;
    const payoutHour = cur.payoutHour || '20:00';
    const minWithdrawalAmount = cur.minWithdrawalAmount != null ? cur.minWithdrawalAmount : 5.0;
    const paymentMethod = cur.paymentMethod || 'PAGO_MOVIL';

    this.localPolicy = {
      mode,
      payoutDayOfWeek,
      payoutHour,
      minWithdrawalAmount,
      paymentMethod,
      payoutNotes: cur.payoutNotes || this.generateSuggestedNote(mode, payoutDayOfWeek, payoutHour, minWithdrawalAmount, paymentMethod),
      emailNotifications: cur.emailNotifications !== false
    };
  }

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<RiderPayoutPolicyData>();

  localPolicy: RiderPayoutPolicyData = {
    mode: 'WEEKLY',
    payoutDayOfWeek: 1,
    payoutHour: '20:00',
    minWithdrawalAmount: 5.0,
    paymentMethod: 'PAGO_MOVIL',
    payoutNotes: '',
    emailNotifications: true
  };

  formatHour12(hourStr: string): string {
    if (!hourStr) return '8:00 PM';
    const parts = hourStr.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    if (isNaN(h)) return hourStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  }

  generateSuggestedNote(
    mode: string = this.localPolicy.mode,
    dayOfWeek: number = this.localPolicy.payoutDayOfWeek,
    hour: string = this.localPolicy.payoutHour,
    minAmount: number = this.localPolicy.minWithdrawalAmount,
    method: string = this.localPolicy.paymentMethod
  ): string {
    const days = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const dayName = days[dayOfWeek] || 'Lunes';
    const formattedHour = this.formatHour12(hour);
    const methodLabel = method === 'PAGO_MOVIL' ? 'Pago Móvil' :
                        method === 'TRANSFERENCIA' ? 'Transferencia Bancaria' :
                        method === 'EFECTIVO' ? 'Efectivo en Tienda' : 'Pago Móvil';

    switch (mode) {
      case 'WEEKLY':
        return `Liquidación semanal directa por ${methodLabel} todos los ${dayName} al cierre de jornada (${formattedHour}).`;
      case 'DAILY':
        return `Liquidación diaria al cierre de jornada a las ${formattedHour} por ${methodLabel}.`;
      case 'BIWEEKLY':
        return `Liquidación quincenal los días 15 y fin de mes a las ${formattedHour} por ${methodLabel}.`;
      case 'ON_DEMAND':
        return `Retiros bajo demanda disponibles a partir de $${(minAmount || 5).toFixed(2)} USD vía ${methodLabel}.`;
      default:
        return `Liquidación directa por ${methodLabel}.`;
    }
  }

  setMode(mode: 'WEEKLY' | 'DAILY' | 'BIWEEKLY' | 'ON_DEMAND'): void {
    this.localPolicy.mode = mode;
    this.onFieldChange();
  }

  onFieldChange(): void {
    this.localPolicy.payoutNotes = this.generateSuggestedNote(
      this.localPolicy.mode,
      this.localPolicy.payoutDayOfWeek,
      this.localPolicy.payoutHour,
      this.localPolicy.minWithdrawalAmount,
      this.localPolicy.paymentMethod
    );
  }

  onSave(): void {
    this.save.emit(this.localPolicy);
    this.close.emit();
  }
}
