import { Component, inject, signal, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import * as L from 'leaflet';
import { MockDataService } from '../../core/services/mock-data.service';
import { ApiService } from '../../core/services/api.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ThemeService } from '../../core/services/theme.service';
import { I18nService } from '../../core/services/i18n.service';
import { AuthStore } from '../../core/stores/auth.store';
import { Order } from '../../core/models/order.model';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-customer-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent],
  templateUrl: './customer-tracking.component.html'
})
export class CustomerTrackingComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly mockData = inject(MockDataService);
  private readonly api = inject(ApiService);
  private readonly supabase = inject(SupabaseService);
  readonly auth = inject(AuthStore);
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);

  readonly order = signal<Order | null>(null);
  readonly etaMinutes = signal<number>(25);
  readonly speedKmh = signal<number>(0);
  readonly distanceKm = signal<number>(0);
  readonly gpsProgress = signal<number>(0);
  readonly searchQuery = signal<string>('');
  readonly recentGuestOrders = signal<any[]>([]);

  // Quick Customer Registration
  readonly regEmail = signal<string>('');
  readonly regPassword = signal<string>('');
  readonly isRegistering = signal<boolean>(false);
  readonly registrationSuccess = signal<boolean>(false);
  readonly registrationError = signal<string>('');
  readonly showDownloadModal = signal<boolean>(false);

  // Corrección y Reenvío de Pago Móvil Rechazado
  readonly newPaymentRefInput = signal<string>('');
  readonly isSubmittingPaymentRef = signal<boolean>(false);
  readonly paymentRefUpdatedSuccess = signal<boolean>(false);

  private leafletMap?: L.Map;
  private storeMarker?: L.Marker;
  private clientMarker?: L.Marker;
  private riderMarker?: L.Marker;
  private routeLine?: L.Polyline;
  private guidelinePolyline?: L.Polyline;
  private simulationInterval: any = null;
  private livePollingInterval: any = null;
  private telemetryChannel: any = null;
  private orderChannel: any = null;
  private subscribedOrderUuid: string | null = null;
  private lastRenderedStatus: string | null = null;
  private riderAnimFrame: number | null = null;
  private lastRoutedRiderPos: [number, number] | null = null;

  private currentWaypoints: [number, number][] = [];

  ngOnInit(): void {
    this.loadRecentGuestOrders();
    const orderIdParam = this.route.snapshot.paramMap.get('orderId') || '';
    if (orderIdParam) {
      this.loadOrderDetails(orderIdParam);
      this.livePollingInterval = setInterval(() => {
        const currentOrd = this.order();
        if (!currentOrd || currentOrd.status !== 'delivered') {
          this.pollLiveOrderAndTelemetry(orderIdParam);
        }
      }, 4000);
    }
  }

  loadRecentGuestOrders(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('pidetelo_recent_web_orders');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          this.recentGuestOrders.set(list);
        }
      }
    } catch (_) {}
  }

  searchOrder(num?: string): void {
    const target = (num || this.searchQuery()).trim().replace('#', '');
    if (!target) return;
    window.location.href = `/track/${target}`;
  }

  getMerchantWhatsAppUrl(ord: Order): string {
    const phone = ord.tenantPhone?.replace(/\D/g, '') || '584245065032';
    const text = encodeURIComponent(
      `👋 Hola *${ord.tenantName}*. Estoy revisando el rastreo de mi pedido *#${ord.orderNumber}* y me indica que el Pago Móvil fue rechazado o no se encontró en cuenta.\n\n` +
      `Adjunto mi nuevo comprobante para que puedan verificarlo y preparar mi comanda en cocina. ¡Gracias!`
    );
    return `https://wa.me/${phone}?text=${text}`;
  }

  submitCorrectedPaymentRef(ord: Order): void {
    const ref = this.newPaymentRefInput().trim();
    if (!ref) return;

    this.isSubmittingPaymentRef.set(true);
    this.api.verifyOrderPayment(ord.id, {
      status: 'pending',
      reference: ref
    }).subscribe({
      next: () => {
        this.isSubmittingPaymentRef.set(false);
        this.paymentRefUpdatedSuccess.set(true);
        this.order.update(curr => curr ? {
          ...curr,
          paymentStatus: 'pending',
          paymentReference: ref
        } : null);
        this.newPaymentRefInput.set('');
        setTimeout(() => this.paymentRefUpdatedSuccess.set(false), 5000);
      },
      error: (err) => {
        console.warn('[Tracking] Error reenviando referencia:', err);
        this.isSubmittingPaymentRef.set(false);
        this.order.update(curr => curr ? {
          ...curr,
          paymentStatus: 'pending',
          paymentReference: ref
        } : null);
        this.paymentRefUpdatedSuccess.set(true);
        this.newPaymentRefInput.set('');
      }
    });
  }

  private smoothMoveRiderMarker(targetLat: number, targetLng: number): void {
    if (!this.riderMarker) return;
    if (this.riderAnimFrame !== null) {
      cancelAnimationFrame(this.riderAnimFrame);
      this.riderAnimFrame = null;
    }
    const startLatLng = this.riderMarker.getLatLng();
    const dLat = targetLat - startLatLng.lat;
    const dLng = targetLng - startLatLng.lng;
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
  }

  private applyLiveRiderPosition(lat: number, lng: number, speed?: number): void {
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;
    if (this.riderMarker) {
      this.smoothMoveRiderMarker(lat, lng);
    }
    if (speed !== undefined && speed !== null && !isNaN(speed)) {
      this.speedKmh.set(Math.round(speed));
    }

    const ord = this.order();
    if (ord && ord.status === 'on_the_way') {
      const storeLat = ord.tenantLat || 10.0267;
      const storeLng = ord.tenantLng || -69.2571;
      const clientLat = ord.deliveryLat || (storeLat + 0.015);
      const clientLng = ord.deliveryLng || (storeLng + 0.018);

      const totalDist = Math.max(0.1, this.calculateDistance(storeLat, storeLng, clientLat, clientLng));
      const remDist = this.calculateDistance(lat, lng, clientLat, clientLng);
      const progressPct = Math.round(Math.max(5, Math.min(98, ((totalDist - remDist) / totalDist) * 100)));
      this.gpsProgress.set(progressPct);

      // Recalcular ruta óptima en vivo desde la posición real del repartidor hacia el cliente cada >35m
      const movedDeg = this.lastRoutedRiderPos
        ? Math.hypot(lat - this.lastRoutedRiderPos[0], lng - this.lastRoutedRiderPos[1])
        : 999;

      if (movedDeg > 0.00035) {
        this.lastRoutedRiderPos = [lat, lng];
        this.api.getFastestRoute(lat, lng, clientLat, clientLng).subscribe(routeRes => {
          if (routeRes && routeRes.waypoints && routeRes.waypoints.length >= 2) {
            this.currentWaypoints = routeRes.waypoints;
            this.distanceKm.set(routeRes.distanceKm);
            this.etaMinutes.set(Math.max(1, routeRes.durationMinutes));
            if (this.routeLine) {
              this.routeLine.setLatLngs(this.currentWaypoints);
            }
            if (this.guidelinePolyline) {
              this.guidelinePolyline.setLatLngs(this.currentWaypoints);
            }
          } else {
            this.distanceKm.set(Number(remDist.toFixed(2)));
            this.etaMinutes.set(Math.max(1, Math.round(remDist * 2.5)));
          }
        });
      }
    }
  }

  private setupTelemetrySubscription(orderUuid: string): void {
    if (!orderUuid || this.subscribedOrderUuid === orderUuid) return;
    this.subscribedOrderUuid = orderUuid;

    if (this.telemetryChannel && typeof this.telemetryChannel.unsubscribe === 'function') {
      this.telemetryChannel.unsubscribe();
    }

    this.telemetryChannel = this.supabase.subscribeToRiderTelemetry(orderUuid, (telemetry) => {
      const ord = this.order();
      if (!ord || !telemetry) return;
      const rawLat = telemetry.latitude ?? telemetry.lat;
      const rawLng = telemetry.longitude ?? telemetry.lng;
      const rawSpeed = telemetry.speed_kmh ?? telemetry.speed;
      if (rawLat !== undefined && rawLng !== undefined) {
        this.applyLiveRiderPosition(Number(rawLat), Number(rawLng), rawSpeed !== undefined ? Number(rawSpeed) : 32);
      }
    });
  }

  private pollLiveOrderAndTelemetry(orderIdParam: string): void {
    this.api.getOrder(orderIdParam).subscribe(ord => {
      if (!ord) return;
      const prevStatus = this.lastRenderedStatus;
      this.order.set(ord);

      if (ord.id) {
        this.setupTelemetrySubscription(ord.id);
      }

      if (prevStatus !== ord.status) {
        this.updateEtaAndDistanceForStatus(ord);
        this.ensureMapInitialized(ord);
      } else if (ord.status === 'on_the_way') {
        if (ord.driverLat && ord.driverLng) {
          this.applyLiveRiderPosition(ord.driverLat, ord.driverLng);
        }
        if (ord.id) {
          this.api.getOrderTelemetry(ord.id).subscribe(telemList => {
            if (telemList && telemList.length > 0) {
              const latest = telemList[0];
              const tLat = latest.latitude ?? latest.lat;
              const tLng = latest.longitude ?? latest.lng;
              const tSpeed = latest.speed_kmh ?? latest.speed;
              if (tLat !== undefined && tLng !== undefined) {
                this.applyLiveRiderPosition(Number(tLat), Number(tLng), tSpeed !== undefined ? Number(tSpeed) : undefined);
              }
            }
          });
        }
      }
    });
  }

  private loadOrderDetails(orderId: string): void {
    this.api.getOrder(orderId).subscribe(ord => {
      if (ord) {
        if (ord.id) {
          this.setupTelemetrySubscription(ord.id);
        }
        // Si la orden tiene un repartidor asignado pero faltan sus datos completos o teléfono
        if (ord.driverId && (!ord.driverName || ord.driverName === 'Repartidor Asignado' || !ord.driverPhone)) {
          this.api.getRiderProfile(ord.driverId).subscribe(rider => {
            if (rider) {
              const updatedOrd: Order = {
                ...ord,
                driverName: rider.name || ord.driverName || 'Repartidor Asignado',
                driverPhone: rider.phone || ord.driverPhone || '',
                driverPlate: rider.vehicle_plate || ord.driverPlate || '',
                driverVehicle: rider.vehicle_model
                  ? `${rider.vehicle_type === 'moto' ? 'Moto' : (rider.vehicle_type || 'Vehículo')} • ${rider.vehicle_model}`
                  : (rider.vehicle_type || ord.driverVehicle || 'Moto'),
                driverAvatar: rider.avatar_url || ord.driverAvatar || '',
                driverLat: rider.current_lat ? Number(rider.current_lat) : ord.driverLat,
                driverLng: rider.current_lng ? Number(rider.current_lng) : ord.driverLng,
              };
              this.order.set(updatedOrd);
              this.updateEtaAndDistanceForStatus(updatedOrd);
              this.ensureMapInitialized(updatedOrd);
            }
          });
        }

        this.order.set(ord);
        if (ord.customer?.email && !this.regEmail()) {
          this.regEmail.set(ord.customer.email);
        }

        this.updateEtaAndDistanceForStatus(ord);
        this.ensureMapInitialized(ord);

        // Suscribirse a cambios de estado de la orden en tiempo real en Supabase
        if (ord.tenantId && !this.orderChannel) {
          this.orderChannel = this.supabase.subscribeToOrders(ord.tenantId, (payload) => {
            if (payload.new && (payload.new.id === ord.id || payload.new.order_number === ord.orderNumber)) {
              // Recargar orden completa para obtener repartidor recién asignado y cambios de estado
              this.loadOrderDetails(orderId);
            }
          });
        }
      }
    });
  }

  ngAfterViewInit(): void {
    const ord = this.order();
    if (ord) {
      this.ensureMapInitialized(ord);
    }
  }

  private ensureMapInitialized(ord: Order, retries = 5): void {
    setTimeout(() => {
      const container = document.getElementById('customer-leaflet-map');
      if (!container && retries > 0) {
        this.ensureMapInitialized(ord, retries - 1);
        return;
      }
      if (!this.leafletMap && container) {
        this.initLeafletBaseMap(ord);
      }
      if (this.leafletMap) {
        this.leafletMap.invalidateSize();
        this.renderMapRoute(ord);
      }
    }, 150);
  }

  ngOnDestroy(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    if (this.livePollingInterval) {
      clearInterval(this.livePollingInterval);
      this.livePollingInterval = null;
    }
    if (this.telemetryChannel && typeof this.telemetryChannel.unsubscribe === 'function') {
      this.telemetryChannel.unsubscribe();
    }
    if (this.orderChannel && typeof this.orderChannel.unsubscribe === 'function') {
      this.orderChannel.unsubscribe();
    }
    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = undefined;
    }
  }

  private initLeafletBaseMap(ord?: Order): void {
    const container = document.getElementById('customer-leaflet-map');
    if (!container || this.leafletMap) return;

    const initialLat = ord?.tenantLat || 10.0267;
    const initialLng = ord?.tenantLng || -69.2571;

    this.leafletMap = L.map(container, {
      zoomControl: false,
      attributionControl: false
    }).setView([initialLat, initialLng], 14);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.leafletMap);
  }

  private updateEtaAndDistanceForStatus(ord: Order): void {
    const storeLat = ord.tenantLat || 10.0267;
    const storeLng = ord.tenantLng || -69.2571;
    const clientLat = ord.deliveryLat || (storeLat + 0.015);
    const clientLng = ord.deliveryLng || (storeLng + 0.018);

    const originLat = (ord.status === 'on_the_way' && ord.driverLat) ? ord.driverLat : storeLat;
    const originLng = (ord.status === 'on_the_way' && ord.driverLng) ? ord.driverLng : storeLng;

    const dist = this.calculateDistance(originLat, originLng, clientLat, clientLng);
    this.distanceKm.set(Number(dist.toFixed(2)));

    if (ord.status === 'received') {
      this.etaMinutes.set(30);
      this.speedKmh.set(0);
      this.gpsProgress.set(0);
    } else if (ord.status === 'in_kitchen') {
      this.etaMinutes.set(20);
      this.speedKmh.set(0);
      this.gpsProgress.set(0);
    } else if (ord.status === 'on_the_way') {
      this.etaMinutes.set(Math.max(2, Math.round(dist * 2.5)));
      this.speedKmh.set(34);
      this.gpsProgress.set(25);
    } else if (ord.status === 'delivered') {
      this.etaMinutes.set(0);
      this.speedKmh.set(0);
      this.distanceKm.set(0);
      this.gpsProgress.set(100);
    }
  }

  private async renderMapRoute(ord: Order): Promise<void> {
    if (!this.leafletMap) return;

    // Limpiar marcadores y rutas previas
    if (this.storeMarker) {
      this.storeMarker.remove();
      this.storeMarker = undefined;
    }
    if (this.clientMarker) {
      this.clientMarker.remove();
      this.clientMarker = undefined;
    }
    if (this.riderMarker) {
      this.riderMarker.remove();
      this.riderMarker = undefined;
    }
    if (this.routeLine) {
      this.routeLine.remove();
      this.routeLine = undefined;
    }
    if (this.guidelinePolyline) {
      this.guidelinePolyline.remove();
      this.guidelinePolyline = undefined;
    }
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    // Coordenadas reales del comercio (Origen)
    const storeLat = ord.tenantLat || 10.0267;
    const storeLng = ord.tenantLng || -69.2571;
    const storePoint: [number, number] = [storeLat, storeLng];

    // Coordenadas reales del cliente (Destino)
    const clientLat = ord.deliveryLat || (storeLat + 0.015);
    const clientLng = ord.deliveryLng || (storeLng + 0.018);
    const clientPoint: [number, number] = [clientLat, clientLng];

    // Si el repartidor está en camino y tiene coordenadas GPS activas, calcular la ruta óptima desde él hasta el cliente
    const hasLiveRider = ord.status === 'on_the_way' && !!ord.driverLat && !!ord.driverLng;
    const routeOriginLat = hasLiveRider ? Number(ord.driverLat) : storeLat;
    const routeOriginLng = hasLiveRider ? Number(ord.driverLng) : storeLng;
    if (hasLiveRider) {
      this.lastRoutedRiderPos = [routeOriginLat, routeOriginLng];
    }

    // 1. Obtener la ruta vial más rápida y más corta (evaluación multi-motor OSRM)
    let waypoints: [number, number][] = [];
    try {
      const routeRes = await firstValueFrom(this.api.getFastestRoute(routeOriginLat, routeOriginLng, clientLat, clientLng));
      if (routeRes && routeRes.waypoints && routeRes.waypoints.length > 0) {
        waypoints = routeRes.waypoints;
        this.distanceKm.set(routeRes.distanceKm);
        const travelMins = routeRes.durationMinutes;

        if (ord.status !== 'delivered') {
          if (ord.status === 'received') {
            this.etaMinutes.set(Math.max(25, 25 + travelMins));
          } else if (ord.status === 'in_kitchen') {
            this.etaMinutes.set(Math.max(15, 15 + travelMins));
          } else if (ord.status === 'on_the_way') {
            this.etaMinutes.set(Math.max(1, travelMins));
          }
        }
      }
    } catch (e) {
      console.warn('[Tracking] Fallback local para ruta:', e);
    }

    // Si los servidores no respondieran, usar línea directa real sin zigzags falsos
    if (!waypoints || waypoints.length < 2) {
      waypoints = [
        [routeOriginLat, routeOriginLng],
        clientPoint
      ];
    }

    this.currentWaypoints = waypoints;

    // 1. Línea de ruta con diseño elegante de carretera
    this.guidelinePolyline = L.polyline(this.currentWaypoints, {
      color: '#94a3b8',
      weight: 6,
      opacity: 0.5,
      dashArray: '6, 8'
    }).addTo(this.leafletMap);

    this.routeLine = L.polyline(this.currentWaypoints, {
      color: '#ea580c',
      weight: 5,
      opacity: 0.95
    }).addTo(this.leafletMap);

    // 2. Marcador Restaurante / Comercio
    const storeIcon = L.divIcon({
      className: 'leaflet-custom-marker',
      html: `
        <div style="background:#ea580c;color:white;width:36px;height:36px;border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(234,88,12,0.45);border:2px solid white;cursor:pointer;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
    this.storeMarker = L.marker(storePoint, { icon: storeIcon })
      .bindPopup(`<b>${ord.tenantName || 'Restaurante'}</b><br><span style="font-size:11px;color:#64748b;">${ord.tenantAddress || 'Local comercial'}</span>`)
      .addTo(this.leafletMap);

    // 3. Marcador Cliente / Entrega
    const clientIcon = L.divIcon({
      className: 'leaflet-custom-marker',
      html: `
        <div style="background:#4f46e5;color:white;width:36px;height:36px;border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(79,70,229,0.45);border:2px solid white;cursor:pointer;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
    this.clientMarker = L.marker(clientPoint, { icon: clientIcon })
      .bindPopup(`<b>Tu Dirección de Entrega</b><br><span style="font-size:11px;color:#64748b;">${ord.customer?.deliveryAddress || 'Domicilio'}</span>`)
      .addTo(this.leafletMap);

    // 4. Centrar vista entre comercio y cliente
    this.leafletMap.invalidateSize();
    const bounds = L.latLngBounds([storePoint, clientPoint]);
    this.leafletMap.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });

    // 5. Marcador del Motorizado: SOLO CUANDO ESTÁ "EN CAMINO"
    if (ord.status === 'on_the_way') {
      const riderName = ord.driverName || 'Repartidor';
      const riderPlate = ord.driverPlate || '';

      const riderIcon = L.divIcon({
        className: 'leaflet-custom-marker',
        html: `
          <div class="leaflet-rider-pulse" style="width:40px;height:40px;">
            <div style="background:#f97316;color:white;width:34px;height:34px;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(249,115,22,0.45);border:2px solid white;z-index:2;position:relative;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      // El motorizado se posiciona en la coordenada GPS reportada o en el origen (comercio)
      const initialPos: [number, number] = (ord.driverLat && ord.driverLng)
        ? [ord.driverLat, ord.driverLng]
        : (this.currentWaypoints[0] || storePoint);
      this.riderMarker = L.marker(initialPos, { icon: riderIcon })
        .bindPopup(`<b>${riderName}</b><br><span style="font-size:11px;color:#f97316;font-weight:bold;">Repartidor asignado (${riderPlate || 'En ruta'})</span>`)
        .addTo(this.leafletMap);

      if (ord.driverLat && ord.driverLng) {
        this.applyLiveRiderPosition(ord.driverLat, ord.driverLng, 30);
      } else {
        this.speedKmh.set(0);
      }
    }
    this.lastRenderedStatus = ord.status;
  }

  getCleanWhatsAppUrl(phone?: string, orderNumber?: string, driverName?: string): string {
    if (!phone) return '';
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = clean.substring(1);
    }
    if (!clean.startsWith('58')) {
      clean = '58' + clean;
    }
    const name = driverName || 'amigo';
    const num = orderNumber || '';
    const text = encodeURIComponent(`Hola ${name}, te escribo respecto al pedido ${num}`);
    return `https://wa.me/${clean}?text=${text}`;
  }

  getCleanTelUrl(phone?: string): string {
    if (!phone) return '';
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = clean.substring(1);
    }
    if (!clean.startsWith('58')) {
      clean = '+58' + clean;
    } else {
      clean = '+' + clean;
    }
    return `tel:${clean}`;
  }

  getFormattedPhone(phone?: string): string {
    if (!phone) return '';
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('58')) clean = clean.substring(2);
    if (clean.startsWith('0')) clean = clean.substring(1);
    if (clean.length === 10) {
      return `+58 (${clean.substring(0, 3)}) ${clean.substring(3, 6)}-${clean.substring(6)}`;
    }
    return `+58 ${clean}`;
  }

  private getPointAtProgress(progressPct: number): [number, number] {
    if (!this.currentWaypoints || this.currentWaypoints.length < 2) {
      return [10.4820, -66.8610];
    }
    const totalSegments = this.currentWaypoints.length - 1;
    const progress = Math.max(0, Math.min(100, progressPct)) / 100;
    const scaled = progress * totalSegments;
    const index = Math.min(Math.floor(scaled), totalSegments - 1);
    const segmentProgress = scaled - index;

    const p1 = this.currentWaypoints[index];
    const p2 = this.currentWaypoints[index + 1];

    const lat = p1[0] + (p2[0] - p1[0]) * segmentProgress;
    const lng = p1[1] + (p2[1] - p1[1]) * segmentProgress;

    return [lat, lng];
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  recenter(): void {
    if (this.leafletMap && this.currentWaypoints.length > 0) {
      const bounds = L.latLngBounds(this.currentWaypoints);
      this.leafletMap.fitBounds(bounds, { padding: [35, 35] });
    }
  }

  async quickRegister(): Promise<void> {
    const email = this.regEmail().trim();
    const password = this.regPassword();

    if (!email || !email.includes('@')) {
      this.registrationError.set('Ingresa un correo electrónico válido.');
      return;
    }
    if (!password || password.length < 6) {
      this.registrationError.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    this.isRegistering.set(true);
    this.registrationError.set('');

    try {
      const ord = this.order();
      const customerName = ord?.customer.name || 'Cliente';
      const customerPhone = ord?.customer.phone || '';

      try {
        await this.supabase.signUpWithEmail(email, password, customerName, 'CUSTOMER');
      } catch (err) {
        console.warn('[Tracking] Registro Supabase secundario:', err);
      }

      this.auth.loginAsCustomer({
        name: customerName,
        email: email,
        phone: customerPhone
      });

      this.registrationSuccess.set(true);
    } catch (err: any) {
      this.registrationError.set(err?.message || 'Error al crear la cuenta.');
    } finally {
      this.isRegistering.set(false);
    }
  }
}
