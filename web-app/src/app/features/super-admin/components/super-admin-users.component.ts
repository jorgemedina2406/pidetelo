import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-super-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="space-y-6 animate-fade-in">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <app-icon name="users" [size]="24" className="text-brand-500"></app-icon>
            <span>Usuarios Registrados en Pídetelo</span>
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Directorio global completo de clientes, motorizados, administradores y personal de comercios de la plataforma.
          </p>
        </div>

        <button (click)="refresh.emit()" class="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer">
          <app-icon name="refresh-cw" [size]="14"></app-icon>
          <span>Refrescar Lista</span>
        </button>
      </div>

      <!-- KPI Metrics Strip for Users -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div (click)="userRoleFilter.set('all')" class="card-adaptive p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-brand-500 transition-all">
          <div class="text-[11px] font-bold text-slate-500 dark:text-slate-400">Total Registrados</div>
          <div class="text-xl font-black text-slate-900 dark:text-white mt-1">{{ platformUsersCount() }}</div>
        </div>
        <div (click)="userRoleFilter.set('CUSTOMER')" class="card-adaptive p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-emerald-500 transition-all">
          <div class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Clientes</div>
          <div class="text-xl font-black text-slate-900 dark:text-white mt-1">{{ customerUsersCount() }}</div>
        </div>
        <div (click)="userRoleFilter.set('RIDER')" class="card-adaptive p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-blue-500 transition-all">
          <div class="text-[11px] font-bold text-blue-600 dark:text-blue-400">Motorizados / Riders</div>
          <div class="text-xl font-black text-slate-900 dark:text-white mt-1">{{ riderUsersCount() }}</div>
        </div>
        <div (click)="userRoleFilter.set('MERCHANT_OWNER')" class="card-adaptive p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-amber-500 transition-all">
          <div class="text-[11px] font-bold text-amber-600 dark:text-amber-400">Personal Comercios</div>
          <div class="text-xl font-black text-slate-900 dark:text-white mt-1">{{ merchantUsersCount() }}</div>
        </div>
      </div>

      <!-- Filtros y Búsqueda -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex-1 min-w-[240px]">
          <input type="text" [ngModel]="userSearchQuery()" (ngModelChange)="userSearchQuery.set($event)"
                 placeholder="Buscar por nombre, correo, teléfono o comercio..."
                 class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-500 font-medium" />
        </div>
        <div class="w-56">
          <select [ngModel]="userRoleFilter()" (ngModelChange)="userRoleFilter.set($event)"
                  class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-brand-500">
            <option value="all">Todos los Roles ({{ platformUsersCount() }})</option>
            <option value="CUSTOMER">Clientes ({{ customerUsersCount() }})</option>
            <option value="RIDER">Motorizados / Riders ({{ riderUsersCount() }})</option>
            <option value="MERCHANT_OWNER">Dueños de Comercio</option>
            <option value="MERCHANT_MANAGER">Encargados de Sucursal</option>
            <option value="MERCHANT_KITCHEN">Cocina / Personal</option>
            <option value="SUPER_ADMIN">Super Administradores</option>
          </select>
        </div>
      </div>

      <!-- Tabla de Usuarios -->
      <div class="card-adaptive rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left">
            <thead class="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th class="p-3.5">Usuario</th>
                <th class="p-3.5">Contacto</th>
                <th class="p-3.5 text-center">Rol en Plataforma</th>
                <th class="p-3.5">Comercio / Ubicación</th>
                <th class="p-3.5 text-center">Fecha Registro</th>
                <th class="p-3.5 text-center">Estado</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              @for (u of filteredPlatformUsers(); track u.id) {
                <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td class="p-3.5">
                    <div class="flex items-center gap-2.5">
                      <div class="w-8 h-8 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 font-extrabold flex items-center justify-center text-xs">
                        {{ (u.name || 'U').substring(0, 1).toUpperCase() }}
                      </div>
                      <div>
                        <div class="font-bold text-xs text-slate-900 dark:text-white">{{ u.name || 'Sin nombre' }}</div>
                        <div class="text-[10px] text-slate-400 font-mono">{{ u.id }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="p-3.5">
                    <div class="text-xs font-medium">{{ u.email }}</div>
                    <div class="text-[10px] text-slate-400 font-mono">{{ u.phone || 'Sin teléfono' }}</div>
                  </td>
                  <td class="p-3.5 text-center">
                    <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide inline-flex items-center gap-1"
                          [class.bg-purple-100]="(u.role || '').toUpperCase().includes('SUPER')"
                          [class.text-purple-700]="(u.role || '').toUpperCase().includes('SUPER')"
                          [class.dark:bg-purple-950]="(u.role || '').toUpperCase().includes('SUPER')"
                          [class.dark:text-purple-300]="(u.role || '').toUpperCase().includes('SUPER')"
                          [class.bg-amber-100]="(u.role || '').toUpperCase().includes('OWNER') || (u.role || '').toUpperCase().includes('ADMIN')"
                          [class.text-amber-800]="(u.role || '').toUpperCase().includes('OWNER') || (u.role || '').toUpperCase().includes('ADMIN')"
                          [class.dark:bg-amber-950]="(u.role || '').toUpperCase().includes('OWNER') || (u.role || '').toUpperCase().includes('ADMIN')"
                          [class.dark:text-amber-300]="(u.role || '').toUpperCase().includes('OWNER') || (u.role || '').toUpperCase().includes('ADMIN')"
                          [class.bg-blue-100]="(u.role || '').toUpperCase().includes('RIDER') || (u.role || '').toUpperCase().includes('MOTOR')"
                          [class.text-blue-700]="(u.role || '').toUpperCase().includes('RIDER') || (u.role || '').toUpperCase().includes('MOTOR')"
                          [class.dark:bg-blue-950]="(u.role || '').toUpperCase().includes('RIDER') || (u.role || '').toUpperCase().includes('MOTOR')"
                          [class.dark:text-blue-300]="(u.role || '').toUpperCase().includes('RIDER') || (u.role || '').toUpperCase().includes('MOTOR')"
                          [class.bg-emerald-100]="(u.role || '').toUpperCase().includes('CUSTOMER') || (u.role || '').toUpperCase().includes('CLIENT')"
                          [class.text-emerald-700]="(u.role || '').toUpperCase().includes('CUSTOMER') || (u.role || '').toUpperCase().includes('CLIENT')"
                          [class.dark:bg-emerald-950]="(u.role || '').toUpperCase().includes('CUSTOMER') || (u.role || '').toUpperCase().includes('CLIENT')"
                          [class.dark:text-emerald-300]="(u.role || '').toUpperCase().includes('CUSTOMER') || (u.role || '').toUpperCase().includes('CLIENT')"
                          [class.bg-indigo-100]="(u.role || '').toUpperCase().includes('MANAGER')"
                          [class.text-indigo-700]="(u.role || '').toUpperCase().includes('MANAGER')"
                          [class.dark:bg-indigo-950]="(u.role || '').toUpperCase().includes('MANAGER')"
                          [class.dark:text-indigo-300]="(u.role || '').toUpperCase().includes('MANAGER')">
                      {{ getRoleLabel(u.role) }}
                    </span>
                  </td>
                  <td class="p-3.5">
                    <div class="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {{ u.tenantName || 'Pídetelo Global' }}
                    </div>
                    @if (u.branchName && u.branchName !== 'Sede Principal') {
                      <div class="text-[10px] text-slate-400 font-medium">{{ u.branchName }}</div>
                    }
                  </td>
                  <td class="p-3.5 text-center text-[11px] text-slate-400">
                    {{ u.createdAt ? (u.createdAt | date:'shortDate') : 'Reciente' }}
                  </td>
                  <td class="p-3.5 text-center">
                    <span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>Activo</span>
                    </span>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="p-8 text-center text-slate-400 text-xs">
                    No se encontraron usuarios registrados con el criterio de búsqueda.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class SuperAdminUsersComponent {
  @Input() set users(value: any[]) {
    this._users.set(value || []);
  }
  @Input() loading = false;
  @Output() refresh = new EventEmitter<void>();

  private readonly _users = signal<any[]>([]);
  readonly userSearchQuery = signal('');
  readonly userRoleFilter = signal('all');

  readonly platformUsersCount = computed(() => this._users().length);
  readonly customerUsersCount = computed(() => this._users().filter(u => (u.role || '').toUpperCase().includes('CUSTOMER') || (u.role || '').toUpperCase().includes('CLIENT')).length);
  readonly riderUsersCount = computed(() => this._users().filter(u => (u.role || '').toUpperCase().includes('RIDER') || (u.role || '').toUpperCase().includes('MOTOR')).length);
  readonly merchantUsersCount = computed(() => this._users().filter(u => {
    const r = (u.role || '').toUpperCase();
    return r.includes('OWNER') || r.includes('ADMIN') || r.includes('MANAGER') || r.includes('KITCHEN') || r.includes('DISPATCH');
  }).length);

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

