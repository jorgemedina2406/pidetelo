import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../shared/components/icon.component';
import { AuthStore } from '../../../../core/stores/auth.store';
import { Branch } from '../../../../core/models/branch.model';

@Component({
  selector: 'app-merchant-branches-tab',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './merchant-branches-tab.component.html'
})
export class MerchantBranchesTabComponent {
  readonly auth = inject(AuthStore);
  readonly Math = Math;

  @Input() isBranchLocked = false;
  @Input() userAssignedBranch: Branch | null = null;
  @Input() currentSubscriptionPlan: any = null;
  @Input() branches: Branch[] = [];
  @Input() visibleBranches: Branch[] = [];
  @Input() branchesViewMode: 'grid' | 'map' = 'grid';
  @Input() isBranchSavedSuccess = false;
  @Input() activeBranchesCount = 0;
  @Input() pendingBranchesCount = 0;
  @Input() currentTenant: any = null;

  @Output() openNewBranchModal = new EventEmitter<void>();
  @Output() openEditBranchModal = new EventEmitter<Branch>();
  @Output() openDeleteBranchModal = new EventEmitter<Branch>();
  @Output() toggleBranch = new EventEmitter<Branch>();
  @Output() copyBranchMenuLink = new EventEmitter<Branch>();
  @Output() copyWhatsAppGreeting = new EventEmitter<Branch>();
  @Output() focusBranchOnMap = new EventEmitter<Branch>();
  @Output() toggleBranchesView = new EventEmitter<'grid' | 'map'>();
  @Output() dismissSavedSuccess = new EventEmitter<void>();
  @Output() manageBranchRiders = new EventEmitter<string>();
  @Output() newRiderForBranch = new EventEmitter<string>();

  cleanBranchDisplayName(name?: string | null): string {
    if (!name) return '';
    return name.replace(/(\s*\(Sede Principal\))+/gi, '').trim();
  }

  isMainBranchOrOwner(): boolean {
    const user = this.auth.currentUser();
    if (!user) return false;
    const role = (user.role || '').toUpperCase();
    if (role === 'SUPER_ADMIN' || role === 'SUPERADMIN' || role === 'ADMIN' || role === 'OWNER') return true;
    return !user.branchId || user.branchId === 'all';
  }

  canToggleBranch(branch: Branch): boolean {
    if (this.isMainBranchOrOwner()) return true;
    const myBranchId = this.auth.currentUser()?.branchId;
    return Boolean(myBranchId && myBranchId === branch.id);
  }

  getTenantEmail(): string {
    return this.currentTenant?.email || this.currentTenant?.contact?.email || this.auth.currentUser()?.email || 'Sin correo asignado';
  }

  isRealPagoMovil(cred?: any): boolean {
    if (!cred || !cred.pagoMovilPhone || !cred.pagoMovilBank) return false;
    const cleanPhone = String(cred.pagoMovilPhone || '').replace(/\D/g, '');
    const cleanId = String(cred.pagoMovilIdNumber || '').replace(/\D/g, '');
    if (cleanPhone === '04121234567' || cleanPhone === '04140000000' || cleanPhone.includes('1234567')) return false;
    if (cleanId.includes('50123456') || cleanId.includes('12345678') || cleanId === '00000000') return false;
    return true;
  }
}
