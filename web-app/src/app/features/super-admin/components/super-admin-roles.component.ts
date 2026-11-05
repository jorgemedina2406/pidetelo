import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Permission, UserRole } from '../../../core/models/user.model';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-super-admin-roles',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div>
        <h2 class="text-2xl font-extrabold tracking-tight">{{ i18n.t('sa.roleMatrixTitle') }}</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">{{ i18n.t('sa.matrixDesc') }}</p>
      </div>

      <div class="card-adaptive rounded-2xl p-6 shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left">
            <thead class="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th class="p-4">Capacidad / Permiso</th>
                @for (role of availableRoles; track role) {
                  <th class="p-4 text-center">{{ getRoleLabel(role) }}</th>
                }
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              @for (perm of availablePermissions; track perm.id) {
                <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td class="p-4">
                    <div class="font-bold text-xs">{{ perm.label }}</div>
                    <div class="text-[10px] text-slate-400 font-mono mt-0.5">{{ perm.id }}</div>
                  </td>

                  @for (role of availableRoles; track role) {
                    <td class="p-4 text-center">
                      @if (role === 'SUPER_ADMIN') {
                        <span class="text-brand-500 font-extrabold text-base" title="Acceso Total">✓</span>
                      } @else {
                        <input type="checkbox" 
                               [checked]="checkPermitted(role, perm.id)"
                               (change)="togglePermission.emit({ role, permission: perm.id })"
                               class="accent-brand-500 w-4 h-4 cursor-pointer rounded" />
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
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

