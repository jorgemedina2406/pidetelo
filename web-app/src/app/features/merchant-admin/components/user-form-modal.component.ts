import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Branch } from '../../../core/models/branch.model';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-user-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './user-form-modal.component.html'
})
export class UserFormModalComponent {

  get hasMinLength(): boolean {
    return (this.userForm?.password || '').length >= 8;
  }
  get hasUppercase(): boolean {
    return /[A-Z]/.test(this.userForm?.password || '');
  }
  get hasSpecialChar(): boolean {
    const s = this.userForm?.password || '';
    return s.includes('*') || s.includes('.') || s.includes('@') || s.includes('#') || s.includes('!') || s.includes('?');
  }

  @Input() isOpen = false;
  @Input() isEditing = false;
  @Input() userForm: any = {};
  @Input() formError: string | null = null;
  @Input() isSaving = false;
  @Input() activeBranch: Branch | null = null;
  @Input() conflictData: { title: string; email: string; message: string } | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
  @Output() closeConflict = new EventEmitter<void>();
}
