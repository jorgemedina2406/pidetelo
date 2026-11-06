import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Branch } from '../../../core/models/branch.model';
import { IconComponent } from '../../../shared/components/icon.component';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-rider-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    @if (isOpen) {
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      (click)="close.emit()">
      <div
        class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-2xl shadow-xl p-6 overflow-hidden border border-slate-200 dark:border-slate-800"
        (click)="$event.stopPropagation()">

        <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
          <h3 class="text-base font-bold">{{ i18n.t('ma.newRider') }}</h3>
          <button (click)="close.emit()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
            <app-icon name="x" [size]="18"></app-icon>
          </button>
        </div>

        <form (submit)="onSubmit($event)" class="space-y-3.5 text-xs">
          @if (formError) {
            <div class="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-semibold">
              ⚠️ {{ formError }}
            </div>
          }
          <div>
            <label class="block font-semibold mb-1">Nombre Completo del Motorizado</label>
            <input type="text" [(ngModel)]="form.name" name="riderName" required placeholder="Ej: Carlos Rodríguez"
              class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 focus:outline-none focus:border-brand-500 font-medium" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold mb-1">Correo / Usuario de Acceso</label>
              <input type="email" [(ngModel)]="form.email" name="riderEmail" required placeholder="repartidor@pidetelo.com"
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 focus:outline-none focus:border-brand-500 font-medium" />
            </div>
            <div>
              <label class="block font-semibold mb-1">Contraseña de Acceso</label>
              <input type="password" [(ngModel)]="form.password" name="riderPassword" required placeholder="Mínimo 6 caracteres"
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 focus:outline-none focus:border-brand-500 font-mono" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold mb-1">Teléfono WhatsApp</label>
              <input type="text" [(ngModel)]="form.phone" name="riderPhone" required placeholder="+584141112233"
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 focus:outline-none focus:border-brand-500 font-mono" />
            </div>
            <div>
              <label class="block font-semibold mb-1">Cédula / DNI</label>
              <input type="text" [(ngModel)]="form.nationalId" name="riderNationalId" placeholder="Ej: V-24.891.332"
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 focus:outline-none focus:border-brand-500 font-mono" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold mb-1">Placa Vehículo</label>
              <input type="text" [(ngModel)]="form.vehiclePlate" name="riderPlate" required placeholder="AC-8891-X"
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 font-mono uppercase focus:outline-none focus:border-brand-500" />
            </div>
            <div>
              <label class="block font-semibold mb-1">Tipo de Vehículo</label>
              <select [(ngModel)]="form.vehicleType" name="vehicleType"
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 focus:outline-none focus:border-brand-500 font-medium">
                <option value="moto">Moto</option>
                <option value="bicicleta">Bicicleta</option>
                <option value="auto">Auto</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block font-semibold mb-1">Sucursal / Sede Asignada</label>
            @if (branches && branches.length > 1) {
              <select [(ngModel)]="selectedBranchId" name="selectedBranch"
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 focus:outline-none focus:border-brand-500 font-medium">
                @for (b of branches; track b.id) {
                  <option [value]="b.id">{{ b.name }} {{ b.isMain ? '(Sede Principal)' : '' }}</option>
                }
              </select>
            } @else {
              <div class="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 font-bold flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span class="flex items-center gap-2">
                  <app-icon name="map-pin" [size]="14" className="text-brand-500"></app-icon>
                  <span>{{ activeBranch?.name || 'Sede Principal' }}</span>
                </span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  Exclusivo de esta sede
                </span>
              </div>
            }
          </div>

          <div class="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
            <button type="button" (click)="close.emit()"
              class="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer font-semibold">
              {{ i18n.t('common.cancel') }}
            </button>
            <button type="submit"
              class="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold shadow-sm cursor-pointer">
              {{ i18n.t('common.save') }}
            </button>
          </div>
        </form>
      </div>
    </div>
    }
  `
})
export class RiderFormModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() activeBranch: Branch | null = null;
  @Input() branches: Branch[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<any>();

  readonly i18n = inject(I18nService);

  selectedBranchId = '';

  formError: string | null = null;

  get hasMinLength(): boolean {
    return (this.form.password || '').length >= 8;
  }
  get hasUppercase(): boolean {
    return /[A-Z]/.test(this.form.password || '');
  }
  get hasSpecialChar(): boolean {
    const s = this.form.password || '';
    return s.includes('*') || s.includes('.') || s.includes('@') || s.includes('#') || s.includes('!') || s.includes('?');
  }
  get isPasswordValid(): boolean {
    return this.hasMinLength && this.hasUppercase && this.hasSpecialChar;
  }


  form = {
    name: '',
    email: '',
    password: '',
    phone: '',
    nationalId: '',
    vehiclePlate: '',
    vehicleType: 'moto' as 'moto' | 'bicicleta' | 'auto'
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeBranch'] && this.activeBranch) {
      this.selectedBranchId = this.activeBranch.id;
    } else if (changes['branches'] && this.branches.length > 0 && !this.selectedBranchId) {
      this.selectedBranchId = this.activeBranch?.id || this.branches[0].id;
    }
  }

  onSubmit(e: Event): void {
    e.preventDefault();
    const effectiveBranchId = this.selectedBranchId || this.activeBranch?.id;
    this.save.emit({
      name: this.form.name.trim(),
      email: this.form.email.trim(),
      password: this.form.password.trim(),
      phone: this.form.phone.trim(),
      national_id: this.form.nationalId.trim(),
      nationalId: this.form.nationalId.trim(),
      vehicle_plate: this.form.vehiclePlate.trim().toUpperCase(),
      vehiclePlate: this.form.vehiclePlate.trim().toUpperCase(),
      vehicle_type: this.form.vehicleType,
      vehicleType: this.form.vehicleType,
      branch_id: effectiveBranchId,
      branchId: effectiveBranchId
    });
    this.form = {
      name: '',
      email: '',
      password: '',
      phone: '',
      nationalId: '',
      vehiclePlate: '',
      vehicleType: 'moto'
    };
  }
}
