export type OrderStatus = 
  | 'draft'
  | 'received'
  | 'in_kitchen'
  | 'assigned_driver'
  | 'at_merchant'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled';

export type OrderSource = 'whatsapp_link' | 'marketplace_web' | 'mobile_app';

export type FulfillmentType = 'delivery' | 'pickup';

export type PaymentMethod = 
  | 'cash_usd'
  | 'cash_local'
  | 'mobile_transfer' // Pago Móvil / Zelle / Bizum
  | 'pago_movil'
  | 'card_terminal'
  | 'online';

export type PaymentStatus = 
  | 'pending'       // Pago Móvil reportado pero sin validar en cuenta
  | 'verified'      // Pago Móvil confirmado en cuenta bancaria
  | 'rejected'      // Comprobante inválido o no encontrado
  | 'not_required'; // Efectivo / Cobro contraentrega

export interface SelectedModifier {
  groupId: string;
  groupTitle: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface CartItem {
  cartItemId: string; // Unique hash based on product + selected modifiers
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  selectedModifiers: SelectedModifier[];
  itemTotal: number; // (unitPrice + sum(modifiers)) * quantity
  notes?: string;
  imageUrl?: string;
}

export interface CustomerInfo {
  name: string;
  phone: string; // WhatsApp phone
  email?: string;
  deliveryAddress?: string;
  addressReference?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. "ORD-8921"
  tenantId: string;
  tenantName: string;
  tenantSlug?: string;
  source: OrderSource;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentStatus;
  paymentReference?: string;
  paymentOriginBank?: string;
  paymentAmountBs?: number;
  paymentVerifiedAt?: string;
  paymentVerifiedBy?: string;
  customer: CustomerInfo;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  tip?: number;
  discount: number;
  couponCode?: string;
  total: number;
  deliveryLat?: number;
  deliveryLng?: number;
  tenantAddress?: string;
  tenantPhone?: string;
  tenantLat?: number;
  tenantLng?: number;
  createdAt: string;
  updatedAt: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverPlate?: string;
  driverVehicle?: string;
  driverAvatar?: string;
  driverLat?: number;
  driverLng?: number;
  riderAccepted?: boolean;
  riderRejected?: boolean;
  rejectedRiderName?: string;
  branchId?: string;
  branchName?: string;
  notes?: string;
  deliveryPin?: string;
}
