import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CartStore } from '../../stores/cart.store';
import { ApiService } from '../../../../core/services/api.service';
import { PaymentMethod } from '../../../../core/models/order.model';
import { Coupon } from '../../../../core/models/coupon.model';
import { CustomerAddressModalComponent, LocationSelectedEvent } from '../customer-address-modal/customer-address-modal.component';

@Component({
  selector: 'app-checkout-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomerAddressModalComponent],
  templateUrl: './checkout-modal.component.html'
})
export class CheckoutModalComponent {
  readonly cart = inject(CartStore);
  private readonly api = inject(ApiService);
  readonly isSubmitting = signal(false);
  readonly isDetectingGps = signal(false);
  readonly gpsStatusMessage = signal<string | null>(null);
  readonly pagoMovilRefError = signal<string | null>(null);
  readonly isConfirmPromptOpen = signal(false);
  readonly isAddressModalOpen = signal(false);

  openAddressModal(): void {
    this.isAddressModalOpen.set(true);
  }

  closeAddressModal(): void {
    this.isAddressModalOpen.set(false);
  }

  onLocationSelected(loc: LocationSelectedEvent): void {
    this.cart.updateCustomer({
      deliveryAddress: loc.address,
      deliveryLat: loc.lat,
      deliveryLng: loc.lng,
      addressReference: loc.reference || this.cart.customer().addressReference
    });
    this.gpsStatusMessage.set(`Ubicación fijada en el mapa (${loc.lat}, ${loc.lng})`);
  }

  storeLat(): number | undefined {
    const branch = this.cart.selectedBranch();
    return branch?.latitude || (this.cart.activeTenant() as any)?.latitude;
  }

  storeLng(): number | undefined {
    const branch = this.cart.selectedBranch();
    return branch?.longitude || (this.cart.activeTenant() as any)?.longitude;
  }

  promptConfirmOrder(): void {
    const cust = this.cart.customer();
    if (!cust.name || cust.name.trim().length < 2) {
      alert('Por favor ingresa tu nombre completo.');
      return;
    }
    if (!cust.phone || cust.phone.trim().length < 7) {
      alert('Por favor ingresa un número de teléfono / WhatsApp válido.');
      return;
    }
    if (this.cart.fulfillmentType() === 'delivery') {
      if (!cust.deliveryLat || !cust.deliveryLng) {
        this.gpsStatusMessage.set('⚠️ Por favor indica o ajusta tu ubicación de entrega en el mapa.');
        this.openAddressModal();
        return;
      }
      if (!cust.deliveryAddress || cust.deliveryAddress.trim().length < 5) {
        alert('Por favor escribe tu dirección exacta (calle, edificio o casa).');
        return;
      }
      if (this.cart.isOutOfCoverage()) {
        alert(`Tu dirección está a ${this.cart.customerDistanceKm()} km del local, superando el radio máximo de entrega (${this.cart.maxCoverageRadiusKm()} km). Cambia a "Retiro en Tienda" o ingresa otra dirección.`);
        return;
      }
    }

    if (this.cart.paymentMethod() === 'mobile_transfer') {
      const ref = (this.cart.pagoMovilReference() || '').trim();
      if (ref.length < 4) {
        this.pagoMovilRefError.set('Debes ingresar el número de referencia del Pago Móvil (mínimo 4 dígitos) para continuar.');
        return;
      }
    }
    this.pagoMovilRefError.set(null);

    if (this.cart.isCustomerValid() && !this.isSubmitting()) {
      this.isConfirmPromptOpen.set(true);
    }
  }

  cancelConfirmOrder(): void {
    this.isConfirmPromptOpen.set(false);
  }

  getPaymentLabel(method: string): string {
    const found = this.paymentMethods.find(m => m.id === method);
    return found ? `${found.icon} ${found.label}` : method;
  }

  readonly paymentMethods: { id: PaymentMethod; label: string; icon: string; desc: string }[] = [
    { id: 'cash_usd', label: 'Efectivo $', icon: '💵', desc: 'Pago exacto o con cambio' },
    { id: 'mobile_transfer', label: 'Pago Móvil', icon: '📲', desc: 'Transferencia bancaria rápida' },
    { id: 'zelle' as PaymentMethod, label: 'Zelle Directo', icon: '⚡', desc: 'Transferencia Zelle' },
    { id: 'card_terminal', label: 'Punto de Venta', icon: '💳', desc: 'Tarjeta al recibir' },
    { id: 'cash_local', label: 'Efectivo Bs', icon: '🪙', desc: 'A tasa del día' }
  ];

