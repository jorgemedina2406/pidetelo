import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Branch } from '../../../core/models/branch.model';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-delete-branch-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    @if (isOpen && branch) {
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      (click)="close.emit()">
      <div
        class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-3xl shadow-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 space-y-5"
        (click)="$event.stopPropagation()">

        <div class="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div class="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
            <app-icon name="trash" [size]="24"></app-icon>
          </div>
          <div>
            <h3 class="font-extrabold text-base text-slate-900 dark:text-white">Eliminar Sucursal</h3>
            <p class="text-xs text-red-600 dark:text-red-400 font-semibold">Acción definitiva e irreversible</p>
          </div>
        </div>

        @if (errorMessage) {
        <div class="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs">
          ⚠️ {{ errorMessage }}
        </div>
        }

        <div class="space-y-3 text-xs text-slate-600 dark:text-slate-300">
          <p>
            ¿Estás seguro de que deseas eliminar permanentemente la sucursal <strong class="text-slate-900 dark:text-white">"{{ branch.name }}"</strong>?
          </p>

          <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1.5 text-[11px]">
            <div class="font-bold text-slate-800 dark:text-slate-200">Esta acción eliminará automáticamente:</div>
            <ul class="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400">
              <li>Las credenciales de ingreso y el usuario encargado de esta sucursal ({{ branch.managerEmail || 'cuenta asignada' }}).</li>
              <li>Las cuentas de Pago Móvil / Zelle configuradas para esta sede.</li>
              <li>El inventario, precios especiales y horarios de entrega locales.</li>
              <li>Desvinculará a los repartidores asignados para que queden disponibles en toda la empresa.</li>
            </ul>
          </div>

          <p class="text-[11px] text-slate-400 italic">
            * Las ventas y pedidos históricos se conservarán para las estadísticas y reportes contables globales de tu comercio.
          </p>
        </div>

        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
          <button type="button" (click)="close.emit()" [disabled]="isDeleting"
            class="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer">
            Cancelar
          </button>
          <button type="button" (click)="confirm.emit(branch)" [disabled]="isDeleting"
            class="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-md shadow-red-600/20 flex items-center gap-2 cursor-pointer transition-all active:scale-95">
            @if (isDeleting) {
              <span class="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full"></span>
              <span>Eliminando...</span>
            } @else {
              <app-icon name="trash" [size]="14"></app-icon>
              <span>Sí, Eliminar Sucursal</span>
            }
          </button>
        </div>

      </div>
    </div>
    }
  `
})
export class DeleteBranchModalComponent {
  @Input() isOpen = false;
  @Input() branch: Branch | null = null;
  @Input() isDeleting = false;
  @Input() errorMessage: string | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<Branch>();
}
