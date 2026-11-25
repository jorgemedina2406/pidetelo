import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Order,
  CartItem,
  OrderItemPhotoPreview,
  parseOrderAdditions,
  OrderAddition,
  isOrderAdditionItem,
  getOrderSourceMeta,
  OrderSourceMeta,
  formatOrderDateTime,
  isOrderAgeRestricted,
  formatOrderModifiersText,
  resolveOrderItemImageUrl,
  buildOrderItemPhotoPreview,
} from '../../../../core/models/order.model';
import { Product } from '../../../../core/models/product.model';
import { IconComponent } from '../../../../shared/components/icon.component';
import { ProductImageLightboxComponent } from '../product-image-lightbox/product-image-lightbox.component';

@Component({
  selector: 'app-order-detail-modal',
  standalone: true,
  imports: [CommonModule, IconComponent, ProductImageLightboxComponent],
  templateUrl: './order-detail-modal.component.html'
})
export class OrderDetailModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() order: Order | null = null;
  @Input() products: Product[] = [];
  @Input() activeExchangeRate = 45.50;

  previewPhoto: OrderItemPhotoPreview | null = null;
  private failedImageUrls = new Set<string>();

  @Output() close = new EventEmitter<void>();
  @Output() viewRoute = new EventEmitter<Order>();
  @Output() verifyAdditionPayment = new EventEmitter<{ order: Order; addition: OrderAddition }>();

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['isOpen'] && !this.isOpen) || changes['order']) {
      this.previewPhoto = null;
    }
  }

  get effectiveRate(): number {
    const ordRate = this.order?.exchangeRate || 0;
    const isLegacy = ordRate <= 1 || ordRate === 45.5 || ordRate === 52.8 || ordRate === 54.5;
    if (!isLegacy) return ordRate;
    return this.activeExchangeRate || ordRate || 45.50;
  }

  get baseItems() {
    return (this.order?.items || []).filter(i => !isOrderAdditionItem(i));
  }

  get additionItems() {
    return (this.order?.items || []).filter(i => isOrderAdditionItem(i));
  }

  get additions(): OrderAddition[] {
    return parseOrderAdditions(this.order?.notes);
  }

  get additionsTotalUsd(): number {
    return this.additions.reduce((sum, a) => sum + a.amountUsd, 0);
  }

  get baseOrderTotalUsd(): number {
    const tot = this.order?.total || 0;
    return Math.max(0, Number((tot - this.additionsTotalUsd).toFixed(2)));
  }

  get initialSubtotalUsd(): number {
    const sub = this.order?.subtotal || 0;
    return Math.max(0, Number((sub - this.additionsTotalUsd).toFixed(2)));
  }

  getAdditionBs(add: OrderAddition): number {
    const implied = add.amountBs && add.amountUsd > 0 ? add.amountBs / add.amountUsd : 0;
    if (add.status === 'verified' && add.amountBs !== undefined && add.amountBs !== null && implied >= 100) {
      return add.amountBs;
    }
    if (this.activeExchangeRate && this.activeExchangeRate > 100) {
      return Number((add.amountUsd * this.activeExchangeRate).toFixed(2));
    }
    if (add.amountBs !== undefined && add.amountBs !== null && implied >= 100) {
      return add.amountBs;
    }
    return Number((add.amountUsd * this.effectiveRate).toFixed(2));
  }

  isAdditionItem(item: any): boolean {
    return isOrderAdditionItem(item);
  }

  get totalBs(): number {
    if (this.order?.totalBs !== undefined && this.order.totalBs !== null) return this.order.totalBs;
    return Number(((this.order?.total || 0) * this.effectiveRate).toFixed(2));
  }

  get deliveryFeeBs(): number {
    if (this.order?.deliveryFeeBs !== undefined && this.order.deliveryFeeBs !== null) return this.order.deliveryFeeBs;
    return Number(((this.order?.deliveryFee || 0) * this.effectiveRate).toFixed(2));
  }

  get subtotalBs(): number {
    if (this.order?.subtotalBs !== undefined && this.order.subtotalBs !== null) return this.order.subtotalBs;
    return Number(((this.order?.subtotal || 0) * this.effectiveRate).toFixed(2));
  }

  get discountBs(): number {
    if (this.order?.discountBs !== undefined && this.order.discountBs !== null) return this.order.discountBs;
    return Number(((this.order?.discount || 0) * this.effectiveRate).toFixed(2));
  }

  getModifiersText(modifiers: any[]): string {
    return formatOrderModifiersText(modifiers);
  }

  getItemImageUrl(item: CartItem): string | null {
    const url = resolveOrderItemImageUrl(item, this.products);
    if (!url || this.failedImageUrls.has(url)) return null;
    return url;
  }

  onItemImageError(url?: string | null): void {
    if (url) {
      this.failedImageUrls.add(url);
    }
  }

  openItemPhoto(item: CartItem, isAddition = false, event?: Event): void {
    event?.stopPropagation();
    const url = this.getItemImageUrl(item);
    if (!url) return;
    this.previewPhoto = buildOrderItemPhotoPreview(item, url, isAddition);
  }

  closeItemPhoto(): void {
    this.previewPhoto = null;
  }

  get sourceMeta(): OrderSourceMeta {
    return getOrderSourceMeta(this.order?.source);
  }

  get isAgeRestricted(): boolean {
    return isOrderAgeRestricted(this.order?.notes);
  }

  formatOrderTime(iso?: string | null): string {
    return formatOrderDateTime(iso);
  }
}
