import { Component, Input, Output, EventEmitter, inject, signal, computed, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product, ProductModifierGroup, ProductCategory } from '../../../core/models/product.model';
import { Branch } from '../../../core/models/branch.model';
import { IconComponent } from '../../../shared/components/icon.component';
import { I18nService } from '../../../core/services/i18n.service';
import { ApiService } from '../../../core/services/api.service';
import { CurrencyService } from '../../../core/services/currency.service';

@Component({
  selector: 'app-product-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    @if (isOpen) {
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      (click)="close.emit()">
      <div
        class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-xl rounded-2xl shadow-xl p-6 overflow-hidden max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800"
        (click)="$event.stopPropagation()">

        <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-base font-bold">Configuración de Producto / Artículo & Variantes</h3>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                📍 {{ activeBranch?.name || 'Sede Principal' }}
              </span>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400">
              Apto para cualquier tipo de comercio (Comida, Farmacias, Markets, Repuestos, Juguetes, etc.)
            </p>
          </div>
          <button (click)="close.emit()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
            <app-icon name="x" [size]="18"></app-icon>
          </button>
        </div>

        <form (submit)="onSubmit($event)" class="overflow-y-auto flex-1 py-4 space-y-4 text-xs">

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="sm:col-span-2">
              <label class="block font-semibold mb-1">Nombre del Producto o Artículo</label>
              <input type="text" [(ngModel)]="editingProduct.name" name="prodName" required
                placeholder="Ej: Hamburguesa Especial, Acetaminofén 500mg, Pack Arroz 1kg, Pastillas de Freno..."
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 focus:outline-none focus:border-brand-500 font-semibold" />
            </div>
            <div>
              <label class="block font-semibold mb-1">Moneda del Precio</label>
              <select [(ngModel)]="editingProduct.currency" name="prodCurrency"
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-bold focus:outline-none focus:border-brand-500">
                <option value="USD">Dólares ($ USD)</option>
                <option value="VES">Bolívares (Bs. VES)</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label class="block font-semibold mb-1">
                Precio ({{ editingProduct.currency === 'VES' ? 'Bs.' : '$ USD' }})
              </label>
              <input type="number" step="0.25" [(ngModel)]="editingProduct.price" name="prodPrice" required
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-extrabold text-sm focus:outline-none focus:border-brand-500" />
            </div>

            <div class="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800">
              <div class="flex items-center justify-between mb-1">
                <span class="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                  Equivalente al cambio ({{ effectiveRate().toFixed(2) }} Bs/$):
                </span>
                <button type="button" (click)="fetchLiveRate()" [disabled]="isFetchingRate()" title="Actualizar desde DolarApi Oficial (BCV)"
                  class="text-[10px] font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 cursor-pointer">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" [class.animate-pulse]="isFetchingRate()"></span>
                  <span>{{ isFetchingRate() ? 'Consultando BCV...' : 'DolarApi Oficial' }}</span>
                  <app-icon name="refresh-cw" [size]="10"></app-icon>
                </button>
              </div>
              @if (editingProduct.currency === 'VES') {
              <span class="font-extrabold text-brand-600 dark:text-brand-400 text-sm">
                ~\${{ (editingProduct.price / effectiveRate()).toFixed(2) }} USD
              </span>
              } @else {
              <span class="font-extrabold text-brand-600 dark:text-brand-400 text-sm font-mono">
                ~Bs. {{ ((editingProduct.price || 0) * effectiveRate()).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </span>
              }
            </div>
          </div>

          <!-- Configuración de Promociones y Destacados -->
          <div class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <span class="font-bold text-xs block text-slate-800 dark:text-slate-200">Visibilidad & Promociones</span>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <!-- Destacado / Popular Switch -->
              <label class="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input type="checkbox" [(ngModel)]="editingProduct.isPopular" name="prodIsPopular" class="rounded text-brand-500 focus:ring-brand-500 w-4 h-4" />
                <div>
                  <span class="font-bold text-xs block text-slate-800 dark:text-slate-200">⭐ Producto Destacado</span>
                  <span class="text-[10px] text-slate-400 block">Mostrar badge de recomendado en el menú</span>
                </div>
              </label>

              <!-- Oferta Switch -->
              <label class="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input type="checkbox" [(ngModel)]="editingProduct.isOnSale" name="prodIsOnSale" class="rounded text-rose-500 focus:ring-rose-500 w-4 h-4" />
                <div>
                  <span class="font-bold text-xs block text-slate-800 dark:text-slate-200">🔥 En Oferta / Descuento</span>
                  <span class="text-[10px] text-slate-400 block">Mostrar badge de promoción y precio tachado</span>
                </div>
              </label>
            </div>

            @if (editingProduct.isOnSale) {
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <div>
                  <label class="block font-semibold mb-1 text-[11px]">Precio Original Anterior (Tachado)</label>
                  <input type="number" step="0.25" [(ngModel)]="editingProduct.compareAtPrice" (input)="onCompareAtPriceChange()" name="prodCompareAtPrice" placeholder="Ej: 15.00"
                         class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-xs focus:outline-none focus:border-rose-500" />
                </div>
                <div>
                  <label class="block font-semibold mb-1 text-[11px]">% de Descuento (Opcional)</label>
                  <input type="number" [(ngModel)]="editingProduct.discountPercentage" (input)="onDiscountPercentageChange()" name="prodDiscountPercentage" placeholder="Ej: 20"
                         class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-xs focus:outline-none focus:border-rose-500" />
                </div>
              </div>
            }
          </div>

          <!-- Identificadores opcionales: SKU y Código de Barra -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="font-semibold text-slate-700 dark:text-slate-300">SKU (Código de Inventario)</label>
                <span class="text-[10px] text-slate-400 font-normal">Opcional</span>
              </div>
              <input type="text" [(ngModel)]="editingProduct.sku" name="prodSku"
                placeholder="Ej: HAM-SMASH-01, FAR-500MG..."
                class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-xs uppercase focus:outline-none focus:border-brand-500" />
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="font-semibold text-slate-700 dark:text-slate-300">Código de Barra (Barcode)</label>
                <span class="text-[10px] text-slate-400 font-normal">Opcional</span>
              </div>
              <input type="text" [(ngModel)]="editingProduct.barcode" name="prodBarcode"
                placeholder="Ej: 7591234567890 (Lector láser / EAN)"
                class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-xs focus:outline-none focus:border-brand-500" />
            </div>
          </div>

          <!-- Control de Inventario / Stock Real -->
          <div class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <span class="font-bold text-xs block text-slate-800 dark:text-slate-200">📦 Control de Inventario / Stock</span>
                <span class="text-[10px] text-slate-500">Limita las compras según las existencias disponibles y registra auditoría</span>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" [(ngModel)]="editingProduct.trackStock" name="prodTrackStock" class="sr-only peer" />
                <div class="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            @if (editingProduct.trackStock) {
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 animate-fade-in">
                <div>
                  <label class="block font-semibold mb-1 text-[11px]">Cantidad en Stock Actual</label>
                  <input type="number" min="0" [(ngModel)]="editingProduct.stockQuantity" name="prodStockQuantity"
                         placeholder="Ej: 50"
                         class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-xs font-bold focus:outline-none focus:border-brand-500" />
                </div>
                <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
                  <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Historial / Stock Previo:</span>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="font-bold text-xs text-slate-700 dark:text-slate-300">
                      {{ editingProduct.previousStock !== undefined && editingProduct.previousStock !== null ? (editingProduct.previousStock + ' unidades') : 'Sin registro previo' }}
                    </span>
                    @if (editingProduct.previousStock !== undefined && editingProduct.previousStock !== null && editingProduct.stockQuantity !== editingProduct.previousStock) {
                      <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        → Actualiza a {{ editingProduct.stockQuantity }}
                      </span>
                    }
                  </div>
                </div>
              </div>
            }
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="font-semibold text-slate-700 dark:text-slate-300">
                  Categoría del Menú
                </label>
                <button type="button" (click)="toggleInlineCategoryCreation()"
                  class="text-[11px] font-bold text-brand-500 hover:text-brand-600 dark:hover:text-brand-400 flex items-center gap-1 cursor-pointer transition-colors">
                  <app-icon [name]="isCreatingCategoryInline() ? 'x' : 'plus'" [size]="12"></app-icon>
                  <span>{{ isCreatingCategoryInline() ? 'Cancelar' : 'Nueva Categoría' }}</span>
                </button>
              </div>

              @if (isCreatingCategoryInline()) {
              <div class="flex items-center gap-1.5 animate-fade-in">
                <input type="text" [(ngModel)]="newCategoryName" name="newCatNameInput"
                  placeholder="Nombre (ej: Hamburguesas, Bebidas)"
                  (keyup.enter)="saveInlineCategory()"
                  class="flex-1 bg-white dark:bg-slate-800 border-2 border-brand-500 rounded-xl p-2.5 text-xs font-semibold focus:outline-none text-slate-900 dark:text-white" />
                <button type="button" (click)="saveInlineCategory()" [disabled]="!newCategoryName.trim() || isSavingCategory()"
                  class="px-3.5 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer whitespace-nowrap shadow-sm transition-all">
                  {{ isSavingCategory() ? '...' : 'Crear' }}
                </button>
                <button type="button" (click)="toggleInlineCategoryCreation()" title="Cancelar"
                  class="p-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs rounded-xl cursor-pointer transition-all">
                  ✕
                </button>
              </div>
              <p class="text-[10px] text-brand-600 dark:text-brand-400 mt-1 font-medium">
                Escribe el nombre y presiona Crear o Enter
              </p>
              } @else {
              <select [(ngModel)]="editingProduct.categoryId" (change)="onCategorySelectChange($event)" name="prodCat"
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-semibold focus:outline-none focus:border-brand-500">
                <option value="">-- Sin categoría asignada (General) --</option>
                @for (cat of categories; track cat.id) {
                <option [value]="cat.id">📁 {{ cat.name }}</option>
                }
                <option value="__NEW__">➕ + Crear nueva categoría...</option>
              </select>
              @if (categories.length === 0) {
              <p class="text-[10px] text-slate-400 mt-1">
                Sin categorías en tu menú. Haz clic en "Nueva Categoría" para crear una.
              </p>
              }
              }
            </div>

            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="font-semibold text-slate-700 dark:text-slate-300">Sucursal / Sede Asignada</label>
              </div>
              <select [(ngModel)]="editingProduct.branchId" name="prodBranch" required
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-bold focus:outline-none focus:border-brand-500">
                @for (b of branches; track b.id) {
                <option [value]="b.id">📍 {{ b.name }}</option>
                }
              </select>
              <p class="text-[10px] text-slate-400 mt-1">
                Cada sucursal gestiona su catálogo y stock de forma 100% independiente.
              </p>
            </div>
          </div>

          <!-- Imagen del Producto: Subida desde PC o URL -->
          <div class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div class="flex items-center justify-between">
              <label class="block font-semibold text-slate-800 dark:text-slate-200">
                🖼️ Imagen del Producto o Artículo
              </label>
              <div class="flex items-center gap-2">
                <button type="button" (click)="imageMode = imageMode === 'upload' ? 'url' : 'upload'"
                  class="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer">
                  {{ imageMode === 'upload' ? 'Ingresar URL de Internet' : 'Subir desde la Computadora' }}
                </button>
              </div>
            </div>

            <!-- Previsualización y acciones -->
            @if (editingProduct.imageUrl) {
            <div class="flex items-center gap-3 p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
              <img [src]="editingProduct.imageUrl" alt="Preview"
                class="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shadow-xs flex-shrink-0 bg-slate-100 dark:bg-slate-800" />
              <div class="min-w-0 flex-1">
                <span class="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
                  {{ imageFileName || 'Imagen asignada' }}
                </span>
                <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                  ✓ Lista para mostrar en el catálogo
                </span>
                <div class="flex items-center gap-2 mt-1">
                  <button type="button" (click)="pcFileInput.click()"
                    class="text-[11px] font-bold text-brand-500 hover:text-brand-600 cursor-pointer">
                    Cambiar imagen
                  </button>
                  <span class="text-slate-300 dark:text-slate-700">•</span>
                  <button type="button" (click)="clearProductImage()"
                    class="text-[11px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer">
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
            }

            <input type="file" #pcFileInput (change)="onFileSelected($event)" accept="image/*" class="hidden" />

            @if (imageMode === 'upload') {
            <div (click)="pcFileInput.click()"
              class="border-2 border-dashed border-brand-300 dark:border-brand-800 hover:border-brand-500 rounded-xl p-4 text-center cursor-pointer transition-all bg-white/50 dark:bg-slate-900/50 hover:bg-brand-50/50 dark:hover:bg-brand-950/20">
              <div class="flex flex-col items-center justify-center gap-1.5">
                <div class="w-10 h-10 rounded-full bg-brand-500/10 text-brand-500 flex items-center justify-center">
                  <app-icon name="upload" [size]="20"></app-icon>
                </div>
                <span class="font-bold text-xs text-slate-700 dark:text-slate-200">
                  {{ isUploadingImage() ? 'Cargando y optimizando imagen...' : 'Haz clic para seleccionar foto desde tu PC' }}
                </span>
                <span class="text-[10px] text-slate-400">
                  Formatos JPG, PNG, WEBP (se ajusta automáticamente para catálogo)
                </span>
              </div>
            </div>
            } @else {
            <div>
              <input type="text" [(ngModel)]="editingProduct.imageUrl" name="prodImage"
                placeholder="https://images.unsplash.com/... o enlace directo de la imagen"
                class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs focus:outline-none focus:border-brand-500" />
            </div>
            }
          </div>

          <div>
            <label class="block font-semibold mb-1">Descripción o Especificaciones del Producto</label>
            <textarea rows="2" [(ngModel)]="editingProduct.description" name="prodDesc"
              placeholder="Especificaciones, ingredientes, compatibilidad, garantía o detalles del artículo..."
              class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 focus:outline-none focus:border-brand-500"></textarea>
          </div>

          <!-- Modifiers / Variants Configuration Section -->
          <div class="space-y-3.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span class="font-bold text-sm block">Grupos de Variantes, Ingredientes o Extras</span>
                <span class="text-[10px] text-slate-500">
                  Opciones obligatorias (1 requerida), extras libres (0 requeridas) o selección con cantidad requerida (ej: 6 ingredientes, 2 obligatorios).
                </span>
              </div>
              
              <div class="flex items-center gap-1.5 flex-wrap">
                <button type="button" (click)="addModifierGroup('single')"
                  class="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500 hover:text-white transition-all flex items-center gap-1 cursor-pointer">
                  <span>+ Opción Única</span>
                </button>
                <button type="button" (click)="addModifierGroup('optional_extras')"
                  class="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1 cursor-pointer">
                  <span>+ Extras Libres</span>
                </button>
                <button type="button" (click)="addModifierGroup('multiple_required')"
                  class="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white transition-all flex items-center gap-1 cursor-pointer">
                  <span>+ Múltiple con Requeridos</span>
                </button>
              </div>
            </div>

            @if (!editingProduct.modifierGroups || editingProduct.modifierGroups.length === 0) {
            <div class="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-center text-slate-400 text-xs">
              Sin grupos de variantes aún. Usa los botones superiores para agregar opciones obligatorias, extras opcionales o ingredientes con cantidad requerida.
            </div>
            }

            @for (group of editingProduct.modifierGroups; track group.id; let gIndex = $index) {
            <div class="p-3.5 rounded-xl border-2 transition-all space-y-3"
              [class.border-orange-500/40]="getModifierGroupMode(group) === 'single'"
              [class.bg-orange-500/[0.02]]="getModifierGroupMode(group) === 'single'"
              [class.border-emerald-500/40]="getModifierGroupMode(group) === 'optional_extras'"
              [class.bg-emerald-500/[0.02]]="getModifierGroupMode(group) === 'optional_extras'"
              [class.border-blue-500/40]="getModifierGroupMode(group) === 'multiple_required'"
              [class.bg-blue-500/[0.02]]="getModifierGroupMode(group) === 'multiple_required'">
              
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 flex-1">
                  <span class="text-xs font-black text-slate-400">#{{ gIndex + 1 }}</span>
                  <input type="text" [(ngModel)]="group.title" [name]="'groupTitle_' + gIndex"
                    placeholder="Título del grupo (ej: Tipo de Pan / Extras / Ingredientes a Elegir)"
                    class="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-bold flex-1" />
                </div>
                <button type="button" (click)="removeModifierGroup(gIndex)"
                  class="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer">
                  Eliminar Grupo
                </button>
              </div>

              <!-- Selection Mode Switcher -->
              <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Comportamiento de Selección del Cliente:</div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  
                  <button type="button" (click)="setModifierGroupMode(group, 'single')"
                    [class.bg-orange-500]="getModifierGroupMode(group) === 'single'"
                    [class.text-white]="getModifierGroupMode(group) === 'single'"
                    [class.bg-slate-100]="getModifierGroupMode(group) !== 'single'"
                    [class.dark:bg-slate-800]="getModifierGroupMode(group) !== 'single'"
                    [class.text-slate-700]="getModifierGroupMode(group) !== 'single'"
                    [class.dark:text-slate-300]="getModifierGroupMode(group) !== 'single'"
                    class="p-2 rounded-lg text-[11px] font-bold text-left flex items-center gap-1.5 transition-all cursor-pointer">
                    <span>🔘</span>
                    <div>
                      <div class="leading-tight">Opción Única</div>
                      <div class="text-[9px] opacity-80 font-normal">1 Requerido (Obligatorio)</div>
                    </div>
                  </button>

                  <button type="button" (click)="setModifierGroupMode(group, 'optional_extras')"
                    [class.bg-emerald-600]="getModifierGroupMode(group) === 'optional_extras'"
                    [class.text-white]="getModifierGroupMode(group) === 'optional_extras'"
                    [class.bg-slate-100]="getModifierGroupMode(group) !== 'optional_extras'"
                    [class.dark:bg-slate-800]="getModifierGroupMode(group) !== 'optional_extras'"
                    [class.text-slate-700]="getModifierGroupMode(group) !== 'optional_extras'"
                    [class.dark:text-slate-300]="getModifierGroupMode(group) !== 'optional_extras'"
                    class="p-2 rounded-lg text-[11px] font-bold text-left flex items-center gap-1.5 transition-all cursor-pointer">
                    <span>🟩</span>
                    <div>
                      <div class="leading-tight">Extras Opcionales</div>
                      <div class="text-[9px] opacity-80 font-normal">Sin requeridos (0 a N)</div>
                    </div>
                  </button>

                  <button type="button" (click)="setModifierGroupMode(group, 'multiple_required')"
                    [class.bg-blue-600]="getModifierGroupMode(group) === 'multiple_required'"
                    [class.text-white]="getModifierGroupMode(group) === 'multiple_required'"
                    [class.bg-slate-100]="getModifierGroupMode(group) !== 'multiple_required'"
                    [class.dark:bg-slate-800]="getModifierGroupMode(group) !== 'multiple_required'"
                    [class.text-slate-700]="getModifierGroupMode(group) !== 'multiple_required'"
                    [class.dark:text-slate-300]="getModifierGroupMode(group) !== 'multiple_required'"
                    class="p-2 rounded-lg text-[11px] font-bold text-left flex items-center gap-1.5 transition-all cursor-pointer">
                    <span>🔢</span>
                    <div>
                      <div class="leading-tight">Múltiple con Requeridos</div>
                      <div class="text-[9px] opacity-80 font-normal">Ej: 6 opciones, 2 obligatorias</div>
                    </div>
                  </button>
                </div>

                @if (getModifierGroupMode(group) === 'multiple_required') {
                <div class="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-blue-600 dark:text-blue-400">Requeridos obligatorios (Mínimo):</span>
                    <input type="number" min="1" [max]="group.maxSelections" [(ngModel)]="group.minSelections" [name]="'minSel_' + gIndex"
                      class="w-16 bg-white dark:bg-slate-800 border border-blue-400 rounded p-1 text-center font-bold" />
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-600 dark:text-slate-400">Máximo permitido:</span>
                    <input type="number" [min]="group.minSelections" [(ngModel)]="group.maxSelections" [name]="'maxSel_' + gIndex"
                      class="w-16 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1 text-center font-bold" />
                  </div>
                  <span class="text-[10px] text-slate-400 italic">El cliente DEBE elegir {{ group.minSelections }} de las {{ group.options.length }} opciones para ordenar.</span>
                </div>
                }

                @if (getModifierGroupMode(group) === 'optional_extras') {
                <div class="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                  <span class="font-bold text-emerald-600 dark:text-emerald-400">Máximo de extras que puede elegir:</span>
                  <input type="number" min="1" [(ngModel)]="group.maxSelections" [name]="'maxSelOpt_' + gIndex"
                    class="w-16 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-1 text-center font-bold" />
                  <span class="text-[10px] text-slate-400 italic">(0 requeridos obligatorios. El cliente puede ordenar sin extras o añadir hasta {{ group.maxSelections }}).</span>
                </div>
                }
              </div>

              <!-- Options list for this group -->
              <div class="space-y-2 pl-2">
                <div class="text-[11px] font-bold text-slate-600 dark:text-slate-400">Opciones disponibles en este grupo:</div>
                @for (opt of group.options; track opt.id; let optIndex = $index) {
                <div class="flex items-center gap-2">
                  <input type="text" [(ngModel)]="opt.name" [name]="'optName_' + gIndex + '_' + optIndex"
                    placeholder="Opción (ej: Extra Queso, Brioche, Cebolla, Talla M)"
                    class="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs" />
                  <div class="flex items-center gap-1 text-slate-500 text-xs">
                    <span>+$</span>
                    <input type="number" step="0.25" [(ngModel)]="opt.priceDelta"
                      [name]="'optPrice_' + gIndex + '_' + optIndex"
                      placeholder="0.00"
                      class="w-16 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2 text-center font-bold" />
                  </div>
                  <button type="button" (click)="group.options.splice(optIndex, 1)"
                    class="text-slate-400 hover:text-red-500 p-1 transition-colors cursor-pointer" title="Eliminar opción">
                    ✕
                  </button>
                </div>
                }
                <button type="button" (click)="addOptionToGroup(group)"
                  class="text-[11px] text-brand-500 hover:underline font-bold pt-1 block cursor-pointer">
                  + Agregar otra opción a este grupo
                </button>
              </div>
            </div>
            }
          </div>

          <div class="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
            <button type="button" (click)="close.emit()"
              class="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              {{ i18n.t('common.cancel') }}
            </button>
            <button type="submit"
              class="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold shadow-sm cursor-pointer">
              {{ i18n.t('common.save') }}
            </button>
          </div>
        </form>

      </div>
    </div>
    }
  `
})
export class ProductFormModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() product: Product | null = null;
  @Input() categories: ProductCategory[] = [];
  @Input() branches: Branch[] = [];
  @Input() activeBranch: Branch | null = null;
  @Input() activeExchangeRate = 45.50;
  @Input() tenantId = '';

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<Product>();
  @Output() categoryCreated = new EventEmitter<ProductCategory>();

  readonly i18n = inject(I18nService);
  private readonly api = inject(ApiService);
  readonly currency = inject(CurrencyService);

  readonly liveRate = signal<number>(0);
  readonly isFetchingRate = signal<boolean>(false);
  readonly effectiveRate = computed(() => this.liveRate() || this.activeExchangeRate || 54.50);

  imageMode: 'upload' | 'url' = 'upload';
  imageFileName = '';
  readonly isUploadingImage = signal<boolean>(false);

  readonly isCreatingCategoryInline = signal(false);
  readonly isSavingCategory = signal(false);
  newCategoryName = '';

  editingProduct: Product = this.getDefaultProduct();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.fetchLiveRate();
    }

    if (changes['product'] || (changes['isOpen'] && this.isOpen)) {
      if (this.product) {
        this.editingProduct = JSON.parse(JSON.stringify(this.product));
        if (!this.editingProduct.modifierGroups) {
          this.editingProduct.modifierGroups = [];
        }
      } else {
        this.editingProduct = this.getDefaultProduct();
      }
      this.isCreatingCategoryInline.set(false);
      this.newCategoryName = '';
      this.imageFileName = '';
    }
  }

  fetchLiveRate(): void {
    this.isFetchingRate.set(true);
    this.currency.fetchDolarApiRate('oficial').then(data => {
      this.isFetchingRate.set(false);
      if (data && typeof data.promedio === 'number' && data.promedio > 0) {
        this.liveRate.set(Number(data.promedio.toFixed(2)));
      }
    }).catch(() => {
      this.isFetchingRate.set(false);
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.imageFileName = file.name;
    this.isUploadingImage.set(true);

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        this.isUploadingImage.set(false);
        return;
      }

      // Optimizar en Canvas a máximo 800px para almacenamiento ligero
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          this.editingProduct.imageUrl = compressed;

          // Enviar al backend para guardar archivo estático
          this.api.uploadImage(compressed, file.name).subscribe({
            next: (res) => {
              if (res?.url) {
                this.editingProduct.imageUrl = res.url;
              }
              this.isUploadingImage.set(false);
            },
            error: () => {
              this.isUploadingImage.set(false);
            }
          });
        } else {
          this.editingProduct.imageUrl = dataUrl;
          this.isUploadingImage.set(false);
        }
      };
      img.onerror = () => {
        this.editingProduct.imageUrl = dataUrl;
        this.isUploadingImage.set(false);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  clearProductImage(): void {
    this.editingProduct.imageUrl = '';
    this.imageFileName = '';
  }

  private getDefaultProduct(): Product {
    return {
      id: '',
      tenantId: this.tenantId,
      categoryId: '',
      name: '',
      description: '',
      price: 0,
      currency: 'USD',
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
      isAvailable: true,
      branchId: this.activeBranch?.id || null,
      isPopular: false,
      isFeatured: false,
      isOnSale: false,
      trackStock: false,
      stockQuantity: 0,
      previousStock: 0,
      modifierGroups: []
    };
  }

  toggleInlineCategoryCreation(): void {
    this.isCreatingCategoryInline.update(v => !v);
    if (this.isCreatingCategoryInline()) {
      this.newCategoryName = '';
    }
  }

  onCategorySelectChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    if (val === '__NEW__') {
      this.editingProduct.categoryId = '';
      this.isCreatingCategoryInline.set(true);
      this.newCategoryName = '';
    }
  }

  saveInlineCategory(): void {
    const name = this.newCategoryName.trim();
    if (!name || !this.tenantId) return;

    this.isSavingCategory.set(true);
    this.api.createCategory(this.tenantId, name).subscribe({
      next: (created) => {
        this.isSavingCategory.set(false);
        this.categoryCreated.emit(created);
        this.editingProduct.categoryId = created.id;
        this.isCreatingCategoryInline.set(false);
        this.newCategoryName = '';
      },
      error: (err) => {
        this.isSavingCategory.set(false);
        console.warn('[ProductFormModal] Error creando categoría:', err);
      }
    });
  }

  getModifierGroupMode(group: ProductModifierGroup): 'single' | 'optional_extras' | 'multiple_required' {
    if (group.minSelections === 1 && group.maxSelections === 1) return 'single';
    if (group.minSelections === 0) return 'optional_extras';
    return 'multiple_required';
  }

  setModifierGroupMode(group: ProductModifierGroup, mode: 'single' | 'optional_extras' | 'multiple_required'): void {
    if (mode === 'single') {
      group.minSelections = 1;
      group.maxSelections = 1;
    } else if (mode === 'optional_extras') {
      group.minSelections = 0;
      group.maxSelections = Math.max(1, group.options?.length || 5);
    } else if (mode === 'multiple_required') {
      group.minSelections = 2;
      group.maxSelections = Math.max(2, group.options?.length || 6);
    }
  }

  addModifierGroup(presetMode: 'single' | 'optional_extras' | 'multiple_required' = 'single'): void {
    if (!this.editingProduct.modifierGroups) {
      this.editingProduct.modifierGroups = [];
    }

    let min = 1;
    let max = 1;
    let defaultTitle = 'Selecciona una Opción (Obligatorio)';
    let sampleOptions = [
      { id: `opt-${Date.now()}-1`, name: 'Opción Estándar', priceDelta: 0 },
      { id: `opt-${Date.now()}-2`, name: 'Opción Especial / Grande', priceDelta: 1.50 }
    ];

    if (presetMode === 'optional_extras') {
      min = 0;
      max = 4;
      defaultTitle = 'Extras & Adicionales (Opcional)';
      sampleOptions = [
        { id: `opt-${Date.now()}-1`, name: 'Tocineta Ahumada', priceDelta: 1.50 },
        { id: `opt-${Date.now()}-2`, name: 'Queso Cheddar Extra', priceDelta: 1.00 },
        { id: `opt-${Date.now()}-3`, name: 'Salsa de la Casa', priceDelta: 0.50 }
      ];
    } else if (presetMode === 'multiple_required') {
      min = 2;
      max = 6;
      defaultTitle = 'Ingredientes (Elige 2 Requeridos)';
      sampleOptions = [
        { id: `opt-${Date.now()}-1`, name: 'Cebolla Caramelizada', priceDelta: 0 },
        { id: `opt-${Date.now()}-2`, name: 'Tomate Fresco', priceDelta: 0 },
        { id: `opt-${Date.now()}-3`, name: 'Pepinillos Agridulces', priceDelta: 0 },
        { id: `opt-${Date.now()}-4`, name: 'Lechuga Romana', priceDelta: 0 },
        { id: `opt-${Date.now()}-5`, name: 'Maíz Tierno', priceDelta: 0 },
        { id: `opt-${Date.now()}-6`, name: 'Jalapeños en Rodajas', priceDelta: 0.50 }
      ];
    }

    this.editingProduct.modifierGroups.push({
      id: `mod-${Date.now()}`,
      title: defaultTitle,
      minSelections: min,
      maxSelections: max,
      options: sampleOptions
    });
  }

  removeModifierGroup(index: number): void {
    this.editingProduct.modifierGroups?.splice(index, 1);
  }

  addOptionToGroup(group: ProductModifierGroup): void {
    group.options.push({
      id: `opt-${Date.now()}`,
      name: 'Nueva Opción Extra',
      priceDelta: 1.00
    });
  }

  onCompareAtPriceChange(): void {
    const curPrice = Number(this.editingProduct.price) || 0;
    const compPrice = Number(this.editingProduct.compareAtPrice) || 0;
    if (compPrice > curPrice && curPrice > 0) {
      this.editingProduct.discountPercentage = Math.round(((compPrice - curPrice) / compPrice) * 100);
    }
  }

  onDiscountPercentageChange(): void {
    const curPrice = Number(this.editingProduct.price) || 0;
    const discPct = Number(this.editingProduct.discountPercentage) || 0;
    if (discPct > 0 && discPct < 100 && curPrice > 0) {
      this.editingProduct.compareAtPrice = Number((curPrice / (1 - discPct / 100)).toFixed(2));
    }
  }

  onSubmit(e: Event): void {
    e.preventDefault();
    if (this.editingProduct.isOnSale) {
      const curPrice = Number(this.editingProduct.price) || 0;
      const compPrice = Number(this.editingProduct.compareAtPrice) || 0;
      const discPct = Number(this.editingProduct.discountPercentage) || 0;
      if (compPrice > curPrice && !discPct) {
        this.onCompareAtPriceChange();
      } else if (discPct > 0 && !compPrice) {
        this.onDiscountPercentageChange();
      }
    } else {
      this.editingProduct.compareAtPrice = undefined;
      this.editingProduct.discountPercentage = 0;
    }
    this.save.emit({ ...this.editingProduct });
  }
}
