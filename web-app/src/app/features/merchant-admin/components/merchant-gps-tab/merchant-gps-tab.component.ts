import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../shared/components/icon.component';
import { Branch } from '../../../../core/models/branch.model';
import { Rider } from '../../merchant-admin.component';
import { Order } from '../../../../core/models/order.model';

@Component({
  selector: 'app-merchant-gps-tab',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './merchant-gps-tab.component.html'
})
export class MerchantGpsTabComponent {
  @Input() selectedBranch: Branch | null = null;
  @Input() radarFleetType: 'all' | 'own' | 'independent' = 'all';
  @Input() radarFilter: 'all' | 'available' | 'delivering' | 'offline' = 'all';
  @Input() radarCountAll = 0;
  @Input() radarCountOwn = 0;
  @Input() radarCountIndependent = 0;
  @Input() radarCountAvailable = 0;
  @Input() radarCountDelivering = 0;
  @Input() radarRiders: Rider[] = [];
  @Input() selectedRadarRider: Rider | null = null;
  @Input() branches: Branch[] = [];
  @Input() orders: Order[] = [];

  @Output() radarFleetTypeChange = new EventEmitter<'all' | 'own' | 'independent'>();
  @Output() radarFilterChange = new EventEmitter<'all' | 'available' | 'delivering' | 'offline'>();
  @Output() flyToRider = new EventEmitter<Rider>();
  @Output() recenterFleetMap = new EventEmitter<void>();

  getBranchName(branchId?: string | null): string {
    if (!branchId || branchId === 'all') {
      const main = this.branches.find(b => b.name?.toLowerCase().includes('principal'));
      return main ? main.name : (this.branches[0]?.name || 'Sede Principal');
    }
    return this.branches.find(b => b.id === branchId)?.name || 'Sucursal Asignada';
  }

  getRiderActiveOrder(riderId: string): Order | undefined {
    return this.orders.find(o => o.driverId === riderId && ['assigned_driver', 'at_merchant', 'picked_up', 'on_the_way'].includes(o.status));
  }
}
