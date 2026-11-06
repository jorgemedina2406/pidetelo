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
