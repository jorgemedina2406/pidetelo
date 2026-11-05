import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-super-admin-coupons',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="space-y-6 animate-fade-in">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <app-icon name="sparkles" [size]="24" className="text-brand-500"></app-icon>
            <span>Cupones Globales de Plataforma</span>
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Crea cupones de descuento canjeables en <strong>cualquier comercio</strong> de la red Pídetelo.
          </p>
        </div>

        <button (click)="createCoupon.emit()"
                class="bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer">
          <app-icon name="plus" [size]="15"></app-icon>
          <span>Nuevo Cupón Global</span>
        </button>
      </div>

      <!-- Listado de Cupones Globales -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        @for (c of allCoupons; track c.id) {
          <div class="card-adaptive rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 relative group">
            <div class="flex items-start justify-between gap-2">
              <div class="px-3 py-1 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 font-mono font-black text-sm tracking-wider border border-brand-500/20">
                {{ c.code }}
              </div>
              <div class="flex items-center gap-1.5">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                      [class.bg-emerald-100]="c.isActive"
                      [class.text-emerald-700]="c.isActive"
                      [class.dark:bg-emerald-950]="c.isActive"
                      [class.dark:text-emerald-300]="c.isActive"
                      [class.bg-slate-100]="!c.isActive"
                      [class.text-slate-500]="!c.isActive">
                  {{ c.isActive ? 'Activo' : 'Pausado' }}
                </span>
                <button (click)="deleteCoupon.emit(c)" class="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer" title="Eliminar cupón">
                  <app-icon name="trash" [size]="14"></app-icon>
                </button>
              </div>
            </div>

            <div>
              <div class="text-xl font-black text-slate-900 dark:text-white">
                {{ c.discountType === 'percentage' ? (c.discountValue + '% OFF') : ('$' + c.discountValue + ' OFF') }}
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                {{ c.description || 'Válido en cualquier comercio afiliado de la plataforma.' }}
              </p>
            </div>

            <div class="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] space-y-1">
              <div class="flex items-center justify-between text-slate-500">
                <span>Pedido Mínimo:</span>
                <strong class="text-slate-800 dark:text-slate-200">{{ c.minOrderAmount ? ('$' + c.minOrderAmount.toFixed(2)) : 'Sin mínimo' }}</strong>
              </div>
              <div class="flex items-center justify-between text-slate-500">
                <span>Alcance:</span>
                <span class="font-bold text-brand-600 dark:text-brand-400">
                  {{ c.isGlobal || c.tenantId === 'global' ? 'Global (Toda la Red)' : 'Comercio Específico' }}
                </span>
              </div>
            </div>
          </div>
        } @empty {
          <div class="col-span-full p-12 text-center card-adaptive rounded-2xl border border-slate-200 dark:border-slate-800">
            <app-icon name="sparkles" [size]="32" className="mx-auto text-slate-300 mb-2"></app-icon>
            <p class="font-bold text-sm">No hay cupones globales creados aún</p>
            <p class="text-xs text-slate-400 mt-1">Crea cupones como FLASHNOW o BIENVENIDO para aplicarse en cualquier comercio.</p>
            <button (click)="createCoupon.emit()"
                    class="mt-4 bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer">
              <app-icon name="plus" [size]="14"></app-icon>
              <span>Crear Cupón Global</span>
            </button>
          </div>
        }
      </div>
    </div>
  `
})
export class SuperAdminCouponsComponent {
  @Input() allCoupons: any[] = [];
  @Output() createCoupon = new EventEmitter<void>();
  @Output() deleteCoupon = new EventEmitter<any>();
}
