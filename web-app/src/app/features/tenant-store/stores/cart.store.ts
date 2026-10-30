import { computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { CartItem, CustomerInfo, FulfillmentType, Order, PaymentMethod, SelectedModifier } from '../../../core/models/order.model';
import { Product } from '../../../core/models/product.model';
import { Tenant, DeliveryTier } from '../../../core/models/tenant.model';
import { Branch } from '../../../core/models/branch.model';

export function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p = 0.017453292519943295; // Math.PI / 180
  const c = Math.cos;
  const a = 0.5 - c((lat2 - lat1) * p) / 2 +
            c(lat1 * p) * c(lat2 * p) *
            (1 - c((lon2 - lon1) * p)) / 2;
  return 12742 * Math.asin(Math.sqrt(Math.max(0, a)));
}

export interface CartState {
  items: CartItem[];
  fulfillmentType: FulfillmentType;
  paymentMethod: PaymentMethod;
  customer: CustomerInfo;
  activeTenant: Tenant | null;
  selectedBranch: Branch | null;
  isCartDrawerOpen: boolean;
  isCheckoutModalOpen: boolean;
  isSuccessModalOpen: boolean;
  completedOrder: Order | null;
  realRoadDistanceKm: number | null;
}

const initialState: CartState = {
  items: [],
  fulfillmentType: 'delivery',
  paymentMethod: 'cash_usd',
  customer: {
    name: '',
    phone: '',
    deliveryAddress: '',
    addressReference: '',
    notes: ''
  },
  activeTenant: null,
  selectedBranch: null,
  isCartDrawerOpen: false,
  isCheckoutModalOpen: false,
  isSuccessModalOpen: false,
  completedOrder: null,
  realRoadDistanceKm: null
};

