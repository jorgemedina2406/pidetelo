import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CartStore } from '../../stores/cart.store';
import { CustomerAddressModalComponent, LocationSelectedEvent } from '../customer-address-modal/customer-address-modal.component';

@Component({
  selector: 'app-cart-drawer',
  standalone: true,
  imports: [CommonModule, CustomerAddressModalComponent],
  templateUrl: './cart-drawer.component.html'
})
export class CartDrawerComponent {
  readonly cart = inject(CartStore);
  readonly isDetectingGps = signal(false);
  readonly gpsMessage = signal<string | null>(null);
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
  }

  storeLat(): number | undefined {
    const branch = this.cart.selectedBranch();
    return branch?.latitude || (this.cart.activeTenant() as any)?.latitude;
  }

  storeLng(): number | undefined {
    const branch = this.cart.selectedBranch();
    return branch?.longitude || (this.cart.activeTenant() as any)?.longitude;
  }

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
            localStorage.setItem('pidetelo_customer_zone', JSON.stringify({
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
