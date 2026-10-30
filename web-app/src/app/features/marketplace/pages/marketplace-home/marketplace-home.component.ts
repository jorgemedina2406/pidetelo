import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { Tenant } from '../../../../core/models/tenant.model';
import { IconComponent } from '../../../../shared/components/icon.component';

export interface CustomerLocationZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  isGps?: boolean;
}

export interface TenantWithDistance extends Tenant {
  distanceKm: number;
  deliveryMinutesMin: number;
  deliveryMinutesMax: number;
  isWithinRange: boolean;
  computedDeliveryFee: number;
}

@Component({
  selector: 'app-marketplace-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent],
  templateUrl: './marketplace-home.component.html'
})
export class MarketplaceHomeComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);

  searchQuery: string = '';
  readonly selectedCategory = signal<string>('Todos');
  sortBy: 'nearest' | 'fastest' | 'rating' | 'fee' = 'nearest';
  readonly isLoading = signal<boolean>(false);
  readonly activeOrder = signal<{ id: string; orderNumber: string; storeName: string } | null>(null);

  readonly categories = [
    'Todos',
    'Hamburguesas',
    'Sushi & Asiática',
    'Pizza & Pasta',
    'Mexicana & Tacos',
    'Postres & Dulces'
  ];

  readonly availableZones: CustomerLocationZone[] = [
    { id: 'bqto-este', name: 'Las Trinitarias / Este, Barquisimeto', lat: 10.0778, lng: -69.2813 },
    { id: 'bqto-centro', name: 'Av. Lara / Los Cardones, Barquisimeto', lat: 10.0633, lng: -69.2865 },
    { id: 'cabudare-centro', name: 'Cabudare Centro / Los Rastrojos', lat: 10.0385, lng: -69.2482 },
    { id: 'las-mercedes', name: 'Las Mercedes, Caracas', lat: 10.4810, lng: -66.8600 },
    { id: 'chacao', name: 'Chacao / El Rosal, Caracas', lat: 10.4920, lng: -66.8580 },
    { id: 'altamira', name: 'Altamira / San Ignacio, Caracas', lat: 10.4960, lng: -66.8520 },
    { id: 'palos-grandes', name: 'Los Palos Grandes, Caracas', lat: 10.4990, lng: -66.8450 },
    { id: 'la-trinidad', name: 'La Trinidad / Baruta, Caracas', lat: 10.4400, lng: -66.8650 }
  ];

  readonly currentZone = signal<CustomerLocationZone>(this.availableZones[0]);
  readonly isLocationDropdownOpen = signal<boolean>(false);
  readonly isDetectingGps = signal<boolean>(false);

  readonly allTenants = signal<Tenant[]>([]);

  readonly enrichedTenants = computed<TenantWithDistance[]>(() => {
    const zone = this.currentZone();
    return this.allTenants().map(tenant => {
      const tenantRadius = Number(tenant.deliverySettings?.deliveryRadiusKm) || 8.0;
      const branches = (tenant.branches || []).filter((b: any) => b.status === 'active' || (!b.status && b.name?.toLowerCase().includes('principal')));

      let minDistance = Infinity;
      let isWithinRange = false;

      if (branches.length > 0) {
        for (const b of branches) {
          const bLat = Number(b.latitude);
          const bLng = Number(b.longitude);
          if (!isNaN(bLat) && !isNaN(bLng) && bLat !== 0 && bLng !== 0) {
            const d = this.calculateDistanceKm(zone.lat, zone.lng, bLat, bLng);
            const branchRadius = Number(b.deliveryRadiusKm || b.delivery_radius_km) || tenantRadius;
            if (d < minDistance) {
              minDistance = d;
            }
            if (d <= branchRadius) {
              isWithinRange = true;
            }
          }
        }
      }

      if (minDistance === Infinity) {
        const tenantLat = Number(tenant.contact?.coordinates?.lat) || 10.0633;
        const tenantLng = Number(tenant.contact?.coordinates?.lng) || -69.2865;
        minDistance = this.calculateDistanceKm(zone.lat, zone.lng, tenantLat, tenantLng);
        isWithinRange = minDistance <= tenantRadius;
      }

      const distance = Number(minDistance.toFixed(1));
      const minMinutes = Math.max(15, Math.round((tenant.deliverySettings?.estimatedDeliveryMinMinutes || 25) + distance * 2.5));
      const maxMinutes = minMinutes + 15;

      let computedFee = tenant.deliverySettings?.baseDeliveryFee || 2.50;
      const tiers = tenant.deliverySettings?.deliveryTiers;
      if (Array.isArray(tiers) && tiers.length > 0) {
        const matchingTier = tiers.find(t => distance >= t.minKm && distance <= t.maxKm);
        if (matchingTier) {
          computedFee = matchingTier.price;
        } else {
          const maxTier = tiers.reduce((p, c) => (c.maxKm > p.maxKm ? c : p), tiers[0]);
          if (distance > maxTier.maxKm) computedFee = maxTier.price;
        }
      }

      return {
        ...tenant,
        branches,
        distanceKm: distance,
        deliveryMinutesMin: minMinutes,
        deliveryMinutesMax: maxMinutes,
        isWithinRange,
        computedDeliveryFee: Number(computedFee.toFixed(2))
      };
    });
  });

  readonly filteredTenants = computed(() => {
    let list = this.enrichedTenants();
    const query = this.searchQuery.toLowerCase().trim();
    const cat = this.selectedCategory();

    // Requisito 3: Si el cliente está fuera del radio máximo de cobertura, NO debe aparecer en el listado
    list = list.filter(t => t.isWithinRange);

    if (cat !== 'Todos') {
      list = list.filter(t => t.category.toLowerCase().includes(cat.toLowerCase()));
    }

    if (query) {
      list = list.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query) ||
        t.tagline.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
      );
    }

    return [...list].sort((a, b) => {
      if (this.sortBy === 'nearest') return a.distanceKm - b.distanceKm;
      if (this.sortBy === 'fastest') return a.deliveryMinutesMin - b.deliveryMinutesMin;
      if (this.sortBy === 'rating') return b.rating - a.rating;
      if (this.sortBy === 'fee') return a.computedDeliveryFee - b.computedDeliveryFee;
      return 0;
    });
  });

  ngOnInit(): void {
    try {
      const savedZoneJson = localStorage.getItem('deliveryhub_customer_zone');
      if (savedZoneJson) {
        const savedZone = JSON.parse(savedZoneJson);
        if (savedZone && savedZone.lat && savedZone.lng) {
          this.currentZone.set(savedZone);
        }
      }
    } catch {}

    try {
      const activeOrderJson = localStorage.getItem('deliveryhub_active_order');
      if (activeOrderJson) {
        const orderData = JSON.parse(activeOrderJson);
        if (orderData && orderData.id) {
          this.activeOrder.set(orderData);
        }
      }
    } catch {}

    this.isLoading.set(true);
    this.api.getTenants().subscribe(tenants => {
      this.allTenants.set(tenants || []);
      this.isLoading.set(false);
    });
  }

  selectZone(zone: CustomerLocationZone): void {
    this.currentZone.set(zone);
    this.isLocationDropdownOpen.set(false);
    try {
      localStorage.setItem('deliveryhub_customer_zone', JSON.stringify(zone));
    } catch {}
  }

  detectGpsLocation(): void {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización.');
      return;
    }

    this.isDetectingGps.set(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.isDetectingGps.set(false);
        const userZone: CustomerLocationZone = {
          id: 'gps-custom',
          name: '📍 Mi Ubicación GPS Exacta',
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          isGps: true
        };
        this.currentZone.set(userZone);
        this.isLocationDropdownOpen.set(false);
        try {
          localStorage.setItem('deliveryhub_customer_zone', JSON.stringify(userZone));
        } catch {}
      },
      err => {
        this.isDetectingGps.set(false);
        this.selectZone(this.availableZones[0]);
      },
      { timeout: 8000 }
    );
  }

  encodeWhatsAppText(storeName: string): string {
    return encodeURIComponent(`Hola ${storeName}, deseo consultar su menú de delivery express.`);
  }

  private calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    // Factor de sinuosidad vial urbana (1.28x sobre distancia euclidiana en línea recta)
    // para reflejar el kilometraje real de calles, avenidas y giros (coincidente con Google Maps)
    return (R * c) * 1.28;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
