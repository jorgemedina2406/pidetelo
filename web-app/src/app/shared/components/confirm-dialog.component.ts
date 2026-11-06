import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from '../../core/services/confirm.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './confirm-dialog.component.html'
})
export class ConfirmDialogComponent {
  readonly confirmService = inject(ConfirmService);
}
