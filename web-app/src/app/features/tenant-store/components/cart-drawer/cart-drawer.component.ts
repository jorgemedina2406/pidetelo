import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CartStore } from '../../stores/cart.store';

@Component({
  selector: 'app-cart-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cart-drawer.component.html'
})
export class CartDrawerComponent {
  readonly cart = inject(CartStore);
  readonly isDetectingGps = signal(false);
  readonly gpsMessage = signal<string | null>(null);

  captureGpsLocation(): void {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      this.isDetectingGps.set(true);
      this.gpsMessage.set('Obteniendo satélites...');

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          this.cart.updateCustomer({ deliveryLat: lat, deliveryLng: lng });
          this.isDetectingGps.set(false);
          this.gpsMessage.set(null);

          try {
            localStorage.setItem('deliveryhub_customer_zone', JSON.stringify({
              id: 'gps-custom',
              name: 'Mi Ubicación GPS',
              lat,
              lng,
              isGps: true
            }));
          } catch (_) {}
        },
        (err) => {
          this.isDetectingGps.set(false);
          this.gpsMessage.set('No se pudo obtener el GPS.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      alert('Tu navegador no soporta geolocalización.');
    }
  }
}
