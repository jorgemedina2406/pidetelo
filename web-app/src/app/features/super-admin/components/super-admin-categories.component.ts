import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-super-admin-categories',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <app-icon name="tag" [size]="24" className="text-brand-500"></app-icon>
            <span>Categorías del Marketplace & Subdivisiones</span>
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gestiona las categorías comerciales principales que ven los clientes (Restaurantes, Súper, Farmacias...) y sus subdivisiones (Hamburguesas, Sushi, Pizzas...)
          </p>
        </div>

        <button (click)="createCategory.emit()"
                class="bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer">
          <app-icon name="plus" [size]="15"></app-icon>
          <span>Nueva Categoría</span>
        </button>
      </div>

      <!-- Action Notice -->
      @if (categoryActionNotice) {
        <div class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 p-4 rounded-xl text-xs font-bold flex items-center justify-between animate-fade-in">
          <span>{{ categoryActionNotice }}</span>
          <button (click)="closeNotice.emit()" class="text-xs underline hover:no-underline cursor-pointer">Cerrar</button>
        </div>
      }

      <!-- Categories Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        @for (cat of businessCategories; track cat.id) {
          <div class="card-adaptive rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between transition-all hover:border-brand-500/40">
            <div class="space-y-3">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-3">
                  <span class="text-3xl p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex-shrink-0">
                    {{ cat.icon }}
                  </span>
                  <div>
                    <h3 class="text-base font-black text-slate-900 dark:text-white">{{ cat.name }}</h3>
                    <span class="font-mono text-[11px] text-slate-400">/{{ cat.slug }}</span>
                  </div>
                </div>

                <div class="flex items-center gap-1.5">
                  <button (click)="toggleCategoryActive.emit(cat)"
                          class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border transition-colors cursor-pointer"
                          [class.border-emerald-300]="cat.is_active"
                          [class.text-emerald-600]="cat.is_active"
                          [class.bg-emerald-50]="cat.is_active"
                          [class.dark:bg-emerald-950/40]="cat.is_active"
                          [class.border-slate-300]="!cat.is_active"
                          [class.text-slate-400]="!cat.is_active">
                    {{ cat.is_active ? 'Activa' : 'Pausada' }}
                  </button>
                  <button (click)="editCategory.emit(cat)"
                          class="p-1.5 rounded-lg text-slate-500 hover:text-brand-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Editar categoría">
                    <app-icon name="edit" [size]="14"></app-icon>
                  </button>
                  <button (click)="deleteCategory.emit(cat)"
                          class="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                          title="Eliminar categoría">
                    <app-icon name="trash" [size]="14"></app-icon>
                  </button>
                </div>
              </div>

              <!-- Subcategorías Pills -->
              <div>
                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Subdivisiones ({{ (cat.subcategories || []).length }})
                </div>
                <div class="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
                  @for (sub of cat.subcategories; track sub) {
                    <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {{ sub }}
                    </span>
                  } @empty {
                    <span class="text-[11px] text-slate-400 italic">Sin subdivisiones configuradas</span>
                  }
                </div>
              </div>
            </div>

            <div class="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Orden: <strong>{{ cat.sort_order }}</strong></span>
              <span class="text-brand-600 dark:text-brand-400 font-bold cursor-pointer" (click)="editCategory.emit(cat)">Editar subdivisiones →</span>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class SuperAdminCategoriesComponent {
  @Input() businessCategories: any[] = [];
  @Input() categoryActionNotice: string | null = null;

  @Output() createCategory = new EventEmitter<void>();
  @Output() editCategory = new EventEmitter<any>();
  @Output() deleteCategory = new EventEmitter<any>();
  @Output() toggleCategoryActive = new EventEmitter<any>();
  @Output() closeNotice = new EventEmitter<void>();
}

