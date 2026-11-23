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

export type OrderSource = 'whatsapp_link' | 'marketplace_web' | 'mobile_app' | 'merchant_manual';

export type FulfillmentType = 'delivery' | 'pickup';

export type PaymentMethod = 
  | 'cash_usd'
  | 'cash_local'
  | 'mobile_transfer' // Pago Móvil / Bizum
  | 'pago_movil'
  | 'zelle'
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
  paymentRejectionReason?: string;
  customer: CustomerInfo;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  tip?: number;
  discount: number;
  couponCode?: string;
  total: number;
  exchangeRate?: number;
  currency?: string;
  subtotalBs?: number;
  deliveryFeeBs?: number;
  discountBs?: number;
  totalBs?: number;
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

export interface OrderAddition {
  index: number;
  raw: string;
  amountUsd: number;
  amountBs?: number;
  method: 'cash' | 'mobile_transfer';
  reference?: string;
  originBank?: string;
  status: 'pending' | 'verified' | 'rejected' | 'cash_on_delivery';
  description?: string;
  rejectionReason?: string;
}

export function isOrderAdditionItem(item: any): boolean {
  if (!item) return false;
  if (typeof item.name === 'string' && /adici[oó]n/i.test(item.name)) return true;
  if (typeof item.product_name === 'string' && /adici[oó]n/i.test(item.product_name)) return true;
  if (Array.isArray(item.selectedModifiers)) {
    return item.selectedModifiers.some((m: any) =>
      String(m?.name || m?.optionName || m?.option_name || '').toLowerCase().includes('adici')
    );
  }
  return false;
}

export function parseOrderAdditions(notes?: string | null): OrderAddition[] {
  if (!notes) return [];
  const results: OrderAddition[] = [];
  const regex = /\[(?:ADICIONAL|Adición en app)[^\]]*\]/gi;
  const matches = notes.match(regex);
  if (!matches) return [];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const descMatch = m.match(/\[(?:ADICIONAL|Adición en app)\s*:\s*([^|\]]+)/i);
    const description = descMatch ? descMatch[1].trim() : undefined;

    const amountMatch = m.match(/\+?\$\s*(\d+(?:\.\d+)?)/);
    const amountUsd = amountMatch ? parseFloat(amountMatch[1]) : 0;
    if (amountUsd <= 0) continue;

    const bsMatch = m.match(/Bs\.?\s*([\d,.]+)/i);
    const amountBs = bsMatch ? parseFloat(bsMatch[1].replace(/,/g, '')) : undefined;

    const isPagoMovil = /pago\s*m[oó]vil|mobile_transfer|ref:/i.test(m);
    const method: 'cash' | 'mobile_transfer' = isPagoMovil ? 'mobile_transfer' : 'cash';

    const refMatch = m.match(/Ref:\s*([A-Za-z0-9\-]+)/i);
    const reference = refMatch ? refMatch[1].trim() : undefined;

    const bankMatch = m.match(/Banco:\s*([^|\]]+)/i);
    const originBank = bankMatch ? bankMatch[1].trim() : undefined;

    const reasonMatch = m.match(/Motivo:\s*([^|\]]+)/i);
    const rejectionReason = reasonMatch ? reasonMatch[1].trim() : undefined;

    const isRejected = /rechazado/i.test(m);
    const isVerified = /verificado|confirmado/i.test(m);
    let status: 'pending' | 'verified' | 'rejected' | 'cash_on_delivery' = 'cash_on_delivery';
    if (method === 'mobile_transfer') {
      status = isRejected ? 'rejected' : (isVerified ? 'verified' : 'pending');
    }

    results.push({
      index: results.length,
      raw: m,
      amountUsd,
      amountBs,
      method,
      reference,
      originBank,
      status,
      description,
      rejectionReason
    });
  }
  return results;
}

