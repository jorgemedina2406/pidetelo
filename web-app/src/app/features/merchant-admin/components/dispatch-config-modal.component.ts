import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../shared/components/icon.component';

export interface DispatchFilterConfig {
  maxDistanceKm: number;
  minRating: number;
  minDeliveries: number;
  onlyAvailable: boolean;
}

@Component({
  selector: 'app-dispatch-config-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './dispatch-config-modal.component.html'
})
export class DispatchConfigModalComponent {
  @Input() isOpen = false;
  @Input() set config(val: DispatchFilterConfig) {
    if (val) {
      this.localConfig = { ...val };
    }
  }

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<DispatchFilterConfig>();

  localConfig: DispatchFilterConfig = {
    maxDistanceKm: 15,
    minRating: 0,
    minDeliveries: 0,
    onlyAvailable: true
  };
}

