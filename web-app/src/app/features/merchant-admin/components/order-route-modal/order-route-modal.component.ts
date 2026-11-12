import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { Order } from '../../../../core/models/order.model';
import { Branch } from '../../../../core/models/branch.model';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { ApiService } from '../../../../core/services/api.service';
import { IconComponent } from '../../../../shared/components/icon.component';

export interface RouteRider {
  id: string;
  name: string;
  currentLocation?: { lat: number; lng: number };
}

@Component({
  selector: 'app-order-route-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './order-route-modal.component.html'
})
export class OrderRouteModalComponent implements OnChanges, OnDestroy {
  private readonly supabase = inject(SupabaseService);
  private readonly api = inject(ApiService);

  @Input() isOpen = false;
  @Input() order: Order | null = null;
  @Input() branch: Branch | null = null;
  @Input() rider: RouteRider | null = null;
  @Input() activeExchangeRate = 45.50;
  @Input() fallbackStoreName = 'Sede Principal';
  @Input() defaultCoords: { lat: number; lng: number } = { lat: 10.0385, lng: -69.2482 };

  @Output() close = new EventEmitter<void>();

  private routeMap?: L.Map;
  private riderMarker?: L.Marker;
  private routePolyline?: L.Polyline;
  private destCoords?: [number, number];
  private lastRouteRiderCoords?: [number, number];
  private renderedOrderId?: string;
  private renderedStatus?: string;
  private telemetryChannel: any = null;
  private telemetryPollTimer: any = null;
  private riderAnimFrame: number | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.isOpen || !this.order) {
      this.destroyMap();
      return;
    }

    const orderChanged = this.renderedOrderId !== this.order.id || this.renderedStatus !== this.order.status;
    if (changes['isOpen'] || orderChanged || !this.routeMap) {
      setTimeout(() => this.initMap(), 150);
    } else if (changes['rider'] || changes['order']) {
      this.updateLiveRiderMarkerFromInputs();
    }
  }

  ngOnDestroy(): void {
    this.destroyMap();
  }

  private destroyMap(): void {
    if (this.riderAnimFrame !== null) {
      cancelAnimationFrame(this.riderAnimFrame);
      this.riderAnimFrame = null;
    }
    if (this.telemetryChannel && typeof this.telemetryChannel.unsubscribe === 'function') {
      this.telemetryChannel.unsubscribe();
      this.telemetryChannel = null;
    }
    if (this.telemetryPollTimer) {
      clearInterval(this.telemetryPollTimer);
      this.telemetryPollTimer = null;
    }
    this.riderMarker = undefined;
    this.routePolyline = undefined;
    this.destCoords = undefined;
    this.lastRouteRiderCoords = undefined;
    this.renderedOrderId = undefined;
    this.renderedStatus = undefined;
    if (this.routeMap) {
      this.routeMap.remove();
      this.routeMap = undefined;
    }
  }

  private updateLiveRiderMarkerPosition(lat: number, lng: number): void {
    if (!this.routeMap || !this.riderMarker || isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;
    if (this.riderAnimFrame !== null) {
      cancelAnimationFrame(this.riderAnimFrame);
      this.riderAnimFrame = null;
    }
    const startLatLng = this.riderMarker.getLatLng();
    const dLat = lat - startLatLng.lat;
    const dLng = lng - startLatLng.lng;
    if (Math.abs(dLat) < 0.000002 && Math.abs(dLng) < 0.000002) {
      return;
    }
    const durationMs = 2400;
    const startTime = performance.now();
    const step = (now: number) => {
      if (!this.riderMarker) return;
      const t = Math.min(1, (now - startTime) / durationMs);
      this.riderMarker.setLatLng([
        startLatLng.lat + dLat * t,
        startLatLng.lng + dLng * t,
      ]);
      if (t < 1) {
        this.riderAnimFrame = requestAnimationFrame(step);
      } else {
        this.riderAnimFrame = null;
      }
    };
    this.riderAnimFrame = requestAnimationFrame(step);

    // Recalcular ruta óptima restante desde la ubicación real del motorizado hacia el cliente si avanzó > 35m
    if (this.destCoords && this.routePolyline) {
      const prev = this.lastRouteRiderCoords;
      const movedDeg = prev ? Math.hypot(lat - prev[0], lng - prev[1]) : 999;
      if (movedDeg > 0.00035) {
        this.lastRouteRiderCoords = [lat, lng];
        this.fetchStreetRoute([lat, lng], this.destCoords).then(pts => {
          if (this.routePolyline && pts.length >= 2) {
            this.routePolyline.setLatLngs(pts);
          }
        });
      }
    }
  }

  private updateLiveRiderMarkerFromInputs(): void {
    const rLat = this.rider?.currentLocation?.lat ?? this.order?.driverLat;
    const rLng = this.rider?.currentLocation?.lng ?? this.order?.driverLng;
    if (rLat !== undefined && rLng !== undefined) {
      this.updateLiveRiderMarkerPosition(rLat, rLng);
    }
  }

  private async initMap(): Promise<void> {
    const container = document.getElementById('order-route-leaflet-modal-map');
    if (!container || !this.order) return;

    this.destroyMap();

    const order = this.order;
    this.renderedOrderId = order.id;
    this.renderedStatus = order.status;
    const originLat = this.branch ? this.branch.latitude : (order.tenantLat || this.defaultCoords.lat);
    const originLng = this.branch ? this.branch.longitude : (order.tenantLng || this.defaultCoords.lng);
    const originName = this.branch ? this.branch.name : (order.branchName || this.fallbackStoreName);

    let destLat = order.deliveryLat;
    let destLng = order.deliveryLng;
    if (!destLat || !destLng || (destLat > 10.45 && destLat < 10.53 && destLng > -66.95)) {
      destLat = Number((originLat + 0.0125).toFixed(6));
      destLng = Number((originLng + 0.0140).toFixed(6));
    }
    this.destCoords = [destLat, destLng];
    const destAddress = order.customer?.deliveryAddress || 'Domicilio del Cliente';

    const isDelivered = order.status === 'delivered';
    const isInTransit = order.status === 'on_the_way';

    let riderLat = originLat;
    let riderLng = originLng;

    if (isInTransit) {
      if (this.rider?.currentLocation) {
        riderLat = this.rider.currentLocation.lat;
        riderLng = this.rider.currentLocation.lng;
      } else if (order.driverLat && order.driverLng) {
        riderLat = order.driverLat;
        riderLng = order.driverLng;
      } else {
        riderLat = originLat;
        riderLng = originLng;
      }
      this.lastRouteRiderCoords = [riderLat, riderLng];
    }

    this.routeMap = L.map(container, {
      zoomControl: true,
      attributionControl: false
    }).setView([originLat, originLng], 14);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.routeMap);

    // Marker Store
    const storeIcon = L.divIcon({
      className: 'leaflet-route-marker',
      html: `
        <div style="background:#ea580c;color:white;width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(234,88,12,0.4);border:2px solid white;cursor:pointer;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });
    L.marker([originLat, originLng], { icon: storeIcon })
      .bindPopup(`<b>${originName}</b><br><span style="font-size:11px;color:#64748b">Punto de Despacho (Sede)</span>`)
      .addTo(this.routeMap);

    // Marker Client
    const clientColor = isDelivered ? '#10b981' : '#4f46e5';
    const clientIcon = L.divIcon({
      className: 'leaflet-route-marker',
      html: `
        <div style="background:${clientColor};color:white;width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.3);border:2px solid white;cursor:pointer;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });
    L.marker([destLat, destLng], { icon: clientIcon })
      .bindPopup(`<b>${order.customer?.name || 'Cliente'}</b><br><span style="font-size:11px;color:#64748b">Destino: ${destAddress}</span>${isDelivered ? '<br><b style="color:#10b981;font-size:11px;">✓ Pedido Entregado con Éxito</b>' : ''}`)
      .addTo(this.routeMap);

    // Marker Rider
    if (isInTransit) {
      const riderIcon = L.divIcon({
        className: 'leaflet-rider-pulse',
        html: `
          <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;width:40px;height:40px;border-radius:9999px;background:#f97316;opacity:0.3;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="background:#f97316;color:white;width:36px;height:36px;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 14px rgba(249,115,22,0.5);border:2.5px solid white;z-index:2;position:relative;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
            </div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });
      this.riderMarker = L.marker([riderLat, riderLng], { icon: riderIcon })
        .bindPopup(`<b>${order.driverName || 'Motorizado'}</b><br><span style="font-size:11px;color:#f97316;font-weight:bold;">En camino con el pedido</span>`)
        .addTo(this.routeMap);

      // Suscribirse en vivo a telemetría GPS de este pedido
      this.telemetryChannel = this.supabase.subscribeToRiderTelemetry(order.id, (telem) => {
        if (!telem) return;
        const tLat = telem.latitude ?? telem.lat;
        const tLng = telem.longitude ?? telem.lng;
        if (tLat !== undefined && tLng !== undefined) {
          this.updateLiveRiderMarkerPosition(Number(tLat), Number(tLng));
        }
      });

      this.telemetryPollTimer = setInterval(() => {
        this.api.getOrderTelemetry(order.id).subscribe(list => {
          if (list && list.length > 0) {
            const latest = list[0];
            const tLat = latest.latitude ?? latest.lat;
            const tLng = latest.longitude ?? latest.lng;
            if (tLat !== undefined && tLng !== undefined) {
              this.updateLiveRiderMarkerPosition(Number(tLat), Number(tLng));
            }
          }
        });
      }, 4000);
    }

    const routeStart: [number, number] = isInTransit ? [riderLat, riderLng] : [originLat, originLng];
    const streetPoints = await this.fetchStreetRoute(routeStart, [destLat, destLng]);

    this.routePolyline = L.polyline(streetPoints, {
      color: isDelivered ? '#10b981' : '#f97316',
      weight: 5,
      opacity: 0.95,
      dashArray: isDelivered ? undefined : '8, 8'
    }).addTo(this.routeMap);

    const bounds = L.latLngBounds([...streetPoints, [originLat, originLng], [destLat, destLng]]);
    this.routeMap.fitBounds(bounds, { padding: [50, 50] });
    setTimeout(() => this.routeMap?.invalidateSize(), 200);
  }

  private async fetchStreetRoute(origin: [number, number], destination: [number, number]): Promise<[number, number][]> {
    const queryStr = `${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson&alternatives=3&continue_straight=false`;
    const endpoints = [
      `https://routing.openstreetmap.de/routed-car/route/v1/driving/${queryStr}`,
      `https://router.project-osrm.org/route/v1/driving/${queryStr}`,
      `https://routing.openstreetmap.de/routed-bike/route/v1/driving/${queryStr}`,
    ];

    const fetchFromEndpoint = async (url: string) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) return [];
        const data = await res.json();
        if (data?.code === 'Ok' && Array.isArray(data.routes)) {
          return data.routes
            .filter((r: any) => r?.geometry?.coordinates?.length >= 2)
            .map((r: any) => {
              const distanceKm = r.distance / 1000;
              const durationMins = Math.min(r.duration / 60, (distanceKm / 28) * 60);
              const score = distanceKm * 1.7 + durationMins * 0.3;
              const waypoints: [number, number][] = r.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
              return { score, waypoints };
            });
        }
      } catch {}
      return [];
    };

    try {
      const lists = await Promise.all(endpoints.map(fetchFromEndpoint));
      const candidates = lists.flat();
      if (candidates.length > 0) {
        candidates.sort((a, b) => a.score - b.score);
        return candidates[0].waypoints;
      }
    } catch {}
    return [origin, destination];
  }
}
