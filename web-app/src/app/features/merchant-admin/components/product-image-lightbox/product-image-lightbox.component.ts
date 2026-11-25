import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../shared/components/icon.component';

/**
 * Full-screen lightbox modal to inspect and zoom product photos from comandas.
 */
@Component({
  selector: 'app-product-image-lightbox',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    @if (imageUrl) {
    <div
      class="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in"
      (click)="close.emit()">
      <div
        class="relative w-full max-w-4xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col"
        (click)="$event.stopPropagation()">

        <!-- Top Controls -->
        <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white/95 dark:bg-slate-900/95">
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-7 h-7 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center shrink-0">
              <app-icon name="eye" [size]="15"></app-icon>
            </span>
            <span class="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
              Vista de Producto en Comanda
            </span>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              (click)="toggleZoom()"
              class="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer">
              <app-icon name="search" [size]="13"></app-icon>
              <span>{{ isZoomed ? 'Reducir' : 'Acercar' }}</span>
            </button>
            <button
              type="button"
              (click)="close.emit()"
              aria-label="Cerrar imagen"
              class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold transition-colors cursor-pointer">
              ✕
            </button>
          </div>
        </div>

        <!-- Scrollable Image Container -->
        <div
          class="flex-1 overflow-auto bg-slate-100 dark:bg-slate-950 p-3 sm:p-5 flex items-center justify-center min-h-[260px]">
          <img
            [src]="imageUrl"
            [alt]="title || 'Foto del producto'"
            (click)="toggleZoom()"
            [ngClass]="isZoomed
              ? 'max-h-none max-w-none w-[min(1100px,140vw)] rounded-xl shadow-lg cursor-zoom-out select-none'
              : 'max-h-[74vh] max-w-[88vw] w-auto h-auto object-contain rounded-2xl shadow-md cursor-zoom-in select-none transition-transform duration-200'" />
        </div>

        <!-- Caption Footer -->
        <div class="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-black text-slate-900 dark:text-white truncate">{{ title }}</span>
              @if (badge) {
              <span class="px-1.5 py-0.5 rounded bg-orange-600 text-white text-[9px] font-black uppercase shrink-0">
                {{ badge }}
              </span>
              }
            </div>
            @if (subtitle) {
            <div class="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-0.5 truncate">
              {{ subtitle }}
            </div>
            }
          </div>

          <span class="text-[11px] font-medium text-slate-400 shrink-0">
            Clic en la foto para {{ isZoomed ? 'reducir' : 'acercar' }} · ESC para cerrar
          </span>
        </div>
      </div>
    </div>
    }
  `,
})
export class ProductImageLightboxComponent implements OnChanges {
  @Input() imageUrl: string | null = null;
  @Input() title = '';
  @Input() subtitle = '';
  @Input() badge = '';

  @Output() close = new EventEmitter<void>();

  isZoomed = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['imageUrl']) {
      this.isZoomed = false;
    }
  }

  toggleZoom(): void {
    this.isZoomed = !this.isZoomed;
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.imageUrl) {
      this.close.emit();
    }
  }
}