export function updateAdditionTagInNotes(
  notes: string,
  targetRaw: string,
  params: {
    status: 'verified' | 'rejected' | 'pending';
    reference?: string;
    originBank?: string;
    verifiedBy?: string;
    rejectionReason?: string;
  }
): string {
  if (!notes || !targetRaw || !notes.includes(targetRaw)) return notes;

  let updatedTag = targetRaw.replace(/\s*\|\s*Motivo:\s*[^|\]]+/i, '');

  if (params.reference && params.reference.trim().length > 0) {
    const cleanRef = params.reference.trim();
    if (/Ref:\s*[^|\]]+/i.test(updatedTag)) {
      updatedTag = updatedTag.replace(/Ref:\s*[^|\]]+/i, `Ref: ${cleanRef}`);
    } else {
      updatedTag = updatedTag.replace(/\]$/, ` | Ref: ${cleanRef}]`);
    }
  }

  if (params.originBank && params.originBank.trim().length > 0) {
    const cleanBank = params.originBank.trim();
    if (/Banco:\s*[^|\]]+/i.test(updatedTag)) {
      updatedTag = updatedTag.replace(/Banco:\s*[^|\]]+/i, `Banco: ${cleanBank}`);
    } else if (/Ref:/i.test(updatedTag)) {
      updatedTag = updatedTag.replace(/(\|\s*Ref:)/i, `| Banco: ${cleanBank} $1`);
    } else {
      updatedTag = updatedTag.replace(/\]$/, ` | Banco: ${cleanBank}]`);
    }
  }

  const statusLabel =
    params.status === 'verified'
      ? `Verificado${params.verifiedBy ? ` por ${params.verifiedBy.trim()}` : ''}`
      : params.status === 'rejected'
        ? 'Rechazado'
        : 'Pendiente de Verificación';

  if (/Estado:\s*[^|\]]+/i.test(updatedTag)) {
    updatedTag = updatedTag.replace(/Estado:\s*[^|\]]+/i, `Estado: ${statusLabel}`);
  } else {
    updatedTag = updatedTag.replace(/\]$/, ` | Estado: ${statusLabel}]`);
  }

  if (params.status === 'rejected' && params.rejectionReason) {
    const cleanReason = params.rejectionReason
      .replace(/[\[\]|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);
    if (cleanReason) {
      updatedTag = updatedTag.replace(/\]$/, ` | Motivo: ${cleanReason}]`);
    }
  }

  return notes.replace(targetRaw, updatedTag);
}

export interface OrderSourceMeta {
  label: string;       // 'App Móvil' | 'App Web' | 'Manual'
  shortLabel: string;  // 'App Móvil' | 'Web' | 'Manual'
  icon: 'smartphone' | 'globe' | 'store';
  badgeClass: string;
  title: string;
  isMobileApp: boolean;
}

export function getOrderSourceMeta(source?: string | null): OrderSourceMeta {
  const normalized = String(source || '').trim().toLowerCase();
  if (normalized === 'mobile_app' || normalized === 'mobile_app_flutter' || normalized === 'app_movil') {
    return {
      label: 'App Móvil',
      shortLabel: 'App Móvil',
      icon: 'smartphone',
      badgeClass: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
      title: 'Pedido realizado desde la App Móvil',
      isMobileApp: true,
    };
  }
  if (normalized === 'merchant_manual') {
    return {
      label: 'Manual',
      shortLabel: 'Manual',
      icon: 'store',
      badgeClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
      title: 'Pedido registrado manualmente desde el panel',
      isMobileApp: false,
    };
  }
  return {
    label: 'App Web',
    shortLabel: 'Web',
    icon: 'globe',
    badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
    title: normalized === 'whatsapp_link'
      ? 'Pedido realizado desde la Web / Enlace'
      : 'Pedido realizado desde la App Web',
    isMobileApp: false,
  };
}

export function formatOrderDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    const parts = new Intl.DateTimeFormat('es-VE', {
      timeZone: 'America/Caracas',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '';
    const day = get('day');
    const month = get('month');
    const year = get('year');
    const hour = get('hour');
    const minute = get('minute');
    const period = get('dayPeriod').replace(/\./g, '').replace(/\s+/g, '').toLowerCase();
    const ampm = period.includes('p') ? 'pm' : 'am';
    return `${day}/${month}/${year} · ${hour}:${minute} ${ampm}`;
  } catch {
    return date.toLocaleString('es-VE');
  }
}

