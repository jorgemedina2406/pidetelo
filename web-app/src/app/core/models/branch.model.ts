import { DeliveryTier, CurrencySettings } from './tenant.model';

export type BranchStatus = 'pending_approval' | 'active' | 'inactive' | 'rejected';

export interface BranchPaymentCredentials {
  pagoMovilBank: string;         // e.g. "0134 - Banesco"
  pagoMovilPhone: string;        // e.g. "0414-5001122"
  pagoMovilIdNumber: string;     // e.g. "V-25.123.456" o "J-501234567"
  pagoMovilAccountName: string;  // e.g. "Burger Lab La Mata C.A."
  zelleEmail?: string;           // e.g. "pagos.lamata@burgerlab.com"
  zelleAccountName?: string;     // e.g. "Burger Lab Group LLC"
  gatewayPublicKey?: string;
  gatewayMerchantId?: string;
  isActive: boolean;
}

export interface Branch {
  id: string;
  companyId: string;             // References Tenant.id
  companyName?: string;
  name: string;                  // e.g. "Burger Lab - La Mata (Sede Principal)"
  slug: string;                  // e.g. "la-mata"
  address: string;               // e.g. "Av. Intercomunal Barquisimeto-Cabudare, Sector La Mata"
  latitude: number;
  longitude: number;
  deliveryRadiusKm: number;      // e.g. 8.0 km
  baseDeliveryFee: number;       // e.g. 2.50 USD
  deliveryTiers?: DeliveryTier[];
  tagline?: string;
  accentColor?: string;
  logoUrl?: string;
  bannerUrl?: string;
  exchangeRate?: number;
  baseCurrency?: 'USD' | 'VES';
  displayMode?: 'usd_and_bs' | 'bs_and_usd' | 'only_usd' | 'only_bs';
  currencySettings?: CurrencySettings;
  branding?: {
    accentColor: string;
    logoUrl: string;
    bannerUrl: string;
  };
  status: BranchStatus;
  phone?: string;
  whatsapp?: string;
  openTime: string;              // e.g. "11:30"
  closeTime: string;             // e.g. "23:00"
  isOpenNow: boolean;
  paymentCredentials: BranchPaymentCredentials;
  createdAt?: string;
  rejectionReason?: string;
  isMain?: boolean;
  managerEmail?: string;
  managerName?: string;
  managerPassword?: string;
}

export interface SubscriptionPlan {
  id: 'EMPRENDEDOR' | 'COMERCIO' | 'CORPORATIVO';
  name: string;
  maxBranches: number;
  monthlyPriceUsd: number;
  description: string;
  features: string[];
}