export const CartStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => {
    const totalItemsCount = computed(() => {
      return store.items().reduce((acc, item) => acc + item.quantity, 0);
    });

    const subtotal = computed(() => {
      return Number(store.items().reduce((acc, item) => acc + item.itemTotal, 0).toFixed(2));
    });

    const storeCoordinates = computed(() => {
      const branch = store.selectedBranch();
      if (branch && branch.latitude && branch.longitude && !isNaN(Number(branch.latitude))) {
        return { lat: Number(branch.latitude), lng: Number(branch.longitude) };
      }
      const tenant = store.activeTenant();
      const tLat = Number((tenant as any)?.latitude ?? tenant?.contact?.coordinates?.lat);
      const tLng = Number((tenant as any)?.longitude ?? tenant?.contact?.coordinates?.lng);
      if (!isNaN(tLat) && !isNaN(tLng) && tLat !== 0 && tLng !== 0) {
        return { lat: tLat, lng: tLng };
      }
      return null;
    });

    const customerCoordinates = computed(() => {
      const c = store.customer();
      if (c.deliveryLat && c.deliveryLng && !isNaN(Number(c.deliveryLat)) && !isNaN(Number(c.deliveryLng))) {
        return { lat: Number(c.deliveryLat), lng: Number(c.deliveryLng) };
      }
      return null;
    });

    const customerDistanceKm = computed<number | null>(() => {
      const s = storeCoordinates();
      const c = customerCoordinates();
      if (!s || !c) return null;
      if (store.realRoadDistanceKm() !== null) {
        return store.realRoadDistanceKm();
      }
      // Distancia vial real por carretera/calle (Google Maps / factor de sinuosidad vial 1.28x sobre Haversine)
      const straight = calculateHaversineDistanceKm(s.lat, s.lng, c.lat, c.lng);
      return Number((straight * 1.28).toFixed(1));
    });

    const isLocationRequired = computed<boolean>(() => {
      return store.fulfillmentType() === 'delivery' && !customerCoordinates();
    });

    const deliveryTiers = computed<DeliveryTier[]>(() => {
      const branchTiers = store.selectedBranch()?.deliveryTiers;
      const tenantTiers = store.activeTenant()?.deliverySettings?.deliveryTiers || (store.activeTenant() as any)?.delivery_tiers;
      
      const bLen = Array.isArray(branchTiers) ? branchTiers.length : 0;
      const tLen = Array.isArray(tenantTiers) ? tenantTiers.length : 0;

      if (bLen > 0 && bLen >= tLen) {
        return branchTiers!;
      }
      if (tLen > 0) {
        return tenantTiers!;
      }
      if (bLen > 0) {
        return branchTiers!;
      }
      return [
        { id: 'tier_1', minKm: 0, maxKm: 2, price: 1.50 },
        { id: 'tier_2', minKm: 2, maxKm: 5, price: 3.00 },
        { id: 'tier_3', minKm: 5, maxKm: 8, price: 4.50 }
      ];
    });

    const maxCoverageRadiusKm = computed<number>(() => {
      const tenantRadius = Number(store.activeTenant()?.deliverySettings?.deliveryRadiusKm);
      const branchRadius = Number(store.selectedBranch()?.deliveryRadiusKm);
      const tiers = deliveryTiers();
      const maxTierKm = tiers.length > 0 ? Math.max(...tiers.map(t => Number(t.maxKm) || 0)) : 0;

      const computedMax = Math.max(tenantRadius || 0, branchRadius || 0, maxTierKm);
      return computedMax > 0 ? computedMax : 8.0;
    });

    const isOutOfCoverage = computed<boolean>(() => {
      if (store.fulfillmentType() !== 'delivery') return false;
      const dist = customerDistanceKm();
      if (dist === null) return false;
      return dist > maxCoverageRadiusKm();
    });

    const appliedDeliveryTier = computed<DeliveryTier | null>(() => {
      const dist = customerDistanceKm();
      if (dist === null) return null;
      const tiers = deliveryTiers();
      const match = tiers.find(t => dist >= t.minKm && dist <= t.maxKm);
      if (match) return match;
      if (tiers.length > 0) {
        const maxTier = tiers.reduce((prev, curr) => (curr.maxKm > prev.maxKm ? curr : prev), tiers[0]);
        if (dist > maxTier.maxKm) return maxTier;
      }
      return null;
    });

    const deliveryFee = computed<number>(() => {
      const tenant = store.activeTenant();
      if (!tenant || store.fulfillmentType() === 'pickup') {
        return 0;
      }
      const settings = tenant.deliverySettings;
      if (settings?.freeDeliveryThreshold && subtotal() >= settings.freeDeliveryThreshold) {
        return 0;
      }
      if (isOutOfCoverage()) {
        return 0;
      }
      if (isLocationRequired()) {
        return 0; // La tarifa exacta se determinará al fijar el GPS
      }
      const tier = appliedDeliveryTier();
      if (tier) {
        return Number(tier.price.toFixed(2));
      }
      return settings?.baseDeliveryFee ?? 2.50;
    });

    const total = computed(() => {
      return Number((subtotal() + deliveryFee()).toFixed(2));
    });

    const meetsMinOrder = computed(() => {
      const minAmount = store.activeTenant()?.deliverySettings?.minOrderAmount ?? 0;
      return subtotal() >= minAmount;
    });

    const isCustomerValid = computed(() => {
      const c = store.customer();
      const hasBasic = c.name.trim().length >= 2 && c.phone.trim().length >= 7;
      if (store.fulfillmentType() === 'delivery') {
        return (
          hasBasic &&
          (c.deliveryAddress?.trim().length ?? 0) >= 5 &&
          Boolean(c.deliveryLat && c.deliveryLng) &&
          !isOutOfCoverage()
        );
      }
      return hasBasic;
    });

    const exchangeRate = computed(() => {
      return store.activeTenant()?.currencySettings?.exchangeRate || 45.5;
    });

    const subtotalVes = computed(() => {
      return Number((subtotal() * exchangeRate()).toFixed(2));
    });

    const deliveryFeeVes = computed(() => {
      return Number((deliveryFee() * exchangeRate()).toFixed(2));
    });

    const totalVes = computed(() => {
      return Number((total() * exchangeRate()).toFixed(2));
    });

    return {
      totalItemsCount,
      subtotal,
      storeCoordinates,
      customerCoordinates,
      customerDistanceKm,
      maxCoverageRadiusKm,
      isOutOfCoverage,
      isLocationRequired,
      deliveryTiers,
      appliedDeliveryTier,
      deliveryFee,
      total,
      meetsMinOrder,
      isCustomerValid,
      exchangeRate,
      subtotalVes,
      deliveryFeeVes,
      totalVes
    };
  }),
  withMethods((store) => ({
    setTenant(tenant: Tenant): void {
      let cust = store.customer();
      if ((!cust.deliveryLat || !cust.deliveryLng) && typeof window !== 'undefined') {
        try {
          const savedZone = localStorage.getItem('deliveryhub_customer_zone');
          if (savedZone) {
            const z = JSON.parse(savedZone);
            if (z.lat && z.lng) {
              cust = {
                ...cust,
                deliveryLat: Number(z.lat),
                deliveryLng: Number(z.lng),
                deliveryAddress: cust.deliveryAddress || z.name || ''
              };
            }
          }
        } catch (_) {}
      }
      patchState(store, { activeTenant: tenant, customer: cust });
    },

    addItem(product: Product, quantity: number, selectedModifiers: SelectedModifier[], notes?: string): void {
      // Calculate unit modifier delta
      const modifiersSum = selectedModifiers.reduce((acc, mod) => acc + mod.priceDelta, 0);
      const singleUnitPrice = product.price + modifiersSum;
      const itemTotal = Number((singleUnitPrice * quantity).toFixed(2));

      // Generate unique hash key for item combination
      const sortedModIds = [...selectedModifiers].map(m => m.optionId).sort().join('-');
      const cartItemId = `${product.id}_${sortedModIds}_${notes || ''}`;

      const existingIndex = store.items().findIndex(item => item.cartItemId === cartItemId);

      if (existingIndex > -1) {
        const currentItems = [...store.items()];
        const current = currentItems[existingIndex];
        const newQty = current.quantity + quantity;
        currentItems[existingIndex] = {
          ...current,
          quantity: newQty,
          itemTotal: Number((singleUnitPrice * newQty).toFixed(2))
        };
        patchState(store, { items: currentItems, isCartDrawerOpen: true });
      } else {
        const newItem: CartItem = {
          cartItemId,
          productId: product.id,
          name: product.name,
          unitPrice: product.price,
          quantity,
          selectedModifiers,
          itemTotal,
          notes,
          imageUrl: product.imageUrl
        };
        patchState(store, { items: [...store.items(), newItem], isCartDrawerOpen: true });
      }
    },

    updateQuantity(cartItemId: string, delta: number): void {
      const currentItems = [...store.items()];
      const index = currentItems.findIndex(item => item.cartItemId === cartItemId);
      if (index === -1) return;

      const current = currentItems[index];
      const newQty = current.quantity + delta;

      if (newQty <= 0) {
        currentItems.splice(index, 1);
      } else {
        const singlePrice = current.itemTotal / current.quantity;
        currentItems[index] = {
          ...current,
          quantity: newQty,
          itemTotal: Number((singlePrice * newQty).toFixed(2))
        };
      }
      patchState(store, { items: currentItems });
    },

    removeItem(cartItemId: string): void {
      patchState(store, {
        items: store.items().filter(item => item.cartItemId !== cartItemId)
      });
    },

    clearCart(): void {
      patchState(store, { items: [] });
    },

    setBranch(selectedBranch: Branch | null): void {
      patchState(store, { selectedBranch });
    },

    setFulfillmentType(fulfillmentType: FulfillmentType): void {
      patchState(store, { fulfillmentType });
    },

    setPaymentMethod(paymentMethod: PaymentMethod): void {
      patchState(store, { paymentMethod });
    },

    updateCustomer(customerData: Partial<CustomerInfo>): void {
      patchState(store, {
        customer: { ...store.customer(), ...customerData }
      });

      if (customerData.deliveryLat && customerData.deliveryLng) {
        const branch = store.selectedBranch();
        const tenant = store.activeTenant();
        const sLat = branch?.latitude || Number((tenant as any)?.latitude ?? tenant?.contact?.coordinates?.lat);
        const sLng = branch?.longitude || Number((tenant as any)?.longitude ?? tenant?.contact?.coordinates?.lng);
        if (sLat && sLng && typeof window !== 'undefined') {
          const url = `https://router.project-osrm.org/route/v1/driving/${sLng},${sLat};${customerData.deliveryLng},${customerData.deliveryLat}?overview=false`;
          fetch(url)
            .then(res => res.json())
            .then(data => {
              if (data && data.routes && data.routes.length > 0 && data.routes[0].distance) {
                const roadKm = Number((data.routes[0].distance / 1000).toFixed(1));
                patchState(store, { realRoadDistanceKm: roadKm });
              }
            })
            .catch(() => {});
        }
      }
    },

    openCart(): void {
      patchState(store, { isCartDrawerOpen: true });
    },

    closeCart(): void {
      patchState(store, { isCartDrawerOpen: false });
    },

    openCheckout(): void {
      patchState(store, { isCartDrawerOpen: false, isCheckoutModalOpen: true });
    },

    closeCheckout(): void {
      patchState(store, { isCheckoutModalOpen: false });
    },

    closeSuccessModal(): void {
      patchState(store, { isSuccessModalOpen: false });
    },

    submitOrder(): Order {
      const tenant = store.activeTenant();
      const branch = store.selectedBranch();
      const orderNumber = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

      const order: Order = {
        id: `ord_${Date.now()}`,
        orderNumber,
        tenantId: (tenant?.id && tenant.id !== 'tenant-1') ? tenant.id : (branch?.companyId || 'dac59429-fd6f-4d3e-8b2e-ab0e23828c1f'),
        tenantName: tenant?.name || branch?.companyName || 'Comercio',
        branchId: branch?.id,
        branchName: branch?.name,
        source: 'whatsapp_link',
        status: 'received',
        fulfillmentType: store.fulfillmentType(),
        paymentMethod: store.paymentMethod(),
        customer: { ...store.customer() },
        deliveryLat: store.customer().deliveryLat,
        deliveryLng: store.customer().deliveryLng,
        items: [...store.items()],
        subtotal: store.subtotal(),
        deliveryFee: store.deliveryFee(),
        discount: 0,
        total: store.total(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      patchState(store, {
        completedOrder: order,
        items: [],
        isCheckoutModalOpen: false,
        isSuccessModalOpen: true
      });

      return order;
    },

    generateWhatsAppOrderUrl(order: Order, whatsappNumber?: string): string {
      const branch = store.selectedBranch();
      const branchPhone = branch?.whatsapp || branch?.phone;
      const targetPhone = whatsappNumber || branchPhone || store.activeTenant()?.contact.whatsappNumber || '';
      const number = targetPhone.replace(/\D/g, '');
      const itemsList = order.items.map(item => {
        const validMods = (item.selectedModifiers || [])
          .map((m: any) => m.optionName || m.option_name || m.name || '')
          .filter(Boolean);
        const mods = validMods.length > 0 
          ? ` (${validMods.join(', ')})` 
          : '';
        return `• ${item.quantity}x *${item.name}*${mods} -> $${item.itemTotal.toFixed(2)}`;
      }).join('\n');

      const fulfillmentText = order.fulfillmentType === 'delivery' 
        ? `🛵 *Delivery a domicilio*\n📍 *Dirección:* ${order.customer.deliveryAddress || 'N/A'}\n🔍 *Ref:* ${order.customer.addressReference || 'N/A'}`
        : `🛍️ *Retiro en tienda (Pick-up)*`;

      const paymentNames: Record<PaymentMethod, string> = {
        cash_usd: 'Efectivo Divisas ($)',
        cash_local: 'Efectivo Moneda Local',
        mobile_transfer: 'Pago Móvil / Transferencia',
        card_terminal: 'Punto de Venta al recibir',
        online: 'Pago Online'
      };

      const rate = store.selectedBranch()?.currencySettings?.exchangeRate ||
                   store.selectedBranch()?.exchangeRate ||
                   store.activeTenant()?.currencySettings?.exchangeRate || 45.5;
      const totalBs = (order.total * rate).toFixed(2);
      const subtotalBs = (order.subtotal * rate).toFixed(2);
      const deliveryBs = (order.deliveryFee * rate).toFixed(2);

      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4200';
      const cleanOrderNum = order.orderNumber.replace('#', '');
      const trackingUrl = `${origin}/track/${cleanOrderNum}`;
      const branchHeader = order.branchName ? `🏪 *Sucursal / Sede:* ${order.branchName}\n` : '';

      const message = `👋 ¡Hola *${order.tenantName}*! Acabo de hacer un pedido web:\n\n` +
        `🧾 *Pedido #${cleanOrderNum}*\n` +
        branchHeader +
        `👤 *Cliente:* ${order.customer.name}\n` +
        `📱 *Teléfono:* ${order.customer.phone}\n\n` +
        `🍽️ *Detalle del pedido:*\n${itemsList}\n\n` +
        `💵 *Subtotal:* $${order.subtotal.toFixed(2)} (Bs. ${subtotalBs})\n` +
        `🛵 *Delivery:* $${order.deliveryFee.toFixed(2)} (Bs. ${deliveryBs})\n` +
        `💰 *TOTAL A PAGAR:* *$${order.total.toFixed(2)}* (≈ *Bs. ${totalBs}*)\n` +
        `🪙 *Tasa aplicada:* ${rate.toFixed(2)} Bs/$\n\n` +
        `${fulfillmentText}\n` +
        `💳 *Método de pago:* ${paymentNames[order.paymentMethod as PaymentMethod] || order.paymentMethod}\n\n` +
        (order.customer.notes ? `📝 *Nota:* ${order.customer.notes}\n\n` : '') +
        `📍 *Rastreo en vivo del pedido (GPS):*\n${trackingUrl}\n\n` +
        `¿Podrían confirmarme el pedido y el tiempo estimado? ¡Muchas gracias!`;

      return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
    }
  }))
);
