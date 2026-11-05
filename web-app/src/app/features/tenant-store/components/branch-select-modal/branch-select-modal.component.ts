import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Branch } from '../../../../core/models/branch.model';

@Component({
  selector: 'app-branch-select-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isOpen) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
           (click)="close.emit()">
        <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
             (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 class="font-extrabold text-base text-slate-900 dark:text-white">Seleccionar Sucursal</h3>
              <p class="text-xs text-slate-500">Elige la sede desde donde deseas pedir</p>
            </div>
            <button (click)="close.emit()" class="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors">
              ✕
            </button>
          </div>

          <div class="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            @for (b of branches; track b.id) {
              <div (click)="selectBranch.emit(b)"
                   [class.border-brand-500]="selectedBranchId === b.id"
                   [class.bg-brand-50/50]="selectedBranchId === b.id"
                   [class.dark:bg-brand-950/20]="selectedBranchId === b.id"
                   class="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-brand-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center text-lg font-bold flex-shrink-0">
                    📍
                  </div>
                  <div>
                    <h4 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      {{ b.name }}
                      @if (b.isMain) {
                        <span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">Principal</span>
                      }
                    </h4>
                    <p class="text-xs text-slate-500 line-clamp-1">{{ b.address }}</p>
                    @if (b.deliveryRadiusKm) {
                      <p class="text-[11px] text-slate-400 mt-0.5">Cobertura hasta {{ b.deliveryRadiusKm }} km • Tarifa ${{ getDeliveryFee(b.baseDeliveryFee) }}</p>
                    }
                  </div>
                </div>
                @if (selectedBranchId === b.id) {
                  <div class="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    ✓
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    }
  `
})
export class BranchSelectModalComponent {
  @Input() isOpen = false;
  @Input() branches: Branch[] = [];
  @Input() selectedBranchId?: string;

  @Output() close = new EventEmitter<void>();
  @Output() selectBranch = new EventEmitter<Branch>();

  getDeliveryFee(fee?: number): string {
    return (fee != null && fee > 0 ? fee : 2.5).toFixed(2);
  }
}

