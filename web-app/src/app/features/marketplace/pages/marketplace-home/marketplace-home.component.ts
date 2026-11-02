import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { Tenant } from '../../../../core/models/tenant.model';
import { Banner } from '../../../../core/models/banner.model';
import { BusinessCategory } from '../../../../core/models/category.model';
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
  isOpenNow: boolean;
  storeStatusLabel: string;
}

export interface MarketplaceCategory {
  id: string;
  name: string;
  icon: string;
  filter: string;
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
  readonly selectedSubcategory = signal<string>('Todos');
  sortBy: 'nearest' | 'fastest' | 'rating' | 'fee' = 'nearest';
  readonly viewMode = signal<'grid' | 'list'>('grid');
  readonly isLoading = signal<boolean>(true);
  readonly activeOrder = signal<{ id: string; orderNumber: string; storeName: string } | null>(null);
  readonly banners = signal<Banner[]>([]);
  readonly businessCategories = signal<BusinessCategory[]>([]);

  // --- NOTIFICACIONES & CUPONES DISPONIBLES PARA CLIENTE ---
  readonly notifications = signal<any[]>([]);
  readonly isNotificationsModalOpen = signal(false);
  readonly copiedCouponCode = signal<string | null>(null);

  readonly categories = signal<MarketplaceCategory[]>([
    { id: 'todos', name: 'Todos', icon: '✨', filter: 'Todos' },
    { id: 'restaurantes', name: 'Restaurantes', icon: '🍽️', filter: 'Restaurantes' },
    { id: 'super', name: 'Súper', icon: '🛒', filter: 'Súper' },
    { id: 'farmacias', name: 'Farmacias', icon: '💊', filter: 'Farmacias' },
    { id: 'mascotas', name: 'Mascotas', icon: '🐾', filter: 'Mascotas' },
    { id: 'licores', name: 'Licores', icon: '🍷', filter: 'Licores' },
    { id: 'postres', name: 'Postres', icon: '🧁', filter: 'Postres' }
  ]);

  readonly currentSubcategories = computed<string[]>(() => {
    const selectedCat = this.selectedCategory();
    if (selectedCat === 'Todos') {
      // Si está en Todos, mostrar subdivisiones destacadas de restaurantes
      const rest = this.businessCategories().find(c => c.name.toLowerCase() === 'restaurantes' || c.slug === 'restaurantes');
      return rest?.subcategories || ['Hamburguesas', 'Sushi & Asiática', 'Pastas & Italiana', 'Pizzas', 'Pollos & Brasas'];
    }
    const found = this.businessCategories().find(c => c.name.toLowerCase() === selectedCat.toLowerCase() || c.slug.toLowerCase() === selectedCat.toLowerCase());
    return found?.subcategories || [];
  });

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

      const status = this.checkStoreBusinessHours(tenant);

      return {
        ...tenant,
        branches,
        distanceKm: distance,
        deliveryMinutesMin: minMinutes,
        deliveryMinutesMax: maxMinutes,
        isWithinRange,
        computedDeliveryFee: Number(computedFee.toFixed(2)),
        isOpenNow: status.isOpen,
        storeStatusLabel: status.label
      };
    });
  });

  readonly featuredTenants = computed(() => {
    return this.enrichedTenants().filter(t => t.isFeatured && t.isWithinRange);
  });

  readonly filteredTenants = computed(() => {
    let list = this.enrichedTenants();
    const query = this.searchQuery.toLowerCase().trim();
    const cat = this.selectedCategory();
    const sub = this.selectedSubcategory();

    // Mostrar comercios en rango de cobertura preferente (si ninguno está en rango exacto, mostrar disponibles para explorar)
    const inRange = list.filter(t => t.isWithinRange);
    if (inRange.length > 0) {
      list = inRange;
    }

    if (cat !== 'Todos') {
      list = list.filter(t => {
        const catLower = (t.category || '').toLowerCase();
        const mainCat = cat.toLowerCase();
        if (catLower === mainCat) return true;
        if (cat === 'Restaurantes') return catLower.includes('hamburguesa') || catLower.includes('pizza') || catLower.includes('sushi') || catLower.includes('tacos') || catLower.includes('restaurante');
        if (cat === 'Súper') return catLower.includes('súper') || catLower.includes('supermercado') || catLower.includes('market') || catLower.includes('bodega');
        if (cat === 'Farmacias') return catLower.includes('farmacia') || catLower.includes('salud');
        if (cat === 'Mascotas') return catLower.includes('mascota') || catLower.includes('pet');
        if (cat === 'Licores') return catLower.includes('licor') || catLower.includes('bebida') || catLower.includes('cerveza');
        if (cat === 'Postres') return catLower.includes('postre') || catLower.includes('dulce') || catLower.includes('café') || catLower.includes('panaderia');
        return catLower.includes(mainCat);
      });
    }

    if (sub !== 'Todos') {
      const subLower = sub.toLowerCase();
      list = list.filter(t => {
        const inSubArray = (t.subcategories || []).some(s => s.toLowerCase().includes(subLower));
        const inCat = (t.category || '').toLowerCase().includes(subLower);
        const inName = (t.name || '').toLowerCase().includes(subLower);
        return inSubArray || inCat || inName;
      });
    }

    if (query) {
      list = list.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query) ||
        (t.subcategories || []).some(s => s.toLowerCase().includes(query)) ||
        t.tagline.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
      );
    }

    return [...list].sort((a, b) => {
      // Comercios abiertos primero
      if (a.isOpenNow !== b.isOpenNow) return a.isOpenNow ? -1 : 1;
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

    this.api.getBanners(true).subscribe(banners => {
      this.banners.set(banners || []);
    });

    this.api.getBusinessCategories().subscribe(cats => {
      if (cats && cats.length > 0) {
        this.businessCategories.set(cats);
        this.categories.set([
          { id: 'todos', name: 'Todos', icon: '✨', filter: 'Todos' },
          ...cats.map(c => ({
            id: c.slug,
            name: c.name,
            icon: c.icon,
            filter: c.name
          }))
        ]);
      }
    });

    this.loadNotifications();
  }

  loadNotifications(): void {
    this.api.getNotifications().subscribe(notifs => {
      this.notifications.set(notifs || []);
    });
  }

  copyCouponCode(code: string): void {
    if (!code) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      this.copiedCouponCode.set(code);
      setTimeout(() => this.copiedCouponCode.set(null), 2500);
    }
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

  checkStoreBusinessHours(tenant: Tenant): { isOpen: boolean; label: string } {
    const hours = tenant.deliverySettings?.businessHours;
    const openStr = hours?.open || '09:00';
    const closeStr = hours?.close || '23:00';

    const [openH, openM] = openStr.split(':').map(Number);
    const [closeH, closeM] = closeStr.split(':').map(Number);

    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const openMin = (openH || 9) * 60 + (openM || 0);
    const closeMin = (closeH || 23) * 60 + (closeM || 0);

    let isOpen = false;
    if (closeMin > openMin) {
      isOpen = currentMin >= openMin && currentMin < closeMin;
    } else {
      // Rango trasnoche (ej: 18:00 a 02:00)
      isOpen = currentMin >= openMin || currentMin < closeMin;
    }

    if (isOpen) {
      return { isOpen: true, label: `Abierto • Cierra a las ${closeStr}` };
    } else {
      return { isOpen: false, label: `Cerrado • Abre a las ${openStr}` };
    }
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
    return (R * c) * 1.28;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
