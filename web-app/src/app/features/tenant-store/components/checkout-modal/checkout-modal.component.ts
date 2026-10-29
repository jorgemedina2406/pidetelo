import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CartStore } from '../../stores/cart.store';
import { ApiService } from '../../../../core/services/api.service';
import { PaymentMethod } from '../../../../core/models/order.model';

@Component({
  selector: 'app-checkout-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './checkout-modal.component.html'
})
export class CheckoutModalComponent {
  readonly cart = inject(CartStore);
  private readonly api = inject(ApiService);
  readonly isSubmitting = signal(false);
  readonly isDetectingGps = signal(false);
  readonly gpsStatusMessage = signal<string | null>(null);

  readonly paymentMethods: { id: PaymentMethod; label: string; icon: string; desc: string }[] = [
    { id: 'cash_usd', label: 'Efectivo $', icon: '💵', desc: 'Pago exacto o con cambio' },
    { id: 'mobile_transfer', label: 'Pago Móvil', icon: '📲', desc: 'Transferencia bancaria rápida' },
    { id: 'card_terminal', label: 'Punto de Venta', icon: '💳', desc: 'Tarjeta al recibir' },
    { id: 'cash_local', label: 'Efectivo Bs', icon: '🪙', desc: 'A tasa del día' }
  ];

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
        customer_name: order.customer.name,
        customer_phone: order.customer.phone,
        delivery_address: order.customer.deliveryAddress || '',
        delivery_lat: order.customer.deliveryLat || null,
        delivery_lng: order.customer.deliveryLng || null,
        subtotal: order.subtotal,
        delivery_fee: order.deliveryFee,
        discount: order.discount,
        total: order.total,
        notes: order.customer.notes || '',
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
          this.isSubmitting.set(false);
        },
        error: err => {
          console.warn('[CheckoutModal] Error al guardar en backend:', err);
          this.isSubmitting.set(false);
        },
      });

      // Abrir pedido formateado para WhatsApp
      const url = this.cart.generateWhatsAppOrderUrl(order);
      window.open(url, '_blank');
    }
  }
}

