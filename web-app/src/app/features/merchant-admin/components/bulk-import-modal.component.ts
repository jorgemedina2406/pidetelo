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
  templateUrl: './bulk-import-modal.component.html'
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
