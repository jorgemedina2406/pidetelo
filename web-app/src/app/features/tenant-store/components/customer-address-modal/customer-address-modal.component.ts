import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';

export interface LocationSelectedEvent {
  address: string;
  lat: number;
  lng: number;
  reference?: string;
}

export interface GeocodingSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}

@Component({
  selector: 'app-customer-address-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-address-modal.component.html',
  styles: [`
    :host {
      display: contents;
    }
    .custom-delivery-pin {
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.35));
      cursor: grab;
    }
    .custom-delivery-pin:active {
      cursor: grabbing;
    }
  `]
})
export class CustomerAddressModalComponent implements OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() initialLat?: number;
  @Input() initialLng?: number;
  @Input() initialAddress?: string;
  @Input() initialReference?: string;
  @Input() storeLat?: number;
  @Input() storeLng?: number;

  @Output() close = new EventEmitter<void>();
  @Output() locationSelected = new EventEmitter<LocationSelectedEvent>();

  // Estados del formulario
  address = '';
  reference = '';
  selectedLat: number = 10.06777;
  selectedLng: number = -69.34735;

  // Estados de búsqueda y geocodificación
  searchQuery = '';
  readonly isSearching = signal(false);
  readonly searchSuggestions = signal<GeocodingSuggestion[]>([]);
  readonly isReverseGeocoding = signal(false);
  readonly isDetectingGps = signal(false);
  readonly statusNotice = signal<string | null>(null);

  private searchDebounceTimer?: any;
  private map?: L.Map;
  private marker?: L.Marker;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (this.isOpen) {
        this.initializeValues();
        setTimeout(() => this.initMap(), 250);
      } else {
        this.destroyMap();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroyMap();
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
  }

  private initializeValues(): void {
    this.address = this.initialAddress || '';
    this.reference = this.initialReference || '';
    this.searchQuery = '';
    this.searchSuggestions.set([]);
    this.statusNotice.set(null);

    if (this.initialLat && this.initialLng && !isNaN(this.initialLat) && !isNaN(this.initialLng)) {
      this.selectedLat = this.initialLat;
      this.selectedLng = this.initialLng;
    } else {
      // Intentar leer de localStorage 'pidetelo_customer_zone'
      try {
        const savedZone = localStorage.getItem('pidetelo_customer_zone');
        if (savedZone) {
          const parsed = JSON.parse(savedZone);
          if (parsed?.lat && parsed?.lng) {
            this.selectedLat = parsed.lat;
            this.selectedLng = parsed.lng;
            return;
          }
        }
      } catch (_) {}

      // Fallback a coordenadas del comercio o default
      if (this.storeLat && this.storeLng && !isNaN(this.storeLat) && !isNaN(this.storeLng)) {
        this.selectedLat = this.storeLat;
        this.selectedLng = this.storeLng;
      } else {
        this.selectedLat = 10.06777; // Barquisimeto / Centro
        this.selectedLng = -69.34735;
      }
    }
  }

  initMap(retryCount = 0): void {
    const container = document.getElementById('customer-address-picker-map');
    if (!container) {
      if (retryCount < 10) {
        setTimeout(() => this.initMap(retryCount + 1), 100);
      }
      return;
    }

    this.destroyMap();

    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    try {
      this.map = L.map(container, {
        zoomControl: true,
        attributionControl: false
      }).setView([this.selectedLat, this.selectedLng], 16);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(this.map);

      // Icono de Entrega elegante y visible
      const pinIcon = L.divIcon({
        className: 'custom-delivery-pin',
        html: `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
            <div style="background:linear-gradient(135deg, #f97316 0%, #ea580c 100%);color:white;width:42px;height:42px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px rgba(234,88,12,0.5);border:3px solid white;">
              <span style="transform:rotate(45deg);font-size:20px;line-height:1;">📍</span>
            </div>
            <div style="background:rgba(0,0,0,0.8);color:white;font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;margin-top:4px;white-space:nowrap;letter-spacing:0.3px;box-shadow:0 2px 6px rgba(0,0,0,0.3);">
              Tu Entrega Aquí
            </div>
          </div>
        `,
        iconSize: [42, 60],
        iconAnchor: [21, 56]
      });

      this.marker = L.marker([this.selectedLat, this.selectedLng], {
        icon: pinIcon,
        draggable: true
      }).addTo(this.map);

      // Evento: Al arrastrar el marcador
      this.marker.on('dragend', () => {
        const pos = this.marker?.getLatLng();
        if (pos) {
          this.updateCoordinates(pos.lat, pos.lng, true);
        }
      });

      // Evento: Al hacer clic en cualquier punto del mapa
      this.map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        this.marker?.setLatLng([lat, lng]);
        this.updateCoordinates(lat, lng, true);
      });

      // Si no hay dirección previa, hacer geocodificación inversa inicial
      if (!this.address || this.address.trim().length === 0) {
        this.reverseGeocode(this.selectedLat, this.selectedLng);
      }

      // Forzar renderizado de Leaflet tras apertura de modal
      setTimeout(() => {
        this.map?.invalidateSize();
      }, 300);

    } catch (e) {
      console.error('[CustomerAddressModal] Error inicializando Leaflet map:', e);
    }
  }

  private destroyMap(): void {
    if (this.map) {
      try {
        this.map.remove();
      } catch (_) {}
      this.map = undefined;
      this.marker = undefined;
    }
  }

  updateCoordinates(lat: number, lng: number, fetchAddress = false): void {
    this.selectedLat = Number(lat.toFixed(6));
    this.selectedLng = Number(lng.toFixed(6));

    if (fetchAddress) {
      this.reverseGeocode(this.selectedLat, this.selectedLng);
    }
  }

  // 1. Geocodificación Inversa (De Coordenadas a Dirección de Texto)
  async reverseGeocode(lat: number, lng: number): Promise<void> {
    this.isReverseGeocoding.set(true);
    this.statusNotice.set('Obteniendo dirección del punto seleccionado...');

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: { 'Accept-Language': 'es' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          // Extraer las partes principales (calle, sector, ciudad)
          const parts = data.display_name.split(',').map((p: string) => p.trim());
          const cleanAddr = parts.slice(0, 3).join(', ');
          this.address = cleanAddr || data.display_name;
          this.statusNotice.set(`📍 Punto fijado: ${this.address}`);
        }
      }
    } catch (err) {
      console.warn('[CustomerAddressModal] Error en reverse geocoding:', err);
    } finally {
      this.isReverseGeocoding.set(false);
      setTimeout(() => {
        if (this.statusNotice()?.startsWith('📍')) {
          this.statusNotice.set(null);
        }
      }, 4000);
    }
  }

  // 2. Búsqueda de dirección con autocompletado y debounce
  onSearchInput(value: string): void {
    this.searchQuery = value;
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    const q = value.trim();
    if (q.length < 3) {
      this.searchSuggestions.set([]);
      this.isSearching.set(false);
      return;
    }

    this.isSearching.set(true);
    this.searchDebounceTimer = setTimeout(async () => {
      try {
        // Buscar con prioridad en Venezuela / Colombia / Internacional
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=ve,co,us,mx,es&limit=5`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
        if (res.ok) {
          const list = await res.json();
          this.searchSuggestions.set(list || []);
        } else {
          this.searchSuggestions.set([]);
        }
      } catch (err) {
        console.warn('[CustomerAddressModal] Error buscando dirección:', err);
        this.searchSuggestions.set([]);
      } finally {
        this.isSearching.set(false);
      }
    }, 350);
  }

  selectSuggestion(item: GeocodingSuggestion): void {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);

    if (!isNaN(lat) && !isNaN(lng)) {
      this.selectedLat = Number(lat.toFixed(6));
      this.selectedLng = Number(lng.toFixed(6));

      // Extraer nombre conciso
      const parts = item.display_name.split(',').map(p => p.trim());
      this.address = parts.slice(0, 3).join(', ');

      this.searchSuggestions.set([]);
      this.searchQuery = this.address;

      // Volar el mapa a la nueva ubicación y mover el marcador
      if (this.map && this.marker) {
        this.map.flyTo([lat, lng], 17, { duration: 1.2 });
        this.marker.setLatLng([lat, lng]);
      }
      this.statusNotice.set('✓ Ubicación encontrada. Puedes arrastrar el pin para mayor precisión.');
      setTimeout(() => this.statusNotice.set(null), 4000);
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchSuggestions.set([]);
  }

  // 3. Captura automática por GPS del dispositivo
  detectGps(): void {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      this.isDetectingGps.set(true);
      this.statusNotice.set('Conectando con satélites GPS...');

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          this.selectedLat = lat;
          this.selectedLng = lng;
          this.isDetectingGps.set(false);
          this.statusNotice.set('✓ Ubicación satelital detectada con éxito.');

          if (this.map && this.marker) {
            this.map.flyTo([lat, lng], 17, { duration: 1.2 });
            this.marker.setLatLng([lat, lng]);
          }

          this.reverseGeocode(lat, lng);
        },
        (err) => {
          this.isDetectingGps.set(false);
          this.statusNotice.set('No se pudo acceder al GPS. Puedes buscar tu calle o tocar directamente en el mapa.');
          setTimeout(() => this.statusNotice.set(null), 5000);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      alert('Tu navegador no cuenta con servicio de GPS activo.');
    }
  }

  // 4. Confirmar y guardar la ubicación
  confirmLocation(): void {
    if (!this.selectedLat || !this.selectedLng || isNaN(this.selectedLat) || isNaN(this.selectedLng)) {
      alert('Por favor selecciona un punto en el mapa para tu entrega.');
      return;
    }

    const cleanAddress = (this.address || '').trim();
    if (cleanAddress.length < 3) {
      alert('Por favor indica una dirección o nombre de calle para la entrega.');
      return;
    }

    // Persistir en localStorage como zona actual de cliente
    try {
      localStorage.setItem('pidetelo_customer_zone', JSON.stringify({
        id: 'gps-custom',
        name: cleanAddress.split(',')[0] || 'Mi Ubicación',
        lat: this.selectedLat,
        lng: this.selectedLng,
        isGps: true
      }));
    } catch (_) {}

    this.locationSelected.emit({
      address: cleanAddress,
      lat: this.selectedLat,
      lng: this.selectedLng,
      reference: (this.reference || '').trim()
    });

    this.closeModal();
  }

  closeModal(): void {
    this.destroyMap();
    this.close.emit();
  }
}
