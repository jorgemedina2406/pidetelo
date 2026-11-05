import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Rider } from '../merchant-admin.component';
import { I18nService } from '../../../core/services/i18n.service';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-merchant-riders-tab',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-2xl font-extrabold tracking-tight">{{ i18n.t('ma.riders') }}</h2>
            @if (selectedBranchName) {
              <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                📍 Sede: {{ selectedBranchName }}
              </span>
            }
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">{{ i18n.t('ma.ridersDesc') }}</p>
        </div>

        <button (click)="newRider.emit()"
          class="bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer">
          <app-icon name="plus" [size]="16" className="text-white"></app-icon>
          <span>{{ i18n.t('ma.newRider') }}</span>
        </button>
      </div>

      @if (riders.length === 0) {
        <div class="card-adaptive rounded-2xl p-12 text-center space-y-4 border border-dashed border-slate-300 dark:border-slate-800 animate-fade-in">
          <div class="w-16 h-16 rounded-2xl bg-brand-500/10 text-brand-500 mx-auto flex items-center justify-center">
            <app-icon name="bike" [size]="32"></app-icon>
          </div>
          <div class="space-y-1">
            <h3 class="text-base font-extrabold text-slate-900 dark:text-white">Sin Repartidores Registrados</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              No hay repartidores registrados para esta sede. Agrega repartidores a tu flota para asignar y monitorear pedidos en tiempo real.
            </p>
          </div>
          <button (click)="newRider.emit()"
            class="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-sm inline-flex items-center gap-2 cursor-pointer transition-all active:scale-95">
            <app-icon name="plus" [size]="15" className="text-white"></app-icon>
            <span>Registrar Primer Repartidor</span>
          </button>
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (r of riders; track r.id) {
            <div class="card-adaptive rounded-2xl p-5 shadow-sm space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div
                    class="w-11 h-11 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center font-bold">
                    <app-icon name="bike" [size]="22"></app-icon>
                  </div>
                  <div>
                    <div class="font-bold text-sm">{{ r.name }}</div>
                    <div class="text-[11px] font-mono text-slate-400 uppercase">{{ r.vehiclePlate }} • {{ r.vehicleType }}</div>
                  </div>
                </div>

                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
                  [class.bg-emerald-50]="r.status === 'available'" [class.text-emerald-700]="r.status === 'available'"
                  [class.border-emerald-200]="r.status === 'available'"
                  [class.dark:bg-emerald-950/40]="r.status === 'available'"
                  [class.dark:text-emerald-400]="r.status === 'available'"
                  [class.bg-blue-50]="r.status === 'delivering'" [class.text-blue-700]="r.status === 'delivering'"
                  [class.border-blue-200]="r.status === 'delivering'">
                  {{ r.status === 'available' ? 'Disponible' : 'En Reparto' }}
                </span>
              </div>

              <div
                class="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div class="flex items-center justify-between">
                  <span>Sede Asignada:</span>
                  <span class="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <span>📍</span>
                    <span>{{ r.branchName || 'Sede Asignada' }}</span>
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span>Teléfono:</span>
                  <span class="font-mono text-slate-900 dark:text-white font-semibold">{{ r.phone }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span>Ubicación GPS:</span>
                  <span class="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Transmitiendo
                  </span>
                </div>
              </div>

              <div class="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <button (click)="deleteRider.emit(r)"
                  class="text-xs font-bold text-red-500 hover:text-red-600 hover:underline flex items-center gap-1 transition-colors cursor-pointer"
                  title="Eliminar motorizado">
                  <app-icon name="trash" [size]="13"></app-icon>
                  <span>Eliminar</span>
                </button>
                <button (click)="locateRider.emit(r)"
                  class="text-xs font-bold text-brand-500 hover:underline flex items-center gap-1 cursor-pointer">
                  <app-icon name="map-pin" [size]="13"></app-icon>
                  <span>Localizar en Mapa</span>
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class MerchantRidersTabComponent {
  readonly i18n = inject(I18nService);

  @Input() riders: Rider[] = [];
  @Input() selectedBranchName?: string;

  @Output() newRider = new EventEmitter<void>();
  @Output() deleteRider = new EventEmitter<Rider>();
  @Output() locateRider = new EventEmitter<Rider>();
}

