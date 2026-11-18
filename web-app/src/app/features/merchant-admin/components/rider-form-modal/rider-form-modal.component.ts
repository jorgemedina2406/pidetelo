import { Component, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Branch } from '../../../../core/models/branch.model';
import { IconComponent } from '../../../../shared/components/icon.component';
import { I18nService } from '../../../../core/services/i18n.service';

@Component({
  selector: 'app-rider-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './rider-form-modal.component.html'
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
    return /[*@#.!$%^&()_+\-=\[\]{};':"\\|,.<>\/?~]/.test(s);
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
    if (changes['isOpen'] && this.isOpen) {
      this.formError = null;
    }
    if (changes['activeBranch'] && this.activeBranch) {
      this.selectedBranchId = this.activeBranch.id;
    } else if (changes['branches'] && this.branches.length > 0 && !this.selectedBranchId) {
      this.selectedBranchId = this.activeBranch?.id || this.branches[0].id;
    }
  }

  onSubmit(e: Event): void {
    e.preventDefault();
    this.formError = null;

    const cleanPlate = (this.form.vehiclePlate || '').trim().toUpperCase().replace(/\s+/g, '');
    const cleanName = (this.form.name || '').trim();
    const cleanEmail = (this.form.email || '').trim().toLowerCase();
    const cleanPhone = (this.form.phone || '').trim();
    const cleanNationalId = (this.form.nationalId || '').trim().toUpperCase();

    if (!cleanPlate || cleanPlate === 'SIN-PLACA' || cleanPlate.length < 3) {
      this.formError = 'La placa del vehículo es obligatoria y debe tener al menos 3 caracteres alfanuméricos.';
      return;
    }

    if (!cleanName || cleanName.length < 3) {
      this.formError = 'El nombre completo del repartidor es obligatorio (mínimo 3 caracteres).';
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      this.formError = 'El correo electrónico no tiene un formato válido.';
      return;
    }

    if (!this.isPasswordValid) {
      this.formError = 'La contraseña debe tener al menos 8 caracteres, una letra mayúscula y un carácter especial.';
      return;
    }

    if (!cleanPhone || cleanPhone.length < 8) {
      this.formError = 'El número de teléfono WhatsApp es obligatorio (mínimo 8 dígitos).';
      return;
    }

    if (!cleanNationalId || cleanNationalId.length < 5) {
      this.formError = 'La cédula o documento de identidad es obligatorio (mínimo 5 caracteres).';
      return;
    }

    const effectiveBranchId = this.selectedBranchId || this.activeBranch?.id;
    this.save.emit({
      name: cleanName,
      email: cleanEmail,
      password: this.form.password.trim(),
      phone: cleanPhone,
      national_id: cleanNationalId,
      nationalId: cleanNationalId,
      vehicle_plate: cleanPlate,
      vehiclePlate: cleanPlate,
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
