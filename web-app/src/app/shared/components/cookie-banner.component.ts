import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp?: string;
}

@Component({
  selector: 'app-cookie-banner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Floating Bottom Cookie Banner -->
    @if (showBanner()) {
      <aside aria-label="Aviso de Cookies" class="fixed bottom-3 sm:bottom-5 left-3 right-3 sm:left-6 sm:right-auto sm:max-w-xl z-50 animate-slide-up">
        <div class="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl shadow-slate-900/20 text-slate-800 dark:text-slate-100">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/15 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl flex-shrink-0">
              🍪
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Valoramos tu privacidad y experiencia
              </h2>
              <p class="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                En <strong>Pídetelo</strong> utilizamos cookies técnicas esenciales para mantener tu carrito de compras, autenticación y sesión seguras. También utilizamos cookies opcionales para recordar tus preferencias y mejorar el servicio.
              </p>
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
            <button
              (click)="openCustomize()"
              type="button"
              class="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 underline underline-offset-4 cursor-pointer transition-colors"
            >
              ⚙️ Personalizar
            </button>

            <div class="flex items-center gap-2 w-full sm:w-auto">
              <button
                (click)="acceptEssentialOnly()"
                type="button"
                class="flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                Solo Esenciales
              </button>
              <button
                (click)="acceptAll()"
                type="button"
                class="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-orange-500 hover:from-brand-500 hover:to-orange-400 shadow-md shadow-brand-500/20 transition-all cursor-pointer"
              >
                Aceptar Todas
              </button>
            </div>
          </div>
        </div>
      </aside>
    }

    <!-- Modal Personalizar Cookies -->
    @if (showCustomizeModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
          <!-- Header -->
          <div class="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl">🍪</span>
              <div>
                <h3 class="text-base font-extrabold text-slate-900 dark:text-white">Preferencias de Cookies</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">Controla qué información permites utilizar</p>
              </div>
            </div>
            <button
              (click)="closeCustomize()"
              class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
            >
              ✕
            </button>
          </div>

          <!-- Body -->
          <div class="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
            <!-- 1. Esenciales -->
            <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-900 dark:text-white">Cookies Esenciales</span>
                    <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Obligatorias
                    </span>
                  </div>
                  <p class="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    Necesarias para navegar, autenticación, persistencia del carrito entre comercios y prevención de fraudes. No pueden ser desactivadas.
                  </p>
                </div>
                <input type="checkbox" checked disabled class="mt-1 w-4 h-4 rounded text-brand-600 opacity-60 cursor-not-allowed" />
              </div>
            </div>

            <!-- 2. Preferencias / Funcionales -->
            <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-900 dark:text-white">Preferencias y Experiencia</span>
                    <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      Opcional
                    </span>
                  </div>
                  <p class="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    Permiten recordar la sucursal elegida, moneda preferida (USD / Bs.) y modo de color (claro / oscuro).
                  </p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer mt-1">
                  <input type="checkbox" [(ngModel)]="customPrefs.marketing" class="sr-only peer" />
                  <div class="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600"></div>
                </label>
              </div>
            </div>

            <!-- 3. Analíticas y Rendimiento -->
            <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-900 dark:text-white">Análisis y Telemetría</span>
                    <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      Opcional
                    </span>
                  </div>
                  <p class="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    Nos ayudan a entender de forma completamente anónima la velocidad del sitio y resolver errores técnicos.
                  </p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer mt-1">
                  <input type="checkbox" [(ngModel)]="customPrefs.analytics" class="sr-only peer" />
                  <div class="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600"></div>
                </label>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-2.5">
            <button
              (click)="closeCustomize()"
              type="button"
              class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              (click)="saveCustomPreferences()"
              type="button"
              class="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 shadow-md shadow-brand-600/20 transition-all cursor-pointer"
            >
              Guardar Selección
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .animate-slide-up {
      animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .animate-fade-in {
      animation: fadeIn 0.2s ease-out forwards;
    }
  `]
})
export class CookieBannerComponent implements OnInit {
  private readonly STORAGE_KEY = 'pidetelo_cookie_consent';

  readonly showBanner = signal<boolean>(false);
  readonly showCustomizeModal = signal<boolean>(false);

  customPrefs: CookiePreferences = {
    essential: true,
    analytics: true,
    marketing: true
  };

  ngOnInit() {
    this.checkConsent();

    // Permitir abrir la configuración de cookies desde cualquier enlace o botón del footer
    if (typeof window !== 'undefined') {
      window.addEventListener('pidetelo-open-cookies', () => {
        this.openCustomize();
      });
    }
  }

  private checkConsent() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        this.showBanner.set(true);
      } else {
        const parsed = JSON.parse(stored);
        this.customPrefs = {
          essential: true,
          analytics: Boolean(parsed.analytics),
          marketing: Boolean(parsed.marketing),
        };
      }
    } catch (_) {
      this.showBanner.set(true);
    }
  }

  acceptAll() {
    this.saveConsent({
      essential: true,
      analytics: true,
      marketing: true
    });
  }

  acceptEssentialOnly() {
    this.saveConsent({
      essential: true,
      analytics: false,
      marketing: false
    });
  }

  openCustomize() {
    this.showCustomizeModal.set(true);
  }

  closeCustomize() {
    this.showCustomizeModal.set(false);
  }

  saveCustomPreferences() {
    this.saveConsent(this.customPrefs);
  }

  private saveConsent(prefs: CookiePreferences) {
    if (typeof window === 'undefined') return;
    try {
      const record = {
        ...prefs,
        accepted: true,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(record));
    } catch (_) {}

    this.showBanner.set(false);
    this.showCustomizeModal.set(false);
  }
}
