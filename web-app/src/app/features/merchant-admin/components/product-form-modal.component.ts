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
    <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-fade-in"
      (click)="close.emit()">
      <div
        class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-5xl rounded-3xl shadow-2xl p-5 sm:p-7 overflow-hidden max-h-[94vh] flex flex-col border border-slate-200 dark:border-slate-800"
        (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center text-lg">
              🍔
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base sm:text-lg font-extrabold tracking-tight">
                  {{ editingProduct.id ? 'Editar Producto o Artículo' : 'Nuevo Producto o Artículo' }}
                </h3>
                <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                  📍 {{ activeBranch?.name || 'Sede Principal' }}
                </span>
              </div>
              <p class="text-[11px] text-slate-500 dark:text-slate-400">
                Apto para cualquier categoría: Comida, Farmacias, Markets, Repuestos, Licores, etc.
              </p>
            </div>
          </div>
          <button (click)="close.emit()" class="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer">
            <app-icon name="x" [size]="18"></app-icon>
          </button>
        </div>

        <!-- Scrollable Form Body -->
        <form (submit)="onSubmit($event)" class="overflow-y-auto flex-1 py-4 pr-1 text-xs">
          
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

            <!-- ================= COLUMNA IZQUIERDA (7 COLS): Datos Principales, Foto & Variantes ================= -->
            <div class="lg:col-span-7 space-y-4">

              <!-- Nombre y Descripción -->
              <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="font-extrabold text-xs text-slate-800 dark:text-slate-200">Información del Producto</span>
                  <span class="text-[10px] text-slate-400">Visible para clientes</span>
                </div>

                <div>
                  <label class="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Nombre del Producto o Artículo *</label>
                  <input type="text" [(ngModel)]="editingProduct.name" name="prodName" required
                    placeholder="Ej: Hamburguesa Bacon Doble Especial, Acetaminofén 500mg, Sushi Roll..."
                    class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-3 focus:outline-none focus:border-brand-500 font-bold text-sm text-slate-900 dark:text-white shadow-xs" />
                </div>

                <div>
                  <label class="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Descripción o Especificaciones del Producto</label>
                  <textarea rows="3" [(ngModel)]="editingProduct.description" name="prodDesc"
                    placeholder="Describe los ingredientes, contenido, presentación, especificaciones o detalles para que el cliente conozca tu producto..."
                    class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 focus:outline-none focus:border-brand-500 text-xs text-slate-800 dark:text-slate-200 leading-relaxed"></textarea>
                </div>
              </div>

              <!-- Foto del Producto con carga desde PC o URL -->
              <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div class="flex items-center justify-between">
                  <div>
                    <span class="font-extrabold text-xs block text-slate-800 dark:text-slate-200">🖼️ Imagen o Fotografía del Producto</span>
                    <span class="text-[10px] text-slate-500">Sube una foto atractiva para incrementar tus ventas</span>
                  </div>
                  <button type="button" (click)="imageMode = imageMode === 'upload' ? 'url' : 'upload'"
                    class="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer">
                    {{ imageMode === 'upload' ? '🔗 Pegar Enlace URL' : '📁 Subir desde mi PC' }}
                  </button>
                </div>

                @if (editingProduct.imageUrl) {
                <div class="flex flex-col sm:flex-row items-center gap-3.5 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                  <img [src]="editingProduct.imageUrl" alt="Preview"
                    class="w-full sm:w-28 h-24 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs bg-slate-100 dark:bg-slate-800 flex-shrink-0" />
                  <div class="min-w-0 flex-1 w-full text-center sm:text-left">
                    <span class="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
                      {{ imageFileName || 'Imagen asignada' }}
                    </span>
                    <span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                      ✓ Lista para mostrar en catálogo y app móvil
                    </span>
                    <div class="flex items-center justify-center sm:justify-start gap-2.5 mt-2">
                      <button type="button" (click)="pcFileInput.click()"
                        class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500 hover:text-white transition-all cursor-pointer">
                        Cambiar foto
                      </button>
                      <button type="button" (click)="clearProductImage()"
                        class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white transition-all cursor-pointer">
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
                }

                <input type="file" #pcFileInput (change)="onFileSelected($event)" accept="image/*" class="hidden" />

                @if (imageMode === 'upload') {
                <div (click)="pcFileInput.click()"
                  class="border-2 border-dashed border-brand-300 dark:border-brand-800 hover:border-brand-500 rounded-2xl p-5 text-center cursor-pointer transition-all bg-white/70 dark:bg-slate-900/70 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 group">
                  <div class="flex flex-col items-center justify-center gap-2">
                    <div class="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <app-icon name="upload" [size]="24"></app-icon>
                    </div>
                    <div>
                      <span class="font-extrabold text-xs text-slate-800 dark:text-slate-100 block">
                        {{ isUploadingImage() ? 'Optimizando foto para catálogo...' : 'Haz clic aquí para seleccionar imagen desde tu Computadora' }}
                      </span>
                      <span class="text-[10px] text-slate-400 block mt-0.5">
                        Admite JPG, PNG o WEBP. Se ajusta y comprime automáticamente.
                      </span>
                    </div>
                  </div>
                </div>
                } @else {
                <div>
                  <input type="text" [(ngModel)]="editingProduct.imageUrl" name="prodImage"
                    placeholder="https://images.unsplash.com/... o enlace de tu imagen"
                    class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs focus:outline-none focus:border-brand-500 font-mono" />
                </div>
                }
              </div>

              <!-- Modifiers / Variants Configuration Section -->
              <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3.5">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span class="font-extrabold text-xs block text-slate-800 dark:text-slate-200">Grupos de Variantes, Ingredientes o Extras</span>
                    <span class="text-[10px] text-slate-500">
                      Opciones obligatorias (1 requerida), extras libres (0) o selección de ingredientes (ej: 2 obligatorios).
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
                      <span>+ Múltiple Obligatorio</span>
                    </button>
                  </div>
                </div>

                @if (!editingProduct.modifierGroups || editingProduct.modifierGroups.length === 0) {
                <div class="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-slate-400 text-xs bg-white/40 dark:bg-slate-900/40">
                  Sin variantes o extras configurados. Agrega opciones con los botones superiores si tu producto ofrece salsas, tamaños, términos de cocción o acompañantes.
                </div>
                }

                @for (group of editingProduct.modifierGroups; track group.id; let gIndex = $index) {
                <div class="p-3.5 rounded-2xl border-2 transition-all space-y-3 bg-white dark:bg-slate-900"
                  [class.border-orange-500/40]="getModifierGroupMode(group) === 'single'"
                  [class.border-emerald-500/40]="getModifierGroupMode(group) === 'optional_extras'"
                  [class.border-blue-500/40]="getModifierGroupMode(group) === 'multiple_required'">

                  <div class="flex items-center justify-between gap-2">
                    <input type="text" [(ngModel)]="group.title" [name]="'groupTitle_' + gIndex"
                      placeholder="Título del grupo (ej: Elige tu Proteína, Extras Opcionales)"
                      class="font-bold text-xs bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 pb-1 flex-1 focus:outline-none focus:border-brand-500 text-slate-900 dark:text-white" />

                    <div class="flex items-center gap-1.5">
                      <select [value]="getModifierGroupMode(group)" (change)="setModifierGroupMode(group, $any($event.target).value)"
                        class="text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-bold">
                        <option value="single">Obligatorio (1)</option>
                        <option value="optional_extras">Libres (0 a N)</option>
                        <option value="multiple_required">Múltiple Requerido</option>
                      </select>

                      <button type="button" (click)="removeModifierGroup(gIndex)"
                        class="text-rose-500 hover:text-rose-700 p-1 cursor-pointer" title="Eliminar grupo">
                        ✕
                      </button>
                    </div>
                  </div>

                  <!-- Options list inside group -->
                  <div class="space-y-2 pt-1">
                    @for (opt of group.options; track opt.id; let optIndex = $index) {
                    <div class="flex items-center gap-2">
                      <input type="text" [(ngModel)]="opt.name" [name]="'optName_' + gIndex + '_' + optIndex"
                        placeholder="Nombre de la opción (ej: Tocineta, Salsa Tártara, Grande)"
                        class="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs focus:outline-none focus:border-brand-500 font-medium" />
                      <div class="flex items-center gap-1 text-slate-500 text-xs">
                        <span>+$</span>
                        <input type="number" step="0.25" [(ngModel)]="opt.priceDelta"
                          [name]="'optPrice_' + gIndex + '_' + optIndex"
                          placeholder="0.00"
                          class="w-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-center font-bold" />
                      </div>
                      <button type="button" (click)="group.options.splice(optIndex, 1)"
                        class="text-slate-400 hover:text-rose-500 p-1 transition-colors cursor-pointer" title="Eliminar opción">
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

            </div>

            <!-- ================= COLUMNA DERECHA (5 COLS): Precios, Descuentos, Stock, Categorías ================= -->
            <div class="lg:col-span-5 space-y-4">

              <!-- Precio y Tasa de Cambio Oficial (DolarApi) -->
              <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <span class="font-extrabold text-xs block text-slate-800 dark:text-slate-200">Fijación de Precio</span>

                <div class="grid grid-cols-2 gap-2.5">
                  <div>
                    <label class="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Moneda Base</label>
                    <select [(ngModel)]="editingProduct.currency" name="prodCurrency"
                      class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-bold focus:outline-none focus:border-brand-500">
                      <option value="USD">Dólares ($ USD)</option>
                      <option value="VES">Bolívares (Bs. VES)</option>
                    </select>
                  </div>
                  <div>
                    <label class="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                      Precio ({{ editingProduct.currency === 'VES' ? 'Bs.' : '$ USD' }}) *
                    </label>
                    <input type="number" step="0.25" [(ngModel)]="editingProduct.price" name="prodPrice" required
                      class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-black text-base focus:outline-none focus:border-brand-500 text-brand-600 dark:text-brand-400" />
                  </div>
                </div>

                <!-- Tarjeta de Equivalencia BCV en Vivo -->
                <div class="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-slate-500 dark:text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                      Equivalente al cambio ({{ effectiveRate().toFixed(2) }} Bs/$):
                    </span>
                    <button type="button" (click)="fetchLiveRate()" [disabled]="isFetchingRate()" title="Actualizar desde DolarApi Oficial (BCV)"
                      class="text-[10px] font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 cursor-pointer">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" [class.animate-pulse]="isFetchingRate()"></span>
                      <span>{{ isFetchingRate() ? 'Consultando...' : 'DolarApi Oficial' }}</span>
                      <app-icon name="refresh-cw" [size]="10"></app-icon>
                    </button>
                  </div>
                  @if (editingProduct.currency === 'VES') {
                  <span class="font-extrabold text-brand-600 dark:text-brand-400 text-sm">
                    ~&#36;{{ (editingProduct.price / effectiveRate()).toFixed(2) }} USD
                  </span>
                  } @else {
                  <span class="font-extrabold text-brand-600 dark:text-brand-400 text-sm font-mono">
                    ~Bs. {{ ((editingProduct.price || 0) * effectiveRate()).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                  </span>
                  }
                </div>
              </div>

              <!-- Promociones y Descuentos -->
              <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <span class="font-extrabold text-xs block text-slate-800 dark:text-slate-200">Visibilidad & Ofertas</span>
                
                <div class="space-y-2">
                  <label class="flex items-center gap-2.5 p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-brand-500 transition-colors">
                    <input type="checkbox" [(ngModel)]="editingProduct.isPopular" name="prodIsPopular" class="rounded text-brand-500 focus:ring-brand-500 w-4 h-4" />
                    <div>
                      <span class="font-bold text-xs block text-slate-800 dark:text-slate-200">⭐ Producto Destacado</span>
                      <span class="text-[10px] text-slate-400 block">Mostrar badge de recomendado en el menú</span>
                    </div>
                  </label>

                  <label class="flex items-center gap-2.5 p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-rose-500 transition-colors">
                    <input type="checkbox" [(ngModel)]="editingProduct.isOnSale" name="prodIsOnSale" class="rounded text-rose-500 focus:ring-rose-500 w-4 h-4" />
                    <div>
                      <span class="font-bold text-xs block text-slate-800 dark:text-slate-200">🔥 En Oferta / Descuento</span>
                      <span class="text-[10px] text-slate-400 block">Mostrar badge de promoción y precio tachado</span>
                    </div>
                  </label>
                </div>

                @if (editingProduct.isOnSale) {
                  <div class="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div>
                      <label class="block font-semibold mb-1 text-[10px]">Precio Anterior (Tachado)</label>
                      <input type="number" step="0.25" [(ngModel)]="editingProduct.compareAtPrice" (input)="onCompareAtPriceChange()" name="prodCompareAtPrice" placeholder="Ej: 15.00"
                             class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-mono text-xs focus:outline-none focus:border-rose-500" />
                    </div>
                    <div>
                      <label class="block font-semibold mb-1 text-[10px]">% Descuento Calculado</label>
                      <input type="number" [(ngModel)]="editingProduct.discountPercentage" (input)="onDiscountPercentageChange()" name="prodDiscountPercentage" placeholder="Ej: 20"
                             class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-mono text-xs focus:outline-none focus:border-rose-500" />
                    </div>
                  </div>
                }
              </div>

              <!-- Control de Inventario / Stock -->
              <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div class="flex items-center justify-between">
                  <div>
                    <span class="font-extrabold text-xs block text-slate-800 dark:text-slate-200">📦 Control de Inventario / Stock</span>
                    <span class="text-[10px] text-slate-500">Limita compras según stock real disponible</span>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" [(ngModel)]="editingProduct.trackStock" name="prodTrackStock" class="sr-only peer" />
                    <div class="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                @if (editingProduct.trackStock) {
                  <div class="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div>
                      <label class="block font-semibold mb-1 text-[10px]">Cantidad Disponible</label>
                      <input type="number" min="0" [(ngModel)]="editingProduct.stockQuantity" name="prodStockQuantity"
                             placeholder="Ej: 50"
                             class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2 font-mono text-xs font-bold focus:outline-none focus:border-brand-500" />
                    </div>
                    <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
                      <span class="text-[9px] text-slate-400 font-bold uppercase">Stock Previo:</span>
                      <span class="font-bold text-xs text-slate-700 dark:text-slate-300 truncate">
                        {{ editingProduct.previousStock !== undefined && editingProduct.previousStock !== null ? (editingProduct.previousStock + ' uds') : 'Sin registro' }}
                      </span>
                    </div>
                  </div>
                }
              </div>

              <!-- Categoría y Sucursal -->
              <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <span class="font-extrabold text-xs block text-slate-800 dark:text-slate-200">Asignación & Catálogo</span>

                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">Categoría del Menú</label>
                    <button type="button" (click)="toggleInlineCategoryCreation()"
                      class="text-[10px] font-bold text-brand-500 hover:text-brand-600 flex items-center gap-1 cursor-pointer">
                      <app-icon [name]="isCreatingCategoryInline() ? 'x' : 'plus'" [size]="11"></app-icon>
                      <span>{{ isCreatingCategoryInline() ? 'Cancelar' : 'Nueva Categoría' }}</span>
                    </button>
                  </div>

                  @if (isCreatingCategoryInline()) {
                  <div class="flex items-center gap-1.5">
                    <input type="text" [(ngModel)]="newCategoryName" name="newCatNameInput"
                      placeholder="Nombre categoría"
                      (keyup.enter)="saveInlineCategory()"
                      class="flex-1 bg-white dark:bg-slate-900 border-2 border-brand-500 rounded-xl p-2 text-xs font-semibold focus:outline-none text-slate-900 dark:text-white" />
                    <button type="button" (click)="saveInlineCategory()" [disabled]="!newCategoryName.trim() || isSavingCategory()"
                      class="px-3 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer">
                      {{ isSavingCategory() ? '...' : 'Crear' }}
                    </button>
                  </div>
                  } @else {
                  <select [(ngModel)]="editingProduct.categoryId" (change)="onCategorySelectChange($event)" name="prodCat"
                    class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-semibold focus:outline-none focus:border-brand-500">
                    <option value="">-- Sin categoría asignada (General) --</option>
                    @for (cat of categories; track cat.id) {
                    <option [value]="cat.id">📁 {{ cat.name }}</option>
                    }
                    <option value="__NEW__">➕ + Crear nueva categoría...</option>
                  </select>
                  }
                </div>

                <div>
                  <label class="block font-semibold mb-1 text-slate-700 dark:text-slate-300 text-[11px]">Sucursal Asignada</label>
                  <select [(ngModel)]="editingProduct.branchId" name="prodBranch" required
                    class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-bold focus:outline-none focus:border-brand-500">
                    @for (b of branches; track b.id) {
                    <option [value]="b.id">📍 {{ b.name }}</option>
                    }
                  </select>
                </div>
              </div>

              <!-- SKU y Código de Barra -->
              <div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2.5">
                <div>
                  <label class="font-semibold text-slate-700 dark:text-slate-300 text-[10px] block mb-1">SKU (Inventario)</label>
                  <input type="text" [(ngModel)]="editingProduct.sku" name="prodSku"
                    placeholder="HAM-01"
                    class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-[11px] uppercase focus:outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label class="font-semibold text-slate-700 dark:text-slate-300 text-[10px] block mb-1">Código de Barra</label>
                  <input type="text" [(ngModel)]="editingProduct.barcode" name="prodBarcode"
                    placeholder="759123456"
                    class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-[11px] focus:outline-none focus:border-brand-500" />
                </div>
              </div>

            </div>

          </div>

          <!-- Sticky Bottom Action Footer -->
          <div class="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 mt-3">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-slate-500 hidden sm:inline">Precio configurado:</span>
              <span class="text-sm font-extrabold text-brand-600 dark:text-brand-400">
                &#36;{{ editingProduct.price || 0 }} {{ editingProduct.currency }}
              </span>
              <span class="text-xs text-slate-400 font-mono">
                (~Bs. {{ ((editingProduct.price || 0) * effectiveRate()).toFixed(2) }})
              </span>
            </div>
            <div class="flex items-center gap-3">
              <button type="button" (click)="close.emit()"
                class="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                {{ i18n.t('common.cancel') }}
              </button>
              <button type="submit"
                class="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-extrabold shadow-md cursor-pointer transition-all active:scale-95">
                {{ i18n.t('common.save') }}
              </button>
            </div>
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
