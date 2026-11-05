import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../shared/components/icon.component';

export interface DispatchFilterConfig {
  maxDistanceKm: number;
  minRating: number;
  minDeliveries: number;
  onlyAvailable: boolean;
}

@Component({
  selector: 'app-dispatch-config-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    @if (isOpen) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
          
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <app-icon name="sliders" [size]="18"></app-icon>
              </div>
              <div>
                <h3 class="font-extrabold text-base text-slate-900 dark:text-white">Filtros de Despacho</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">Configura qué motorizados mostrar en tus pedidos</p>
              </div>
            </div>
            <button (click)="close.emit()"
                    class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer">
              ✕
            </button>
          </div>

          <div class="space-y-3.5 text-xs">
            <!-- 1. Distancia máxima -->
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Distancia Máxima de Búsqueda
              </label>
              <select [(ngModel)]="localConfig.maxDistanceKm"
                      class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold">
                <option [value]="3">Hasta 3 km a la redonda (Ultra cercano)</option>
                <option [value]="5">Hasta 5 km (Recomendado zonas urbanas)</option>
                <option [value]="10">Hasta 10 km (Interurbano / Amplio)</option>
                <option [value]="15">Hasta 15 km (Toda la ciudad)</option>
                <option [value]="30">Hasta 30 km (Sin restricción de distancia)</option>
              </select>
            </div>

            <!-- 2. Calificación mínima -->
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Calificación Mínima del Motorizado
              </label>
              <select [(ngModel)]="localConfig.minRating"
                      class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold">
                <option [value]="0">Cualquier calificación (Todos los verificados)</option>
                <option [value]="4.0">⭐ 4.0 estrellas o más</option>
                <option [value]="4.5">⭐ 4.5 estrellas o más (Alta reputación)</option>
                <option [value]="4.8">⭐ 4.8 estrellas o más (Solo los mejores)</option>
              </select>
            </div>

            <!-- 3. Entregas mínimas -->
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Experiencia Mínima en Entregas
              </label>
              <select [(ngModel)]="localConfig.minDeliveries"
                      class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold">
                <option [value]="0">Sin requisito (Incluye recién certificados)</option>
                <option [value]="5">Al menos 5 pedidos completados</option>
                <option [value]="20">Al menos 20 pedidos completados (Veteranos)</option>
              </select>
            </div>

            <!-- 4. Disponibilidad -->
            <div class="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1.5">
              <label class="flex items-center gap-2 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                <input type="checkbox" [(ngModel)]="localConfig.onlyAvailable"
                       class="rounded text-brand-600 focus:ring-brand-500">
                <span>Solo motorizados en línea y desocupados</span>
              </label>
              <p class="text-[10px] text-slate-500 dark:text-slate-400 pl-5">
                Oculta automáticamente a motorizados que ya tengan una entrega en camino.
              </p>
            </div>
          </div>

          <div class="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button (click)="close.emit()"
                    class="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              Cancelar
            </button>
            <button (click)="save.emit(localConfig)"
                    class="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md cursor-pointer">
              Guardar y Aplicar
            </button>
          </div>

        </div>
      </div>
    }
  `
})
export class DispatchConfigModalComponent {
  @Input() isOpen = false;
  @Input() set config(val: DispatchFilterConfig) {
    if (val) {
      this.localConfig = { ...val };
    }
  }

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<DispatchFilterConfig>();

  localConfig: DispatchFilterConfig = {
    maxDistanceKm: 15,
    minRating: 0,
    minDeliveries: 0,
    onlyAvailable: true
  };
}
