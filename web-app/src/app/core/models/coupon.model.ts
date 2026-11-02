export interface Coupon {
  id: string;
  tenantId: string;
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number | null;
  maxDiscountAmount?: number | null;
  max_discount?: number | null;
  usageLimit?: number | null;
  timesUsed: number;
  isActive: boolean;
  isGlobal?: boolean;
  targetCondition?: string;
  notificationSentAt?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

