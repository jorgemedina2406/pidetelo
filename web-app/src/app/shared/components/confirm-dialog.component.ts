import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from '../../core/services/confirm.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    @if (confirmService.state().isOpen) {
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
           (click)="confirmService.handleAnswer(false)">
        <div class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-2xl shadow-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-4"
             (click)="$event.stopPropagation()">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                 [class.bg-rose-500/10]="confirmService.state().options.isDanger"
                 [class.text-rose-500]="confirmService.state().options.isDanger"
                 [class.bg-amber-500/10]="!confirmService.state().options.isDanger"
                 [class.text-amber-500]="!confirmService.state().options.isDanger">
              <app-icon name="alert-triangle" [size]="20"></app-icon>
            </div>
            <div>
              <h3 class="font-bold text-base text-slate-900 dark:text-white">{{ confirmService.state().options.title }}</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed whitespace-pre-line">{{ confirmService.state().options.message }}</p>
            </div>
          </div>
          <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button"
                    (click)="confirmService.handleAnswer(false)"
                    class="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
              {{ confirmService.state().options.cancelText }}
            </button>
            <button type="button"
                    (click)="confirmService.handleAnswer(true)"
                    [class.bg-rose-600]="confirmService.state().options.isDanger"
                    [class.hover:bg-rose-700]="confirmService.state().options.isDanger"
                    [class.bg-brand-500]="!confirmService.state().options.isDanger"
                    [class.hover:bg-brand-600]="!confirmService.state().options.isDanger"
                    class="px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow-sm transition-all cursor-pointer active:scale-95">
              {{ confirmService.state().options.confirmText }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmDialogComponent {
  readonly confirmService = inject(ConfirmService);
}
