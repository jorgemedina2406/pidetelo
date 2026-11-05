import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Tenant } from '../../../../core/models/tenant.model';
import { Branch } from '../../../../core/models/branch.model';
import { ThemeService } from '../../../../core/services/theme.service';
import { IconComponent } from '../../../../shared/components/icon.component';

@Component({
  selector: 'app-store-header',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent],
  template: `
    @if (tenant; as store) {
      <!-- Top App Bar / Marketplace Teaser Header -->
      <header
        class="bg-slate-900 text-white text-xs px-4 py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full" [class.bg-emerald-400]="isStoreOpen.isOpen" [class.bg-red-500]="!isStoreOpen.isOpen" [class.animate-pulse]="isStoreOpen.isOpen"></span>
          <span class="font-medium text-slate-300">Tienda Oficial WhatsApp Express</span>
        </div>

        <div class="flex items-center gap-3">
          <!-- Dark/Light Theme Switcher -->
          <button (click)="theme.toggleTheme()"
                  [title]="theme.isDark() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
                  class="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer">
            <app-icon [name]="theme.isDark() ? 'sun' : 'moon'" [size]="14" [className]="theme.isDark() ? 'text-amber-400' : 'text-slate-300'"></app-icon>
          </button>

          <a routerLink="/explorar"
            class="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full text-slate-200 transition-colors">
            <span>🗺️ Ver más comercios</span>
          </a>
          <a routerLink="/admin"
            class="hidden sm:flex items-center gap-1 text-slate-400 hover:text-white transition-colors">
            <span>Panel Comercio</span>
          </a>
        </div>
      </header>

      <!-- Store Hero Banner -->
      <div class="relative h-48 sm:h-64 w-full bg-slate-900 overflow-hidden">
        <img [src]="selectedBranch?.bannerUrl || store.bannerUrl" [alt]="selectedBranch?.name || store.name" class="w-full h-full object-cover opacity-70" />
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-transparent"></div>

        <div class="absolute bottom-4 left-4 right-4 max-w-5xl mx-auto flex items-end gap-4">
          <img [src]="selectedBranch?.logoUrl || store.logoUrl" [alt]="selectedBranch?.name || store.name"
            class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-white dark:border-slate-800 object-cover shadow-xl flex-shrink-0 bg-white" />
          <div class="text-white pb-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="text-xl sm:text-2xl font-extrabold truncate">{{ selectedBranch?.name || store.name }}</h1>
              <span class="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-sm"
                    [class.bg-emerald-500]="isStoreOpen.isOpen"
                    [class.bg-red-600]="!isStoreOpen.isOpen">
                {{ isStoreOpen.isOpen ? 'Abierto ahora' : 'Cerrado' }}
              </span>
            </div>
            <p class="text-xs sm:text-sm text-slate-200 mt-0.5 line-clamp-1">{{ selectedBranch?.tagline || store.tagline }}</p>
          </div>
        </div>
      </div>

      <!-- Store Meta & Quick Stats Container -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300 flex-wrap">
          <div class="flex items-center gap-1 font-bold text-amber-500">
            <span>⭐</span> {{ store.rating }} <span class="text-slate-400 font-normal">({{ store.reviewCount }})</span>
          </div>
          <div class="flex items-center gap-1">
            <span>🛵</span> {{ store.deliverySettings.estimatedDeliveryMinMinutes }}-{{ store.deliverySettings.estimatedDeliveryMaxMinutes }} min
          </div>
          <div class="flex items-center gap-1">
            <span>💵</span> Delivery: ${{ ((selectedBranch?.baseDeliveryFee ?? store.deliverySettings.baseDeliveryFee) || 0).toFixed(2) }}
          </div>
          <div class="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
            @if (store.branches && store.branches.length > 0) {
              <button (click)="openBranchModal.emit()"
                      class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 dark:bg-slate-800 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-slate-700 text-xs font-bold transition-all cursor-pointer">
                <span>📍 Sede:</span>
                <span class="underline decoration-dotted">{{ selectedBranch?.name || store.contact.address }}</span>
                <span class="text-[10px]">▼</span>
              </button>
            } @else {
              <span>📍 {{ selectedBranch?.name || store.contact.address }}</span>
            }
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <div class="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 font-bold text-[11px] shadow-sm">
            <span>🪙</span>
            <span>Tasa: <strong>1 USD = {{ activeBranchRate }} Bs.</strong></span>
          </div>

          <a [href]="'https://wa.me/' + (selectedBranch?.whatsapp || selectedBranch?.phone || store.contact.whatsappNumber || '').replace('+', '')" target="_blank"
            class="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 transition-colors cursor-pointer">
            <app-icon name="message-circle" [size]="14"></app-icon>
            <span>WhatsApp</span>
          </a>
        </div>
      </div>

      <!-- Aviso Preventivo si Cerrado -->
      @if (!isStoreOpen.isOpen) {
        <div class="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center gap-2.5 shadow-xs">
          <span class="text-base">🔴</span>
          <div>
            <span class="font-extrabold">Comercio fuera de horario:</span>
            <span> Actualmente cerrado. Horario de atención: {{ isStoreOpen.openStr }} a {{ isStoreOpen.closeStr }}. Puedes armar tu pedido y será procesado al reanudar actividades.</span>
          </div>
        </div>
      }
    }
  `
})
export class StoreHeaderComponent {
  readonly theme = inject(ThemeService);

  @Input() tenant: Tenant | null = null;
  @Input() selectedBranch: Branch | null = null;
  @Input() isStoreOpen: { isOpen: boolean; label: string; openStr: string; closeStr: string } = {
    isOpen: true,
    label: 'Abierto',
    openStr: '09:00',
    closeStr: '23:00'
  };
  @Input() activeBranchRate: number = 52.80;

  @Output() openBranchModal = new EventEmitter<void>();
}
