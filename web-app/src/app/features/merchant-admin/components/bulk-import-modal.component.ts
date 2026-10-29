import { Component, Input, Output, EventEmitter, inject, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { Branch } from '../../../core/models/branch.model';
import { ProductModifierGroup } from '../../../core/models/product.model';
import { IconComponent } from '../../../shared/components/icon.component';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-bulk-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    @if (isOpen) {
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      (click)="closeModal()">
      <div
        class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-4xl rounded-2xl shadow-2xl p-6 overflow-hidden max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800"
        (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <app-icon name="file-text" [size]="20"></app-icon>
            </div>
            <div>
              <h3 class="text-base font-extrabold flex items-center gap-2">
                <span>Importación Masiva de Productos</span>
                <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  Excel (.xlsx, .xls) & CSV
                </span>
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Carga catálogos completos con más de 3,000 productos, SKU, códigos de barra y variantes en segundos.
              </p>
            </div>
          </div>

          <button (click)="closeModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg cursor-pointer">
            <app-icon name="x" [size]="20"></app-icon>
          </button>
        </div>

        <!-- Stepper Pills -->
        <div class="flex items-center justify-between gap-2 py-3 px-1 border-b border-slate-100 dark:border-slate-800 text-xs">
          <div class="flex items-center gap-2 font-bold" [class.text-emerald-600]="bulkImportStage() === 'upload'" [class.dark:text-emerald-400]="bulkImportStage() === 'upload'">
            <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border"
              [class.bg-emerald-500]="bulkImportStage() === 'upload'" [class.text-white]="bulkImportStage() === 'upload'">1</span>
            <span>1. Subir Archivo</span>
          </div>
          <div class="w-8 h-0.5 bg-slate-200 dark:bg-slate-800"></div>
          <div class="flex items-center gap-2 font-bold" [class.text-emerald-600]="bulkImportStage() === 'preview'" [class.dark:text-emerald-400]="bulkImportStage() === 'preview'">
            <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border"
              [class.bg-emerald-500]="bulkImportStage() === 'preview'" [class.text-white]="bulkImportStage() === 'preview'">2</span>
            <span>2. Vista Previa ({{ parsedBulkProducts().length }})</span>
          </div>
          <div class="w-8 h-0.5 bg-slate-200 dark:bg-slate-800"></div>
          <div class="flex items-center gap-2 font-bold" [class.text-emerald-600]="bulkImportStage() === 'importing'" [class.dark:text-emerald-400]="bulkImportStage() === 'importing'">
            <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border"
              [class.bg-emerald-500]="bulkImportStage() === 'importing'" [class.text-white]="bulkImportStage() === 'importing'">3</span>
            <span>3. Procesando Lotes</span>
          </div>
          <div class="w-8 h-0.5 bg-slate-200 dark:bg-slate-800"></div>
          <div class="flex items-center gap-2 font-bold" [class.text-emerald-600]="bulkImportStage() === 'completed'" [class.dark:text-emerald-400]="bulkImportStage() === 'completed'">
            <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border"
              [class.bg-emerald-500]="bulkImportStage() === 'completed'" [class.text-white]="bulkImportStage() === 'completed'">4</span>
            <span>4. Completado</span>
          </div>
        </div>

        <!-- Main Body per Stage -->
        <div class="flex-1 overflow-y-auto py-4 space-y-4 text-xs">

          <!-- STAGE 1: UPLOAD -->
          @if (bulkImportStage() === 'upload') {
          <div class="space-y-4">
            <!-- Download Template Card -->
            <div class="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div class="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>📄 ¿Aún no tienes el archivo preparado?</span>
                </div>
                <p class="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  Descarga nuestra plantilla oficial en Excel (.xlsx) con columnas pre-configuradas para Nombre, Categoría, Precio, SKU, Código de Barra y Extras.
                </p>
              </div>
              <button type="button" (click)="downloadExcelTemplate()"
                class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap">
                <app-icon name="arrow-down" [size]="14" className="text-white"></app-icon>
                <span>Descargar Plantilla Excel (.xlsx)</span>
              </button>
            </div>

            <!-- Drag and drop zone -->
            <div
              (dragover)="handleDragOver($event)"
              (dragleave)="handleDragLeave($event)"
              (drop)="handleBulkFileDrop($event)"
              [class.border-emerald-500]="isDraggingFile()"
              [class.bg-emerald-500/[0.06]]="isDraggingFile()"
              class="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-8 sm:p-12 text-center space-y-3 transition-all hover:border-emerald-500/60 bg-slate-50/50 dark:bg-slate-800/20">
              
              <div class="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-xs">
                <app-icon name="file-text" [size]="32"></app-icon>
              </div>

              <div>
                <h4 class="text-sm font-extrabold text-slate-900 dark:text-white">
                  Arrastra y suelta tu archivo Excel o CSV aquí
                </h4>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  Soporta archivos .xlsx, .xls y .csv. Ideal para comercios o supermercados con 1,000, 3,000 o más productos.
                </p>
              </div>

              <div class="pt-2">
                <label class="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold inline-flex items-center gap-2 cursor-pointer transition-all shadow-sm active:scale-95">
                  <app-icon name="folder" [size]="15"></app-icon>
                  <span>Seleccionar Archivo de mi Equipo</span>
                  <input type="file" accept=".xlsx, .xls, .csv" (change)="handleBulkFileInput($event)" class="hidden" />
                </label>
              </div>
            </div>

            <!-- Feature Bullets -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                <div class="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>⚡ Lotes de Alta Velocidad</span>
                </div>
                <p class="text-[10px] text-slate-500 dark:text-slate-400">
                  Segmentación automática en chunks para evitar bloqueos del navegador y caídas de red.
                </p>
              </div>

              <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                <div class="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>🏷️ Auto-Categorización</span>
                </div>
                <p class="text-[10px] text-slate-500 dark:text-slate-400">
                  Crea automáticamente las categorías faltantes en tu comercio si aún no existen.
                </p>
              </div>

              <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                <div class="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>🔍 SKU & Códigos de Barra</span>
                </div>
                <p class="text-[10px] text-slate-500 dark:text-slate-400">
                  Registra códigos de barras compatibles con pistolas lectoras para puntos de venta.
                </p>
              </div>
            </div>
          </div>
          }

          <!-- STAGE 2: PREVIEW -->
          @if (bulkImportStage() === 'preview') {
          <div class="space-y-4">
            @if (bulkFileSummary(); as summary) {
            <div class="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold">
                  ✓
                </div>
                <div>
                  <div class="font-extrabold text-xs text-slate-900 dark:text-white">{{ summary.fileName }}</div>
                  <div class="text-[10px] text-slate-500 dark:text-slate-400">{{ summary.fileSize }} • {{ summary.validRows }} productos listos para importar</div>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button type="button" (click)="bulkImportStage.set('upload')"
                  class="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer">
                  Cambiar Archivo
                </button>
                <button type="button" (click)="executeBulkImport()"
                  class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer">
                  <span>🚀 Confirmar e Importar ({{ parsedBulkProducts().length }})</span>
                </button>
              </div>
            </div>
            }

            <!-- Preview Table -->
            <div class="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div class="max-h-[380px] overflow-y-auto">
                <table class="w-full text-left border-collapse text-[11px]">
                  <thead class="bg-slate-100 dark:bg-slate-800/80 sticky top-0 font-bold text-slate-700 dark:text-slate-300 z-10">
                    <tr>
                      <th class="p-2.5">#</th>
                      <th class="p-2.5">Nombre</th>
                      <th class="p-2.5">Categoría</th>
                      <th class="p-2.5">Precio</th>
                      <th class="p-2.5">SKU</th>
                      <th class="p-2.5">Código Barra</th>
                      <th class="p-2.5">Variantes / Grupos</th>
                      <th class="p-2.5">Estado</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                    @for (prod of parsedBulkProducts().slice(0, 50); track $index; let idx = $index) {
                    <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td class="p-2.5 font-mono text-slate-400">{{ idx + 1 }}</td>
                      <td class="p-2.5 font-bold text-slate-900 dark:text-white max-w-[200px] truncate">{{ prod.name }}</td>
                      <td class="p-2.5">
                        <span class="px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-[10px] font-semibold">
                          {{ prod.categoryName }}
                        </span>
                      </td>
                      <td class="p-2.5 font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        \${{ prod.price.toFixed(2) }}
                      </td>
                      <td class="p-2.5 font-mono text-slate-500">
                        {{ prod.sku || '-' }}
                      </td>
                      <td class="p-2.5 font-mono text-slate-500">
                        {{ prod.barcode || '-' }}
                      </td>
                      <td class="p-2.5">
                        @if (prod.modifierGroups && prod.modifierGroups.length > 0) {
                        <span class="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                          {{ prod.modifierGroups.length }} grupo(s)
                        </span>
                        } @else {
                        <span class="text-slate-400 italic">Sin extras</span>
                        }
                      </td>
                      <td class="p-2.5">
                        <span class="px-2 py-0.5 rounded-full text-[9px] font-bold"
                          [class.bg-emerald-500/15]="prod.isAvailable" [class.text-emerald-600]="prod.isAvailable"
                          [class.bg-red-500/15]="!prod.isAvailable" [class.text-red-500]="!prod.isAvailable">
                          {{ prod.isAvailable ? 'Activo' : 'Agotado' }}
                        </span>
                      </td>
                    </tr>
                    }
                  </tbody>
                </table>
              </div>

              @if (parsedBulkProducts().length > 50) {
              <div class="p-2 text-center bg-slate-50 dark:bg-slate-800/40 text-slate-500 text-[10px] border-t border-slate-200 dark:border-slate-800">
                Mostrando las primeras 50 filas de {{ parsedBulkProducts().length }} productos detectados en total.
              </div>
              }
            </div>
          </div>
          }

          <!-- STAGE 3: IMPORTING -->
          @if (bulkImportStage() === 'importing') {
          <div class="py-12 px-6 text-center space-y-6">
            <div class="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center animate-pulse">
              <app-icon name="refresh-cw" [size]="32"></app-icon>
            </div>

            <div class="space-y-2">
              <h4 class="text-lg font-extrabold text-slate-900 dark:text-white">
                Importando productos a la base de datos...
              </h4>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Procesando Lote {{ bulkImportProgress().currentBatch }} de {{ bulkImportProgress().totalBatches }}
              </p>
            </div>

            <div class="max-w-md mx-auto space-y-2">
              <div class="w-full bg-slate-200 dark:bg-slate-800 h-4 rounded-full overflow-hidden p-0.5">
                <div class="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
                  [style.width.%]="bulkImportProgress().percentage"></div>
              </div>
              <div class="flex items-center justify-between text-xs font-mono font-bold text-slate-500">
                <span>{{ bulkImportProgress().current }} / {{ bulkImportProgress().total }} artículos</span>
                <span class="text-emerald-600 dark:text-emerald-400">{{ bulkImportProgress().percentage }}%</span>
              </div>
            </div>

            <div class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-[11px] text-slate-500 max-w-sm mx-auto">
              Por favor mantén esta pestaña abierta mientras se completan todos los lotes sin saturar tu red.
            </div>
          </div>
          }

          <!-- STAGE 4: COMPLETED -->
          @if (bulkImportStage() === 'completed') {
          <div class="py-10 px-6 text-center space-y-5 animate-fade-in">
            <div class="w-16 h-16 rounded-2xl bg-emerald-500 text-white mx-auto flex items-center justify-center text-3xl font-black shadow-lg shadow-emerald-500/30">
              ✓
            </div>

            <div class="space-y-1">
              <h4 class="text-xl font-extrabold text-slate-900 dark:text-white">
                ¡Importación Masiva Completada con Éxito!
              </h4>
              <p class="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Se han registrado y sincronizado {{ bulkImportProgress().total }} productos en tu catálogo con sus categorías, precios y variantes.
              </p>
            </div>

            @if (bulkImportErrors().length > 0) {
            <div class="max-w-md mx-auto p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-left text-[11px] space-y-1">
              <div class="font-bold">Advertencias encontradas durante la carga:</div>
              <ul class="list-disc pl-4 space-y-0.5">
                @for (err of bulkImportErrors(); track err) {
                <li>{{ err }}</li>
                }
              </ul>
            </div>
            }

            <div class="pt-4 flex items-center justify-center gap-3">
              <button type="button" (click)="resetModal()"
                class="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                Importar Otro Archivo
              </button>
              <button type="button" (click)="closeModal()"
                class="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer">
                Ver Productos en el Catálogo
              </button>
            </div>
          </div>
          }

        </div>

      </div>
    </div>
    }
  `
})
export class BulkImportModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() activeBranch: Branch | null = null;
  @Input() tenantId = '';

  @Output() close = new EventEmitter<void>();
  @Output() importCompleted = new EventEmitter<void>();

  private readonly api = inject(ApiService);

  readonly bulkImportStage = signal<'upload' | 'preview' | 'importing' | 'completed'>('upload');
  readonly parsedBulkProducts = signal<any[]>([]);
  readonly bulkImportProgress = signal<{
    current: number;
    total: number;
    percentage: number;
    currentBatch: number;
    totalBatches: number;
  }>({ current: 0, total: 0, percentage: 0, currentBatch: 0, totalBatches: 0 });
  readonly bulkImportErrors = signal<string[]>([]);
  readonly isDraggingFile = signal(false);
  readonly bulkFileSummary = signal<{
    fileName: string;
    fileSize: string;
    totalRows: number;
    validRows: number;
  } | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.resetModal();
    }
  }

  resetModal(): void {
    this.bulkImportStage.set('upload');
    this.parsedBulkProducts.set([]);
    this.bulkFileSummary.set(null);
    this.bulkImportErrors.set([]);
    this.bulkImportProgress.set({ current: 0, total: 0, percentage: 0, currentBatch: 0, totalBatches: 0 });
  }

  closeModal(): void {
    this.close.emit();
  }

  downloadExcelTemplate(): void {
    const templateData = [
      {
        'Nombre': 'Hamburguesa Bacon Doble Especial',
        'Categoria': 'Hamburguesas',
        'Precio': 8.50,
        'Moneda': 'USD',
        'SKU': 'BL-HAM-001',
        'CodigoDeBarra': '7591234567890',
        'Descripcion': 'Doble carne smash 200g, queso cheddar americano, tocineta crujiente y pan brioche artesanal',
        'Disponible': 'SI',
        'ImagenURL': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
        'VariantesOExtras': 'Tipo de Pan: Brioche [0], Integral [0.50] (Requerido 1) | Extras: Tocineta [+1.50], Doble Queso [+1.00] (Opcional)'
      },
      {
        'Nombre': 'Papas Fritas Cheese & Bacon',
        'Categoria': 'Acompañantes',
        'Precio': 4.00,
        'Moneda': 'USD',
        'SKU': 'BL-PAP-002',
        'CodigoDeBarra': '7591234567891',
        'Descripcion': 'Papas rústicas con baño de queso cheddar fundido y lluvia de tocineta',
        'Disponible': 'SI',
        'ImagenURL': 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=600',
        'VariantesOExtras': 'Salsas: Tartara, BBQ, Picante (Requerido 1) | Adicional: Extra Queso [+1.00] (Opcional)'
      },
      {
        'Nombre': 'Bowl Ensalada César o Fit Personalizado',
        'Categoria': 'Ensaladas & Bowls',
        'Precio': 6.50,
        'Moneda': 'USD',
        'SKU': 'BL-ENS-003',
        'CodigoDeBarra': '7591234567892',
        'Descripcion': 'Base verde mixta con 6 ingredientes a elegir, aderezo y proteína',
        'Disponible': 'SI',
        'ImagenURL': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600',
        'VariantesOExtras': 'Ingredientes: Cebolla, Tomate, Pepinillos, Maiz, Crutones, Aguacate (Requerido 2) | Proteina: Pollo Grill [0], Salmon [+2.50] (Requerido 1)'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!cols'] = [
      { wch: 32 },
      { wch: 18 },
      { wch: 10 },
      { wch: 8 },
      { wch: 14 },
      { wch: 16 },
      { wch: 45 },
      { wch: 12 },
      { wch: 35 },
      { wch: 55 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla_Productos');
    XLSX.writeFile(workbook, 'Plantilla_Importacion_Productos_DeliveryHub.xlsx');
  }

  handleBulkFileInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.processExcelFile(target.files[0]);
    }
  }

  handleDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile.set(true);
  }

  handleDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile.set(false);
  }

  handleBulkFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.processExcelFile(event.dataTransfer.files[0]);
    }
  }

  private processExcelFile(file: File): void {
    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rows || rows.length === 0) {
          alert('El archivo Excel no contiene filas o datos legibles.');
          return;
        }

        const normalized: any[] = [];
        let validCount = 0;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rawName = row['Nombre'] || row['nombre'] || row['Name'] || row['name'] || row['Producto'] || row['producto'] || row['Articulo'];
          const name = rawName ? String(rawName).trim() : '';

          if (!name) continue;

          const rawPrice = row['Precio'] || row['precio'] || row['Price'] || row['price'] || 0;
          const price = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice).replace(',', '.')) || 0;
          const rawCategory = row['Categoria'] || row['categoria'] || row['Category'] || row['category'] || row['Rubro'] || 'General';
          const categoryName = String(rawCategory).trim() || 'General';

          const rawSku = row['SKU'] || row['sku'] || row['Codigo'] || row['codigo'] || '';
          const sku = rawSku ? String(rawSku).trim() : '';

          const rawBarcode = row['CodigoDeBarra'] || row['Codigo_Barra'] || row['codigoDeBarra'] || row['codigo_barra'] || row['Barcode'] || row['barcode'] || '';
          const barcode = rawBarcode ? String(rawBarcode).trim() : '';

          const rawDesc = row['Descripcion'] || row['descripcion'] || row['Description'] || row['description'] || '';
          const description = String(rawDesc).trim();

          const rawAvail = row['Disponible'] || row['disponible'] || row['Disponible?'] || row['EnStock'] || row['isAvailable'];
          const isAvailable = rawAvail === '' || rawAvail === true || String(rawAvail).toLowerCase() === 'si' || String(rawAvail).toLowerCase() === 'true' || String(rawAvail) === '1';

          const rawCurrency = row['Moneda'] || row['moneda'] || row['Currency'] || 'USD';
          const currency = String(rawCurrency).toUpperCase().includes('VES') || String(rawCurrency).toUpperCase().includes('BS') ? 'VES' : 'USD';

          const rawImage = row['ImagenURL'] || row['Imagen'] || row['imagen'] || row['image_url'] || row['imageUrl'] || '';
          const imageUrl = rawImage ? String(rawImage).trim() : 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600';

          const rawModifiers = row['VariantesOExtras'] || row['Variantes'] || row['variantes'] || row['Extras'] || row['extras'] || '';
          const modifierGroups = this.parseModifiersFromString(String(rawModifiers));

          normalized.push({
            name,
            price,
            categoryName,
            sku,
            barcode,
            description,
            isAvailable,
            currency,
            imageUrl,
            modifierGroups
          });
          validCount++;
        }

        const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
        const sizeStr = file.size > 1024 * 1024 ? `${sizeInMb} MB` : `${Math.round(file.size / 1024)} KB`;

        this.bulkFileSummary.set({
          fileName: file.name,
          fileSize: sizeStr,
          totalRows: rows.length,
          validRows: validCount
        });

        this.parsedBulkProducts.set(normalized);
        this.bulkImportStage.set('preview');
      } catch (err: any) {
        console.error('[BulkImportModal] Error al leer archivo Excel:', err);
        alert(`Error al procesar el archivo Excel: ${err.message || 'Formato no reconocido'}`);
      }
    };

    reader.readAsArrayBuffer(file);
  }

  parseModifiersFromString(raw: string): ProductModifierGroup[] {
    if (!raw || !raw.trim()) return [];

    const groups: ProductModifierGroup[] = [];
    const groupBlocks = raw.split('|');

    for (let gIdx = 0; gIdx < groupBlocks.length; gIdx++) {
      const block = groupBlocks[gIdx].trim();
      if (!block) continue;

      const colonIdx = block.indexOf(':');
      let title = block;
      let optionsStr = '';

      if (colonIdx > -1) {
        title = block.substring(0, colonIdx).trim();
        optionsStr = block.substring(colonIdx + 1).trim();
      } else {
        optionsStr = block;
        title = `Grupo ${gIdx + 1}`;
      }

      let minSelections = 0;
      let maxSelections = 1;

      const reqMatch = optionsStr.match(/\((?:requerido|obligatorio)\s*(\d+)?\)/i);
      const optMatch = optionsStr.match(/\((?:opcional|extras)\)/i);

      if (reqMatch) {
        const requiredCount = reqMatch[1] ? parseInt(reqMatch[1], 10) : 1;
        minSelections = requiredCount;
        maxSelections = requiredCount;
        optionsStr = optionsStr.replace(reqMatch[0], '').trim();
      } else if (optMatch) {
        minSelections = 0;
        optionsStr = optionsStr.replace(optMatch[0], '').trim();
      }

      const optParts = optionsStr.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
      const options = optParts.map((optPart, oIdx) => {
        let name = optPart;
        let priceDelta = 0;

        const priceBracket = optPart.match(/\[\+?\$?([0-9.]+)\]/);
        const priceColon = optPart.match(/:\+?\$?([0-9.]+)/);

        if (priceBracket) {
          priceDelta = parseFloat(priceBracket[1]) || 0;
          name = optPart.replace(priceBracket[0], '').trim();
        } else if (priceColon) {
          priceDelta = parseFloat(priceColon[1]) || 0;
          name = optPart.replace(priceColon[0], '').trim();
        }

        return {
          id: `opt-import-${Date.now()}-${gIdx}-${oIdx}`,
          name: name || `Opción ${oIdx + 1}`,
          priceDelta: priceDelta
        };
      });

      if (options.length > 0) {
        if (!reqMatch && minSelections === 0) {
          maxSelections = options.length;
        } else if (reqMatch && maxSelections < minSelections) {
          maxSelections = Math.max(minSelections, options.length);
        }

        groups.push({
          id: `mod-import-${Date.now()}-${gIdx}`,
          title: title || 'Opciones',
          minSelections: minSelections,
          maxSelections: Math.max(minSelections, maxSelections || options.length),
          options: options
        });
      }
    }

    return groups;
  }

  async executeBulkImport(): Promise<void> {
    const list = this.parsedBulkProducts();
    if (list.length === 0) return;

    this.bulkImportStage.set('importing');
    const tenantId = this.tenantId || 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const total = list.length;
    const BATCH_SIZE = 150;
    const totalBatches = Math.ceil(total / BATCH_SIZE);

    this.bulkImportProgress.set({
      current: 0,
      total: total,
      percentage: 0,
      currentBatch: 0,
      totalBatches: totalBatches
    });

    const accumulatedErrors: string[] = [];

    for (let b = 0; b < totalBatches; b++) {
      const start = b * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, total);
      const chunk = list.slice(start, end);

      try {
        const branchId = this.activeBranch?.id || undefined;
        await new Promise<void>((resolve) => {
          this.api.bulkImportProducts(tenantId, chunk, branchId).subscribe({
            next: (res) => {
              if (res.errors && res.errors.length > 0) {
                accumulatedErrors.push(...res.errors);
              }
              resolve();
            },
            error: (err) => {
              accumulatedErrors.push(`Error en lote ${b + 1}: ${err.message || 'Error de red'}`);
              resolve();
            }
          });
        });
      } catch (e: any) {
        accumulatedErrors.push(`Error en lote ${b + 1}: ${e.message}`);
      }

      const currentProcessed = Math.min((b + 1) * BATCH_SIZE, total);
      const pct = Math.round((currentProcessed / total) * 100);

      this.bulkImportProgress.set({
        current: currentProcessed,
        total: total,
        percentage: pct,
        currentBatch: b + 1,
        totalBatches: totalBatches
      });

      await new Promise(r => setTimeout(r, 60));
    }

    this.bulkImportErrors.set(accumulatedErrors);
    this.importCompleted.emit();
    this.bulkImportStage.set('completed');
  }
}
