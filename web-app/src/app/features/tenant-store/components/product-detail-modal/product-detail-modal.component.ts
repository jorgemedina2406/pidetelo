import { Component, EventEmitter, Input, Output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product, ProductModifierGroup, ProductModifierOption } from '../../../../core/models/product.model';
import { SelectedModifier } from '../../../../core/models/order.model';
import { CartStore } from '../../stores/cart.store';

@Component({
  selector: 'app-product-detail-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-detail-modal.component.html'
})
export class ProductDetailModalComponent {
  readonly cart = inject(CartStore);

  @Input() product: Product | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() add = new EventEmitter<{ product: Product; quantity: number; modifiers: SelectedModifier[]; notes?: string }>();

  readonly quantity = signal(1);
  readonly selectedModifiers = signal<SelectedModifier[]>([]);
  notes = '';

  ngOnChanges(): void {
    if (this.product) {
      this.quantity.set(1);
      this.notes = '';
      // Preselect default options
      const defaults: SelectedModifier[] = [];
      this.product.modifierGroups?.forEach(group => {
        const defOpt = group.options.find(o => o.isDefault);
        if (defOpt) {
          defaults.push({
            groupId: group.id,
            groupTitle: group.title,
            optionId: defOpt.id,
            optionName: defOpt.name,
            priceDelta: defOpt.priceDelta
          });
        }
      });
      this.selectedModifiers.set(defaults);
    }
  }

  readonly calculatedTotal = computed(() => {
    if (!this.product) return 0;
    const modsSum = this.selectedModifiers().reduce((acc, m) => acc + m.priceDelta, 0);
    return (this.product.price + modsSum) * this.quantity();
  });

  readonly calculatedTotalVes = computed(() => {
    return Number((this.calculatedTotal() * this.cart.exchangeRate()).toFixed(2));
  });

  isOptionSelected(groupId: string, optionId: string): boolean {
    return this.selectedModifiers().some(m => m.groupId === groupId && m.optionId === optionId);
  }

  getSelectedCountInGroup(groupId: string): number {
    return this.selectedModifiers().filter(m => m.groupId === groupId).length;
  }

  isGroupComplete(group: ProductModifierGroup): boolean {
    if (!group.minSelections || group.minSelections <= 0) return true;
    return this.getSelectedCountInGroup(group.id) >= group.minSelections;
  }

  getMissingCount(group: ProductModifierGroup): number {
    if (!group.minSelections || group.minSelections <= 0) return 0;
    return Math.max(0, group.minSelections - this.getSelectedCountInGroup(group.id));
  }

  toggleModifier(group: ProductModifierGroup, option: ProductModifierOption): void {
    const current = [...this.selectedModifiers()];

    if (group.maxSelections === 1) {
      // Single choice
      const filtered = current.filter(m => m.groupId !== group.id);
      filtered.push({
        groupId: group.id,
        groupTitle: group.title,
        optionId: option.id,
        optionName: option.name,
        priceDelta: option.priceDelta
      });
      this.selectedModifiers.set(filtered);
    } else {
      // Multiple choices
      const existsIndex = current.findIndex(m => m.groupId === group.id && m.optionId === option.id);
      if (existsIndex > -1) {
        current.splice(existsIndex, 1);
        this.selectedModifiers.set(current);
      } else {
        const countInGroup = current.filter(m => m.groupId === group.id).length;
        if (countInGroup < group.maxSelections) {
          current.push({
            groupId: group.id,
            groupTitle: group.title,
            optionId: option.id,
            optionName: option.name,
            priceDelta: option.priceDelta
          });
          this.selectedModifiers.set(current);
        }
      }
    }
  }

  isValidSelection(): boolean {
    if (!this.product?.modifierGroups) return true;
    for (const group of this.product.modifierGroups) {
      if (group.minSelections > 0) {
        const count = this.selectedModifiers().filter(m => m.groupId === group.id).length;
        if (count < group.minSelections) return false;
      }
    }
    return true;
  }

  increaseQuantity(): void {
    this.quantity.update(q => q + 1);
  }

  decreaseQuantity(): void {
    this.quantity.update(q => (q > 1 ? q - 1 : 1));
  }

  closeModal(): void {
    this.close.emit();
  }

  confirmAdd(): void {
    if (this.product && this.isValidSelection()) {
      this.add.emit({
        product: this.product,
        quantity: this.quantity(),
        modifiers: this.selectedModifiers(),
        notes: this.notes.trim() || undefined
      });
      this.closeModal();
    }
  }
}
