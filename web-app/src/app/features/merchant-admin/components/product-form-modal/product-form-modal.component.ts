import { Component, Input, Output, EventEmitter, inject, signal, computed, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product, ProductModifierGroup, ProductCategory } from '../../../../core/models/product.model';
import { Branch } from '../../../../core/models/branch.model';
import { IconComponent } from '../../../../shared/components/icon.component';
import { I18nService } from '../../../../core/services/i18n.service';
import { ApiService } from '../../../../core/services/api.service';
import { CurrencyService } from '../../../../core/services/currency.service';

@Component({
  selector: 'app-product-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './product-form-modal.component.html'
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
