import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-merchant-users-tab',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="space-y-6 animate-fade-in">
      <!-- Header con Acción Principal -->
      <div class="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-2xl font-extrabold tracking-tight">Equipo & Encargados de Sucursal</h2>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              {{ users.length }} Colaborador{{ users.length === 1 ? '' : 'es' }}
            </span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Registra y asigna encargados de sede, cocineros y despachadores a cada sucursal física de tu comercio.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button (click)="createUser.emit()"
            class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-bold text-xs shadow-md shadow-brand-500/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95">
            <app-icon name="user-plus" [size]="15"></app-icon>
            <span>+ Nuevo Colaborador</span>
          </button>
        </div>
      </div>

      <!-- Filtros de Rol y Ámbito de Sucursal -->
      <div class="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-850/60 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <!-- Selector de Roles -->
        <div class="flex flex-wrap items-center gap-1.5 text-xs">
          <span class="text-slate-400 font-bold uppercase text-[10px] mr-1">Rol:</span>
          <button (click)="filterRoleChange.emit('all')"
            [class.bg-brand-500]="filterRole === 'all'"
            [class.text-white]="filterRole === 'all'"
            [class.shadow-sm]="filterRole === 'all'"
            class="px-3 py-1.5 rounded-lg font-semibold transition-all hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer">
            Todos
          </button>
          <button (click)="filterRoleChange.emit('MERCHANT_MANAGER')"
            [class.bg-brand-500]="filterRole === 'MERCHANT_MANAGER'"
            [class.text-white]="filterRole === 'MERCHANT_MANAGER'"
            [class.shadow-sm]="filterRole === 'MERCHANT_MANAGER'"
            class="px-3 py-1.5 rounded-lg font-semibold transition-all hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-1">
            <span>🏢</span> Encargados de Sede
          </button>
          <button (click)="filterRoleChange.emit('MERCHANT_KITCHEN')"
            [class.bg-brand-500]="filterRole === 'MERCHANT_KITCHEN'"
            [class.text-white]="filterRole === 'MERCHANT_KITCHEN'"
            [class.shadow-sm]="filterRole === 'MERCHANT_KITCHEN'"
            class="px-3 py-1.5 rounded-lg font-semibold transition-all hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-1">
            <span>👨‍🍳</span> Cocina
          </button>
          <button (click)="filterRoleChange.emit('MERCHANT_DISPATCH')"
            [class.bg-brand-500]="filterRole === 'MERCHANT_DISPATCH'"
            [class.text-white]="filterRole === 'MERCHANT_DISPATCH'"
            [class.shadow-sm]="filterRole === 'MERCHANT_DISPATCH'"
            class="px-3 py-1.5 rounded-lg font-semibold transition-all hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-1">
            <span>📦</span> Despacho
          </button>
          <button (click)="filterRoleChange.emit('MERCHANT_OWNER')"
            [class.bg-brand-500]="filterRole === 'MERCHANT_OWNER'"
            [class.text-white]="filterRole === 'MERCHANT_OWNER'"
            [class.shadow-sm]="filterRole === 'MERCHANT_OWNER'"
            class="px-3 py-1.5 rounded-lg font-semibold transition-all hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-1">
            <span>👑</span> Dueños / Socios
          </button>
        </div>

        <!-- Indicador de Sucursal Activa -->
        <div class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <span>Sede activa en panel:</span>
          <span class="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200">
            📍 {{ activeBranchName || 'Sede Principal' }}
          </span>
        </div>
      </div>

      <!-- Grid de Tarjetas de Colaboradores -->
      @if (users.length > 0) {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          @for (u of users; track u.id) {
            <div class="card-adaptive rounded-2xl p-5 shadow-sm border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between gap-4 transition-all hover:shadow-md">
              <div class="space-y-3.5">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <img [src]="u.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'"
                      alt="Avatar"
                      class="w-11 h-11 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm shrink-0" />
                    <div>
                      <div class="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{{ u.name }}</span>
                        @if (u.role === 'MERCHANT_OWNER') {
                          <span title="Dueño de la cuenta" class="text-amber-500 text-xs">👑</span>
                        }
                      </div>
                      <div class="text-[11px] text-slate-400 truncate">{{ u.email }}</div>
                    </div>
                  </div>

                  <button (click)="toggleStatus.emit(u)"
                    [title]="u.isActive ? 'Desactivar usuario' : 'Activar usuario'"
                    class="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 transition-all cursor-pointer"
                    [class.bg-emerald-500/10]="u.isActive"
                    [class.text-emerald-600]="u.isActive"
                    [class.dark:text-emerald-400]="u.isActive"
                    [class.border]="true"
                    [class.border-emerald-500/20]="u.isActive"
                    [class.bg-slate-100]="!u.isActive"
                    [class.text-slate-400]="!u.isActive"
                    [class.dark:bg-slate-800]="!u.isActive">
                    <span class="w-1.5 h-1.5 rounded-full" [class.bg-emerald-500]="u.isActive" [class.bg-slate-400]="!u.isActive"></span>
                    {{ u.isActive ? 'Activo' : 'Inactivo' }}
                  </button>
                </div>

                <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850/80 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <app-icon name="map-pin" [size]="11"></app-icon>
                    <span>Sucursal Asignada:</span>
                  </div>
                  <div class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-brand-500"></span>
                    <span>{{ u.branchName || activeBranchName || 'Sede Principal' }}</span>
                  </div>
                </div>

                @if (u.phone) {
                  <div class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <app-icon name="phone" [size]="12" class="text-slate-400"></app-icon>
                    <span>{{ u.phone }}</span>
                  </div>
                }
              </div>

              <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                @if (u.role === 'MERCHANT_MANAGER') {
                  <span class="text-[10px] px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-extrabold border border-indigo-200 dark:border-indigo-800/60 flex items-center gap-1">
                    <span>🏢</span> Encargado de Sede
                  </span>
                } @else if (u.role === 'MERCHANT_KITCHEN') {
                  <span class="text-[10px] px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-extrabold border border-amber-200 dark:border-amber-800/60 flex items-center gap-1">
                    <span>👨‍🍳</span> Cocina / KDS
                  </span>
                } @else if (u.role === 'MERCHANT_DISPATCH') {
                  <span class="text-[10px] px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-extrabold border border-blue-200 dark:border-blue-800/60 flex items-center gap-1">
                    <span>📦</span> Despacho
                  </span>
                } @else if (u.role === 'MERCHANT_OWNER') {
                  <span class="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-extrabold border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                    <span>👑</span> Propietario
                  </span>
                } @else {
                  <span class="text-[10px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                    {{ u.role }}
                  </span>
                }

                <div class="flex items-center gap-1">
                  <button (click)="editUser.emit(u)"
                    title="Editar colaborador"
                    class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer">
                    <app-icon name="edit" [size]="13"></app-icon>
                  </button>
                  @if (u.role !== 'MERCHANT_OWNER') {
                    <button (click)="deleteUser.emit(u)"
                      title="Eliminar colaborador"
                      class="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center transition-all cursor-pointer">
                      <app-icon name="trash" [size]="13"></app-icon>
                    </button>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="p-12 text-center card-adaptive rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 space-y-4">
          <div class="w-14 h-14 mx-auto rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center text-2xl font-bold">
            👥
          </div>
          <div>
            <h3 class="text-base font-extrabold text-slate-900 dark:text-white">No se encontraron colaboradores</h3>
            <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No hay usuarios que coincidan con la sucursal o el rol seleccionado. Registra al primer encargado de sede.
            </p>
          </div>
          <button (click)="createUser.emit()"
            class="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer">
            + Registrar Primer Colaborador
          </button>
        </div>
      }
    </div>
  `
})
export class MerchantUsersTabComponent {
  @Input() users: any[] = [];
  @Input() activeBranchName?: string;
  @Input() filterRole = 'all';

  @Output() filterRoleChange = new EventEmitter<string>();
  @Output() createUser = new EventEmitter<void>();
  @Output() editUser = new EventEmitter<any>();
  @Output() deleteUser = new EventEmitter<any>();
  @Output() toggleStatus = new EventEmitter<any>();
}

