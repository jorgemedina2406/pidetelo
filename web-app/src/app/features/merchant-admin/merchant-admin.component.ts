import { ConfirmService } from '../../core/services/confirm.service';
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
import { Coupon } from '../../core/models/coupon.model';
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
import { MerchantCouponModalComponent } from './components/coupon-form-modal.component';
import { MerchantCouponNotifyModalComponent } from './components/coupon-notify-modal.component';
import { NearbyRidersModalComponent } from './components/nearby-riders-modal.component';
import { DispatchConfigModalComponent } from './components/dispatch-config-modal.component';
import { MerchantCouponsTabComponent } from './components/merchant-coupons-tab.component';
import { MerchantRidersTabComponent } from './components/merchant-riders-tab.component';
import { MerchantUsersTabComponent } from './components/merchant-users-tab.component';

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
  distanceKm?: number;
  isIndependent?: boolean;
  isCertified?: boolean;
  rating?: number;
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
    UserFormModalComponent,
    MerchantCouponModalComponent,
    MerchantCouponNotifyModalComponent,
    NearbyRidersModalComponent,
    DispatchConfigModalComponent,
    MerchantCouponsTabComponent,
    MerchantRidersTabComponent,
    MerchantUsersTabComponent
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
  private readonly confirmModal = inject(ConfirmService);
  private readonly supabase = inject(SupabaseService);
  private realtimeChannel: any = null;
  private ordersPollingInterval: any = null;
  private ridersPollingInterval: any = null;

  readonly Math = Math;

  readonly isSidebarExpanded = signal(true);
  readonly isMobileMenuOpen = signal(false);
  readonly productViewMode = signal<'grid' | 'list'>('grid');
  readonly activeTab = signal<'orders' | 'products' | 'branches' | 'riders' | 'gps_map' | 'users' | 'settings' | 'coupons' | 'whatsapp'>('orders');

  // --- WHATSAPP BOT & CENTRAL DE MENSAJERIA ---
  readonly whatsappSubTab = signal<'chat' | 'settings'>('chat');
  readonly whatsappInstance = signal<any>(null);
  readonly whatsappConversations = signal<any[]>([]);
  readonly selectedWhatsAppConversation = signal<any>(null);
  readonly whatsappMessages = signal<any[]>([]);
  readonly whatsappSearchQuery = signal<string>('');
  readonly whatsappNewMessageText = signal<string>('');
  readonly isLoadingWhatsApp = signal<boolean>(false);
  readonly isConnectingWhatsApp = signal<boolean>(false);
  readonly isSendingWhatsApp = signal<boolean>(false);
  readonly whatsappSettings = signal<{ greetingMessage: string; autoReplyEnabled: boolean; pauseDurationMinutes: number }>({
    greetingMessage: '¡Hola! Bienvenido a nuestro canal oficial de atención. ¿En qué podemos ayudarte hoy?',
    autoReplyEnabled: true,
    pauseDurationMinutes: 120
  });
  private whatsappPollingInterval: any = null;

  readonly filteredWhatsAppConversations = computed(() => {
    const q = this.whatsappSearchQuery().toLowerCase().trim();
    const list = this.whatsappConversations();
    if (!q) return list;
    return list.filter(c =>
      (c.customer_name && c.customer_name.toLowerCase().includes(q)) ||
      (c.customer_phone && c.customer_phone.includes(q)) ||
      (c.last_message && c.last_message.toLowerCase().includes(q))
    );
  });

  // --- SISTEMA DE TOASTS LLAMATIVOS PARA COMERCIO ---
  readonly activeToasts = signal<{ id: string; type: 'success' | 'error' | 'info'; title: string; message: string }[]>([]);

  showToast(type: 'success' | 'error' | 'info', title: string, message: string): void {
    const id = `toast_${Date.now()}_${Math.random()}`;
    this.activeToasts.update(list => [...list, { id, type, title, message }]);
    setTimeout(() => {
      this.activeToasts.update(list => list.filter(t => t.id !== id));
    }, 4500);
  }

  removeToast(id: string): void {
    this.activeToasts.update(list => list.filter(t => t.id !== id));
  }

  readonly coupons = signal<Coupon[]>([]);
  readonly isCouponModalOpen = signal(false);
  readonly isSavingCoupon = signal(false);
  readonly couponActionNotice = signal<string | null>(null);

  // --- NOTIFICAR CUPÓN A CLIENTES SEGÚN CONDICIÓN ---
  readonly isNotifyCouponModalOpen = signal(false);
  readonly selectedCouponToNotify = signal<Coupon | null>(null);
  readonly notificationCondition = signal<string>('all');
  readonly notificationCustomMessage = signal<string>('¡Aprovecha este descuento especial en tu próximo pedido!');
  readonly isSendingNotification = signal(false);
  editingCoupon: Partial<Coupon> = {
    discountType: 'percentage',
    discountValue: 10,
    minOrderAmount: 0,
    isActive: true
  };

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

  cleanBranchDisplayName(name?: string | null): string {
    if (!name) return '';
    return name.replace(/(\s*\(Sede Principal\))+/gi, '').trim();
  }

  getTenantEmail(): string {
    return (this.currentTenant() as any)?.email || (this.currentTenant() as any)?.contact?.email || this.auth.currentUser()?.email || 'Sin correo asignado';
  }

  isRealPagoMovil(cred?: any): boolean {
    if (!cred || !cred.pagoMovilPhone || !cred.pagoMovilBank) return false;
    const cleanPhone = String(cred.pagoMovilPhone || '').replace(/\D/g, '');
    const cleanId = String(cred.pagoMovilIdNumber || '').replace(/\D/g, '');
    if (cleanPhone === '04121234567' || cleanPhone === '04140000000' || cleanPhone.includes('1234567')) return false;
    if (cleanId.includes('50123456') || cleanId.includes('12345678') || cleanId === '00000000') return false;
    return true;
  }

  // Compatibilidad con templates y referencias existentes
  readonly selectedBranchId = computed<string>(() => this.activeBranchId());
  readonly selectedBranch = computed<Branch | null>(() => this.activeBranch());

  // Sucursal seleccionada para la configuración de Marca, Moneda y Cobertura (personalizable por sede)
  readonly selectedConfigBranchId = signal<string>('');
  readonly currentConfigBranch = computed<Branch | null>(() => {
    const list = this.branches();
    if (list.length === 0) return null;
    const sel = this.selectedConfigBranchId();
    if (sel) {
      const match = list.find(b => b.id === sel);
      if (match) return match;
    }
    return this.activeBranch() || list[0] || null;
  });

  readonly subscriptionPlans = signal<SubscriptionPlan[]>([]);
  readonly isNewBranchModalOpen = signal(false);
  readonly isEditBranchModalOpen = signal(false);
  readonly editingBranch = signal<Branch | null>(null);
  readonly isUpgradePlanModalOpen = signal(false);
  readonly planModalLimitType = signal<'branches' | 'products' | 'users' | 'orders' | 'whatsapp' | 'excel' | 'banner' | 'generic'>('generic');
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
    const tenant = this.currentTenant() as any;
    const rawCode = (tenant?.planCode || tenant?.plan_code || tenant?.subscriptionPlanId || 'COMERCIO_PRO').toUpperCase();
    const code = rawCode === 'COMERCIO' ? 'COMERCIO_PRO' : (rawCode === 'CORPORATIVO' ? 'FRANQUICIA' : rawCode);

    return plans.find(p => p.code === code || p.id === code) || {
      id: 'plan_comercio_pro',
      code: 'COMERCIO_PRO',
      name: 'Plan Comercio Pro',
      priceMonthly: 29.00,
      priceAnnual: 23.00,
      monthlyPriceUsd: 29.00,
      maxBranches: 2,
      hasWhatsappBot: true,
      hasExcelReports: true,
      hasFeaturedBanners: false,
      maxAdditionalUsers: 3,
      maxMonthlyOrders: 50,
      maxProducts: 100,
      description: 'Para comercios establecidos que buscan automatización y expansión local.',
      features: [
        'Hasta 2 sucursales adicionales (3 sedes en total)',
        'Hasta 100 productos en catálogo',
        'Hasta 50 pedidos al mes',
        'Hasta 3 usuarios adicionales',
        'Bot automático de WhatsApp 24/7',
        'Reportes avanzados en Excel (.xlsx)'
      ],
      isActive: true
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
    if (!this.isMainBranchOrOwner()) return false;
    const plan = this.currentSubscriptionPlan();
    if (plan.maxBranches === -1) return true;
    if (plan.maxBranches === 0) return false;
    const additionalBranches = this.branches().filter(b => !b.isMain && b.status !== 'rejected').length;
    return additionalBranches < plan.maxBranches;
  });
  readonly liveExchangeRate = signal<number | null>(null);
  readonly activeExchangeRate = computed(() => this.liveExchangeRate() || this.currentTenant()?.currencySettings?.exchangeRate || this.brandingForm.exchangeRate || 54.50);



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
    exchangeRate: 896.12,
    acceptedPaymentMethods: ['cash_usd', 'mobile_transfer', 'cash_local'] as string[],
    pagoMovilBank: '',
    pagoMovilPhone: '',
    pagoMovilIdNumber: '',
    pagoMovilAccountName: '',
    zelleEmail: '',
    openTime: '11:00',
    closeTime: '23:00',
    scheduleDays: [
      { day: 'Lunes', open: true, from: '11:00', to: '23:00' },
      { day: 'Martes', open: true, from: '11:00', to: '23:00' },
      { day: 'Miércoles', open: true, from: '11:00', to: '23:00' },
      { day: 'Jueves', open: true, from: '11:00', to: '23:00' },
      { day: 'Viernes', open: true, from: '11:00', to: '23:30' },
      { day: 'Sábado', open: true, from: '11:00', to: '23:30' },
      { day: 'Domingo', open: true, from: '11:00', to: '22:30' }
    ]
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

  loadBrandingForBranch(branch: Branch): void {
    if (!branch) return;
    this.selectedConfigBranchId.set(branch.id);
    const tenant = this.currentTenant();

    let cached: any = null;
    try {
      const raw = localStorage.getItem('deliveryhub_branch_branding_' + branch.id);
      if (raw) cached = JSON.parse(raw);
    } catch (_) {}

    this.brandingForm.name = branch.name || cached?.name || tenant.name || '';
    this.brandingForm.tagline = branch.tagline || cached?.tagline || tenant.tagline || '';
    this.brandingForm.accentColor = branch.accentColor || cached?.accentColor || tenant.branding?.accentColor || '#f97316';
    this.brandingForm.logoUrl = branch.logoUrl || cached?.logoUrl || tenant.branding?.logoUrl || '';
    this.brandingForm.bannerUrl = branch.bannerUrl || cached?.bannerUrl || tenant.branding?.bannerUrl || '';
    this.brandingForm.whatsappNumber = branch.whatsapp || cached?.whatsappNumber || branch.phone || tenant.contact?.whatsappNumber || '';
    this.brandingForm.phone = branch.phone || cached?.phone || tenant.contact?.phone || '';
    this.brandingForm.address = branch.address || cached?.address || tenant.contact?.address || '';
    this.brandingForm.latitude = branch.latitude ?? cached?.latitude ?? 10.077715;
    this.brandingForm.longitude = branch.longitude ?? cached?.longitude ?? -69.2812938;
    this.brandingForm.deliveryRadiusKm = Number(branch.deliveryRadiusKm ?? cached?.deliveryRadiusKm ?? 8.0);
    this.brandingForm.baseDeliveryFee = Number(branch.baseDeliveryFee ?? cached?.baseDeliveryFee ?? 2.50);

    const branchTiers = (Array.isArray(branch.deliveryTiers) && branch.deliveryTiers.length > 0)
      ? branch.deliveryTiers
      : (Array.isArray(cached?.deliveryTiers) && cached.deliveryTiers.length > 0 ? cached.deliveryTiers : tenant.deliverySettings?.deliveryTiers);

    if (Array.isArray(branchTiers) && branchTiers.length > 0) {
      this.brandingForm.deliveryTiers = JSON.parse(JSON.stringify(branchTiers));
    } else {
      this.brandingForm.deliveryTiers = [
        { id: 'tier_1', minKm: 0, maxKm: 2, price: 1.50 },
        { id: 'tier_2', minKm: 2, maxKm: 5, price: 3.00 },
        { id: 'tier_3', minKm: 5, maxKm: 8, price: 4.50 }
      ];
    }

    const curr = branch.currencySettings || (branch as any).currency_settings;
    this.brandingForm.exchangeRate = Number(branch.exchangeRate ?? curr?.exchangeRate ?? cached?.exchangeRate ?? tenant.currencySettings?.exchangeRate ?? 45.50);
    this.brandingForm.baseCurrency = (branch.baseCurrency || curr?.baseCurrency || cached?.baseCurrency || tenant.currencySettings?.baseCurrency || 'USD') as 'USD' | 'VES';
    this.brandingForm.displayMode = (branch.displayMode || curr?.displayMode || cached?.displayMode || tenant.currencySettings?.displayMode || 'usd_and_bs') as CurrencyDisplayMode;
    this.brandingForm.openTime = branch.businessHours?.open || branch.openTime || (branch as any).open_time || (branch as any).openTime || cached?.openTime || '11:00';
    this.brandingForm.closeTime = branch.businessHours?.close || branch.closeTime || (branch as any).close_time || (branch as any).closeTime || cached?.closeTime || '23:00';
    const bh = branch.businessHours as any;
    const bhRaw = (branch as any).business_hours as any;
    if (bh?.scheduleDays && Array.isArray(bh.scheduleDays)) {
      this.brandingForm.scheduleDays = JSON.parse(JSON.stringify(bh.scheduleDays));
    } else if (bhRaw?.scheduleDays && Array.isArray(bhRaw.scheduleDays)) {
      this.brandingForm.scheduleDays = JSON.parse(JSON.stringify(bhRaw.scheduleDays));
    } else if (cached?.scheduleDays && Array.isArray(cached.scheduleDays)) {
      this.brandingForm.scheduleDays = JSON.parse(JSON.stringify(cached.scheduleDays));
    }
  }

  applySchedulePreset(preset: 'all' | 'weekdays' | 'weekends'): void {
    const from = this.brandingForm.openTime || '11:00';
    const to = this.brandingForm.closeTime || '23:00';
    this.brandingForm.scheduleDays = this.brandingForm.scheduleDays.map((d: any) => {
      if (preset === 'all') return { ...d, open: true, from, to };
      if (preset === 'weekdays') {
        const isWk = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].includes(d.day);
        return { ...d, open: isWk, from, to };
      }
      if (preset === 'weekends') {
        const isWe = ['Sábado', 'Domingo'].includes(d.day);
        return { ...d, open: isWe, from, to };
      }
      return d;
    });
  }

  copyGeneralHoursToAllDays(): void {
    const from = this.brandingForm.openTime || '11:00';
    const to = this.brandingForm.closeTime || '23:00';
    this.brandingForm.scheduleDays.forEach((d: any) => {
      d.from = from;
      d.to = to;
    });
  }

  onConfigBranchChange(branchId: string): void {
    this.selectedConfigBranchId.set(branchId);
    const branch = this.branches().find(b => b.id === branchId);
    if (branch) {
      this.loadBrandingForBranch(branch);
    }
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
          this.updateSettingsLocationFromInputs();

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

  readonly ownRiders = signal<Rider[]>([]);
  readonly nearbyRiders = signal<Rider[]>([]);
  readonly isNearbyRidersModalOpen = signal(false);
  readonly isDispatchConfigModalOpen = signal(false);
  readonly selectedOrderForNearbyDispatch = signal<Order | null>(null);

  readonly dispatchFilterConfig = signal<{
    maxDistanceKm: number;
    minRating: number;
    minDeliveries: number;
    onlyAvailable: boolean;
  }>({
    maxDistanceKm: 15,
    minRating: 0,
    minDeliveries: 0,
    onlyAvailable: true
  });

  saveDispatchFilterConfig(config: { maxDistanceKm: number; minRating: number; minDeliveries: number; onlyAvailable: boolean }): void {
    this.dispatchFilterConfig.set(config);
    try {
      localStorage.setItem(`pidetelo_dispatch_config_${this.activeBranchId()}`, JSON.stringify(config));
    } catch (_) {}
    this.refreshRidersLocation();
    this.isDispatchConfigModalOpen.set(false);
  }

  getBusyRiderIds(excludeOrderId?: string): Set<string> {
    const busy = new Set<string>();
    this.orders().forEach(o => {
      if (o.id !== excludeOrderId && o.driverId && ['assigned_driver', 'at_merchant', 'picked_up', 'on_the_way'].includes(o.status)) {
        busy.add(o.driverId);
      }
    });
    return busy;
  }

  readonly filteredRiders = computed(() => {
    const branchId = this.activeBranchId();
    if (!branchId) return [];
    const isMain = this.isSelectedBranchMain();
    const busy = this.getBusyRiderIds();
    return this.riders().filter(r => (r.branchId === branchId || (isMain && !r.branchId) || r.isIndependent) && r.status === 'available' && !busy.has(r.id));
  });
  readonly availableRiders = computed(() => this.filteredRiders());

  getOwnRidersForOrder(order: Order): Rider[] {
    const busy = this.getBusyRiderIds(order.id);
    const list = this.ownRiders().filter(r => r.status === 'available' && !busy.has(r.id));
    if (list.length > 0) return list;
    const branchId = this.activeBranchId();
    if (!branchId) return [];
    const isMain = this.isSelectedBranchMain();
    return this.riders().filter(r => (r.branchId === branchId || (isMain && !r.branchId)) && !r.isIndependent && r.status === 'available' && !busy.has(r.id));
  }

  getNearbyRidersForOrder(order: Order): Rider[] {
    const busy = this.getBusyRiderIds(order.id);
    const list = this.nearbyRiders().filter(r => r.status === 'available' && !busy.has(r.id));
    if (list.length > 0) return list;
    return this.riders().filter(r => r.isIndependent && r.status === 'available' && !busy.has(r.id));
  }

  getRidersForOrder(order: Order): Rider[] {
    const own = this.getOwnRidersForOrder(order);
    const nearby = this.getNearbyRidersForOrder(order);
    if (own.length > 0 || nearby.length > 0) {
      return [...own, ...nearby];
    }
    const branchId = this.activeBranchId();
    if (!branchId) return [];
    const isMain = this.isSelectedBranchMain();
    const busy = this.getBusyRiderIds(order.id);
    return this.riders().filter(r => (r.branchId === branchId || (isMain && !r.branchId)) && r.status === 'available' && !busy.has(r.id));
  }

  openNearbyRidersModal(order: Order): void {
    this.selectedOrderForNearbyDispatch.set(order);
    this.isNearbyRidersModalOpen.set(true);
    this.refreshRidersLocation();
  }

  assignNearbyRider(riderId: string): void {
    const order = this.selectedOrderForNearbyDispatch();
    if (!order) return;
    this.assignRiderToOrder(order.id, riderId);
    this.isNearbyRidersModalOpen.set(false);
    this.selectedOrderForNearbyDispatch.set(null);
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

      if (tab === 'settings') {
        setTimeout(() => this.initSettingsLocationMap(), 200);
      } else {
        if (this.settingsLocationMap) {
          try {
            this.settingsLocationMap.remove();
          } catch (_) {}
          this.settingsLocationMap = undefined;
          this.settingsLocationMarker = undefined;
        }
      }

      if (tab === 'whatsapp') {
        this.loadWhatsAppInstance();
        this.loadWhatsAppConversations();
        if (!this.whatsappPollingInterval) {
          this.whatsappPollingInterval = setInterval(() => {
            if (this.activeTab() === 'whatsapp') {
              this.loadWhatsAppConversations(true);
              const sel = this.selectedWhatsAppConversation();
              if (sel) {
                this.loadWhatsAppMessages(sel.id, true);
              }
            }
          }, 5000);
        }
      } else {
        if (this.whatsappPollingInterval) {
          clearInterval(this.whatsappPollingInterval);
          this.whatsappPollingInterval = null;
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
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('deliveryhub_riders_auth');
      } catch (_) {}
    }
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
          if (parsed.openTime) this.brandingForm.openTime = parsed.openTime;
          if (parsed.closeTime) this.brandingForm.closeTime = parsed.closeTime;
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
      this.loadCoupons();
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
      try {
        this.realtimeChannel = this.supabase.subscribeToOrders(activeTenantId, (payload) => {
          console.log('[MerchantAdmin] Realtime event from Supabase:', payload);
          if (payload && payload.eventType === 'REJECTED_BY_RIDER' && payload.order) {
            triggerRejectionAlert(payload.order.orderNumber || payload.order.id, payload.order.riderName);
          }
          reloadOrders();
        });
      } catch (e) {
        console.warn('[MerchantAdmin] Realtime subscribeToOrders caught error:', e);
      }
    }

    // Polling de respaldo para órdenes y ubicación en vivo de motorizados (Supabase Realtime notifica al instante)
    this.ordersPollingInterval = setInterval(() => {
      reloadOrders();
    }, 5000);

    // Carga inicial, Realtime y polling de respaldo cada 4 segundos para telemetría GPS de motorizados
    this.refreshRidersLocation();
    try {
      this.supabase.subscribeToRiders(() => {
        this.refreshRidersLocation();
      });
    } catch (e) {
      console.warn('[MerchantAdmin] Realtime subscribeToRiders caught error:', e);
    }
    this.ridersPollingInterval = setInterval(() => {
      this.refreshRidersLocation();
    }, 4000);

    // Preload live exchange rate from DolarApi
    this.currency.fetchDolarApiRate('oficial').then(data => {
      if (data && typeof data.promedio === 'number' && data.promedio > 0) {
        const rate = Number(data.promedio.toFixed(2));
        this.liveExchangeRate.set(rate);
        this.brandingForm.exchangeRate = rate;
        this.bcvLastUpdated.set(data.fechaActualizacion);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.whatsappPollingInterval) {
      clearInterval(this.whatsappPollingInterval);
      this.whatsappPollingInterval = null;
    }
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
    const plan = this.currentSubscriptionPlan();
    const additionalUsers = this.storeUsers().filter((u: any) => u.role !== 'MERCHANT_OWNER').length;
    if (plan.maxAdditionalUsers !== -1 && additionalUsers >= plan.maxAdditionalUsers) {
      this.planModalLimitType.set('users');
      this.isUpgradePlanModalOpen.set(true);
      return;
    }
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

  // --- REFRESH TELEMETRÍA EN VIVO DE MOTORIZADOS (FLOTA PROPIA + FLOTA LIBRE CERCANA) ---
  refreshRidersLocation(): void {
    const targetBranch = this.activeBranch();
    const activeTenantId = this.auth.currentUser()?.tenantId || this.currentTenant()?.id || targetBranch?.companyId || 'dac59429-fd6f-4d3e-8b2e-ab0e23828c1f';
    if (!activeTenantId) {
      this.riders.set([]);
      this.ownRiders.set([]);
      this.nearbyRiders.set([]);
      return;
    }
    const branchFilter = this.activeBranchId();
    if (!branchFilter) {
      return;
    }

    const targetLat = targetBranch?.latitude || this.brandingForm.latitude || 10.038;
    const targetLng = targetBranch?.longitude || this.brandingForm.longitude || -69.266;

    const mapRawToRider = (r: any): Rider => {
      const rawLat = (r.current_lat !== undefined && r.current_lat !== null) ? Number(r.current_lat) : (r.currentLocation?.lat);
      const rawLng = (r.current_lng !== undefined && r.current_lng !== null) ? Number(r.current_lng) : (r.currentLocation?.lng);
      const isValid = typeof rawLat === 'number' && !isNaN(rawLat) && typeof rawLng === 'number' && !isNaN(rawLng);
      let currentLocation: { lat: number; lng: number } | undefined = undefined;
      if (isValid) {
        currentLocation = { lat: Number(rawLat.toFixed(6)), lng: Number(rawLng.toFixed(6)) };
      }
      const resolvedRiderBranchId = r.branch_id || (r as any).branchId || branchFilter;
      const branch = this.branches().find(b => b.id === resolvedRiderBranchId);

      return {
        id: r.id,
        name: r.name,
        phone: r.phone || '',
        vehiclePlate: r.vehicle_plate || (r as any).vehiclePlate || 'N/D',
        vehicleType: (r.vehicle_type as any) || (r as any).vehicleType || 'moto',
        status: (r.status as any) || 'available',
        branchId: resolvedRiderBranchId,
        branchName: branch?.name || r.branch_name || (r.is_independent ? 'Flota Libre Pídetelo' : 'Sede Asignada'),
        currentLocation,
        distanceKm: r.distanceKm != null ? Number(r.distanceKm) : (r.distance_km != null ? Number(r.distance_km) : undefined),
        isIndependent: !!(r.is_independent || (r as any).isIndependent),
        isCertified: !!(r.is_certified || (r as any).isCertified),
        rating: r.rating != null ? Number(r.rating) : 5.0,
      };
    };

    const cfg = this.dispatchFilterConfig();
    this.api.getDispatchPool(
      activeTenantId,
      branchFilter,
      targetLat,
      targetLng,
      cfg.minRating,
      cfg.maxDistanceKm,
      cfg.minDeliveries
    ).subscribe({
      next: (pool) => {
        if (pool && ((pool.ownRiders && pool.ownRiders.length > 0) || (pool.nearbyRiders && pool.nearbyRiders.length > 0))) {
          const mappedOwn = (pool.ownRiders || []).map(mapRawToRider);
          const mappedNearby = (pool.nearbyRiders || []).map(mapRawToRider);

          this.ownRiders.set(mappedOwn);
          this.nearbyRiders.set(mappedNearby);
          this.riders.set([...mappedOwn, ...mappedNearby]);

          if (this.activeTab() === 'gps_map' && this.fleetRadarMap) {
            this.updateFleetRiderMarkers();
          }
          return;
        }

        // Fallback standard fetch if pool returned empty
        this.api.getRiders(activeTenantId, branchFilter).subscribe(riders => {
          if (riders && riders.length > 0) {
            const isMain = this.isSelectedBranchMain();
            const branchRiders = riders.filter(r => {
              const rBId = r.branch_id || (r as any).branchId;
              return rBId === branchFilter || (isMain && !rBId) || r.is_independent;
            });
            const mapped = branchRiders.map(mapRawToRider);
            this.riders.set(mapped);
            this.ownRiders.set(mapped.filter(r => !r.isIndependent));
            this.nearbyRiders.set(mapped.filter(r => r.isIndependent));
          } else {
            this.riders.set([]);
            this.ownRiders.set([]);
            this.nearbyRiders.set([]);
          }
          if (this.activeTab() === 'gps_map' && this.fleetRadarMap) {
            this.updateFleetRiderMarkers();
          }
        });
      },
      error: () => {
        this.api.getRiders(activeTenantId, branchFilter).subscribe(riders => {
          if (riders && riders.length > 0) {
            const mapped = riders.map(mapRawToRider);
            this.riders.set(mapped);
            this.ownRiders.set(mapped.filter(r => !r.isIndependent));
            this.nearbyRiders.set(mapped.filter(r => r.isIndependent));
          } else {
            this.riders.set([]);
            this.ownRiders.set([]);
            this.nearbyRiders.set([]);
          }
          if (this.activeTab() === 'gps_map' && this.fleetRadarMap) {
            this.updateFleetRiderMarkers();
          }
        });
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

  // --- SELECTOR DE UBICACIÓN SATELITAL EN MAPA (AJUSTES DE SEDE) ---
  private settingsLocationMap?: L.Map;
  private settingsLocationMarker?: L.Marker;

  initSettingsLocationMap(retryCount = 0): void {
    const container = document.getElementById('settings-location-picker-map');
    if (!container) {
      if (retryCount < 8) {
        setTimeout(() => this.initSettingsLocationMap(retryCount + 1), 120);
      }
      return;
    }

    if (this.settingsLocationMap) {
      try { this.settingsLocationMap.remove(); } catch (_) {}
      this.settingsLocationMap = undefined;
      this.settingsLocationMarker = undefined;
    }

    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    const lat = Number(this.brandingForm.latitude) || 10.0385;
    const lng = Number(this.brandingForm.longitude) || -69.2482;

    this.settingsLocationMap = L.map(container, {
      zoomControl: true,
      attributionControl: false
    }).setView([lat, lng], 15);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.settingsLocationMap);

    const storeIcon = L.divIcon({
      className: 'leaflet-branch-marker',
      html: `
        <div style="background:${this.brandingForm.accentColor || '#f97316'};color:white;width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 16px rgba(0,0,0,0.3);border:2.5px solid white;cursor:grab;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
        </div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 21]
    });

    this.settingsLocationMarker = L.marker([lat, lng], {
      icon: storeIcon,
      draggable: true
    }).addTo(this.settingsLocationMap);

    this.settingsLocationMarker.on('dragend', (e: any) => {
      const pos = e.target.getLatLng();
      this.brandingForm.latitude = Number(pos.lat.toFixed(6));
      this.brandingForm.longitude = Number(pos.lng.toFixed(6));
    });

    this.settingsLocationMap.on('click', (e: any) => {
      const cLat = Number(e.latlng.lat.toFixed(6));
      const cLng = Number(e.latlng.lng.toFixed(6));
      this.brandingForm.latitude = cLat;
      this.brandingForm.longitude = cLng;
      this.settingsLocationMarker?.setLatLng([cLat, cLng]);
      this.settingsLocationMap?.panTo([cLat, cLng]);
    });

    setTimeout(() => this.settingsLocationMap?.invalidateSize(), 150);
    setTimeout(() => this.settingsLocationMap?.invalidateSize(), 400);
  }

  updateSettingsLocationFromInputs(): void {
    const lat = Number(this.brandingForm.latitude);
    const lng = Number(this.brandingForm.longitude);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      if (this.settingsLocationMarker && this.settingsLocationMap) {
        this.settingsLocationMarker.setLatLng([lat, lng]);
        this.settingsLocationMap.panTo([lat, lng]);
      }
    }
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

  assignRiderToOrder(orderId: string, riderId?: string | null): void {
    if (!riderId) return;

    let targetRiderId = riderId;
    if (riderId === 'auto_closest') {
      const order = this.orders().find(o => o.id === orderId);
      if (!order) return;
      const candidates = this.getRidersForOrder(order).filter(r => r.status === 'available');
      const sorted = [...candidates].sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return 0;
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });

      if (sorted.length === 0) {
        alert('No hay motorizados disponibles en este momento que cumplan con los filtros de despacho.');
        return;
      }
      targetRiderId = sorted[0].id;
    }

    const rider = this.riders().find(r => r.id === targetRiderId);
    this.orders.update(list =>
      list.map(o => o.id === orderId ? {
        ...o,
        driverId: targetRiderId,
        driverName: rider?.name,
        driverPhone: rider?.phone,
        status: 'assigned_driver',
        riderAccepted: false,
        riderRejected: false,
        rejectedRiderName: undefined
      } : o)
    );
    // 1. Direct Supabase update for immediate Realtime broadcast to mobile apps
    this.supabase.assignRider(orderId, targetRiderId).then(ok => {
      if (ok) console.log(`[MerchantAdmin] Repartidor asignado en Supabase: ${orderId} -> ${targetRiderId}`);
    });
    // 2. Backend update
    this.api.assignRider(orderId, targetRiderId).subscribe({
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
    if (!prod) {
      const plan = this.currentSubscriptionPlan();
      if (plan.maxProducts !== -1 && this.products().length >= plan.maxProducts) {
        this.planModalLimitType.set('products');
        this.isUpgradePlanModalOpen.set(true);
        return;
      }
    }
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
        is_popular: Boolean(prodToSave.isPopular),
        is_featured: Boolean(prodToSave.isFeatured),
        is_on_sale: Boolean(prodToSave.isOnSale),
        compare_at_price: prodToSave.compareAtPrice ? Number(prodToSave.compareAtPrice) : null,
        discount_percentage: Number(prodToSave.discountPercentage) || 0,
        track_stock: Boolean(prodToSave.trackStock),
        stock_quantity: Number(prodToSave.stockQuantity) || 0,
        modifierGroups: prodToSave.modifierGroups || []
      }).subscribe({
        next: () => {
          this.showToast('success', '¡Producto Actualizado!', `"${prodToSave.name}" se actualizó correctamente.`);
          console.log(`[MerchantAdmin] Producto ${prodToSave.id} actualizado`);
        },
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
        is_popular: Boolean(prodToSave.isPopular),
        is_featured: Boolean(prodToSave.isFeatured),
        is_on_sale: Boolean(prodToSave.isOnSale),
        compare_at_price: prodToSave.compareAtPrice ? Number(prodToSave.compareAtPrice) : null,
        discount_percentage: Number(prodToSave.discountPercentage) || 0,
        track_stock: Boolean(prodToSave.trackStock),
        stock_quantity: Number(prodToSave.stockQuantity) || 0,
        modifierGroups: prodToSave.modifierGroups || []
      }).subscribe({
        next: (created) => {
          this.showToast('success', '¡Nuevo Producto Guardado!', `"${prodToSave.name}" fue agregado al catálogo.`);
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
        localStorage.removeItem('deliveryhub_riders_auth');
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

  async deleteRider(rider: Rider): Promise<void> {
    const confirmed = await this.confirmModal.confirm(`¿Estás seguro de que deseas eliminar al motorizado ${rider.name} (${rider.vehiclePlate}) de esta sede?`);
    if (!confirmed) return;

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


  togglePaymentMethod(method: string): void {
    const list = this.brandingForm.acceptedPaymentMethods || [];
    if (list.includes(method)) {
      if (list.length > 1) {
        this.brandingForm.acceptedPaymentMethods = list.filter(m => m !== method);
      }
    } else {
      this.brandingForm.acceptedPaymentMethods = [...list, method];
    }
  }

  saveSettings(e?: Event): void {
    if (e) e.preventDefault();
    this.isSavingBranding.set(true);

    const targetBranch = this.currentConfigBranch();
    const activeTenantId = this.currentTenant().id || this.auth.currentUser()?.tenantId || '';

    if (targetBranch) {
      try {
        localStorage.setItem('deliveryhub_branch_branding_' + targetBranch.id, JSON.stringify(this.brandingForm));
      } catch (_) {}
    }
    if (activeTenantId && typeof window !== 'undefined') {
      try {
        localStorage.setItem('deliveryhub_branding_' + activeTenantId, JSON.stringify(this.brandingForm));
      } catch (_) {}
    }

    const branchPayload: any = {
      name: this.brandingForm.name,
      tagline: this.brandingForm.tagline,
      accentColor: this.brandingForm.accentColor,
      accent_color: this.brandingForm.accentColor,
      logoUrl: this.brandingForm.logoUrl,
      logo_url: this.brandingForm.logoUrl,
      bannerUrl: this.brandingForm.bannerUrl,
      banner_url: this.brandingForm.bannerUrl,
      whatsapp: this.brandingForm.whatsappNumber,
      whatsapp_number: this.brandingForm.whatsappNumber,
      phone: this.brandingForm.phone,
      address: this.brandingForm.address,
      latitude: Number(this.brandingForm.latitude),
      longitude: Number(this.brandingForm.longitude),
      deliveryRadiusKm: Number(this.brandingForm.deliveryRadiusKm),
      delivery_radius_km: Number(this.brandingForm.deliveryRadiusKm),
      baseDeliveryFee: Number(this.brandingForm.baseDeliveryFee),
      base_delivery_fee: Number(this.brandingForm.baseDeliveryFee),
      deliveryTiers: this.brandingForm.deliveryTiers,
      delivery_tiers: this.brandingForm.deliveryTiers,
      exchangeRate: Number(this.brandingForm.exchangeRate),
      exchange_rate: Number(this.brandingForm.exchangeRate),
      baseCurrency: this.brandingForm.baseCurrency,
      base_currency: this.brandingForm.baseCurrency,
      displayMode: this.brandingForm.displayMode,
      display_mode: this.brandingForm.displayMode,
      acceptedPaymentMethods: this.brandingForm.acceptedPaymentMethods,
      accepted_payment_methods: this.brandingForm.acceptedPaymentMethods,
      payment_credentials: {
        pago_movil_bank: this.brandingForm.pagoMovilBank,
        pago_movil_phone: this.brandingForm.pagoMovilPhone,
        pago_movil_id_number: this.brandingForm.pagoMovilIdNumber,
        pago_movil_account_name: this.brandingForm.pagoMovilAccountName,
        zelle_email: this.brandingForm.zelleEmail,
      },
      openTime: this.brandingForm.openTime,
      closeTime: this.brandingForm.closeTime,
      businessHours: {
        open: this.brandingForm.openTime,
        close: this.brandingForm.closeTime,
        isOpenToday: true,
        scheduleDays: this.brandingForm.scheduleDays
      },
      business_hours: {
        open: this.brandingForm.openTime,
        close: this.brandingForm.closeTime,
        isOpenToday: true,
        scheduleDays: this.brandingForm.scheduleDays
      },
      currencySettings: {
        baseCurrency: this.brandingForm.baseCurrency,
        displayMode: this.brandingForm.displayMode,
        exchangeRate: Number(this.brandingForm.exchangeRate),
        lastRateUpdate: new Date().toISOString()
      },
      currency_settings: {
        baseCurrency: this.brandingForm.baseCurrency,
        displayMode: this.brandingForm.displayMode,
        exchangeRate: Number(this.brandingForm.exchangeRate),
        lastRateUpdate: new Date().toISOString()
      }
    };

    // Actualizar la sucursal localmente de inmediato
    if (targetBranch) {
      this.branches.update(list => list.map(b => {
        if (b.id === targetBranch.id) {
          return {
            ...b,
            ...branchPayload,
            deliveryRadiusKm: Number(this.brandingForm.deliveryRadiusKm),
            baseDeliveryFee: Number(this.brandingForm.baseDeliveryFee),
            deliveryTiers: this.brandingForm.deliveryTiers,
            branding: {
              accentColor: this.brandingForm.accentColor,
              logoUrl: this.brandingForm.logoUrl,
              bannerUrl: this.brandingForm.bannerUrl
            }
          };
        }
        return b;
      }));
    }

    // Si es la sede principal o no hay sucursal específica, actualizar también el tenant global
    if (!targetBranch || targetBranch.isMain || targetBranch.name.toLowerCase().includes('principal')) {
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
        accepted_payment_methods: this.brandingForm.acceptedPaymentMethods,
        acceptedPaymentMethods: this.brandingForm.acceptedPaymentMethods,
        currency_settings: {
          baseCurrency: this.brandingForm.baseCurrency,
          displayMode: this.brandingForm.displayMode,
          exchangeRate: Number(this.brandingForm.exchangeRate),
          lastRateUpdate: new Date().toISOString(),
          acceptedPaymentMethods: this.brandingForm.acceptedPaymentMethods
        },
        business_hours: {
          open: this.brandingForm.openTime,
          close: this.brandingForm.closeTime,
          isOpenToday: true
        }
      }).subscribe({ error: (err) => console.warn('[MerchantAdmin] Sync tenant warning:', err) });
    }

    try {
      const storageKey = 'deliveryhub_branding_' + (targetBranch?.id || this.currentTenant().id);
      localStorage.setItem(storageKey, JSON.stringify({
        ...branchPayload,
        openTime: this.brandingForm.openTime,
        closeTime: this.brandingForm.closeTime
      }));
    } catch (_) {}

    // Guardar específicamente la sucursal seleccionada en el backend
    if (targetBranch) {
      this.api.updateBranch(targetBranch.id, branchPayload).subscribe({
        next: (updatedBranch) => {
          this.isSavingBranding.set(false);
          this.isSavedNotificationVisible.set(true);
          setTimeout(() => this.isSavedNotificationVisible.set(false), 3000);
          console.log('[MerchantAdmin] Configuración guardada para sucursal:', updatedBranch?.name || targetBranch.name);
          if (updatedBranch) {
            this.branches.update(list => list.map(b => b.id === updatedBranch.id ? { ...b, ...updatedBranch } : b));
          }
          setTimeout(() => {
            if (this.branchesMap) {
              this.initBranchesMap();
            }
          }, 250);
        },
        error: (err) => {
          this.isSavingBranding.set(false);
          console.warn('[MerchantAdmin] Error al guardar sucursal:', err);
        }
      });
    } else {
      this.isSavingBranding.set(false);
      this.isSavedNotificationVisible.set(true);
      setTimeout(() => this.isSavedNotificationVisible.set(false), 3000);
    }
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

      if (!this.selectedConfigBranchId()) {
        const target = this.currentConfigBranch();
        if (target) {
          this.loadBrandingForBranch(target);
        }
      }

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
      this.planModalLimitType.set('branches');
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



  copyWhatsAppGreeting(branch: Branch): void {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://pidetelo.com';
    const tenant = this.currentTenant();
    const slug = tenant?.slug || 'burger-king';
    const branchParam = branch.slug || branch.id;
    const link = `${origin}/t/${slug}?branch=${branchParam}`;
    const storeName = tenant?.name || 'nuestro restaurante';
    const branchName = branch.name || 'Sede Principal';

    const text = `¡Hola! 👋 Gracias por comunicarte con *${storeName}* (${branchName}). 🍔✨\n\n` +
      `Para ver nuestro menú actualizado con fotos, precios en $ y Bs, y hacer tu pedido sin esperas, ingresa aquí:\n\n` +
      `🌐 *Haz tu pedido en línea:* \n${link}\n\n` +
      `📲 *O pide desde nuestra App Móvil oficial:*\n` +
      `• Descárgala en tu teléfono para ordenar con 1 clic y rastrear a tu repartidor en tiempo real: ${origin}/descargar\n\n` +
      `¡Tu orden entrará directo a cocina y podrás pagar en línea o al recibir! 🛵💨`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert(`✓ ¡Mensaje de Bienvenida copiado al portapapeles!\n\nPégalo en WhatsApp Business en:\nAjustes > Herramientas para la empresa > Mensaje de bienvenida.`);
      }).catch(() => {
        prompt('Copia este texto para la respuesta automática de WhatsApp:', text);
      });
    } else {
      prompt('Copia este texto para la respuesta automática de WhatsApp:', text);
    }
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

  // --- GESTIÓN DE CUPONES DE OFERTA DEL COMERCIO ---
  loadCoupons(): void {
    const tenantId = this.currentTenant().id || this.auth.currentUser()?.tenantId;
    if (!tenantId) return;
    this.api.getCoupons(tenantId).subscribe(coupons => {
      this.coupons.set(coupons || []);
    });
  }

  openNewCouponModal(): void {
    this.editingCoupon = {
      tenantId: this.currentTenant().id || this.auth.currentUser()?.tenantId || '',
      code: '',
      description: '',
      discountType: 'percentage',
      discountValue: 10,
      minOrderAmount: 0,
      isActive: true
    };
    this.isCouponModalOpen.set(true);
  }

  openEditCouponModal(c: Coupon): void {
    this.editingCoupon = { ...c };
    this.isCouponModalOpen.set(true);
  }

  openNotifyCouponModal(c: Coupon): void {
    this.selectedCouponToNotify.set(c);
    this.notificationCondition.set('all');
    this.notificationCustomMessage.set(`¡Aprovecha hoy un ${c.discountType === 'percentage' ? c.discountValue + '% OFF' : '$' + c.discountValue + ' OFF'} usando el cupón ${c.code} en nuestro menú!`);
    this.isNotifyCouponModalOpen.set(true);
  }

  sendCouponNotification(): void {
    const c = this.selectedCouponToNotify();
    if (!c) return;
    this.isSendingNotification.set(true);

    const tenantName = this.currentTenant()?.name || 'Comercio';
    this.api.notifyCoupon(c.id, this.notificationCondition(), tenantName, this.notificationCustomMessage().trim()).subscribe({
      next: (res: any) => {
        this.isSendingNotification.set(false);
        this.isNotifyCouponModalOpen.set(false);
        this.showToast('success', '¡Notificación Enviada!', `El cupón ${c.code} fue notificado a los clientes según el criterio seleccionado.`);
        this.loadCoupons();
      },
      error: (err: any) => {
        this.isSendingNotification.set(false);
        this.showToast('error', 'Error al Notificar', err.error?.message || 'No se pudo enviar la notificación a los clientes.');
      }
    });
  }

  saveCoupon(): void {
    if (!this.editingCoupon.code) return;
    this.isSavingCoupon.set(true);
    const tenantId = this.currentTenant().id || this.auth.currentUser()?.tenantId || '';
    this.editingCoupon.tenantId = tenantId;

    if (this.editingCoupon.id) {
      this.api.updateCoupon(this.editingCoupon.id, this.editingCoupon).subscribe({
        next: () => {
          this.isSavingCoupon.set(false);
          this.isCouponModalOpen.set(false);
          this.loadCoupons();
          this.showToast('success', '¡Cupón Actualizado!', `El cupón "${this.editingCoupon.code}" fue guardado exitosamente.`);
          this.couponActionNotice.set(`✓ Cupón "${this.editingCoupon.code}" actualizado con éxito.`);
          setTimeout(() => this.couponActionNotice.set(null), 3500);
        },
        error: () => this.isSavingCoupon.set(false)
      });
    } else {
      this.api.createCoupon(this.editingCoupon).subscribe({
        next: (created) => {
          this.isSavingCoupon.set(false);
          this.isCouponModalOpen.set(false);
          this.loadCoupons();
          this.showToast('success', '¡Cupón Creado!', `El cupón de oferta "${created.code}" ya está activo para tus clientes.`);
          this.couponActionNotice.set(`✓ Cupón "${created.code}" creado con éxito.`);
          setTimeout(() => this.couponActionNotice.set(null), 3500);
        },
        error: () => this.isSavingCoupon.set(false)
      });
    }
  }

  toggleCouponActive(c: Coupon): void {
    const nextVal = !c.isActive;
    this.api.updateCoupon(c.id, { isActive: nextVal }).subscribe(() => {
      this.coupons.update(list => list.map(item => item.id === c.id ? { ...item, isActive: nextVal } : item));
      this.showToast('info', 'Estado Actualizado', `Cupón ${c.code} ahora está ${nextVal ? 'activo' : 'pausado'}.`);
    });
  }

  async deleteCoupon(c: Coupon): Promise<void> {
    const confirmed = await this.confirmModal.confirm(`¿Eliminar el cupón de oferta "${c.code}"?`);
    if (!confirmed) return;
    this.api.deleteCoupon(c.id).subscribe(() => {
      this.coupons.update(list => list.filter(item => item.id !== c.id));
      this.showToast('info', 'Cupón Eliminado', `El cupón "${c.code}" fue eliminado.`);
      this.couponActionNotice.set(`Cupón "${c.code}" eliminado.`);
      setTimeout(() => this.couponActionNotice.set(null), 3500);
    });
  }

  // ================= WHATSAPP BOT & CENTRAL DE MENSAJERIA =================
  getEffectiveTenantId(): string {
    return this.currentTenant().id || this.auth.currentUser()?.tenantId || '';
  }

  loadWhatsAppInstance(): void {
    const tenantId = this.getEffectiveTenantId();
    if (!tenantId) return;
    const branchId = this.activeBranch()?.id;
    this.api.getWhatsAppInstance(tenantId, branchId).subscribe({
      next: (instance) => {
        this.whatsappInstance.set(instance);
        if (instance) {
          this.whatsappSettings.set({
            greetingMessage: instance.greeting_message || '¡Hola! Bienvenido a nuestro canal oficial de atención. ¿En qué podemos ayudarte hoy?',
            autoReplyEnabled: instance.auto_reply_enabled ?? true,
            pauseDurationMinutes: instance.pause_duration_minutes ?? 120
          });
        }
      },
      error: (err) => {
        console.error('Error loading WhatsApp instance:', err);
      }
    });
  }

  getFormattedQrCode(): string | null {
    const inst = this.whatsappInstance();
    const raw = inst?.qr_code;
    if (!raw) return null;
    if (raw.startsWith('http') || raw.startsWith('data:')) {
      return raw;
    }
    if (raw.startsWith('iVBORw') || raw.length > 500) {
      return `data:image/png;base64,${raw}`;
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(raw)}`;
  }

  connectWhatsApp(): void {
    const tenantId = this.getEffectiveTenantId();
    if (!tenantId) return;
    const branchId = this.activeBranch()?.id;
    this.isConnectingWhatsApp.set(true);
    this.api.connectWhatsAppInstance(tenantId, branchId).subscribe({
      next: (res) => {
        this.isConnectingWhatsApp.set(false);
        const inst = res?.instance || res;
        this.whatsappInstance.set(inst);
        if (inst?.qr_code) {
          this.showToast('success', 'WhatsApp', 'Código QR generado. Escanéalo con tu teléfono.');
        } else if (inst?.status === 'connected') {
          this.showToast('success', 'WhatsApp', 'WhatsApp ya se encuentra conectado.');
        } else {
          this.showToast('info', 'WhatsApp', 'Instancia iniciada. Escanea el código QR.');
        }
      },
      error: (err) => {
        this.isConnectingWhatsApp.set(false);
        this.showToast('error', 'Error WhatsApp', err.error?.message || 'No se pudo iniciar la conexión con WhatsApp.');
      }
    });
  }

  async disconnectWhatsApp(): Promise<void> {
    const tenantId = this.getEffectiveTenantId();
    if (!tenantId) return;
    const branchId = this.activeBranch()?.id;
    const confirmed = await this.confirmModal.confirm('¿Estás seguro de que deseas desconectar este número de WhatsApp? El bot dejará de responder.');
    if (!confirmed) return;

    this.api.disconnectWhatsAppInstance(tenantId, branchId).subscribe({
      next: () => {
        this.loadWhatsAppInstance();
        this.showToast('info', 'WhatsApp Desconectado', 'Se ha cerrado la sesión de WhatsApp.');
      },
      error: (err) => {
        this.showToast('error', 'Error', err.error?.message || 'No se pudo desconectar.');
      }
    });
  }

  saveWhatsAppSettings(): void {
    const tenantId = this.getEffectiveTenantId();
    if (!tenantId) return;
    const branchId = this.activeBranch()?.id;
    this.api.updateWhatsAppSettings(tenantId, this.whatsappSettings(), branchId).subscribe({
      next: (updated) => {
        this.whatsappInstance.set(updated);
        this.showToast('success', 'Configuración Guardada', 'Los ajustes de respuestas y bienvenida han sido actualizados.');
      },
      error: (err) => {
        this.showToast('error', 'Error al Guardar', err.error?.message || 'No se pudieron guardar los ajustes.');
      }
    });
  }

  loadWhatsAppConversations(silent = false): void {
    const tenantId = this.getEffectiveTenantId();
    if (!tenantId) return;
    if (!silent) this.isLoadingWhatsApp.set(true);
    this.api.getWhatsAppConversations(tenantId).subscribe({
      next: (convs) => {
        this.whatsappConversations.set(convs || []);
        if (!silent) this.isLoadingWhatsApp.set(false);
      },
      error: (err) => {
        if (!silent) this.isLoadingWhatsApp.set(false);
        console.error('Error loading conversations:', err);
      }
    });
  }

  selectWhatsAppConversation(conv: any): void {
    this.selectedWhatsAppConversation.set(conv);
    this.loadWhatsAppMessages(conv.id);
  }

  loadWhatsAppMessages(conversationId: string, silent = false): void {
    this.api.getWhatsAppMessages(conversationId).subscribe({
      next: (msgs) => {
        this.whatsappMessages.set(msgs || []);
      },
      error: (err) => {
        console.error('Error loading messages:', err);
      }
    });
  }

  sendWhatsAppChatMessage(): void {
    const text = this.whatsappNewMessageText().trim();
    const conv = this.selectedWhatsAppConversation();
    if (!text || !conv) return;

    this.isSendingWhatsApp.set(true);
    this.api.sendWhatsAppMessage(conv.id, text).subscribe({
      next: (res) => {
        this.isSendingWhatsApp.set(false);
        this.whatsappNewMessageText.set('');
        this.loadWhatsAppMessages(conv.id, true);
        this.loadWhatsAppConversations(true);
        this.selectedWhatsAppConversation.update(c => c ? { ...c, mode: 'human' } : null);
      },
      error: (err) => {
        this.isSendingWhatsApp.set(false);
        this.showToast('error', 'Error al Enviar', err.error?.message || 'No se pudo enviar el mensaje.');
      }
    });
  }

  toggleWhatsAppBotMode(mode: 'bot' | 'human'): void {
    const conv = this.selectedWhatsAppConversation();
    if (!conv) return;
    const duration = this.whatsappSettings().pauseDurationMinutes || 120;
    this.api.toggleWhatsAppBotMode(conv.id, mode, duration).subscribe({
      next: (res) => {
        this.selectedWhatsAppConversation.update(c => c ? { ...c, mode: res.mode, paused_until: res.paused_until } : null);
        this.loadWhatsAppConversations(true);
        this.showToast('info', 'Modo WhatsApp', mode === 'human' ? `Bot pausado por ${duration} minutos. Estás atendiendo como Operador.` : 'Bot reanudado para este cliente.');
      },
      error: (err) => {
        this.showToast('error', 'Error', err.error?.message || 'No se pudo cambiar el modo.');
      }
    });
  }

  resumeAllWhatsAppBots(): void {
    const tenantId = this.getEffectiveTenantId();
    if (!tenantId) return;
    this.api.resumeAllWhatsAppBots(tenantId).subscribe({
      next: () => {
        this.whatsappConversations.update(list => list.map(c => ({ ...c, mode: 'bot', paused_until: null })));
        if (this.selectedWhatsAppConversation()) {
          this.selectedWhatsAppConversation.update(c => c ? { ...c, mode: 'bot', paused_until: null } : null);
        }
        this.showToast('success', 'Bot Activado para Todos', 'El bot responderá automáticamente a todos los clientes.');
      },
      error: (err) => {
        this.showToast('error', 'Error', err.error?.message || 'No se pudo activar el bot para todos.');
      }
    });
  }

  async logout(): Promise<void> {
    await this.supabase.signOut();
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  exportOrdersToExcel(): void {
    const plan = this.currentSubscriptionPlan();
    if (!plan.hasExcelReports) {
      this.planModalLimitType.set('excel');
      this.isUpgradePlanModalOpen.set(true);
      return;
    }

    const ordersList = this.filteredOrders();
    if (ordersList.length === 0) {
      alert('No hay pedidos disponibles para exportar en este momento.');
      return;
    }

    const headers = ['Nro Pedido', 'Fecha y Hora', 'Cliente', 'Telefono', 'Tipo', 'Sucursal', 'Estado', 'Metodo de Pago', 'Total USD', 'Total Bs'];
    const rows = ordersList.map(o => [
      `"${o.orderNumber || o.id}"`,
      `"${o.createdAt ? new Date(o.createdAt).toLocaleString() : ''}"`,
      `"${(o.customer?.name || 'Cliente').replace(/"/g, '""')}"`,
      `"${o.customer?.phone || ''}"`,
      `"${o.fulfillmentType === 'pickup' ? 'Para Llevar / Retiro' : 'Delivery'}"`,
      `"${(o.branchName || 'Sede Principal').replace(/"/g, '""')}"`,
      `"${o.status}"`,
      `"${o.paymentMethod || 'Pago Movil'}"`,
      `"${(Number(o.total) || 0).toFixed(2)}"`,
      `"${((Number(o.total) || 0) * (this.activeExchangeRate() || 54.50)).toFixed(2)}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_Pedidos_${this.currentTenant()?.slug || 'Pidetelo'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

}
