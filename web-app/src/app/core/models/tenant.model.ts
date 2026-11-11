export interface TenantBusinessHours {
  open: string;  // e.g. "11:00"
  close: string; // e.g. "23:00"
  isOpenToday: boolean;
}

export interface TenantContact {
  whatsappNumber: string; // e.g. "+584121234567"
  phone?: string;
  instagram?: string;
  address: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface DeliveryTier {
  id: string;
  minKm: number;
  maxKm: number;
  price: number;
}

export interface TenantDeliverySettings {
  hasDelivery: boolean;
  hasPickup: boolean;
  baseDeliveryFee: number;
  deliveryRadiusKm?: number;
  deliveryTiers?: DeliveryTier[];
  estimatedDeliveryMinMinutes: number;
  estimatedDeliveryMaxMinutes: number;
  freeDeliveryThreshold?: number;
  minOrderAmount: number;
  currency: string;
  currencySymbol: string;
  businessHours?: {
    open: string;
    close: string;
  };
}

export type CurrencyDisplayMode = 'usd_and_bs' | 'bs_and_usd' | 'only_usd' | 'only_bs';

export interface TenantBranding {
  accentColor: string; // Hex color e.g. '#f97316'
  logoUrl: string;
  bannerUrl: string;
}

export interface TenantCurrencySettings {
  baseCurrency: 'USD' | 'VES';
  displayMode: CurrencyDisplayMode;
  exchangeRate: number; // e.g. 45.50 Bs por USD
  lastRateUpdate?: string;
}

export type CurrencySettings = TenantCurrencySettings;

export interface Tenant {
  id: string;
  slug: string; // Unique URL identifier: /t/:slug (e.g., 'burger-lab', 'tokyo-sushi')
  name: string;
  tagline: string;
  description: string;
  logoUrl: string;
  bannerUrl: string;
  rating: number;
  reviewCount: number;
  category: string; // e.g. "Restaurantes", "Súper", "Farmacias"
  subcategories?: string[]; // e.g. ["Hamburguesas", "Sushi"]
  isActive: boolean;
  isFeatured?: boolean;
  address?: string;
  phone?: string;
  whatsapp_number?: string;
  whatsappNumber?: string;
  contact: TenantContact;
  deliverySettings: TenantDeliverySettings;
  businessHours: TenantBusinessHours;
  branding: TenantBranding;
  currencySettings: TenantCurrencySettings;
  deliveryTiers?: DeliveryTier[];
  subscriptionPlanId?: string;
  planCode?: 'EMPRENDEDOR' | 'COMERCIO_PRO' | 'FRANQUICIA' | string;
  subscriptionPlan?: any;
  commissionPercentage?: number;
  branches?: any[];
}

