export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  displayOrder: number;
}

export interface ProductModifierOption {
  id: string;
  name: string;
  priceDelta: number; // additional cost (e.g. +$1.50)
  isDefault?: boolean;
}

export interface ProductModifierGroup {
  id: string;
  title: string;
  description?: string;
  minSelections: number; // 0 for optional, 1+ for required
  maxSelections: number;
  options: ProductModifierOption[];
}

export interface Product {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  currency?: 'USD' | 'VES';
  compareAtPrice?: number; // Original price if on sale
  imageUrl: string;
  isAvailable: boolean;
  isPopular?: boolean;
  isFeatured?: boolean;
  isOnSale?: boolean;
  discountPercentage?: number;
  tags?: string[];
  modifierGroups?: ProductModifierGroup[];
  branchId?: string | null;
  sku?: string;
  barcode?: string;
  trackStock?: boolean;
  stockQuantity?: number | null;
  previousStock?: number | null;
}

