import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Permission, UserRole } from '../../../../core/models/user.model';
import { I18nService } from '../../../../core/services/i18n.service';

@Component({
  selector: 'app-super-admin-roles',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './super-admin-roles.component.html'
})
export class SuperAdminRolesComponent {
  readonly i18n = inject(I18nService);

  @Input() availableRoles: UserRole[] = [];
  @Input() availablePermissions: { id: Permission; label: string }[] = [];
  @Input() isRolePermittedFn?: (role: UserRole, perm: Permission) => boolean;

  @Output() togglePermission = new EventEmitter<{ role: UserRole; permission: Permission }>();

  checkPermitted(role: UserRole, perm: Permission): boolean {
    if (this.isRolePermittedFn) {
      return this.isRolePermittedFn(role, perm);
    }
    return false;
  }

  getRoleLabel(role: UserRole): string {
    switch (role) {
      case 'SUPER_ADMIN': return 'Super Admin';
      case 'MERCHANT_OWNER': return 'Dueño Local';
      case 'MERCHANT_MANAGER': return 'Gerente Sede';
      case 'MERCHANT_KITCHEN': return 'Cocina';
      case 'MERCHANT_DISPATCH': return 'Despachador';
      case 'RIDER': return 'Motorizado';
      case 'CUSTOMER': return 'Cliente';
      case 'PLATFORM_SUPPORT': return 'Soporte Plataforma';
      default: return role;
    }
  }
}

