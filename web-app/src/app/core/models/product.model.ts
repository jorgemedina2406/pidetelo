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
  isAgeRestricted?: boolean;
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

function normalizeAgeCheckText(value?: string | null): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function isProductAgeRestricted(
  product?: Partial<Product> | null,
  categoryName?: string | null,
  tenant?: any
): boolean {
  if (!product && !tenant) return false;
  if (product && Boolean((product as any).isAgeRestricted ?? (product as any).is_age_restricted)) {
    return true;
  }
  if (tenant) {
    const explicitTenant = tenant.isAgeRestricted ?? tenant.is_age_restricted;
    if (explicitTenant === true) return true;
    const storeCat = normalizeAgeCheckText(tenant.category);
    if (/licor|bodeg|alcohol|cervez|cervec|vinot|licorer/.test(storeCat)) {
      return true;
    }
  }
  const catText = normalizeAgeCheckText(categoryName);
  if (catText && /licor|cervez|vino|ron|whisky|vodka|tequila|ginebra|coctel|trago|alcohol/.test(catText)) {
    return true;
  }
  return false;
}

