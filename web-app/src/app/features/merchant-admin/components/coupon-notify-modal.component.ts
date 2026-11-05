import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-merchant-coupon-notify-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    @if (isOpen && coupon) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
           (click)="close.emit()">
        <div class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-lg rounded-2xl shadow-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-4"
             (click)="$event.stopPropagation()">
          
          <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 class="text-base font-bold flex items-center gap-2">
                <span>📢</span>
                <span>Enviar Cupón por Notificación Push</span>
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">Cupón: <strong class="font-mono text-brand-500">{{ coupon.code }}</strong></p>
            </div>
            <button (click)="close.emit()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
              <app-icon name="x" [size]="18"></app-icon>
            </button>
          </div>

          <div class="p-3 bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800/60 rounded-xl text-xs space-y-1">
            <div class="font-bold text-brand-700 dark:text-brand-300 flex items-center gap-1.5">
              <app-icon name="shield" [size]="14"></app-icon>
              <span>Privacidad de Clientes Protegida</span>
            </div>
            <p class="text-[11px] text-slate-600 dark:text-slate-400">
              Como comercio, tus datos no exponen información privada de clientes. El sistema inteligente de Pídetelo segmenta y entrega automáticamente la notificación en la app móvil y web a los usuarios que cumplan la condición seleccionada.
            </p>
          </div>

          <div class="space-y-3 text-xs">
            <div>
              <label class="block font-bold mb-1.5 text-slate-700 dark:text-slate-300">
                ¿A qué clientes deseas enviar este cupón?
              </label>
              <div class="space-y-2">
                <label class="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850"
                       [class.border-brand-500]="notificationCondition === 'all'"
                       [class.bg-brand-500/5]="notificationCondition === 'all'">
                  <input type="radio" [ngModel]="notificationCondition" (ngModelChange)="conditionChange.emit($event)" value="all" name="cond" class="mt-0.5 accent-brand-500" />
                  <div>
                    <div class="font-bold text-xs text-slate-900 dark:text-white">Todos los Clientes en Cobertura</div>
                    <div class="text-[11px] text-slate-400">Notifica a todos los clientes registrados en tu radio de delivery</div>
                  </div>
                </label>

                <label class="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850"
                       [class.border-brand-500]="notificationCondition === 'new_customers'"
                       [class.bg-brand-500/5]="notificationCondition === 'new_customers'">
                  <input type="radio" [ngModel]="notificationCondition" (ngModelChange)="conditionChange.emit($event)" value="new_customers" name="cond" class="mt-0.5 accent-brand-500" />
                  <div>
                    <div class="font-bold text-xs text-slate-900 dark:text-white">Clientes Nuevos</div>
                    <div class="text-[11px] text-slate-400">Clientes que aún no han hecho su primera orden en tu local</div>
                  </div>
                </label>

                <label class="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850"
                       [class.border-brand-500]="notificationCondition === 'frequent_customers'"
                       [class.bg-brand-500/5]="notificationCondition === 'frequent_customers'">
                  <input type="radio" [ngModel]="notificationCondition" (ngModelChange)="conditionChange.emit($event)" value="frequent_customers" name="cond" class="mt-0.5 accent-brand-500" />
                  <div>
                    <div class="font-bold text-xs text-slate-900 dark:text-white">Clientes Frecuentes (+5 compras)</div>
                    <div class="text-[11px] text-slate-400">Recompensa la lealtad de tus clientes más fieles</div>
                  </div>
                </label>

                <label class="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850"
                       [class.border-brand-500]="notificationCondition === 'inactive_customers'"
                       [class.bg-brand-500/5]="notificationCondition === 'inactive_customers'">
                  <input type="radio" [ngModel]="notificationCondition" (ngModelChange)="conditionChange.emit($event)" value="inactive_customers" name="cond" class="mt-0.5 accent-brand-500" />
                  <div>
                    <div class="font-bold text-xs text-slate-900 dark:text-white">Clientes Inactivos (+15 días sin comprar)</div>
                    <div class="text-[11px] text-slate-400">Reactiva clientes enviándoles un incentivo directo</div>
                  </div>
                </label>

                <label class="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850"
                       [class.border-brand-500]="notificationCondition === 'high_spenders'"
                       [class.bg-brand-500/5]="notificationCondition === 'high_spenders'">
                  <input type="radio" [ngModel]="notificationCondition" (ngModelChange)="conditionChange.emit($event)" value="high_spenders" name="cond" class="mt-0.5 accent-brand-500" />
                  <div>
                    <div class="font-bold text-xs text-slate-900 dark:text-white">Clientes VIP (Compras > $25)</div>
                    <div class="text-[11px] text-slate-400">Premia a los clientes con mayor valor de compra promedio</div>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label class="block font-semibold mb-1">Mensaje de la Notificación</label>
              <input type="text" [ngModel]="customMessage" (ngModelChange)="messageChange.emit($event)"
                     placeholder="¡Aprovecha este descuento exclusivo hoy!"
                     class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs focus:outline-none focus:border-brand-500 font-medium" />
            </div>
          </div>

          <div class="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button (click)="close.emit()"
                    class="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              Cancelar
            </button>
            <button (click)="send.emit()" [disabled]="isSending"
                    class="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-2">
              @if (isSending) {
                <span>Enviando...</span>
              } @else {
                <span>🚀 Enviar Notificación a Clientes</span>
              }
            </button>
          </div>

        </div>
      </div>
    }
  `
})
export class MerchantCouponNotifyModalComponent {
  @Input() isOpen = false;
  @Input() coupon: any = null;
  @Input() notificationCondition = 'all';
  @Input() customMessage = '';
  @Input() isSending = false;

  @Output() close = new EventEmitter<void>();
  @Output() conditionChange = new EventEmitter<string>();
  @Output() messageChange = new EventEmitter<string>();
  @Output() send = new EventEmitter<void>();
}

