import { computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { CartItem, CustomerInfo, FulfillmentType, Order, PaymentMethod, SelectedModifier } from '../../../core/models/order.model';
import { Product } from '../../../core/models/product.model';
import { Tenant } from '../../../core/models/tenant.model';
import { Branch } from '../../../core/models/branch.model';

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
  completedOrder: null
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

    const deliveryFee = computed(() => {
      const tenant = store.activeTenant();
      if (!tenant || store.fulfillmentType() === 'pickup') {
        return 0;
      }
      const settings = tenant.deliverySettings;
      if (settings.freeDeliveryThreshold && subtotal() >= settings.freeDeliveryThreshold) {
        return 0;
      }
      return settings.baseDeliveryFee;
    });

    const total = computed(() => {
      return Number((subtotal() + deliveryFee()).toFixed(2));
    });

    const meetsMinOrder = computed(() => {
      const minAmount = store.activeTenant()?.deliverySettings.minOrderAmount ?? 0;
      return subtotal() >= minAmount;
    });

    const isCustomerValid = computed(() => {
      const c = store.customer();
      const hasBasic = c.name.trim().length >= 2 && c.phone.trim().length >= 7;
      if (store.fulfillmentType() === 'delivery') {
        return hasBasic && (c.deliveryAddress?.trim().length ?? 0) >= 5;
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
      patchState(store, { activeTenant: tenant });
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

      const rate = store.activeTenant()?.currencySettings?.exchangeRate || 45.5;
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
