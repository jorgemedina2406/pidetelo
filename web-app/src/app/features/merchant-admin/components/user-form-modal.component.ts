import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Branch } from '../../../core/models/branch.model';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-user-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <!-- Modal: Formulario Crear / Editar Usuario -->
    @if (isOpen) {
    <div class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
      (click)="close.emit()">
      <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8 animate-scale-in"
        (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div class="p-6 bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-brand-500 text-white flex items-center justify-center shadow-md shadow-brand-500/30">
              <app-icon [name]="isEditing ? 'edit' : 'user-plus'" [size]="18"></app-icon>
            </div>
            <div>
              <h3 class="text-base font-extrabold text-slate-900 dark:text-white">
                {{ isEditing ? 'Editar Colaborador' : 'Nuevo Colaborador de Sede' }}
              </h3>
              <p class="text-[11px] text-slate-400">
                {{ isEditing ? 'Actualiza su rol o asignación de sucursal' : 'Registra un encargado, cocinero o despachador' }}
              </p>
            </div>
          </div>

          <button (click)="close.emit()"
            class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center transition-all cursor-pointer">
            <app-icon name="x" [size]="16"></app-icon>
          </button>
        </div>

        <!-- Body Form -->
        <div class="p-6 space-y-4">

          @if (formError) {
          <div class="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5 animate-shake">
            <span class="text-base shrink-0 leading-none">⚠️</span>
            <div class="font-semibold leading-relaxed">{{ formError }}</div>
          </div>
          }
          
          <!-- Nombre Completo -->
          <div class="space-y-1.5">
            <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">Nombre Completo *</label>
            <input type="text" [(ngModel)]="userForm.name" placeholder="Ej: Carlos Mendoza"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-brand-500 outline-none text-slate-900 dark:text-white" />
          </div>

          <!-- Correo Electrónico -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">Correo Electrónico (Login) *</label>
              <span class="text-[10px] text-slate-400">Debe ser único en la plataforma</span>
            </div>
            <input type="email" [(ngModel)]="userForm.email" [disabled]="isEditing" placeholder="Ej: gerente.lamata@burgerlab.com"
              [class.border-rose-500]="formError && formError.toLowerCase().includes('correo')"
              [class.ring-2]="formError && formError.toLowerCase().includes('correo')"
              [class.ring-rose-500/20]="formError && formError.toLowerCase().includes('correo')"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-brand-500 outline-none text-slate-900 dark:text-white disabled:opacity-60" />
          </div>

          <!-- Teléfono -->
          <div class="space-y-1.5">
            <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">Teléfono Celular / WhatsApp</label>
            <input type="tel" [(ngModel)]="userForm.phone" placeholder="Ej: +584123344556"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-brand-500 outline-none text-slate-900 dark:text-white" />
          </div>

          <!-- Rol del Colaborador -->
          <div class="space-y-1.5">
            <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">Rol & Responsabilidad *</label>
            <select [(ngModel)]="userForm.role"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-brand-500 outline-none text-slate-900 dark:text-white cursor-pointer font-medium">
              <option value="MERCHANT_MANAGER">🏢 Encargado de Sucursal (Gerente de Sede)</option>
              <option value="MERCHANT_KITCHEN">👨‍🍳 Cocina / Comandas KDS</option>
              <option value="MERCHANT_DISPATCH">📦 Despacho / Asignador de Repartidores</option>
              <option value="MERCHANT_OWNER">👑 Socio / Co-propietario (Acceso Global)</option>
            </select>
            <p class="text-[10px] text-slate-400">
              @if (userForm.role === 'MERCHANT_MANAGER') {
              Gestiona pedidos, menú, inventario y repartos de su sucursal asignada.
              } @else if (userForm.role === 'MERCHANT_KITCHEN') {
              Solo visualiza la pantalla de comandas de cocina de esa sede.
              } @else if (userForm.role === 'MERCHANT_DISPATCH') {
              Asigna motorizados y supervisa entregas de esa sede.
              } @else {
              Acceso administrativo total a todas las sedes del comercio.
              }
            </p>
          </div>

          <!-- Sucursal Asignada -->
          <div class="space-y-1.5">
            <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">Sucursal Asignada</label>
            <div class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-between">
              <span class="text-xs font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <app-icon name="map-pin" [size]="14" className="text-brand-500"></app-icon>
                <span>{{ activeBranch?.name || 'Sede Principal' }}</span>
              </span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400">
                Exclusivo de esta sede
              </span>
            </div>
            <p class="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
              El colaborador solo operará y visualizará información dentro de esta sucursal física.
            </p>
          </div>

          <!-- Contraseña Inicial (Solo al crear) -->
          @if (!isEditing) {
          <div class="space-y-1.5">
            <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">Contraseña Inicial *</label>
            <input type="password" [(ngModel)]="userForm.password" placeholder="Mínimo 6 caracteres"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-brand-500 outline-none text-slate-900 dark:text-white" />
          </div>
          }

        </div>

        <!-- Footer -->
        <div class="p-5 bg-slate-50 dark:bg-slate-850/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button (click)="close.emit()"
            class="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer">
            Cancelar
          </button>
          <button (click)="save.emit()" [disabled]="isSaving"
            class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-bold text-xs shadow-md shadow-brand-500/25 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
            @if (isSaving) {
            <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            <span>Guardando...</span>
            } @else {
            <span>{{ isEditing ? 'Actualizar Colaborador' : 'Crear Colaborador' }}</span>
            }
          </button>
        </div>

      </div>
    </div>
    }

    <!-- Modal de Advertencia: Conflicto de Correo -->
    @if (conflictData) {
    <div class="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-rose-900/60 overflow-hidden animate-scale-in">
        
        <div class="p-6 bg-gradient-to-b from-rose-500/15 to-transparent border-b border-rose-100 dark:border-rose-950/50 flex items-start gap-4">
          <div class="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 shrink-0 text-2xl font-black">
            ⚠️
          </div>
          <div class="space-y-1">
            <h3 class="text-base font-black text-slate-900 dark:text-white leading-tight">
              {{ conflictData.title }}
            </h3>
            <p class="text-xs text-rose-600 dark:text-rose-400 font-mono font-bold break-all">
              {{ conflictData.email }}
            </p>
          </div>
        </div>

        <div class="p-6 space-y-3.5">
          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850/80 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
            {{ conflictData.message }}
          </div>
          <p class="text-[11px] text-slate-500 dark:text-slate-400">
            Por políticas de autenticación y seguridad de la plataforma SaaS, cada correo electrónico debe ser único en todo el sistema.
          </p>
        </div>

        <div class="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button (click)="closeConflict.emit()"
            class="w-full py-2.5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 dark:from-white dark:to-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold text-xs shadow-md transition-all cursor-pointer">
            Entendido, usaré otro correo
          </button>
        </div>

      </div>
    </div>
    }
  `
})
export class UserFormModalComponent {
  @Input() isOpen = false;
  @Input() isEditing = false;
  @Input() userForm: any = {};
  @Input() formError: string | null = null;
  @Input() isSaving = false;
  @Input() activeBranch: Branch | null = null;
  @Input() conflictData: { title: string; email: string; message: string } | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
  @Output() closeConflict = new EventEmitter<void>();
}
