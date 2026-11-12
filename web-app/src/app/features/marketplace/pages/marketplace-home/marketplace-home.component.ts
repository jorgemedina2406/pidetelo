import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { FavoritesService } from '../../../../core/services/favorites.service';
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
  readonly favorites = inject(FavoritesService);
  private readonly router = inject(Router);

  readonly searchQuery = signal<string>('');
  readonly selectedCategory = signal<string>('Todos');
  readonly selectedSubcategory = signal<string>('Todos');
  readonly sortBy = signal<'nearest' | 'fastest' | 'rating' | 'fee'>('nearest');
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
    { id: 'favoritos', name: 'Favoritos', icon: '❤️', filter: 'Favoritos' },
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

  private getTenantKeywords(tenant: any): string[] {
    const keywords: string[] = [];
    const name = (tenant.name || '').toLowerCase();
    const cat = (tenant.category || '').toLowerCase();
    const sub = (tenant.subcategories || []).map((s: string) => (s || '').toLowerCase());

    if (name.includes('mcdonald') || name.includes('burger') || sub.includes('hamburguesas') || sub.includes('comida rápida')) {
      keywords.push('hamburguesa', 'hamburguesas', 'burger', 'burgers', 'papas', 'papas fritas', 'fries', 'bacon', 'doble', 'queso', 'cheddar', 'refresco', 'combo', 'nuggets', 'alitas', 'ensalada', 'fit', 'carne', 'smash', 'snack', 'postre', 'sundae', 'helado', 'desayuno');
    }
    if (cat.includes('restaurante') || cat.includes('comida')) {
      keywords.push('comida', 'almuerzo', 'cena', 'delivery', 'plato', 'menu', 'orden');
    }
    if (cat.includes('farmacia') || name.includes('farmacia') || name.includes('farma')) {
      keywords.push('farmacia', 'medicinas', 'salud', 'remedios', 'pastillas', 'cuidado', 'bienestar', 'jarabe', 'analgesico');
    }
    if (cat.includes('super') || cat.includes('súper') || name.includes('market') || name.includes('bodega')) {
      keywords.push('supermercado', 'viveres', 'abarrotes', 'mercado', 'comestibles', 'despensa');
    }
    if (cat.includes('licor') || name.includes('licor') || name.includes('bodegon')) {
      keywords.push('licor', 'licores', 'cerveza', 'cervezas', 'ron', 'whisky', 'vino', 'bebidas', 'hielo', 'tragos');
    }
    if (cat.includes('postre') || cat.includes('dulce') || cat.includes('cafe')) {
      keywords.push('postre', 'postres', 'dulces', 'tortas', 'pastel', 'cafe', 'cafeteria', 'helado', 'galletas');
    }
    return keywords;
  }

  readonly liveSearchSuggestions = computed(() => {
    const q = (this.searchQuery() || '').toLowerCase().trim();
    if (!q || q.length < 2) return [];
    return this.filteredTenants().slice(0, 5);
  });

  readonly filteredTenants = computed(() => {
    let list = this.enrichedTenants();
    const query = (this.searchQuery() || '').toLowerCase().trim();
    const cat = this.selectedCategory();
    const sub = this.selectedSubcategory();

    // Si NO hay búsqueda por texto, aplicamos el filtro de cobertura por zona preferente
    if (!query) {
      const inRange = list.filter(t => t.isWithinRange);
      if (inRange.length > 0) {
        list = inRange;
      }
    }

    if (cat === 'Favoritos') {
      list = list.filter(t => this.favorites.isFavorite(t.slug) || this.favorites.isFavorite(t.id));
    } else if (cat !== 'Todos' && !query) {
      list = list.filter(t => {
        const catLower = (t.category || '').toLowerCase();
        const mainCat = cat.toLowerCase();
        if (catLower === mainCat) return true;
        if (cat === 'Restaurantes') return catLower.includes('hamburguesa') || catLower.includes('pizza') || catLower.includes('sushi') || catLower.includes('tacos') || catLower.includes('restaurante') || catLower.includes('comida');
        if (cat === 'Súper' || cat === 'Super') return catLower.includes('súper') || catLower.includes('super') || catLower.includes('supermercado') || catLower.includes('market') || catLower.includes('bodega');
        if (cat === 'Farmacias') return catLower.includes('farmacia') || catLower.includes('salud') || catLower.includes('medic');
        if (cat === 'Mascotas') return catLower.includes('mascota') || catLower.includes('pet');
        if (cat === 'Licores') return catLower.includes('licor') || catLower.includes('bebida') || catLower.includes('cerveza') || catLower.includes('vino');
        if (cat === 'Postres') return catLower.includes('postre') || catLower.includes('dulce') || catLower.includes('café') || catLower.includes('cafe') || catLower.includes('panaderia') || catLower.includes('helado');
        if (cat === 'Juguetes') return catLower.includes('juguet') || catLower.includes('niñ') || catLower.includes('toy');
        return catLower.includes(mainCat);
      });
    }

    if (sub !== 'Todos' && !query) {
      const subLower = sub.toLowerCase();
      list = list.filter(t => {
        const inSubArray = (t.subcategories || []).some(s => (s || '').toLowerCase().includes(subLower));
        const inCat = (t.category || '').toLowerCase().includes(subLower);
        const inName = (t.name || '').toLowerCase().includes(subLower);
        return inSubArray || inCat || inName;
      });
    }

    if (query) {
      const normalizeText = (txt: string) => (txt || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normQuery = normalizeText(query);
      const strippedQuery = normQuery.replace(/[^a-z0-9]/g, '');

      list = list.filter(t => {
        const name = normalizeText(t.name);
        const strippedName = name.replace(/[^a-z0-9]/g, '');
        const category = normalizeText(t.category);
        const tagline = normalizeText(t.tagline);
        const description = normalizeText(t.description);
        const address = normalizeText(t.contact?.address || (t as any).address);
        const inSubcats = (t.subcategories || []).some(s => normalizeText(s).includes(normQuery) || normalizeText(s).replace(/[^a-z0-9]/g, '').includes(strippedQuery));
        const inBranches = (t.branches || []).some((b: any) => {
          const bName = normalizeText(b.name);
          const bAddr = normalizeText(b.address);
          return bName.includes(normQuery) || bName.replace(/[^a-z0-9]/g, '').includes(strippedQuery) || bAddr.includes(normQuery);
        });

        const tenantKeywords = this.getTenantKeywords(t).map(normalizeText);
        const inKeywords = tenantKeywords.some(k => k.includes(normQuery) || normQuery.includes(k));

        return (
          name.includes(normQuery) ||
          (strippedQuery.length > 2 && strippedName.includes(strippedQuery)) ||
          category.includes(normQuery) ||
          inSubcats ||
          inKeywords ||
          tagline.includes(normQuery) ||
          description.includes(normQuery) ||
          address.includes(normQuery) ||
          inBranches
        );
      });
    }

    return [...list].sort((a, b) => {
      // Comercios abiertos primero
      if (a.isOpenNow !== b.isOpenNow) return a.isOpenNow ? -1 : 1;
      const s = this.sortBy();
      if (s === 'nearest') return a.distanceKm - b.distanceKm;
      if (s === 'fastest') return a.deliveryMinutesMin - b.deliveryMinutesMin;
      if (s === 'rating') return b.rating - a.rating;
      if (s === 'fee') return a.computedDeliveryFee - b.computedDeliveryFee;
      return 0;
    });
  });

  executeSearch(): void {
    if (typeof document !== 'undefined') {
      const el = document.getElementById('seccion-comercios');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }


  toggleFavorite(slug: string): void {
    this.favorites.toggleFavorite(slug);
  }

  onBannerClicked(b: Banner): void {
    if (b.couponCode) {
      navigator.clipboard?.writeText(b.couponCode);
      this.copiedCouponCode.set(b.couponCode);
      setTimeout(() => this.copiedCouponCode.set(null), 3000);
    }
    if (b.linkUrl) {
      const clean = b.linkUrl.trim();
      if (clean.startsWith('http')) {
        window.open(clean, '_blank');
      } else if (clean.startsWith('/')) {
        this.router.navigateByUrl(clean);
      } else {
        this.router.navigate(['/t', clean]);
      }
    }
  }

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
      } else {
        const rawRecent = localStorage.getItem('pidetelo_recent_web_orders');
        if (rawRecent) {
          const list = JSON.parse(rawRecent);
          if (Array.isArray(list) && list.length > 0) {
            const latest = list[0];
            const hoursAgo = (Date.now() - new Date(latest.createdAt).getTime()) / (1000 * 60 * 60);
            if (hoursAgo < 24) {
              this.activeOrder.set({
                id: latest.cleanNumber,
                orderNumber: latest.orderNumber,
                storeName: latest.tenantName
              });
            }
          }
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
    const rawBh = (tenant as any).business_hours || (tenant as any).businessHours || tenant.deliverySettings?.businessHours;
    const scheduleDays = rawBh?.scheduleDays || (tenant.branches && (tenant.branches[0] as any)?.business_hours?.scheduleDays);
    const fallbackOpen = rawBh?.open || (tenant as any).open_time || (tenant as any).openTime || '11:00';
    const fallbackClose = rawBh?.close || (tenant as any).close_time || (tenant as any).closeTime || '23:00';

    if (rawBh?.forceOpen === true || rawBh?.force_open === true) {
      return { isOpen: true, label: 'Abierto 24 Horas' };
    }

    if (rawBh?.isOpenToday === false) {
      return { isOpen: false, label: 'Pausado temporalmente' };
    }

    let todayName = 'lunes';
    let curMin = 0;
    try {
      const formatter = new Intl.DateTimeFormat('es-VE', {
        timeZone: 'America/Caracas',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(new Date());
      let hour = 0, minute = 0;
      for (const p of parts) {
        if (p.type === 'weekday') todayName = p.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (p.type === 'hour') hour = parseInt(p.value, 10);
        if (p.type === 'minute') minute = parseInt(p.value, 10);
      }
      curMin = hour * 60 + minute;
    } catch (_) {
      const now = new Date();
      const daysMap = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      todayName = daysMap[now.getDay()];
      curMin = now.getHours() * 60 + now.getMinutes();
    }

    if (Array.isArray(scheduleDays) && scheduleDays.length > 0) {
      const todayConfig = scheduleDays.find((d: any) => {
        if (!d || !d.day) return false;
        const norm = String(d.day).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return norm === todayName;
      });

      if (todayConfig) {
        if (todayConfig.open === false) {
          return { isOpen: false, label: 'Cerrado hoy' };
        }
        const openStr = todayConfig.from || fallbackOpen;
        const closeStr = todayConfig.to || fallbackClose;
        const [openH, openM] = openStr.split(':').map(Number);
        const [closeH, closeM] = closeStr.split(':').map(Number);
        const oMin = (isNaN(openH) ? 11 : openH) * 60 + (isNaN(openM) ? 0 : openM);
        const cMin = (isNaN(closeH) ? 23 : closeH) * 60 + (isNaN(closeM) ? 0 : closeM);

        let isOpen = false;
        if (cMin > oMin) {
          isOpen = curMin >= oMin && curMin < cMin;
        } else {
          isOpen = curMin >= oMin || curMin < cMin;
        }

        return {
          isOpen,
          label: isOpen ? `Abierto • Cierra a las ${closeStr}` : `Cerrado • Abre a las ${openStr}`
        };
      }
    }

    const [openH, openM] = fallbackOpen.split(':').map(Number);
    const [closeH, closeM] = fallbackClose.split(':').map(Number);
    const openMin = (isNaN(openH) ? 11 : openH) * 60 + (isNaN(openM) ? 0 : openM);
    const closeMin = (isNaN(closeH) ? 23 : closeH) * 60 + (isNaN(closeM) ? 0 : closeM);

    let isOpen = false;
    if (closeMin > openMin) {
      isOpen = curMin >= openMin && curMin < closeMin;
    } else {
      isOpen = curMin >= openMin || curMin < closeMin;
    }

    if (isOpen) {
      return { isOpen: true, label: `Abierto • Cierra a las ${fallbackClose}` };
    } else {
      return { isOpen: false, label: `Cerrado • Abre a las ${fallbackOpen}` };
    }
  }

  encodeWhatsAppText(storeName: string): string {
    return encodeURIComponent(`Hola ${storeName}, deseo consultar su menú de delivery express.`);
  }

  getFallbackLogo(name?: string): string {
    const n = (name || '').toLowerCase();
    if (n.includes('mcdonald')) return '/assets/stores/mcdonalds-logo.svg';
    if (n.includes('burger')) return '/assets/stores/burgerking-logo.svg';
    const initial = (name || 'P').trim().charAt(0).toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="#f97316"/><text x="50%" y="54%" font-family="system-ui,sans-serif" font-weight="900" font-size="52" fill="white" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  getFallbackBanner(name?: string): string {
    const n = (name || '').toLowerCase();
    if (n.includes('mcdonald')) return '/assets/stores/mcdonalds-banner.svg';
    if (n.includes('burger')) return '/assets/stores/burgerking-banner.svg';
    return '/assets/delivery_courier.jpg';
  }

  onLogoError(event: Event, name?: string): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.onerror = null;
      target.src = this.getFallbackLogo(name);
    }
  }

  onBannerError(event: Event, name?: string): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.onerror = null;
      target.src = this.getFallbackBanner(name);
    }
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