  isRealPagoMovil(cred?: any): boolean {
    if (!cred) return false;
    const phone = String(cred.pagoMovilPhone || cred.pago_movil_phone || '').replace(/\D/g, '');
    const bank = String(cred.pagoMovilBank || cred.pago_movil_bank || '').trim();
    const idNum = String(cred.pagoMovilIdNumber || cred.pago_movil_id_number || '').replace(/\D/g, '');
    if (phone.length < 10 || bank.length < 2 || idNum.length < 5) return false;
    if (phone.includes('1234567') || phone === '04140000000' || phone === '04121234567') return false;
    if (idNum.includes('50123456') || idNum.includes('12345678') || idNum === '00000000') return false;
    return true;
  }

  readonly availablePaymentMethods = computed(() => {
    const branch = this.cart.selectedBranch();
    const tenant = this.cart.activeTenant();
    const rawAccepted: any = (branch as any)?.acceptedPaymentMethods || 
                             (branch as any)?.accepted_payment_methods || 
                             (branch as any)?.currencySettings?.acceptedPaymentMethods ||
                             (branch as any)?.currency_settings?.acceptedPaymentMethods ||
                             (tenant as any)?.acceptedPaymentMethods || 
                             (tenant as any)?.accepted_payment_methods || 
                             (tenant as any)?.currencySettings?.acceptedPaymentMethods ||
                             (tenant as any)?.currency_settings?.acceptedPaymentMethods;
    
    let normalizedAccepted: string[] = [];
    if (Array.isArray(rawAccepted)) {
      normalizedAccepted = rawAccepted.map((m: string) => {
        const s = String(m).toLowerCase().trim();
        if (s === 'pago_movil') return 'mobile_transfer';
        if (s === 'efectivo') return 'cash_usd';
        if (s === 'tarjeta') return 'card_terminal';
        return s;
      });
    }

    if (normalizedAccepted.length === 0) {
      return [];
    }

    const creds = branch?.paymentCredentials || (branch as any)?.payment_credentials || {};
    const isPmValid = this.isRealPagoMovil(creds);
    const zEmail = String(creds.zelleEmail || (branch as any)?.zelleEmail || '').trim();
    const isZelleValid = zEmail.includes('@') && zEmail.length >= 5;

    return this.paymentMethods.filter(pm => {
      if (!normalizedAccepted.includes(pm.id)) return false;
      if (pm.id === 'mobile_transfer') return isPmValid;
      if (pm.id === 'zelle') return isZelleValid;
      return true;
    });
  });

  constructor() {
    effect(() => {
      const available = this.availablePaymentMethods();
      const current = this.cart.paymentMethod();
      if (available.length > 0 && !available.some(m => m.id === current)) {
        this.cart.setPaymentMethod(available[0].id);
      }
    });
  }

  applyCoupon(): void {
    const code = this.cart.couponCodeInput()?.trim().toUpperCase();
    if (!code) return;
    const tenantId = this.cart.activeTenant()?.id || this.cart.selectedBranch()?.companyId;
    if (!tenantId) return;

    this.cart.setIsApplyingCoupon(true);
    this.api.validateCoupon(tenantId, code, this.cart.subtotal()).subscribe({
      next: (res) => {
        if (res.isValid && res.coupon) {
          const applied: Coupon = {
            id: res.coupon.id,
            tenantId,
            code: res.coupon.code,
            discountType: res.coupon.discountType,
            discountValue: res.coupon.discountValue,
            minOrderAmount: 0,
            timesUsed: 0,
            isActive: true
          };
          this.cart.setAppliedCoupon(applied);
        } else {
          this.cart.setCouponErrorMessage(res.message || 'Cupón inválido o no aplicable.');
        }
      },
      error: () => {
        this.cart.setCouponErrorMessage('Error al verificar el cupón. Intenta nuevamente.');
      }
    });
  }

