export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  couponCode?: string;
  badgeText?: string;
  buttonText?: string;
  linkUrl?: string;
  imageUrl?: string;
  bgGradientStart?: string;
  bgGradientEnd?: string;
  sortOrder?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

