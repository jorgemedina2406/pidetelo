import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-super-admin-banners',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="space-y-6 animate-fade-in">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-extrabold tracking-tight">Banners & Promociones Flash</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Configura los anuncios, descuentos y cupones que se muestran en el carrusel de la cabecera de la app móvil y web</p>
        </div>

        <button (click)="createBanner.emit()"
                class="bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer">
          <app-icon name="plus" [size]="16" className="text-white"></app-icon>
          <span>Nuevo Banner Promocional</span>
        </button>
      </div>

      @if (bannerActionNotice) {
        <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold animate-fade-in flex items-center gap-2">
          <app-icon name="check" [size]="16"></app-icon>
          <span>{{ bannerActionNotice }}</span>
        </div>
      }

      <!-- Grid of Banners -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        @for (b of banners; track b.id) {
          <div class="card-adaptive rounded-2xl overflow-hidden p-5 flex flex-col justify-between border border-slate-200 dark:border-slate-800 shadow-sm relative group">
            <!-- Status pill & actions -->
            <div class="flex items-center justify-between gap-2 mb-3">
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                      [class.bg-emerald-100]="b.isActive"
                      [class.text-emerald-700]="b.isActive"
                      [class.dark:bg-emerald-950]="b.isActive"
                      [class.dark:text-emerald-300]="b.isActive"
                      [class.bg-slate-100]="!b.isActive"
                      [class.text-slate-500]="!b.isActive">
                  {{ b.isActive ? 'Activo en App y Web' : 'Pausado' }}
                </span>
                <span class="text-[10px] text-slate-400 font-bold">Orden: {{ b.sortOrder }}</span>
              </div>

              <div class="flex items-center gap-1.5">
                <button (click)="toggleBannerActive.emit(b)"
                        class="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer"
                        [class.border-emerald-300]="b.isActive"
                        [class.text-emerald-600]="b.isActive"
                        [class.border-slate-300]="!b.isActive"
                        [class.text-slate-500]="!b.isActive">
                  {{ b.isActive ? 'Pausar' : 'Activar' }}
                </button>
                <button (click)="editBanner.emit(b)"
                        class="p-1.5 rounded-lg text-slate-500 hover:text-brand-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Editar banner">
                  <app-icon name="edit" [size]="14"></app-icon>
                </button>
                <button (click)="deleteBanner.emit(b)"
                        class="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                        title="Eliminar banner">
                  <app-icon name="trash" [size]="14"></app-icon>
                </button>
              </div>
            </div>

            <!-- Live Banner Card Preview -->
            <div class="rounded-2xl p-5 text-white shadow-md relative overflow-hidden flex items-center justify-between gap-4"
                 [style.background]="'linear-gradient(135deg, ' + (b.bgGradientStart || '#f97316') + ' 0%, ' + (b.bgGradientEnd || '#ea580c') + ' 100%)'">
              
              <div class="relative z-10 flex-1 min-w-0 space-y-2">
                @if (b.badgeText) {
                  <span class="inline-block px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-[10px] font-extrabold uppercase tracking-wider text-white">
                    {{ b.badgeText }}
                  </span>
                }
                <h4 class="text-lg font-black leading-tight drop-shadow-xs truncate">{{ b.title }}</h4>
                @if (b.subtitle) {
                  <p class="text-xs text-white/90 font-medium line-clamp-2">{{ b.subtitle }}</p>
                }
                <div class="flex items-center gap-2 pt-1 flex-wrap">
                  @if (b.couponCode) {
                    <div class="px-2 py-0.5 rounded-lg bg-black/30 border border-white/20 text-[11px] font-mono font-bold tracking-wider">
                      Cupón: {{ b.couponCode }}
                    </div>
                  }
                  <span class="text-[11px] font-bold bg-white text-slate-900 px-3 py-1 rounded-xl shadow-xs">
                    {{ b.buttonText || 'Pedir ahora' }} →
                  </span>
                </div>
              </div>

              @if (b.imageUrl) {
                <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-white/10 backdrop-blur-xs flex-shrink-0 shadow-lg border border-white/20">
                  <img [src]="b.imageUrl" [alt]="b.title" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
              }
            </div>

            <div class="mt-3 text-[11px] text-slate-400 flex items-center justify-between">
              <span class="truncate">Destino: <strong class="text-slate-600 dark:text-slate-300 font-mono">{{ b.linkUrl || '/' }}</strong></span>
            </div>
          </div>
        } @empty {
          <div class="col-span-full p-12 text-center card-adaptive rounded-2xl">
            <app-icon name="sparkles" [size]="32" className="mx-auto text-slate-300 mb-2"></app-icon>
            <p class="font-bold text-sm">No hay banners promocionales creados</p>
            <p class="text-xs text-slate-400 mt-1">Crea el primer banner para mostrarlo a todos los usuarios de la app y web.</p>
            <button (click)="createBanner.emit()"
                    class="mt-4 bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer">
              <app-icon name="plus" [size]="14"></app-icon>
              <span>Crear Banner Ahora</span>
            </button>
          </div>
        }
      </div>
    </div>
  `
})
export class SuperAdminBannersComponent {
  @Input() banners: any[] = [];
  @Input() bannerActionNotice: string | null = null;

  @Output() createBanner = new EventEmitter<void>();
  @Output() editBanner = new EventEmitter<any>();
  @Output() deleteBanner = new EventEmitter<any>();
  @Output() toggleBannerActive = new EventEmitter<any>();
}

