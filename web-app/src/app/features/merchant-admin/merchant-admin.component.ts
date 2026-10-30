import { Component, inject, signal, computed, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import * as L from 'leaflet';
import { AuthStore } from '../../core/stores/auth.store';
import { ThemeService } from '../../core/services/theme.service';
import { I18nService } from '../../core/services/i18n.service';
import { Product, ProductModifierGroup, ProductCategory } from '../../core/models/product.model';
import { Order, OrderStatus } from '../../core/models/order.model';
import { AppUser, UserRole } from '../../core/models/user.model';
import { Tenant, CurrencyDisplayMode, DeliveryTier } from '../../core/models/tenant.model';
import { Branch, SubscriptionPlan } from '../../core/models/branch.model';
import { IconComponent } from '../../shared/components/icon.component';
import { CARACAS_DELIVERY_ROUTE } from '../../core/constants/street-route.data';
import { CurrencyService } from '../../core/services/currency.service';
import { ApiService } from '../../core/services/api.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ProductFormModalComponent } from './components/product-form-modal.component';
import { BulkImportModalComponent } from './components/bulk-import-modal.component';
import { BranchFormModalComponent } from './components/branch-form-modal.component';
import { DeleteBranchModalComponent } from './components/delete-branch-modal.component';
import { PlanUpgradeModalComponent } from './components/plan-upgrade-modal.component';
import { OrderRouteModalComponent } from './components/order-route-modal.component';
import { OrderDetailModalComponent } from './components/order-detail-modal.component';
import { RiderFormModalComponent } from './components/rider-form-modal.component';
import { UserFormModalComponent } from './components/user-form-modal.component';

export interface Rider {
  id: string;
  name: string;
  phone: string;
  vehiclePlate: string;
  vehicleType: 'moto' | 'bicicleta' | 'auto';
  status: 'available' | 'delivering' | 'offline';
  currentOrderId?: string;
  currentLocation?: { lat: number; lng: number };
  branchId?: string;
  branchName?: string;
}

@Component({
  selector: 'app-merchant-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IconComponent,
    ProductFormModalComponent,
    BulkImportModalComponent,
    BranchFormModalComponent,
    DeleteBranchModalComponent,
    PlanUpgradeModalComponent,
    OrderRouteModalComponent,
    OrderDetailModalComponent,
    RiderFormModalComponent,
    UserFormModalComponent
  ],
  templateUrl: './merchant-admin.component.html'
})
export class MerchantAdminComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);
  readonly currency = inject(CurrencyService);
  private readonly api = inject(ApiService);
  private readonly supabase = inject(SupabaseService);
  private realtimeChannel: any = null;
  private ordersPollingInterval: any = null;
  private ridersPollingInterval: any = null;

  readonly Math = Math;

  readonly isSidebarExpanded = signal(true);
  readonly isMobileMenuOpen = signal(false);
  readonly productViewMode = signal<'grid' | 'list'>('grid');
  readonly activeTab = signal<'orders' | 'products' | 'branches' | 'riders' | 'gps_map' | 'users' | 'settings'>('orders');

  readonly currentTenant = signal<Tenant>({
    id: this.auth.currentUser()?.tenantId || '',
    slug: '',
    name: this.auth.currentUser()?.tenantName || 'Mi Comercio',
    tagline: '',
    description: '',
    logoUrl: '',
    bannerUrl: '',
    rating: 5.0,
    reviewCount: 0,
    category: 'General',
    isActive: true,
    contact: {
      whatsappNumber: this.auth.currentUser()?.phone || '',
      address: ''
    },
    deliverySettings: {
      hasDelivery: true,
      hasPickup: true,
      baseDeliveryFee: 2.50,
      estimatedDeliveryMinMinutes: 30,
      estimatedDeliveryMaxMinutes: 45,
      minOrderAmount: 5.0,
      currency: 'USD',
      currencySymbol: '$'
    },
    businessHours: {
      open: '11:00',
      close: '23:00',
      isOpenToday: true
    },
    branding: {
      accentColor: '#f97316',
      logoUrl: '',
      bannerUrl: ''
    },
    currencySettings: {
      baseCurrency: 'USD',
      displayMode: 'usd_and_bs',
      exchangeRate: 45.50
    }
  });
  readonly isSavedNotificationVisible = signal(false);
  readonly isFetchingBcv = signal(false);
  readonly bcvLastUpdated = signal<string | null>(null);
  readonly bcvRateSource = signal<'oficial' | 'paralelo'>('oficial');
  readonly bcvApiSuccess = signal(false);

  // --- MULTI-SUCURSAL & SUSCRIPCIONES ---
  readonly branches = signal<Branch[]>([]);

  // Sede de operación activa:
  // - Para una sucursal asignada (ej: encargado o colaborador): es su sucursal fija.
  // - Para la Sede Principal / Dueño: es exclusivamente la Sede Principal.
  // Regla de Negocio: Cada sucursal y la Sede Principal operan única y exclusivamente sobre sus propios
  // productos, motorizados, comandas y colaboradores. La Sede Principal solo puede ver las demás sedes en la
  // pestaña "Mis Sucursales" para crearlas, editarlas, pausarlas o eliminarlas.
  readonly activeBranch = computed<Branch | null>(() => {
    const user = this.auth.currentUser();
    const branches = this.branches();
    if (branches.length === 0) return null;
    if (user?.branchId && user.branchId !== 'all') {
      return branches.find(b => b.id === user.branchId) || null;
    }
    return branches.find(b => b.isMain || b.name?.toLowerCase().includes('principal')) || branches[0] || null;
  });

  readonly activeBranchId = computed<string>(() => this.activeBranch()?.id || '');

  // Compatibilidad con templates y referencias existentes
  readonly selectedBranchId = computed<string>(() => this.activeBranchId());
  readonly selectedBranch = computed<Branch | null>(() => this.activeBranch());
  readonly subscriptionPlans = signal<SubscriptionPlan[]>([]);
  readonly isNewBranchModalOpen = signal(false);
  readonly isEditBranchModalOpen = signal(false);
  readonly editingBranch = signal<Branch | null>(null);
  readonly isUpgradePlanModalOpen = signal(false);
  readonly isDetectingBranchGps = signal(false);
  readonly branchGpsMessage = signal<string | null>(null);
  readonly branchFormErrorMessage = signal<string | null>(null);
  readonly isBranchSavedSuccess = signal(false);
  readonly isDeleteBranchModalOpen = signal(false);
  readonly branchToDelete = signal<Branch | null>(null);
  readonly isDeletingBranch = signal(false);
  readonly deleteBranchErrorMessage = signal<string | null>(null);

  readonly currentSubscriptionPlan = computed<SubscriptionPlan>(() => {
    const plans = this.subscriptionPlans();
    const planId = (this.currentTenant() as any)?.subscriptionPlanId || 'COMERCIO';
    return plans.find(p => p.id === planId) || {
      id: 'COMERCIO',
      name: 'Plan Comercio',
      maxBranches: 3,
      monthlyPriceUsd: 59.00,
      description: 'Para cadenas locales en expansión con hasta 3 sucursales operativas.',
      features: ['Hasta 3 Sedes operativas', '0% Comisiones por venta', 'Cuentas bancarias independientes por sede']
    };
  });

  // --- REGLAS DE NEGOCIO: SEDE PRINCIPAL VS SUCURSALES SECUNDARIAS ---
  // La Sede Principal lleva el conteo global y es la única que puede crear sucursales.
  // Una sucursal secundaria tiene credenciales propias y NO puede crear sucursales.
  readonly isMainBranchOrOwner = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    if (user.role === 'MERCHANT_OWNER') {
      if (!user.branchId || user.branchId === 'all') return true;
      const branch = this.branches().find(b => b.id === user.branchId);
      return !branch || Boolean(branch.isMain) || branch.name.toLowerCase().includes('principal');
    }
    return false;
  });

  readonly isBranchLocked = computed(() => !this.isMainBranchOrOwner());

  readonly userAssignedBranch = computed(() => {
    const user = this.auth.currentUser();
    if (!user?.branchId || user.branchId === 'all') return null;
    return this.branches().find(b => b.id === user.branchId) || null;
  });

  readonly visibleBranches = computed(() => {
    if (this.isBranchLocked() && this.auth.currentUser()?.branchId) {
      const bId = this.auth.currentUser()!.branchId;
      return this.branches().filter(b => b.id === bId);
    }
    return this.branches();
  });

  readonly activeBranchesCount = computed(() => this.branches().filter(b => b.status === 'active').length);
  readonly pendingBranchesCount = computed(() => this.branches().filter(b => b.status === 'pending_approval').length);
  readonly canCreateBranch = computed(() => {
    // Solo la sede principal o dueño del comercio puede crear sucursales
    if (!this.isMainBranchOrOwner()) return false;
    const plan = this.currentSubscriptionPlan();
    return this.activeBranchesCount() < plan.maxBranches;
  });
  readonly activeExchangeRate = computed(() => this.currentTenant()?.currencySettings?.exchangeRate || this.brandingForm.exchangeRate || 45.50);



  readonly colorPresets = [
    { name: 'Naranja Burger', hex: '#f97316' },
    { name: 'Carmesí Gourmet', hex: '#e11d48' },
    { name: 'Verde Esmeralda', hex: '#10b981' },
    { name: 'Índigo Moderno', hex: '#6366f1' },
    { name: 'Ámbar Dorado', hex: '#f59e0b' },
    { name: 'Carbón Pizarra', hex: '#334155' }
  ];

  brandingForm = {
    name: this.auth.currentUser()?.tenantName || '',
    tagline: '',
    accentColor: '#f97316',
    logoUrl: '',
    bannerUrl: '',
    whatsappNumber: this.auth.currentUser()?.phone || '',
    phone: '',
    address: '',
    latitude: 10.038500,
    longitude: -69.248200,
    baseDeliveryFee: 2.50,
    deliveryRadiusKm: 8.0,
    deliveryTiers: [
      { id: 'tier_1', minKm: 0, maxKm: 2, price: 1.50 },
      { id: 'tier_2', minKm: 2, maxKm: 5, price: 3.00 },
      { id: 'tier_3', minKm: 5, maxKm: 8, price: 4.50 }
    ] as DeliveryTier[],
    baseCurrency: 'USD' as 'USD' | 'VES',
    displayMode: 'usd_and_bs' as CurrencyDisplayMode,
    exchangeRate: 45.50
  };

  addDeliveryTier(): void {
    const tiers = this.brandingForm.deliveryTiers;
    const lastTier = tiers.length > 0 ? tiers[tiers.length - 1] : null;
    const nextMin = lastTier ? Number(lastTier.maxKm) : 0;
    const nextMax = nextMin + 3;
    const nextPrice = lastTier ? Number((lastTier.price + 1.50).toFixed(2)) : 2.50;
    const newTier: DeliveryTier = {
      id: 'tier_' + Date.now(),
      minKm: nextMin,
      maxKm: nextMax,
      price: nextPrice
    };
    this.brandingForm.deliveryTiers = [...tiers, newTier];
    if (this.brandingForm.deliveryRadiusKm < nextMax) {
      this.brandingForm.deliveryRadiusKm = nextMax;
    }
  }

  removeDeliveryTier(index: number): void {
    if (this.brandingForm.deliveryTiers.length <= 1) {
      alert('Debes mantener al menos un rango de tarifa de delivery.');
      return;
    }
    const updated = [...this.brandingForm.deliveryTiers];
    updated.splice(index, 1);
    this.brandingForm.deliveryTiers = updated;
  }

  readonly isDetectingStoreGps = signal(false);
  readonly storeGpsMessage = signal<string | null>(null);
  readonly isSavingBranding = signal(false);
  readonly showLogoUrlInput = signal(false);
  readonly showBannerUrlInput = signal(false);

  onImageFileSelected(event: Event, type: 'logo' | 'banner'): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (PNG, JPG o WEBP).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert('La imagen seleccionada supera los 8MB. Por favor elige una imagen más ligera.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          if (type === 'logo') this.brandingForm.logoUrl = dataUrl;
          else this.brandingForm.bannerUrl = dataUrl;
          return;
        }

        if (type === 'logo') {
          // Logo recomendado: cuadrado 500x500 máx
          const maxDim = 500;
          let w = img.width;
          let h = img.height;
          if (w > h) {
            if (w > maxDim) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            }
          } else {
            if (h > maxDim) {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          const optimized = canvas.toDataURL('image/webp', 0.92);
          this.brandingForm.logoUrl = optimized;
        } else {
          // Portada recomendada: panorámica 1400x550 máx
          const maxWidth = 1400;
          const maxHeight = 600;
          let w = img.width;
          let h = img.height;
          if (w > maxWidth) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
          }
          if (h > maxHeight) {
            w = Math.round((w * maxHeight) / h);
            h = maxHeight;
          }
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          const optimized = canvas.toDataURL('image/webp', 0.88);
          this.brandingForm.bannerUrl = optimized;
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  captureStoreGps(): void {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      this.isDetectingStoreGps.set(true);
      this.storeGpsMessage.set('Detectando satélites GPS del local...');
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          this.brandingForm.latitude = Number(pos.coords.latitude.toFixed(6));
          this.brandingForm.longitude = Number(pos.coords.longitude.toFixed(6));
          this.isDetectingStoreGps.set(false);
          this.storeGpsMessage.set(`✓ Coordenadas satelitales fijadas: ${this.brandingForm.latitude}, ${this.brandingForm.longitude}`);

          // Geocodificación inversa automática si la dirección está vacía o corta
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${this.brandingForm.latitude}&lon=${this.brandingForm.longitude}`);
            if (res.ok) {
              const data = await res.json();
              if (data && data.display_name && (!this.brandingForm.address || this.brandingForm.address.trim().length < 5)) {
                this.brandingForm.address = data.display_name;
              }
            }
          } catch {}

          setTimeout(() => this.storeGpsMessage.set(null), 5000);
        },
        () => {
          this.isDetectingStoreGps.set(false);
          this.storeGpsMessage.set('No se pudo obtener el GPS. Puedes ingresar latitud y longitud manualmente.');
        },
        { enableHighAccuracy: true, timeout: 12000 }
      );
    }
  }

  readonly orders = signal<Order[]>([]);
  readonly products = signal<Product[]>([]);


  readonly riders = signal<Rider[]>([]);

  readonly storeUsers = signal<AppUser[]>([]);

  // Modal y gestión de Colaboradores & Encargados de Sucursal
  readonly isUserModalOpen = signal(false);
  readonly isEditingUser = signal(false);
  readonly isSavingUser = signal(false);
  readonly userFilterRole = signal<string>('all');
  readonly userFormError = signal<string | null>(null);

  // Modal de Advertencia / Conflicto por Correo Ya Existente
  readonly conflictModalData = signal<{
    title: string;
    message: string;
    email: string;
  } | null>(null);

  userForm: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: UserRole;
    branchId: string;
    password?: string;
  } = {
    id: '',
    name: '',
    email: '',
    phone: '',
    role: 'MERCHANT_MANAGER',
    branchId: 'all',
    password: ''
  };

  // Colaboradores filtrados estrictamente por Sucursal Activa y Rol
  readonly filteredStoreUsers = computed(() => {
    const branchId = this.activeBranchId();
    const roleFilter = this.userFilterRole();
    if (!branchId) return [];

    return this.storeUsers().filter(u => {
      if (u.branchId !== branchId) return false;
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      return true;
    });
  });

  // Comandas y listas estrictamente filtradas por la Sucursal Activa
  readonly filteredOrders = computed(() => {
    const branchId = this.activeBranchId();
    if (!branchId) return [];
    const isMain = Boolean(this.activeBranch()?.isMain || this.activeBranch()?.name?.toLowerCase().includes('principal'));
    return this.orders().filter(o => {
      if (o.branchId === branchId) return true;
      if (isMain && !o.branchId) return true;
      return false;
    });
  });

  // Sub-pestaña en Comandas: 'kanban' (activas) vs 'history' (completadas/canceladas)
  readonly ordersSubTab = signal<'kanban' | 'history'>('kanban');
  readonly historySearchQuery = signal<string>('');
  readonly historyStatusFilter = signal<'all' | 'delivered' | 'cancelled'>('all');

  readonly receivedOrders = computed(() => this.filteredOrders().filter(o => o.status === 'received'));
  readonly kitchenOrders = computed(() => this.filteredOrders().filter(o => ['in_kitchen', 'assigned_driver', 'at_merchant', 'picked_up'].includes(o.status)));
  readonly transitOrders = computed(() => this.filteredOrders().filter(o => o.status === 'on_the_way'));

  // Pedidos Completados (delivered / cancelled) para el Historial
  readonly completedOrders = computed(() => {
    const q = this.historySearchQuery().toLowerCase().trim();
    const statusFilter = this.historyStatusFilter();
    return this.filteredOrders().filter(o => {
      const isDone = o.status === 'delivered' || o.status === 'cancelled';
      if (!isDone) return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        (o.customer?.name && o.customer.name.toLowerCase().includes(q)) ||
        (o.customer?.phone && o.customer.phone.includes(q)) ||
        (o.driverName && o.driverName.toLowerCase().includes(q)) ||
        (o.branchName && o.branchName.toLowerCase().includes(q))
      );
    });
  });

  readonly completedRevenueUsd = computed(() => {
    return this.filteredOrders()
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.total || 0), 0);
  });

  readonly completedRevenueBs = computed(() => {
    return this.completedRevenueUsd() * this.activeExchangeRate();
  });

  readonly deliveredCount = computed(() => this.filteredOrders().filter(o => o.status === 'delivered').length);
  readonly cancelledCount = computed(() => this.filteredOrders().filter(o => o.status === 'cancelled').length);

  // Modal de Detalle Completo de Pedido
  readonly selectedOrderDetail = signal<Order | null>(null);
  readonly isOrderDetailModalOpen = signal(false);

  // Modal de Ruta del Pedido en Vivo
  readonly selectedRouteOrder = signal<Order | null>(null);
  readonly isOrderRouteModalOpen = signal(false);
  private orderRouteMap?: L.Map;

  // Vista de Sucursales: 'grid' (tarjetas) vs 'map' (cobertura geográfica)
  readonly branchesViewMode = signal<'grid' | 'map'>('grid');
  private branchesMap?: L.Map;

  // Radar GPS de Flota de Motorizados
  private fleetRadarMap?: L.Map;
  private fleetRiderMarkers = new Map<string, L.Marker>();
  readonly selectedRadarRider = signal<Rider | null>(null);
  readonly radarFilter = signal<'all' | 'available' | 'delivering' | 'offline'>('all');

  // Categorías de productos del menú / comercio
  readonly productCategories = signal<ProductCategory[]>([]);
  readonly selectedCategoryFilter = signal<string>('all');
  readonly isCreatingCategoryInline = signal<boolean>(false);
  newCategoryName = '';
  readonly isSavingCategory = signal<boolean>(false);

  readonly activeSelectedBranch = computed(() => {
    const id = this.selectedBranchId();
    if (id === 'all') return null;
    return this.branches().find(b => b.id === id) || null;
  });

  readonly isSelectedBranchMain = computed(() => {
    const b = this.activeSelectedBranch();
    if (!b) return false;
    return b.name?.toLowerCase().includes('principal') || false;
  });

  readonly isCopyingFromMain = signal<boolean>(false);
  readonly copyFromMainSuccessMessage = signal<string | null>(null);
  readonly copyFromMainErrorMessage = signal<string | null>(null);

  readonly filteredProducts = computed(() => {
    const branchId = this.activeBranchId();
    const catFilter = this.selectedCategoryFilter();
    if (!branchId) return [];

    let all = this.products().filter(p => p.branchId === branchId);

    if (catFilter !== 'all') {
      all = all.filter(p => p.categoryId === catFilter);
    }
    return all;
  });

  readonly filteredRiders = computed(() => {
    const branchId = this.activeBranchId();
    if (!branchId) return [];
    const isMain = this.isSelectedBranchMain();
    return this.riders().filter(r => r.branchId === branchId || (isMain && !r.branchId));
  });
  readonly availableRiders = computed(() => this.filteredRiders());

  getRidersForOrder(order: Order): Rider[] {
    const branchId = this.activeBranchId();
    if (!branchId) return [];
    const isMain = this.isSelectedBranchMain();
    return this.riders().filter(r => r.branchId === branchId || (isMain && !r.branchId));
  }

  selectBranch(branchId: string): void {
    const branch = this.branches().find(b => b.id === branchId);
    if (branch) {
      this.brandingForm.latitude = branch.latitude;
      this.brandingForm.longitude = branch.longitude;
      if (this.branchesMap) {
        this.branchesMap.flyTo([branch.latitude, branch.longitude], 14);
      }
    }
  }

  // Alerta sonora y visual de rechazo de pedido
  readonly rejectedAlert = signal<{ orderNumber: string; message: string } | null>(null);

  // GPS & Leaflet Map State (Legacy / Telemetry)
  private riderMarker?: L.Marker;
  private routeLine?: L.Polyline;
  private gpsInterval: any = null;

  readonly gpsProgress = signal(0);
  readonly selectedTrackingOrder = signal<Order | null>(null);
  readonly riderSpeed = signal(38);
  readonly riderBattery = signal(92);
  readonly riderEta = signal(8);
  readonly riderDistanceKm = signal(1.4);
  readonly isAutoTracking = signal(true);

  // Real street route fallback
  private readonly waypoints: [number, number][] = CARACAS_DELIVERY_ROUTE;

  // Modals & Product Management
  readonly isProductModalOpen = signal(false);
  readonly isRiderModalOpen = signal(false);

  // --- IMPORTACIÓN MASIVA EXCEL / CSV ---
  readonly isBulkImportModalOpen = signal(false);

  currentEditingProduct: Product = {
    id: '',
    tenantId: '',
    categoryId: '',
    name: '',
    description: '',
    price: 0,
    currency: 'USD',
    sku: '',
    barcode: '',
    imageUrl: '',
    isAvailable: true,
    modifierGroups: []
  };

  openNewRiderModal(): void {
    this.isRiderModalOpen.set(true);
  }

  constructor() {
    effect(() => {
      const tab = this.activeTab();
      if (tab === 'gps_map') {
        setTimeout(() => this.initFleetRadarMap(), 150);
      } else {
        if (this.fleetRadarMap) {
          try {
            this.fleetRadarMap.remove();
          } catch (_) {}
          this.fleetRadarMap = undefined;
          this.fleetRiderMarkers.clear();
        }
      }

      if (tab === 'branches' && this.branchesViewMode() === 'map') {
        setTimeout(() => this.initBranchesMap(), 150);
      } else if (tab !== 'branches') {
        if (this.branchesMap) {
          try {
            this.branchesMap.remove();
          } catch (_) {}
          this.branchesMap = undefined;
        }
      }
    });

    effect(() => {
      if (this.activeTab() === 'branches' && this.branchesViewMode() === 'map') {
        setTimeout(() => this.initBranchesMap(), 150);
      }
    });
  }

  ngOnInit(): void {
    const user = this.auth.currentUser();
    const activeTenantId = user?.tenantId;

    if (user?.tenantName) {
      this.brandingForm.name = user.tenantName;
      this.currentTenant.update(t => ({ ...t, name: user.tenantName! }));
    }

    if (activeTenantId) {
      // 0. Intentar precargar caché local inmediato de marca y moneda
      try {
        const cached = localStorage.getItem('deliveryhub_branding_' + activeTenantId);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.name) this.brandingForm.name = parsed.name;
          if (parsed.tagline) this.brandingForm.tagline = parsed.tagline;
          if (parsed.accentColor) this.brandingForm.accentColor = parsed.accentColor;
          if (parsed.logoUrl) this.brandingForm.logoUrl = parsed.logoUrl;
          if (parsed.bannerUrl) this.brandingForm.bannerUrl = parsed.bannerUrl;
          if (parsed.whatsappNumber) this.brandingForm.whatsappNumber = parsed.whatsappNumber;
          if (parsed.phone) this.brandingForm.phone = parsed.phone;
          if (parsed.address) this.brandingForm.address = parsed.address;
          if (parsed.exchangeRate) this.brandingForm.exchangeRate = parsed.exchangeRate;
          if (parsed.baseCurrency) this.brandingForm.baseCurrency = parsed.baseCurrency;
          if (parsed.displayMode) this.brandingForm.displayMode = parsed.displayMode;
          if (Array.isArray(parsed.deliveryTiers) && parsed.deliveryTiers.length > 0) {
            this.brandingForm.deliveryTiers = parsed.deliveryTiers;
          }
          if (parsed.deliveryRadiusKm) this.brandingForm.deliveryRadiusKm = Number(parsed.deliveryRadiusKm);
          if (parsed.baseDeliveryFee) this.brandingForm.baseDeliveryFee = Number(parsed.baseDeliveryFee);
        }
      } catch (_) {}

      // 1. Cargar datos del comercio real
      this.api.getTenantBySlug(activeTenantId).subscribe(tenant => {
        if (tenant) {
          this.currentTenant.set(tenant);
          this.brandingForm.name = tenant.name;
          this.brandingForm.tagline = tenant.tagline || '';
          this.brandingForm.accentColor = tenant.branding?.accentColor || '#f97316';
          this.brandingForm.logoUrl = tenant.branding?.logoUrl || '';
          this.brandingForm.bannerUrl = tenant.branding?.bannerUrl || '';
          this.brandingForm.whatsappNumber = tenant.contact?.whatsappNumber || '';
          this.brandingForm.phone = tenant.contact?.phone || '';
          this.brandingForm.address = tenant.contact?.address || '';
          if ((tenant as any).latitude) {
            this.brandingForm.latitude = Number((tenant as any).latitude);
          } else if (tenant.contact?.coordinates?.lat) {
            this.brandingForm.latitude = Number(tenant.contact.coordinates.lat);
          }
          if ((tenant as any).longitude) {
            this.brandingForm.longitude = Number((tenant as any).longitude);
          } else if (tenant.contact?.coordinates?.lng) {
            this.brandingForm.longitude = Number(tenant.contact.coordinates.lng);
          }
          if (tenant.deliverySettings?.deliveryRadiusKm) {
            this.brandingForm.deliveryRadiusKm = tenant.deliverySettings.deliveryRadiusKm;
          }
          this.brandingForm.baseDeliveryFee = tenant.deliverySettings?.baseDeliveryFee ?? 2.50;
          const tiers = tenant.deliverySettings?.deliveryTiers || (tenant as any).delivery_tiers;
          if (Array.isArray(tiers) && tiers.length > 0) {
            this.brandingForm.deliveryTiers = tiers;
          }
          const curr = tenant.currencySettings || (tenant as any).currency_settings;
          if (curr?.exchangeRate || (tenant as any).exchange_rate) {
            this.brandingForm.exchangeRate = Number(curr?.exchangeRate ?? (tenant as any).exchange_rate);
          }
          if (curr?.baseCurrency || (tenant as any).base_currency) {
            this.brandingForm.baseCurrency = curr?.baseCurrency ?? (tenant as any).base_currency;
          }
          if (curr?.displayMode || (tenant as any).display_mode) {
            this.brandingForm.displayMode = curr?.displayMode ?? (tenant as any).display_mode;
          }
        }
      });

      // 2. Cargar categorías de productos del comercio
      this.loadCategories(activeTenantId);

      // 3. Cargar sucursales reales (esto fija la sede activa y dispara la carga aislada de pedidos, productos, motorizados y colaboradores)
      this.loadBranches(activeTenantId);
      this.api.getSubscriptionPlans().subscribe(plans => {
        if (plans && plans.length > 0) {
          this.subscriptionPlans.set(plans);
        }
      });
    }

    // 7. Suscripción en Tiempo Real con Supabase WebSockets + Auto-polling continuo
    const triggerRejectionAlert = (orderNumber: string, riderName?: string) => {
      this.rejectedAlert.set({
        orderNumber: orderNumber,
        message: `El repartidor ${riderName ? riderName + ' ' : ''}rechazó la asignación de ${orderNumber}. Reasigna otro repartidor disponible.`
      });
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(320, audioCtx.currentTime);
        osc.frequency.setValueAtTime(240, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.45);
      } catch (_) {}
    };

    const reloadOrders = () => {
      if (!activeTenantId) return;
      const bFilter = this.activeBranchId();
      if (!bFilter) return;
      this.api.getOrders(activeTenantId, undefined, bFilter).subscribe(orders => {
        const isMain = Boolean(this.activeBranch()?.isMain || this.activeBranch()?.name?.toLowerCase().includes('principal'));
        const orderList = (orders || []).filter(o => {
          if (o.branchId === bFilter) return true;
          if (isMain && !o.branchId) return true;
          return false;
        });
        const currentCount = this.orders().length;

        if (orderList.length > currentCount && currentCount > 0) {
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.35);
          } catch (_) {}
        }
        this.orders.set(orderList);
        const currentRouteOrd = this.selectedRouteOrder();
        if (currentRouteOrd) {
          const refreshed = orderList.find(o => o.id === currentRouteOrd.id);
          if (refreshed) {
            this.selectedRouteOrder.set(refreshed);
          }
        }
      });
    };

    if (activeTenantId) {
      this.realtimeChannel = this.supabase.subscribeToOrders(activeTenantId, (payload) => {
        console.log('[MerchantAdmin] Realtime event from Supabase:', payload);
        if (payload && payload.eventType === 'REJECTED_BY_RIDER' && payload.order) {
          triggerRejectionAlert(payload.order.orderNumber || payload.order.id, payload.order.riderName);
        }
        reloadOrders();
      });
    }

    // Polling de respaldo para órdenes y ubicación en vivo de motorizados (Supabase Realtime notifica al instante)
    this.ordersPollingInterval = setInterval(() => {
      reloadOrders();
    }, 5000);

    // Carga inicial, Realtime y polling de respaldo cada 4 segundos para telemetría GPS de motorizados
    this.refreshRidersLocation();
    this.supabase.subscribeToRiders(() => {
      this.refreshRidersLocation();
    });
    this.ridersPollingInterval = setInterval(() => {
      this.refreshRidersLocation();
    }, 4000);

    // Preload live exchange rate from DolarApi
    this.currency.fetchDolarApiRate('oficial').then(data => {
      if (data && typeof data.promedio === 'number' && data.promedio > 0) {
        this.brandingForm.exchangeRate = Number(data.promedio.toFixed(2));
        this.bcvLastUpdated.set(data.fechaActualizacion);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.ordersPollingInterval) {
      clearInterval(this.ordersPollingInterval);
    }
    if (this.ridersPollingInterval) {
      clearInterval(this.ridersPollingInterval);
    }
    if (this.gpsInterval) {
      clearInterval(this.gpsInterval);
    }
    if (this.realtimeChannel && typeof this.realtimeChannel.unsubscribe === 'function') {
      this.realtimeChannel.unsubscribe();
    }
    if (this.fleetRadarMap) {
      this.fleetRadarMap.remove();
      this.fleetRadarMap = undefined;
    }
    if (this.branchesMap) {
      this.branchesMap.remove();
      this.branchesMap = undefined;
    }
    if (this.orderRouteMap) {
      this.orderRouteMap.remove();
      this.orderRouteMap = undefined;
    }
  }

  // --- GESTIÓN DE COLABORADORES & ENCARGADOS DE SUCURSAL ---
  loadStoreUsers(): void {
    const userTenant = this.auth.currentUser()?.tenantId;
    const activeTenantId = (userTenant && userTenant !== 'tenant-1') ? userTenant : 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const bFilter = this.activeBranchId() || undefined;
    this.api.getStoreUsers(activeTenantId, bFilter).subscribe(users => {
      if (users && users.length > 0) {
        this.storeUsers.set(users);
      }
    });
  }

  openCreateUserModal(): void {
    const defaultBranch = this.activeBranchId();
    this.userForm = {
      id: '',
      name: '',
      email: '',
      phone: '',
      role: 'MERCHANT_MANAGER',
      branchId: defaultBranch,
      password: ''
    };
    this.userFormError.set(null);
    this.isEditingUser.set(false);
    this.isUserModalOpen.set(true);
  }

  openEditUserModal(user: AppUser): void {
    this.userForm = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      branchId: user.branchId || 'all',
      password: ''
    };
    this.userFormError.set(null);
    this.isEditingUser.set(true);
    this.isUserModalOpen.set(true);
  }

  closeUserModal(): void {
    this.isUserModalOpen.set(false);
    this.isSavingUser.set(false);
    this.userFormError.set(null);
  }

  closeConflictModal(): void {
    this.conflictModalData.set(null);
  }

  saveStoreUser(): void {
    this.userFormError.set(null);

    const name = this.userForm.name?.trim();
    const email = this.userForm.email?.trim().toLowerCase();

    if (!name || !email) {
      this.userFormError.set('Por favor completa los campos obligatorios (Nombre y Correo Electrónico).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.userFormError.set('El formato del correo electrónico no es válido.');
      return;
    }

    const userTenant = this.auth.currentUser()?.tenantId;
    const activeTenantId = (userTenant && userTenant !== 'tenant-1') ? userTenant : 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const targetBranch = this.activeBranch();
    const branchId = targetBranch?.id || this.userForm.branchId;
    const branchName = targetBranch?.name || 'Sede Principal';

    this.isSavingUser.set(true);

    if (this.isEditingUser()) {
      this.api.updateStoreUser(activeTenantId, this.userForm.id, {
        name: this.userForm.name,
        phone: this.userForm.phone,
        role: this.userForm.role,
        branchId: branchId,
        branchName: branchName
      }).subscribe({
        next: (updated) => {
          this.storeUsers.update(list => list.map(u => u.id === updated.id ? updated : u));
          this.closeUserModal();
        },
        error: (err) => {
          this.isSavingUser.set(false);
          const errorMsg = err?.error?.message || err.message || 'Error al actualizar colaborador.';
          const isConflict = err?.status === 409 || errorMsg.toLowerCase().includes('ya se encuentra registrado') || errorMsg.toLowerCase().includes('ya está registrado');

          if (isConflict) {
            this.conflictModalData.set({
              title: 'Correo Ya Registrado en la Plataforma',
              message: errorMsg,
              email: this.userForm.email
            });
          }
          this.userFormError.set(errorMsg);
        }
      });
    } else {
      this.api.createStoreUser(activeTenantId, {
        name: this.userForm.name,
        email: email,
        phone: this.userForm.phone,
        role: this.userForm.role,
        branchId: branchId,
        branchName: branchName,
        password: this.userForm.password
      }).subscribe({
        next: (created) => {
          this.storeUsers.update(list => [...list, created]);
          this.closeUserModal();
        },
        error: (err) => {
          this.isSavingUser.set(false);
          const errorMsg = err?.error?.message || err.message || 'Error al registrar colaborador.';
          const isConflict = err?.status === 409 || errorMsg.toLowerCase().includes('ya se encuentra registrado') || errorMsg.toLowerCase().includes('ya está registrado') || errorMsg.toLowerCase().includes('pertenece a');

          if (isConflict) {
            this.conflictModalData.set({
              title: 'Correo Ya Registrado en la Plataforma',
              message: errorMsg,
              email: this.userForm.email
            });
          }
          this.userFormError.set(errorMsg);
        }
      });
    }
  }

  toggleStoreUserStatus(user: AppUser): void {
    const userTenant = this.auth.currentUser()?.tenantId;
    const activeTenantId = (userTenant && userTenant !== 'tenant-1') ? userTenant : 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const newStatus = !user.isActive;
    this.api.updateStoreUser(activeTenantId, user.id, { isActive: newStatus }).subscribe({
      next: (updated) => {
        this.storeUsers.update(list => list.map(u => u.id === updated.id ? updated : u));
      }
    });
  }

  deleteStoreUser(user: AppUser): void {
    if (!confirm(`¿Estás seguro de eliminar al colaborador ${user.name}?`)) return;
    const userTenant = this.auth.currentUser()?.tenantId;
    const activeTenantId = (userTenant && userTenant !== 'tenant-1') ? userTenant : 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    this.api.deleteStoreUser(activeTenantId, user.id).subscribe({
      next: () => {
        this.storeUsers.update(list => list.filter(u => u.id !== user.id));
      },
      error: (err) => {
        this.conflictModalData.set({
          title: 'Error al Eliminar',
          message: err?.error?.message || err.message || 'No se pudo eliminar al colaborador.',
          email: user.email
        });
      }
    });
  }

  // --- REFRESH TELEMETRÍA EN VIVO DE MOTORIZADOS DESDE BASE DE DATOS Y GPS REAL ---
  refreshRidersLocation(): void {
    const targetBranch = this.activeBranch();
    const activeTenantId = this.auth.currentUser()?.tenantId || this.currentTenant()?.id || targetBranch?.companyId || 'dac59429-fd6f-4d3e-8b2e-ab0e23828c1f';
    if (!activeTenantId) {
      this.riders.set([]);
      return;
    }
    const branchFilter = this.activeBranchId();
    if (!branchFilter) {
      // Si la sede activa aún no está resuelta en memoria, no consultar para evitar traer datos globales
      return;
    }

    this.api.getRiders(activeTenantId, branchFilter).subscribe(riders => {
      if (riders && riders.length > 0) {
        const isMain = this.isSelectedBranchMain();
        // Aislamiento: conservar los motorizados que pertenezcan a la sede activa (o a la principal si no tienen sede asignada)
        const branchRiders = riders.filter(r => {
          const rBId = r.branch_id || (r as any).branchId;
          return rBId === branchFilter || (isMain && !rBId);
        });

        this.riders.set(branchRiders.map((r) => {
          const rawLat = (r.current_lat !== undefined && r.current_lat !== null) ? Number(r.current_lat) : undefined;
          const rawLng = (r.current_lng !== undefined && r.current_lng !== null) ? Number(r.current_lng) : undefined;

          const isValid = typeof rawLat === 'number' && !isNaN(rawLat) && typeof rawLng === 'number' && !isNaN(rawLng);
          const isCaracas = isValid && rawLat > 10.45 && rawLat < 10.53 && rawLng > -66.95 && rawLng < -66.80;

          let currentLocation: { lat: number; lng: number } | undefined = undefined;
          if (isValid && !isCaracas) {
            currentLocation = { lat: Number(rawLat.toFixed(6)), lng: Number(rawLng.toFixed(6)) };
          }

          const resolvedRiderBranchId = r.branch_id || (r as any).branchId || branchFilter;
          const branch = this.branches().find(b => b.id === resolvedRiderBranchId);

          return {
            id: r.id,
            name: r.name,
            phone: r.phone,
            vehiclePlate: r.vehicle_plate || (r as any).vehiclePlate || 'AC-8891-X',
            vehicleType: (r.vehicle_type as any) || (r as any).vehicleType || 'moto',
            status: (r.status as any) || 'available',
            branchId: resolvedRiderBranchId,
            branchName: branch?.name || r.branch_name || 'Sede Asignada',
            currentLocation
          };
        }));

        if (this.activeTab() === 'gps_map' && this.fleetRadarMap) {
          this.updateFleetRiderMarkers();
        }
      } else {
        this.riders.set([]);
        if (this.activeTab() === 'gps_map' && this.fleetRadarMap) {
          this.updateFleetRiderMarkers();
        }
      }
    });
  }

  // --- RADAR GPS EN VIVO (FLOTA DE MOTORIZADOS) ---
  initFleetRadarMap(retryCount = 0): void {
    const container = document.getElementById('merchant-leaflet-map');
    if (!container) {
      if (retryCount < 5 && this.activeTab() === 'gps_map') {
        setTimeout(() => this.initFleetRadarMap(retryCount + 1), 100);
      }
      return;
    }

    if (this.fleetRadarMap) {
      try {
        this.fleetRadarMap.remove();
      } catch (_) {}
      this.fleetRadarMap = undefined;
      this.fleetRiderMarkers.clear();
    }

    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    const defaultLat = this.brandingForm.latitude || 10.0385;
    const defaultLng = this.brandingForm.longitude || -69.2482;

    this.fleetRadarMap = L.map(container, {
      zoomControl: true,
      attributionControl: false
    }).setView([defaultLat, defaultLng], 14);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.fleetRadarMap);

    this.updateFleetRiderMarkers();
    setTimeout(() => this.fleetRadarMap?.invalidateSize(), 100);
    setTimeout(() => this.fleetRadarMap?.invalidateSize(), 300);
  }

  updateFleetRiderMarkers(): void {
    if (!this.fleetRadarMap) return;

    // Limpiar marcadores existentes
    this.fleetRiderMarkers.forEach(m => m.remove());
    this.fleetRiderMarkers.clear();

    const riders = this.filteredRiders();
    const filter = this.radarFilter();
    const visibleRiders = filter === 'all' ? riders : riders.filter(r => r.status === filter);

    const bounds: [number, number][] = [];
    const branch = this.selectedBranch();
    const baseLat = branch?.latitude || this.brandingForm.latitude || 10.0385;
    const baseLng = branch?.longitude || this.brandingForm.longitude || -69.2482;

    visibleRiders.forEach((r) => {
      const lat = r.currentLocation?.lat;
      const lng = r.currentLocation?.lng;

      // Solo pintamos el marcador si el motorizado ha reportado su GPS real
      if (!lat || !lng) return;

      bounds.push([lat, lng]);

      const statusColor = r.status === 'available' ? '#10b981' : r.status === 'delivering' ? '#3b82f6' : '#64748b';
      const statusLabel = r.status === 'available' ? 'Disponible' : r.status === 'delivering' ? 'En Reparto Activo' : 'Desconectado';

      const riderIcon = L.divIcon({
        className: 'leaflet-rider-marker',
        html: `
          <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;width:40px;height:40px;border-radius:9999px;background:${statusColor};opacity:0.25;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="background:${statusColor};color:white;width:34px;height:34px;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);border:2.5px solid white;z-index:2;cursor:pointer;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
            </div>
            <div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.85);backdrop-filter:blur(4px);color:white;font-size:10px;font-weight:bold;padding:1px 6px;border-radius:6px;white-space:nowrap;border:1px solid rgba(255,255,255,0.2);">
              ${r.name.split(' ')[0]}
            </div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      const marker = L.marker([lat, lng], { icon: riderIcon }).addTo(this.fleetRadarMap!);

      const activeOrder = this.orders().find(o => o.driverId === r.id && o.status === 'on_the_way');

      marker.bindPopup(`
        <div style="font-family:sans-serif;padding:4px;min-width:180px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${statusColor};"></span>
            <b style="font-size:13px;color:#0f172a;">${r.name}</b>
          </div>
          <div style="font-size:11px;color:#64748b;margin-bottom:4px;">
            Placa: <b>${r.vehiclePlate}</b> • ${r.vehicleType.toUpperCase()}
          </div>
          <div style="font-size:11px;color:#64748b;margin-bottom:6px;">
            Estado: <b style="color:${statusColor}">${statusLabel}</b>
          </div>
          <div style="font-size:10px;color:#059669;margin-bottom:8px;font-family:monospace;background:#ecfdf5;padding:3px 6px;border-radius:6px;border:1px solid #a7f3d0;">
            📍 GPS Real: ${lat.toFixed(5)}, ${lng.toFixed(5)}
          </div>
          ${activeOrder ? `
            <div style="background:#f1f5f9;padding:6px 8px;border-radius:8px;font-size:10px;color:#334155;margin-bottom:8px;">
              🛵 Entregando: <b>${activeOrder.orderNumber}</b><br>
              Destino: ${activeOrder.customer.deliveryAddress || 'En ruta'}
            </div>
          ` : ''}
          <div style="display:flex;gap:6px;">
            <a href="tel:${r.phone}" style="display:inline-block;padding:4px 8px;background:#0f172a;color:white;font-size:11px;border-radius:6px;text-decoration:none;font-weight:bold;">
              📞 Llamar
            </a>
            <a href="https://wa.me/${r.phone.replace(/[^0-9]/g, '')}" target="_blank" style="display:inline-block;padding:4px 8px;background:#10b981;color:white;font-size:11px;border-radius:6px;text-decoration:none;font-weight:bold;">
              WhatsApp
            </a>
          </div>
        </div>
      `);

      this.fleetRiderMarkers.set(r.id, marker);
    });

    if (bounds.length > 0) {
      if (bounds.length === 1) {
        this.fleetRadarMap.setView(bounds[0], 15);
      } else {
        this.fleetRadarMap.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
      }
    } else {
      this.fleetRadarMap.setView([baseLat, baseLng], 14);
    }
  }

  flyToRider(rider: Rider): void {
    this.selectedRadarRider.set(rider);
    if (!this.fleetRadarMap) return;

    if (!rider.currentLocation?.lat || !rider.currentLocation?.lng) {
      alert(`El motorizado ${rider.name} aún no ha reportado su ubicación GPS satelital desde su teléfono móvil.`);
      return;
    }

    const lat = rider.currentLocation.lat;
    const lng = rider.currentLocation.lng;

    this.fleetRadarMap.flyTo([lat, lng], 16, { duration: 1.2 });
    const marker = this.fleetRiderMarkers.get(rider.id);
    if (marker) {
      marker.openPopup();
    }
  }

  recenterFleetMap(): void {
    if (!this.fleetRadarMap) return;
    this.updateFleetRiderMarkers();
  }

  // --- MAPA DE COBERTURA DE SUCURSALES (MIS SUCURSALES) ---
  toggleBranchesView(mode: 'grid' | 'map'): void {
    this.branchesViewMode.set(mode);
    if (mode === 'map') {
      setTimeout(() => {
        this.initBranchesMap();
        setTimeout(() => {
          this.branchesMap?.invalidateSize();
          this.renderBranchesOnMap();
        }, 150);
      }, 50);
    }
  }

  initBranchesMap(retryCount = 0): void {
    const container = document.getElementById('branches-leaflet-map');
    if (!container) {
      if (retryCount < 5 && this.activeTab() === 'branches' && this.branchesViewMode() === 'map') {
        setTimeout(() => this.initBranchesMap(retryCount + 1), 100);
      }
      return;
    }

    if (this.branchesMap) {
      try {
        this.branchesMap.remove();
      } catch (_) {}
      this.branchesMap = undefined;
    }

    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    const defaultLat = this.brandingForm.latitude || 10.0385;
    const defaultLng = this.brandingForm.longitude || -69.2482;

    this.branchesMap = L.map(container, {
      zoomControl: true,
      attributionControl: false
    }).setView([defaultLat, defaultLng], 13);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.branchesMap);

    this.renderBranchesOnMap();
    setTimeout(() => this.branchesMap?.invalidateSize(), 100);
    setTimeout(() => this.branchesMap?.invalidateSize(), 300);
  }

  renderBranchesOnMap(): void {
    if (!this.branchesMap) return;

    this.branchesMap.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Circle) {
        layer.remove();
      }
    });

    const branchesList = this.branches();
    if (branchesList.length === 0) return;

    const group = L.featureGroup();

    branchesList.forEach((b) => {
      const isActive = b.status === 'active';
      const markerColor = isActive ? '#f97316' : '#f59e0b';

      const storeIcon = L.divIcon({
        className: 'leaflet-branch-marker',
        html: `
          <div style="background:${markerColor};color:white;width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 14px rgba(249,115,22,0.4);border:2.5px solid white;cursor:pointer;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const marker = L.marker([b.latitude, b.longitude], { icon: storeIcon });
      marker.bindPopup(`
        <div style="font-family:sans-serif;padding:4px;min-width:210px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span style="font-size:14px;">🏪</span>
            <b style="font-size:13px;color:#0f172a;">${b.name}</b>
          </div>
          <div style="font-size:11px;color:#64748b;margin-bottom:4px;">
            📍 ${b.address}
          </div>
          <div style="font-size:11px;color:#334155;margin-bottom:4px;">
            🛵 Radio Cobertura: <b>${b.deliveryRadiusKm} km</b> • Envío Base: <b>$${b.baseDeliveryFee.toFixed(2)}</b>
          </div>
          <div style="font-size:11px;color:#64748b;margin-bottom:8px;">
            ⏰ Horario: <b>${b.openTime} - ${b.closeTime}</b> (${isActive ? 'Activa' : 'Pendiente'})
          </div>
        </div>
      `);

      const circle = L.circle([b.latitude, b.longitude], {
        radius: (b.deliveryRadiusKm || 5) * 1000,
        color: markerColor,
        fillColor: markerColor,
        fillOpacity: 0.12,
        weight: 2,
        dashArray: '5, 8'
      });

      marker.addTo(group);
      circle.addTo(group);
    });

    group.addTo(this.branchesMap);
    this.branchesMap.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 15 });
  }

  focusBranchOnMap(branch: Branch): void {
    this.branchesViewMode.set('map');
    setTimeout(() => {
      this.initBranchesMap();
      setTimeout(() => {
        if (this.branchesMap) {
          this.branchesMap.flyTo([branch.latitude, branch.longitude], 15, { duration: 1.2 });
        }
      }, 200);
    }, 150);
  }

  // --- SEGUIMIENTO DE RUTA REAL (DELEGADO A OrderRouteModalComponent) ---
  openOrderRouteModal(order: Order): void {
    this.selectedRouteOrder.set(order);
    this.isOrderRouteModalOpen.set(true);
  }

  closeOrderRouteModal(): void {
    this.isOrderRouteModalOpen.set(false);
    this.selectedRouteOrder.set(null);
  }

  onViewOrderRoute(order: Order): void {
    this.closeOrderDetail();
    this.openOrderRouteModal(order);
  }

  getRiderById(driverId?: string): Rider | null {
    if (!driverId) return null;
    return this.riders().find(r => r.id === driverId) || null;
  }

  // --- MODAL DE DETALLE DE PEDIDO ---
  openOrderDetail(order: Order): void {
    this.selectedOrderDetail.set(order);
    this.isOrderDetailModalOpen.set(true);
  }

  closeOrderDetail(): void {
    this.isOrderDetailModalOpen.set(false);
    this.selectedOrderDetail.set(null);
  }




  getModifiersText(modifiers: any[]): string {
    if (!modifiers || !Array.isArray(modifiers)) return '';
    return modifiers
      .map(m => m.optionName || m.option_name || m.name || '')
      .filter((n: string) => typeof n === 'string' && n.trim().length > 0)
      .join(', ');
  }

  advanceOrderStatus(orderId: string, status: OrderStatus): void {
    this.orders.update(list =>
      list.map(o => o.id === orderId ? { ...o, status, updatedAt: new Date().toISOString() } : o)
    );
    // 1. Direct Supabase update for immediate Realtime broadcast to mobile apps
    this.supabase.updateOrderStatus(orderId, status).then(ok => {
      if (ok) console.log(`[MerchantAdmin] Estado actualizado directamente en Supabase: ${orderId} -> ${status}`);
    });
    // 2. Backend update
    this.api.updateOrderStatus(orderId, status).subscribe({
      next: () => console.log(`[MerchantAdmin] Orden ${orderId} actualizada en backend a ${status}`),
      error: (err) => console.warn('[MerchantAdmin] Error sincronizando estado en backend:', err)
    });
  }

  assignRiderToOrder(orderId: string, riderId: string): void {
    const rider = this.riders().find(r => r.id === riderId);
    this.orders.update(list =>
      list.map(o => o.id === orderId ? {
        ...o,
        driverId: riderId,
        driverName: rider?.name,
        driverPhone: rider?.phone,
        status: 'assigned_driver',
        riderAccepted: false,
        riderRejected: false,
        rejectedRiderName: undefined
      } : o)
    );
    // 1. Direct Supabase update for immediate Realtime broadcast to mobile apps
    this.supabase.assignRider(orderId, riderId).then(ok => {
      if (ok) console.log(`[MerchantAdmin] Repartidor asignado en Supabase: ${orderId} -> ${riderId}`);
    });
    // 2. Backend update
    this.api.assignRider(orderId, riderId).subscribe({
      next: () => console.log(`[MerchantAdmin] Repartidor asignado en backend a orden ${orderId}`),
      error: (err) => console.warn('[MerchantAdmin] Error asignando repartidor:', err)
    });
  }

  toggleProductStock(productId: string): void {
    const p = this.products().find(item => item.id === productId);
    const newAvail = p ? !p.isAvailable : false;
    this.products.update(list =>
      list.map(item => item.id === productId ? { ...item, isAvailable: newAvail } : item)
    );
    this.api.updateProduct(productId, { is_available: newAvail }).subscribe({
      next: () => console.log(`[MerchantAdmin] Stock producto ${productId} actualizado a ${newAvail}`),
      error: (err) => console.warn('[MerchantAdmin] Error actualizando stock en backend:', err)
    });
  }

  loadCategories(tenantId: string): void {
    if (!tenantId) return;
    this.api.getCategories(tenantId).subscribe(cats => {
      this.productCategories.set(cats || []);
    });
  }

  toggleInlineCategoryCreation(): void {
    this.isCreatingCategoryInline.update(v => !v);
    if (this.isCreatingCategoryInline()) {
      this.newCategoryName = '';
    }
  }

  onCategorySelectChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    if (val === '__NEW__') {
      this.currentEditingProduct.categoryId = '';
      this.isCreatingCategoryInline.set(true);
      this.newCategoryName = '';
    }
  }

  saveInlineCategory(): void {
    const name = this.newCategoryName.trim();
    if (!name) return;
    const tenantId = this.currentTenant().id || this.auth.currentUser()?.tenantId;
    if (!tenantId) return;

    this.isSavingCategory.set(true);
    this.api.createCategory(tenantId, name).subscribe({
      next: (created) => {
        this.isSavingCategory.set(false);
        this.productCategories.update(list => [...list, created]);
        this.currentEditingProduct.categoryId = created.id;
        this.isCreatingCategoryInline.set(false);
        this.newCategoryName = '';
      },
      error: (err) => {
        this.isSavingCategory.set(false);
        console.warn('[MerchantAdmin] Error creando categoría:', err);
      }
    });
  }

  getCategoryName(categoryId?: string): string {
    if (!categoryId) return 'General';
    const cat = this.productCategories().find(c => c.id === categoryId);
    return cat ? cat.name : 'General';
  }

  getBranchName(branchId?: string | null): string {
    if (!branchId || branchId === 'all') {
      const main = this.branches().find(b => b.name?.toLowerCase().includes('principal'));
      return main ? main.name : (this.branches()[0]?.name || 'Sede Principal');
    }
    const b = this.branches().find(x => x.id === branchId);
    return b ? b.name : 'Sede Asignada';
  }

  openProductModal(prod?: Product): void {
    const defaultBranchId = this.activeBranchId();

    if (prod) {
      this.currentEditingProduct = {
        ...JSON.parse(JSON.stringify(prod)),
        currency: prod.currency || 'USD',
        categoryId: prod.categoryId || '',
        sku: prod.sku || '',
        barcode: prod.barcode || '',
        branchId: prod.branchId || defaultBranchId,
        modifierGroups: prod.modifierGroups ? JSON.parse(JSON.stringify(prod.modifierGroups)) : []
      };
    } else {
      const defaultCatId = this.selectedCategoryFilter() !== 'all' 
        ? this.selectedCategoryFilter() 
        : (this.productCategories()[0]?.id || '');

      this.currentEditingProduct = {
        id: `prod-${Date.now()}`,
        tenantId: this.currentTenant().id || this.auth.currentUser()?.tenantId || '',
        categoryId: defaultCatId,
        name: '',
        description: '',
        price: 8.50,
        currency: 'USD',
        sku: '',
        barcode: '',
        imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
        isAvailable: true,
        branchId: defaultBranchId,
        modifierGroups: []
      };
    }
    this.isCreatingCategoryInline.set(false);
    this.newCategoryName = '';
    this.isProductModalOpen.set(true);
  }

  onSaveProductFromModal(prodToSave: Product): void {
    const existingIndex = this.products().findIndex(p => p.id === prodToSave.id);
    const branchToAssign = this.activeBranchId() || this.branches()[0]?.id;
    prodToSave.branchId = branchToAssign;

    if (existingIndex > -1) {
      this.products.update(list => {
        const copy = [...list];
        copy[existingIndex] = prodToSave;
        return copy;
      });
      this.api.updateProduct(prodToSave.id, {
        name: prodToSave.name,
        description: prodToSave.description,
        price: prodToSave.price,
        currency: prodToSave.currency || 'USD',
        category_id: prodToSave.categoryId,
        image_url: prodToSave.imageUrl,
        is_available: prodToSave.isAvailable,
        branch_id: branchToAssign || null,
        sku: prodToSave.sku?.trim() || null,
        barcode: prodToSave.barcode?.trim() || null,
        modifierGroups: prodToSave.modifierGroups || []
      }).subscribe({
        next: () => console.log(`[MerchantAdmin] Producto ${prodToSave.id} actualizado`),
        error: (err) => console.warn('[MerchantAdmin] Error actualizando producto:', err)
      });
    } else {
      this.products.update(list => [prodToSave, ...list]);
      this.api.createProduct({
        tenant_id: this.currentTenant().id,
        name: prodToSave.name,
        description: prodToSave.description,
        price: prodToSave.price,
        currency: prodToSave.currency || 'USD',
        category_id: prodToSave.categoryId,
        image_url: prodToSave.imageUrl,
        is_available: prodToSave.isAvailable,
        branch_id: branchToAssign || null,
        sku: prodToSave.sku?.trim() || null,
        barcode: prodToSave.barcode?.trim() || null,
        modifierGroups: prodToSave.modifierGroups || []
      }).subscribe({
        next: (created) => {
          if (created && created.id) {
            this.products.update(list => list.map(p => p.id === prodToSave.id ? { ...p, id: created.id, branchId: branchToAssign } : p));
          }
        },
        error: (err) => console.warn('[MerchantAdmin] Error creando producto:', err)
      });
    }
    this.isProductModalOpen.set(false);
  }

  onCategoryCreatedFromModal(cat: ProductCategory): void {
    this.productCategories.update(list => [...list, cat]);
  }

  copyFromMainBranch(): void {
    const tenantId = this.currentTenant().id;
    const branchId = this.selectedBranchId();
    if (!tenantId || branchId === 'all') {
      alert('Por favor selecciona una sucursal específica para copiar los productos.');
      return;
    }

    const branch = this.branches().find(b => b.id === branchId);
    if (!confirm(`¿Deseas copiar todo el catálogo de productos y modificadores de la Sede Principal hacia la sucursal "${branch?.name || 'Seleccionada'}"?\n\nLos productos tendrán stock y disponibilidad independiente en esta sucursal.`)) {
      return;
    }

    this.isCopyingFromMain.set(true);
    this.copyFromMainSuccessMessage.set(null);
    this.copyFromMainErrorMessage.set(null);

    this.api.copyProductsFromMainBranch(tenantId, branchId).subscribe({
      next: (res) => {
        this.isCopyingFromMain.set(false);
        this.copyFromMainSuccessMessage.set(res.message || `¡Éxito! Se copiaron ${res.count} productos.`);
        // Recargar productos desde el backend
        this.api.getProducts(tenantId).subscribe(prods => {
          this.products.set(prods || []);
        });
        setTimeout(() => this.copyFromMainSuccessMessage.set(null), 5000);
      },
      error: (err) => {
        this.isCopyingFromMain.set(false);
        const msg = err?.error?.message || err.message || 'Error al copiar productos desde la sede principal.';
        this.copyFromMainErrorMessage.set(msg);
        setTimeout(() => this.copyFromMainErrorMessage.set(null), 6000);
      }
    });
  }

  // ==========================================
  // IMPORTACIÓN MASIVA EXCEL / CSV (3000+ PRODUCTOS)
  // ==========================================
  openBulkImportModal(): void {
    this.isBulkImportModalOpen.set(true);
  }

  closeBulkImportModal(): void {
    this.isBulkImportModalOpen.set(false);
  }







  onBulkImportCompleted(): void {
    const tenantId = this.currentTenant().id || this.auth.currentUser()?.tenantId || '';
    if (tenantId) {
      this.api.getProducts(tenantId).subscribe(prods => {
        if (prods) {
          this.products.set(prods);
        }
      });
    }
  }

  onSaveRiderFromModal(riderPayload: any): void {
    const targetBranch = this.activeBranch();
    const branchId = targetBranch?.id || riderPayload.branch_id || riderPayload.branchId || this.branches()[0]?.id || '';
    const branchName = targetBranch?.name || 'Sede Principal';
    const activeTenantId = this.auth.currentUser()?.tenantId || this.currentTenant()?.id || targetBranch?.companyId || 'dac59429-fd6f-4d3e-8b2e-ab0e23828c1f';

    const formattedPayload = {
      tenant_id: activeTenantId,
      tenantId: activeTenantId,
      branch_id: branchId,
      branchId: branchId,
      name: riderPayload.name,
      email: riderPayload.email,
      password: riderPayload.password,
      phone: riderPayload.phone,
      national_id: riderPayload.national_id || riderPayload.nationalId || '',
      nationalId: riderPayload.national_id || riderPayload.nationalId || '',
      vehicle_plate: riderPayload.vehicle_plate || riderPayload.vehiclePlate,
      vehiclePlate: riderPayload.vehicle_plate || riderPayload.vehiclePlate,
      vehicle_type: riderPayload.vehicle_type || riderPayload.vehicleType || 'moto',
      vehicleType: riderPayload.vehicle_type || riderPayload.vehicleType || 'moto'
    };

    if (typeof window !== 'undefined') {
      try {
        const localList = JSON.parse(localStorage.getItem('deliveryhub_riders_auth') || '[]');
        localList.push(formattedPayload);
        localStorage.setItem('deliveryhub_riders_auth', JSON.stringify(localList));
      } catch {}
    }

    const tempRider: Rider = {
      id: `rider-${Date.now()}`,
      name: formattedPayload.name,
      phone: formattedPayload.phone,
      vehiclePlate: formattedPayload.vehicle_plate,
      vehicleType: formattedPayload.vehicle_type as any,
      status: 'available',
      branchId: branchId,
      branchName: branchName,
      currentLocation: { lat: 10.4820, lng: -66.8610 }
    };
    this.riders.update(list => [tempRider, ...list]);
    this.isRiderModalOpen.set(false);

    this.api.createRider(formattedPayload).subscribe({
      next: (created) => {
        if (created) {
          const resolvedBranchId = created.branch_id || (created as any).branchId || branchId;
          const branch = this.branches().find(b => b.id === resolvedBranchId);
          const finalRider: Rider = {
            id: created.id,
            name: created.name || formattedPayload.name,
            phone: created.phone || formattedPayload.phone,
            vehiclePlate: created.vehicle_plate || (created as any).vehiclePlate || formattedPayload.vehicle_plate,
            vehicleType: ((created.vehicle_type || (created as any).vehicleType) as any) || formattedPayload.vehicle_type,
            status: (created.status as any) || 'available',
            branchId: resolvedBranchId,
            branchName: branch?.name || branchName,
            currentLocation: created.current_lat && created.current_lng
              ? { lat: Number(created.current_lat), lng: Number(created.current_lng) }
              : { lat: 10.4820, lng: -66.8610 }
          };
          this.riders.update(list => [finalRider, ...list.filter(r => r.id !== tempRider.id)]);
        }
        this.refreshRidersLocation();
        this.isSavedNotificationVisible.set(true);
        setTimeout(() => this.isSavedNotificationVisible.set(false), 3000);
      },
      error: (err) => {
        console.warn('[MerchantAdmin] Advertencia al persistir repartidor:', err);
        this.refreshRidersLocation();
      }
    });
  }

  deleteRider(rider: Rider): void {
    if (!confirm(`¿Estás seguro de que deseas eliminar al motorizado ${rider.name} (${rider.vehiclePlate}) de esta sede?`)) {
      return;
    }

    const branchFilter = this.isBranchLocked() ? this.auth.currentUser()?.branchId : undefined;
    this.riders.update(list => list.filter(r => r.id !== rider.id));
    this.api.deleteRider(rider.id, branchFilter).subscribe({
      next: () => {
        this.isSavedNotificationVisible.set(true);
        setTimeout(() => this.isSavedNotificationVisible.set(false), 2500);
      },
      error: (err) => {
        console.warn('[MerchantAdmin] Advertencia al eliminar motorizado en backend:', err);
      }
    });
  }

  getPointAtProgress(pct: number): [number, number] {
    if (!this.waypoints || this.waypoints.length === 0) return [10.4820, -66.8610];
    const index = Math.min(
      Math.floor((pct / 100) * (this.waypoints.length - 1)),
      this.waypoints.length - 1
    );
    return this.waypoints[index];
  }

  advanceGpsProgress(explicitProgress?: number): void {
    const newProgress = explicitProgress !== undefined
      ? explicitProgress
      : (this.gpsProgress() >= 95 ? 5 : this.gpsProgress() + 15);

    this.gpsProgress.set(newProgress);

    const pos = this.getPointAtProgress(newProgress);
    if (this.riderMarker) {
      this.riderMarker.setLatLng(pos);
    }

    // Dynamic telemetry updates
    const remainingRatio = Math.max(0, (100 - newProgress) / 100);
    this.riderDistanceKm.set(Number((1.8 * remainingRatio).toFixed(1)));
    this.riderEta.set(Math.max(1, Math.round(9 * remainingRatio)));
    this.riderSpeed.set(Math.floor(32 + Math.random() * 14));
  }


  simulateIncomingOrder(): void {
    const num = Math.floor(1000 + Math.random() * 9000);
    const resolvedTenantId = this.currentTenant().id || this.auth.currentUser()?.tenantId || '';
    const targetBranch = this.selectedBranch() || (this.branches().length > 0 ? this.branches()[0] : null);

    const newOrd: Order = {
      id: `ord_${Date.now()}`,
      orderNumber: `ORD-${num}`,
      tenantId: resolvedTenantId,
      tenantName: this.currentTenant().name || this.auth.currentUser()?.tenantName || 'Comercio',
      branchId: targetBranch?.id,
      branchName: targetBranch?.name,
      source: 'whatsapp_link',
      status: 'received',
      fulfillmentType: 'delivery',
      paymentMethod: 'mobile_transfer',
      customer: {
        name: 'Cliente WhatsApp Simulado',
        phone: '+584128889900',
        deliveryAddress: targetBranch ? `Cerca de ${targetBranch.name}` : 'Av. Libertador, Edif. Centro'
      },
      items: [
        {
          cartItemId: `item_${Date.now()}`,
          productId: 'prod-101',
          name: 'Combo Doble Bacon Smash',
          unitPrice: 9.99,
          quantity: 1,
          selectedModifiers: [
            { groupId: 'mod-drink', groupTitle: 'Bebida', optionId: 'd1', optionName: 'Coca Cola Zero', priceDelta: 0 }
          ],
          itemTotal: 9.99
        }
      ],
      subtotal: 9.99,
      deliveryFee: targetBranch?.baseDeliveryFee || 2.50,
      discount: 0,
      total: 9.99 + (targetBranch?.baseDeliveryFee || 2.50),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.orders.update(list => [newOrd, ...list]);

    // Persistir en el Backend & Supabase
    this.api.createOrder({
      tenant_id: resolvedTenantId,
      branch_id: targetBranch?.id,
      order_number: `ORD-${num}`,
      source: 'whatsapp_link',
      status: 'received',
      fulfillment_type: 'delivery',
      payment_method: 'mobile_transfer',
      customer_name: 'Cliente WhatsApp Simulado',
      customer_phone: '+584128889900',
      delivery_address: 'Av. Libertador, Edif. Centro',
      subtotal: 9.99,
      delivery_fee: 2.50,
      total: 12.49,
      items: [
        {
          product_name: 'Combo Doble Bacon Smash',
          unit_price: 9.99,
          quantity: 1,
          item_total: 9.99,
          selected_modifiers: [{ groupId: 'mod-drink', groupTitle: 'Bebida', optionId: 'd1', optionName: 'Coca Cola Zero', priceDelta: 0 }]
        }
      ]
    }).subscribe({
      next: (saved) => {
        if (saved) {
          this.orders.update(list => [saved, ...list.filter(o => o.orderNumber !== saved.orderNumber && o.id !== newOrd.id)]);
        }
      },
      error: (err) => console.warn('[MerchantAdmin] Error simulando pedido en backend:', err)
    });
  }

  selectColorPreset(hex: string): void {
    this.brandingForm.accentColor = hex;
  }

  async fetchOfficialBcvRate(fuente: 'oficial' | 'paralelo' = 'oficial'): Promise<void> {
    this.isFetchingBcv.set(true);
    try {
      const data = await this.currency.fetchDolarApiRate(fuente);
      if (data && typeof data.promedio === 'number' && data.promedio > 0) {
        this.brandingForm.exchangeRate = Number(data.promedio.toFixed(2));
        this.bcvLastUpdated.set(data.fechaActualizacion);
        this.bcvRateSource.set(fuente);
        this.bcvApiSuccess.set(true);
        this.saveSettings();
        setTimeout(() => this.bcvApiSuccess.set(false), 4500);
      }
    } catch (err) {
      console.error('Error fetching rate from dolarapi.com:', err);
    } finally {
      this.isFetchingBcv.set(false);
    }
  }

  saveSettings(e?: Event): void {
    if (e) e.preventDefault();
    this.isSavingBranding.set(true);

    const activeTenantId = this.currentTenant().id || this.auth.currentUser()?.tenantId || '';
    if (activeTenantId && typeof window !== 'undefined') {
      try {
        localStorage.setItem('deliveryhub_branding_' + activeTenantId, JSON.stringify(this.brandingForm));
      } catch (_) {}
    }

    this.currentTenant.update(prev => ({
      ...prev,
      name: this.brandingForm.name,
      tagline: this.brandingForm.tagline,
      branding: {
        accentColor: this.brandingForm.accentColor,
        logoUrl: this.brandingForm.logoUrl,
        bannerUrl: this.brandingForm.bannerUrl
      },
      currencySettings: {
        baseCurrency: this.brandingForm.baseCurrency,
        displayMode: this.brandingForm.displayMode,
        exchangeRate: Number(this.brandingForm.exchangeRate),
        lastRateUpdate: new Date().toISOString()
      },
      contact: {
        whatsappNumber: this.brandingForm.whatsappNumber,
        phone: this.brandingForm.phone,
        address: this.brandingForm.address,
        coordinates: {
          lat: Number(this.brandingForm.latitude),
          lng: Number(this.brandingForm.longitude)
        }
      },
      deliverySettings: {
        ...prev.deliverySettings,
        baseDeliveryFee: Number(this.brandingForm.baseDeliveryFee),
        deliveryRadiusKm: Number(this.brandingForm.deliveryRadiusKm),
        deliveryTiers: this.brandingForm.deliveryTiers
      }
    }));

    // Actualizar sede principal y sucursales localmente de inmediato
    this.branches.update(list => list.map(b => {
      const isTargetBranch = list.length === 1 || b.isMain || b.name.toLowerCase().includes('principal') || b.id === this.userAssignedBranch()?.id;
      return {
        ...b,
        deliveryRadiusKm: Number(this.brandingForm.deliveryRadiusKm),
        baseDeliveryFee: Number(this.brandingForm.baseDeliveryFee),
        deliveryTiers: this.brandingForm.deliveryTiers,
        ...(isTargetBranch ? {
          address: this.brandingForm.address,
          latitude: Number(this.brandingForm.latitude),
          longitude: Number(this.brandingForm.longitude),
          phone: this.brandingForm.phone,
          whatsapp: this.brandingForm.whatsappNumber
        } : {})
      };
    }));

    // Backend sync
    this.api.updateTenant(this.currentTenant().id, {
      name: this.brandingForm.name,
      tagline: this.brandingForm.tagline,
      accent_color: this.brandingForm.accentColor,
      logo_url: this.brandingForm.logoUrl,
      banner_url: this.brandingForm.bannerUrl,
      whatsapp_number: this.brandingForm.whatsappNumber,
      phone: this.brandingForm.phone,
      address: this.brandingForm.address,
      latitude: Number(this.brandingForm.latitude),
      longitude: Number(this.brandingForm.longitude),
      delivery_radius_km: Number(this.brandingForm.deliveryRadiusKm),
      base_delivery_fee: Number(this.brandingForm.baseDeliveryFee),
      delivery_tiers: this.brandingForm.deliveryTiers,
      exchange_rate: Number(this.brandingForm.exchangeRate),
      base_currency: this.brandingForm.baseCurrency,
      display_mode: this.brandingForm.displayMode,
      currency_settings: {
        baseCurrency: this.brandingForm.baseCurrency,
        displayMode: this.brandingForm.displayMode,
        exchangeRate: Number(this.brandingForm.exchangeRate),
        lastRateUpdate: new Date().toISOString()
      }
    }).subscribe({
      next: (updatedTenant) => {
        this.isSavingBranding.set(false);
        console.log('[MerchantAdmin] Configuración guardada en backend');
        if (updatedTenant) {
          this.currentTenant.set(updatedTenant);
        }
        this.loadBranches();
        setTimeout(() => {
          if (this.branchesMap) {
            this.initBranchesMap();
          }
        }, 250);
      },
      error: (err) => {
        this.isSavingBranding.set(false);
        console.warn('[MerchantAdmin] Error sincronizando configuración en backend:', err);
      }
    });

    this.isSavedNotificationVisible.set(true);
    setTimeout(() => this.isSavedNotificationVisible.set(false), 3000);
  }

  // --- MULTI-SUCURSAL ACTIONS ---
  loadBranches(tenantId?: string): void {
    const activeTenantId = tenantId || this.auth.currentUser()?.tenantId || this.currentTenant()?.id;
    if (!activeTenantId) {
      this.branches.set([]);
      return;
    }
    this.api.getBranches(activeTenantId).subscribe(branches => {
      const list = branches || [];
      this.branches.set(list);
      const bFilter = this.activeBranchId();

      this.refreshRidersLocation();
      this.loadStoreUsers();
      if (bFilter) {
        this.api.getOrders(activeTenantId, undefined, bFilter).subscribe(orders => {
          const isMain = Boolean(this.activeBranch()?.isMain || this.activeBranch()?.name?.toLowerCase().includes('principal'));
          const orderList = (orders || []).filter(o => {
            if (o.branchId === bFilter) return true;
            if (isMain && !o.branchId) return true;
            return false;
          });
          this.orders.set(orderList);
        });
        this.api.getProducts(activeTenantId, bFilter).subscribe(products => {
          this.products.set((products || []).filter(p => p.branchId === bFilter));
        });
      }
    });
  }

  openNewBranchModal(): void {
    // Regla de Negocio: Solo la Sede Principal puede crear sucursales.
    if (!this.isMainBranchOrOwner()) {
      alert('Acceso restringido: Una sucursal secundaria no tiene permisos para crear sucursales. Esta función es exclusiva de la Sede Principal del comercio.');
      return;
    }
    if (!this.canCreateBranch()) {
      this.isUpgradePlanModalOpen.set(true);
      return;
    }
    this.branchFormErrorMessage.set(null);
    this.isNewBranchModalOpen.set(true);
  }

  openEditBranchModal(branch: Branch): void {
    this.editingBranch.set(branch);
    this.branchFormErrorMessage.set(null);
    this.isEditBranchModalOpen.set(true);
  }



  onBranchSaved(): void {
    this.isNewBranchModalOpen.set(false);
    this.isEditBranchModalOpen.set(false);
    this.isBranchSavedSuccess.set(true);
    this.loadBranches();
    this.loadStoreUsers();
    setTimeout(() => this.isBranchSavedSuccess.set(false), 5000);
  }



  copyBranchMenuLink(branch: Branch): void {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4200';
    const slug = this.currentTenant()?.slug || 'burger-king';
    const branchParam = branch.slug || branch.id;
    const link = `${origin}/t/${slug}?branch=${branchParam}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => {
        alert(`✓ Enlace oficial copiado al portapapeles:\n\n${link}\n\nPega este enlace en la respuesta automática o saludo de WhatsApp de esta sucursal.`);
      }).catch(() => {
        prompt('Copia este enlace de pedido para esta sucursal:', link);
      });
    } else {
      prompt('Copia este enlace de pedido para esta sucursal:', link);
    }
  }

  canToggleBranch(branch: Branch): boolean {
    if (this.isMainBranchOrOwner()) return true;
    const myBranchId = this.auth.currentUser()?.branchId;
    return Boolean(myBranchId && myBranchId === branch.id);
  }

  toggleBranch(branch: Branch): void {
    if (!this.canToggleBranch(branch)) {
      alert('Acceso denegado: Solo la Sede Principal o el encargado de esta sucursal pueden modificar su estado.');
      return;
    }
    const role = this.auth.currentUser()?.role;
    const userBranchId = this.auth.currentUser()?.branchId;
    const nextState = !branch.isOpenNow;

    this.api.toggleBranchStatus(branch.id, nextState, role, userBranchId).subscribe({
      next: () => {
        this.loadBranches();
      },
      error: (err) => {
        alert(err?.error?.message || err?.message || 'Error al cambiar el estado de la sucursal.');
      }
    });
  }

  openDeleteBranchModal(branch: Branch): void {
    if (!this.isMainBranchOrOwner()) {
      alert('Acceso denegado: Solo la Sede Principal puede eliminar sucursales.');
      return;
    }
    if (branch.isMain || branch.name.toLowerCase().includes('principal')) {
      alert('No es posible eliminar la Sede Principal (Matriz) del comercio.');
      return;
    }
    this.branchToDelete.set(branch);
    this.deleteBranchErrorMessage.set(null);
    this.isDeleteBranchModalOpen.set(true);
  }

  closeDeleteBranchModal(): void {
    this.isDeleteBranchModalOpen.set(false);
    this.branchToDelete.set(null);
    this.deleteBranchErrorMessage.set(null);
  }

  confirmDeleteBranch(): void {
    const branch = this.branchToDelete();
    if (!branch) return;

    if (!this.isMainBranchOrOwner()) {
      this.deleteBranchErrorMessage.set('Acceso denegado: Solo la Sede Principal puede eliminar sucursales.');
      return;
    }

    this.isDeletingBranch.set(true);
    this.deleteBranchErrorMessage.set(null);

    const role = this.auth.currentUser()?.role;
    const userBranchId = this.auth.currentUser()?.branchId;

    this.api.deleteBranch(branch.id, role, userBranchId).subscribe({
      next: (res) => {
        this.isDeletingBranch.set(false);
        if (res.success) {
          this.closeDeleteBranchModal();
          if (this.isEditBranchModalOpen()) {
            this.isEditBranchModalOpen.set(false);
          }
          this.loadBranches();
          this.loadStoreUsers();
        } else {
          this.deleteBranchErrorMessage.set(res.message || 'Error al eliminar la sucursal.');
        }
      },
      error: (err) => {
        this.isDeletingBranch.set(false);
        this.deleteBranchErrorMessage.set(err?.error?.message || err?.message || 'Error al eliminar la sucursal en el servidor.');
      }
    });
  }

  async logout(): Promise<void> {
    await this.supabase.signOut();
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}

