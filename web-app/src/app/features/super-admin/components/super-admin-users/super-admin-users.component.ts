import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../shared/components/icon.component';

@Component({
  selector: 'app-super-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './super-admin-users.component.html'
})
export class SuperAdminUsersComponent {
  @Input() set users(value: any[]) {
    this._users.set(value || []);
  }
  @Input() loading = false;
  @Output() refresh = new EventEmitter<void>();
  @Output() deleteUser = new EventEmitter<any>();
  @Output() toggleActive = new EventEmitter<any>();
  @Output() verifyRider = new EventEmitter<{ riderId: string; isApproved: boolean }>();

  private readonly _users = signal<any[]>([]);
  readonly userSearchQuery = signal('');
  readonly userRoleFilter = signal('all');

  readonly platformUsersCount = computed(() => this._users().length);
  readonly customerUsersCount = computed(() => this._users().filter(u => (u.role || '').toUpperCase().includes('CUSTOMER') || (u.role || '').toUpperCase().includes('CLIENT')).length);
  readonly riderUsersCount = computed(() => this._users().filter(u => (u.role || '').toUpperCase().includes('RIDER') || (u.role || '').toUpperCase().includes('MOTOR')).length);
  readonly pendingRidersCount = computed(() => this._users().filter(u => {
    const r = (u.role || '').toUpperCase();
    const isRider = r.includes('RIDER') || r.includes('MOTOR');
    return isRider && (!u.isCertified || u.verificationStatus === 'pending');
  }).length);
  readonly merchantUsersCount = computed(() => this._users().filter(u => {
    const r = (u.role || '').toUpperCase();
    return r.includes('OWNER') || r.includes('ADMIN') || r.includes('MANAGER') || r.includes('KITCHEN') || r.includes('DISPATCH');
  }).length);

  // Modal de revisión de documentos
  readonly selectedRiderForReview = signal<any | null>(null);

  openReviewModal(rider: any): void {
    this.selectedRiderForReview.set(rider);
  }

  closeReviewModal(): void {
    this.selectedRiderForReview.set(null);
  }

  openLink(url?: string): void {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  onApproveRider(rider: any): void {
    if (!rider?.id) return;
    this.verifyRider.emit({ riderId: rider.id, isApproved: true });
    this.closeReviewModal();
  }

  onRejectRider(rider: any): void {
    if (!rider?.id) return;
    this.verifyRider.emit({ riderId: rider.id, isApproved: false });
    this.closeReviewModal();
  }

  readonly filteredPlatformUsers = computed(() => {
    const q = this.userSearchQuery().toLowerCase().trim();
    const filterRole = this.userRoleFilter().toUpperCase().trim();
    return this._users().filter(u => {
      const matchQuery = !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && u.phone.toLowerCase().includes(q)) ||
        (u.tenantName && u.tenantName.toLowerCase().includes(q));

      if (!matchQuery) return false;
      if (filterRole === 'ALL') return true;

      const userRole = (u.role || '').toUpperCase().trim();
      return (
        userRole === filterRole ||
        (filterRole === 'MERCHANT_OWNER' && (userRole === 'MERCHANT_ADMIN' || userRole === 'ADMIN' || userRole === 'OWNER')) ||
        (filterRole === 'MERCHANT_MANAGER' && (userRole === 'BRANCH_MANAGER' || userRole === 'MANAGER')) ||
        (filterRole === 'MERCHANT_KITCHEN' && (userRole === 'KITCHEN' || userRole === 'COCINA')) ||
        (filterRole === 'RIDER' && (userRole === 'MOTORIZADO' || userRole === 'REPARTIDOR')) ||
        (filterRole === 'CUSTOMER' && (userRole === 'CLIENTE')) ||
        (filterRole === 'SUPER_ADMIN' && (userRole === 'SUPERADMIN'))
      );
    });
  });

  getRoleLabel(role?: string): string {
    if (!role) return 'Cliente';
    const r = role.toUpperCase();
    if (r.includes('SUPER')) return 'Superadmin';
    if (r.includes('OWNER') || r === 'MERCHANT_ADMIN' || r === 'ADMIN') return 'Dueño Local';
    if (r.includes('MANAGER')) return 'Encargado';
    if (r.includes('KITCHEN') || r.includes('COCINA')) return 'Cocina';
    if (r.includes('DISPATCH') || r.includes('DESPACHO')) return 'Despacho';
    if (r.includes('RIDER') || r.includes('MOTORIZADO') || r.includes('REPARTIDOR')) return 'Motorizado';
    if (r.includes('CUSTOMER') || r.includes('CLIENTE')) return 'Cliente';
    return role;
  }
}

