import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order } from '../../../core/models/order.model';
import { Rider } from '../merchant-admin.component';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-nearby-riders-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './nearby-riders-modal.component.html'
})
export class NearbyRidersModalComponent {
  @Input() isOpen = false;
  @Input() order: Order | null = null;
  @Input() ownRiders: Rider[] = [];
  @Input() nearbyRiders: Rider[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() assignRider = new EventEmitter<string>();
  @Output() refresh = new EventEmitter<void>();
}