  captureGpsLocation(): void {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      this.isDetectingGps.set(true);
      this.gpsStatusMessage.set('Obteniendo satélites GPS...');
      
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          this.cart.updateCustomer({
            deliveryLat: lat,
            deliveryLng: lng
          });
          this.isDetectingGps.set(false);
          this.gpsStatusMessage.set(`Ubicación GPS fijada (${lat}, ${lng})`);

          try {
            localStorage.setItem('pidetelo_customer_zone', JSON.stringify({
              id: 'gps-custom',
              name: 'Mi Ubicación GPS',
              lat,
              lng,
              isGps: true
            }));
          } catch (_) {}

          // Geocodificación inversa con OpenStreetMap Nominatim
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
            .then(res => res.json())
            .then(data => {
              if (data && data.display_name && !this.cart.customer().deliveryAddress) {
                this.cart.updateCustomer({ deliveryAddress: data.display_name.split(',').slice(0, 3).join(',') });
              }
            })
            .catch(() => {});
        },
        (err) => {
          this.isDetectingGps.set(false);
          this.gpsStatusMessage.set('No se pudo acceder al GPS. Por favor escribe tu dirección manualmente.');
        },
        { enableHighAccuracy: true, timeout: 12000 }
      );
    } else {
      alert('Tu navegador no soporta geolocalización GPS.');
    }
  }

  submitOrder(): void {
    this.isConfirmPromptOpen.set(false);
    if (this.cart.isCustomerValid() && !this.isSubmitting()) {
      this.isSubmitting.set(true);
      const order = this.cart.submitOrder();

      const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
      const branchCompanyId = this.cart.selectedBranch()?.companyId;
      const activeTenantId = this.cart.activeTenant()?.id;
      const resolvedTenantId = isUuid(order.tenantId) 
        ? order.tenantId 
        : (isUuid(activeTenantId) ? activeTenantId! : (isUuid(branchCompanyId) ? branchCompanyId! : 'dac59429-fd6f-4d3e-8b2e-ab0e23828c1f'));

      // Guardar el pedido en el Backend / Supabase
      this.api.createOrder({
        tenant_id: resolvedTenantId,
        branch_id: order.branchId || null,
        order_number: order.orderNumber,
        source: 'whatsapp_link',
        status: 'received',
        fulfillment_type: order.fulfillmentType,
        payment_method: order.paymentMethod,
        payment_status: order.paymentStatus || (order.paymentMethod === 'mobile_transfer' ? 'pending' : 'not_required'),
        payment_reference: order.paymentReference || null,
        payment_origin_bank: order.paymentOriginBank || null,
        payment_amount_bs: order.paymentAmountBs || null,
        customer_name: order.customer.name,
        customer_phone: order.customer.phone,
        delivery_address: order.customer.deliveryAddress || '',
        delivery_lat: order.customer.deliveryLat || null,
        delivery_lng: order.customer.deliveryLng || null,
        subtotal: order.subtotal,
        delivery_fee: order.deliveryFee,
        discount: order.discount,
        total: order.total,
        exchange_rate: order.exchangeRate,
        currency: order.currency || 'USD',
        subtotal_bs: order.subtotalBs,
        delivery_fee_bs: order.deliveryFeeBs,
        discount_bs: order.discountBs,
        total_bs: order.totalBs,
        delivery_pin: order.deliveryPin,
        notes: [
          order.deliveryPin ? `[PIN:${order.deliveryPin}]` : '',
          order.paymentOriginBank ? `[PAGO_ORIGEN:${order.paymentOriginBank}]` : '',
          order.customer.notes || ''
        ].filter(Boolean).join(' '),
        items: order.items.map((i: any) => ({
          product_id: isUuid(i.productId) ? i.productId : null,
          product_name: i.name,
          unit_price: i.unitPrice,
          quantity: i.quantity,
          item_total: i.itemTotal,
          selected_modifiers: i.selectedModifiers,
        })),
      }).subscribe({
        next: saved => {
          console.log('[CheckoutModal] Pedido guardado en backend con éxito:', saved);
          const savedNotesPin = saved?.notes ? String(saved.notes).match(/\[PIN:(\d{4})\]/)?.[1] : undefined;
          const savedExplicitPin = saved?.delivery_pin ? String(saved.delivery_pin).trim() : undefined;
          const resolvedPin = savedExplicitPin && /^\d{4}$/.test(savedExplicitPin) ? savedExplicitPin : savedNotesPin;
          if (resolvedPin && /^\d{4}$/.test(resolvedPin)) {
            this.cart.syncCompletedOrderPin(resolvedPin);
          }
          if (typeof window !== 'undefined' && saved) {
            try {
              const savedOrdNum = String(saved.order_number || order.orderNumber);
              const cleanNum = savedOrdNum.replace(/^#/, '');
              const tName = order.tenantName || 'Comercio';
              const raw = localStorage.getItem('pidetelo_recent_web_orders');
              const list: any[] = raw ? JSON.parse(raw) : [];
              const filtered = list.filter(x => String(x?.cleanNumber || '') !== cleanNum);
              filtered.unshift({
                id: saved.id,
                orderNumber: savedOrdNum,
                cleanNumber: cleanNum,
                tenantSlug: this.cart.activeTenant()?.slug || '',
                tenantName: tName,
                branchName: order.branchName || '',
                total: Number(saved.total ?? order.total),
                createdAt: saved.created_at || new Date().toISOString(),
              });
              localStorage.setItem('pidetelo_recent_web_orders', JSON.stringify(filtered.slice(0, 8)));
              localStorage.setItem('pidetelo_active_order', JSON.stringify({
                id: cleanNum,
                dbId: saved.id,
                orderNumber: cleanNum,
                storeName: order.branchName || tName,
                status: saved.status || 'received',
              }));
            } catch (_) {}
          }
          this.isSubmitting.set(false);
        },
        error: err => {
          console.warn('[CheckoutModal] Error al guardar en backend:', err);
          this.api.purgeLocalCachedOrder(order.orderNumber);
          this.isSubmitting.set(false);
          alert(err?.error?.message || 'No se pudo registrar tu pedido en el servidor. Verifica los datos e intenta nuevamente.');
        },
      });
    }
  }
}

