import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../../core/services/i18n.service';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-super-admin-metrics',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="space-y-6 animate-fade-in">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-extrabold tracking-tight">{{ i18n.t('sa.metrics') }} & Reportes</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Datos consolidados en tiempo real directamente desde la base de datos de pedidos y sucursales.
          </p>
        </div>
        <button (click)="refresh.emit()" class="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer">
          <app-icon name="refresh-cw" [size]="14"></app-icon>
          <span>Actualizar Datos</span>
        </button>
      </div>

      <!-- Top KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card-adaptive rounded-2xl p-5 shadow-sm space-y-2 relative border border-slate-200 dark:border-slate-800">
          <div class="w-2.5 h-2.5 rounded-full bg-brand-500 absolute top-4 right-4"></div>
          <span class="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Comercios Activos</span>
          <div class="text-3xl font-extrabold">{{ activeMerchantsCount }}</div>
          <span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            Total Registrados: {{ totalMerchantsCount }}
          </span>
        </div>

        <div class="card-adaptive rounded-2xl p-5 shadow-sm space-y-2 relative border border-slate-200 dark:border-slate-800">
          <span class="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Ventas Totales</span>
          <div class="text-3xl font-extrabold text-brand-500 font-mono">
            \${{ (metricsSummary?.totalRevenueUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
          </div>
          <span class="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            ~Bs. {{ (metricsSummary?.totalRevenueBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
          </span>
        </div>

        <div class="card-adaptive rounded-2xl p-5 shadow-sm space-y-2 relative border border-slate-200 dark:border-slate-800">
          <span class="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Comisiones Pídetelo</span>
          <div class="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            \${{ (metricsSummary?.totalCommissionUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
          </div>
          <span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
            Ingreso neto de la red
          </span>
        </div>

        <div class="card-adaptive rounded-2xl p-5 shadow-sm space-y-2 relative border border-slate-200 dark:border-slate-800">
          <span class="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Total de Pedidos</span>
          <div class="text-3xl font-extrabold">{{ metricsSummary?.totalOrders || 0 }}</div>
          <span class="text-[11px] text-brand-500 font-semibold">
            {{ metricsSummary?.deliveredOrders || 0 }} Entregados • {{ metricsSummary?.activeOrders || 0 }} Activos
          </span>
        </div>
      </div>

      <!-- Tabla de Reportes por Sucursal -->
      <div class="card-adaptive rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-bold flex items-center gap-2">
              <app-icon name="store" [size]="18" className="text-brand-500"></app-icon>
              <span>Reportes de Desempeño por Sucursales</span>
            </h3>
            <p class="text-xs text-slate-400">Rendimiento, pedidos cerrados, facturación y comisiones generadas por cada sede física</p>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left">
            <thead class="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th class="p-3.5">Sucursal / Local</th>
                <th class="p-3.5 text-center">Estado</th>
                <th class="p-3.5 text-center">Pedidos</th>
                <th class="p-3.5 text-center">Entregados</th>
                <th class="p-3.5 text-right">Facturación Bruta ($)</th>
                <th class="p-3.5 text-right">Comisión Plataforma</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              @for (rep of metricsSummary?.branchReports || []; track rep.branchId) {
                <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td class="p-3.5">
                    <div class="font-bold text-xs text-slate-900 dark:text-white">{{ rep.branchName }}</div>
                    <div class="text-[10px] text-slate-400">{{ rep.companyName }}</div>
                  </td>
                  <td class="p-3.5 text-center">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          [class.bg-emerald-100]="rep.status === 'active'"
                          [class.text-emerald-700]="rep.status === 'active'"
                          [class.dark:bg-emerald-950]="rep.status === 'active'"
                          [class.dark:text-emerald-300]="rep.status === 'active'"
                          [class.bg-slate-100]="rep.status !== 'active'"
                          [class.text-slate-500]="rep.status !== 'active'">
                      {{ rep.status === 'active' ? 'Activa' : 'Pausada' }}
                    </span>
                  </td>
                  <td class="p-3.5 text-center font-bold">{{ rep.totalOrders }}</td>
                  <td class="p-3.5 text-center text-emerald-600 font-bold">{{ rep.deliveredOrders }}</td>
                  <td class="p-3.5 text-right font-extrabold text-slate-900 dark:text-white font-mono">
                    \${{ (rep.grossRevenueUsd || 0).toFixed(2) }}
                  </td>
                  <td class="p-3.5 text-right font-black text-brand-600 dark:text-brand-400 font-mono">
                    \${{ (rep.commissionEarnedUsd || 0).toFixed(2) }}
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="p-8 text-center text-slate-400 text-xs">
                    No hay registros de pedidos aún para mostrar en los reportes de sucursales.
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
export class SuperAdminMetricsComponent {
  readonly i18n = inject(I18nService);

  @Input() metricsSummary: any = null;
  @Input() activeMerchantsCount = 0;
  @Input() totalMerchantsCount = 0;

  @Output() refresh = new EventEmitter<void>();
}
