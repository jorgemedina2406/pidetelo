import { ConfirmService } from '../../core/services/confirm.service';
import { Component, inject, signal, computed, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import * as L from 'leaflet';
import { AuthStore } from '../../core/stores/auth.store';
import { ThemeService } from '../../core/services/theme.service';
import { I18nService } from '../../core/services/i18n.service';
import { Product, ProductModifierGroup, ProductCategory } from '../../core/models/product.model';
import { Order, OrderStatus, OrderAddition, parseOrderAdditions, updateAdditionTagInNotes } from '../../core/models/order.model';

type OrderRiderPhase =
  | 'none'
  | 'assigned_pending'
  | 'accepted'
  | 'at_merchant'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered'
  | 'rejected'
  | 'cancelled';
import { AppUser, UserRole } from '../../core/models/user.model';
import { Tenant, CurrencyDisplayMode, DeliveryTier } from '../../core/models/tenant.model';
import { Branch, SubscriptionPlan } from '../../core/models/branch.model';
import { Coupon } from '../../core/models/coupon.model';
import { IconComponent } from '../../shared/components/icon.component';
import { CARACAS_DELIVERY_ROUTE } from '../../core/constants/street-route.data';
import { CurrencyService } from '../../core/services/currency.service';
import { ApiService } from '../../core/services/api.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ProductFormModalComponent } from './components/product-form-modal/product-form-modal.component';
import { BulkImportModalComponent } from './components/bulk-import-modal/bulk-import-modal.component';
import { BranchFormModalComponent } from './components/branch-form-modal/branch-form-modal.component';
import { DeleteBranchModalComponent } from './components/delete-branch-modal/delete-branch-modal.component';
import { PlanUpgradeModalComponent } from './components/plan-upgrade-modal/plan-upgrade-modal.component';
import { OrderRouteModalComponent } from './components/order-route-modal/order-route-modal.component';
import { OrderDetailModalComponent } from './components/order-detail-modal/order-detail-modal.component';
import { RiderFormModalComponent } from './components/rider-form-modal/rider-form-modal.component';
import { UserFormModalComponent } from './components/user-form-modal/user-form-modal.component';
import { MerchantCouponModalComponent } from './components/coupon-form-modal/coupon-form-modal.component';
import { MerchantCouponNotifyModalComponent } from './components/coupon-notify-modal/coupon-notify-modal.component';
import { NearbyRidersModalComponent } from './components/nearby-riders-modal/nearby-riders-modal.component';
import { DispatchConfigModalComponent } from './components/dispatch-config-modal/dispatch-config-modal.component';
import { PayoutPolicyModalComponent } from './components/payout-policy-modal/payout-policy-modal.component';
import { MerchantCouponsTabComponent } from './components/merchant-coupons-tab/merchant-coupons-tab.component';
import { MerchantRidersTabComponent } from './components/merchant-riders-tab/merchant-riders-tab.component';
import { MerchantUsersTabComponent } from './components/merchant-users-tab/merchant-users-tab.component';
import { MerchantReviewsTabComponent } from './components/merchant-reviews-tab/merchant-reviews-tab.component';
import { MerchantWhatsappTabComponent } from './components/merchant-whatsapp-tab/merchant-whatsapp-tab.component';
import { MerchantSidebarComponent } from './components/merchant-sidebar/merchant-sidebar.component';
import { MerchantHeaderComponent } from './components/merchant-header/merchant-header.component';
import { MerchantOrdersTabComponent } from './components/merchant-orders-tab/merchant-orders-tab.component';
import { MerchantProductsTabComponent } from './components/merchant-products-tab/merchant-products-tab.component';
import { MerchantBranchesTabComponent } from './components/merchant-branches-tab/merchant-branches-tab.component';
import { MerchantGpsTabComponent } from './components/merchant-gps-tab/merchant-gps-tab.component';
import { MerchantSettingsTabComponent } from './components/merchant-settings-tab/merchant-settings-tab.component';
import { SupportKanbanComponent } from '../../shared/components/support-kanban/support-kanban.component';
import { RiderWithdrawal } from '../../core/models/rider-withdrawal.model';

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
  totalDeliveries?: number;
  walletBalance?: number;
  tenantId?: string;
}

export interface OrderAdditionAlert {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  addedSummary?: string;
  addedAmountUsd: number;
  addedAmountBs?: number;
  paymentMethod?: 'cash' | 'mobile_transfer';
  paymentReference?: string;
  needsPaymentVerification: boolean;
  timestamp: string;
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
    PayoutPolicyModalComponent,
    MerchantCouponsTabComponent,
    MerchantRidersTabComponent,
    MerchantUsersTabComponent,
    MerchantReviewsTabComponent,
    MerchantWhatsappTabComponent,
    MerchantSidebarComponent,
    MerchantHeaderComponent,
    MerchantOrdersTabComponent,
    MerchantProductsTabComponent,
    MerchantBranchesTabComponent,
    MerchantGpsTabComponent,
    MerchantSettingsTabComponent,
    SupportKanbanComponent
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
  readonly activeTab = signal<'orders' | 'products' | 'branches' | 'riders' | 'gps_map' | 'users' | 'settings' | 'coupons' | 'whatsapp' | 'support' | 'reviews'>('orders');

  // --- VALORACIONES POR SUCURSAL ---
  readonly branchReviews = signal<any[]>([]);
  readonly isLoadingReviews = signal<boolean>(false);
  readonly selectedReviewBranchId = signal<string>('all');

  readonly filteredBranchReviews = computed(() => {
    const list = this.branchReviews();
    const branchFilter = this.selectedReviewBranchId();
    if (!branchFilter || branchFilter === 'all') return list;
    return list.filter(r => r.branch_id === branchFilter || r.branchId === branchFilter);
  });

  readonly reviewsAverage = computed(() => {
    const list = this.filteredBranchReviews();
    if (!list || list.length === 0) return 5.0;
    const sum = list.reduce((acc, curr) => acc + (Number(curr.rating) || 5), 0);
    return Number((sum / list.length).toFixed(1));
  });

  readonly reviewsStarCounts = computed<Record<number, number>>(() => {
    const list = this.filteredBranchReviews();
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of list) {
      const star = Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5)));
      counts[star] = (counts[star] || 0) + 1;
    }
    return counts;
  });

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
  readonly activeToasts = signal<{ id: string; type: 'success' | 'error' | 'info' | 'warning'; title: string; message: string; replaceKey?: string }[]>([]);

  showToast(type: 'success' | 'error' | 'info' | 'warning', title: string, message: string, replaceKey?: string): void {
    const id = `toast_${Date.now()}_${Math.random()}`;
    this.activeToasts.update(list => [
      ...(replaceKey ? list.filter(t => t.replaceKey !== replaceKey) : list),
      { id, type, title, message, replaceKey }
    ]);
    const duration = type === 'warning' ? 9000 : 5000;
    setTimeout(() => {
      this.activeToasts.update(list => list.filter(t => t.id !== id));
    }, duration);
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
    if (!cred) return false;
    const pm = cred.pago_movil || cred;
    const bank = String(pm.bank_name || cred.pagoMovilBank || cred.pago_movil_bank || '').trim();
    const phone = String(pm.phone || cred.pagoMovilPhone || cred.pago_movil_phone || '').replace(/\D/g, '');
    const idNum = String(pm.id_number || cred.pagoMovilIdNumber || cred.pago_movil_id_number || '').replace(/\D/g, '');

    if (bank.length < 2 || phone.length < 10 || idNum.length < 5) return false;
    if (phone === '04121234567' || phone === '04140000000' || phone.includes('1234567')) return false;
    if (idNum.includes('50123456') || idNum.includes('12345678') || idNum === '00000000') return false;
    return true;
  }

  hasValidPaymentMethods(branch: any): boolean {
    if (!branch) return false;
    let rawMethods = branch.acceptedPaymentMethods ?? 
                     branch.accepted_payment_methods ?? 
                     branch.currencySettings?.acceptedPaymentMethods ?? 
                     branch.currency_settings?.acceptedPaymentMethods;
    let methods: string[] = [];
    if (Array.isArray(rawMethods)) {
      methods = rawMethods;
    } else if (rawMethods && typeof rawMethods === 'object') {
      methods = Object.keys(rawMethods).filter(k => Boolean(rawMethods[k]));
    }
    const normalizedMethods = methods.map(m => {
      const s = String(m).toLowerCase().trim();
      if (s === 'pago_movil') return 'mobile_transfer';
      if (s === 'efectivo') return 'cash_usd';
      if (s === 'tarjeta') return 'card_terminal';
      return s;
    });
    if (normalizedMethods.length === 0) return false;
    const creds = branch.paymentCredentials || branch.payment_credentials || {};
    const isPmValid = this.isRealPagoMovil(creds);
    const zEmail = String(creds.zelleEmail || branch.zelleEmail || '').trim();
    const isZelleValid = zEmail.includes('@') && zEmail.length >= 5;

    const valid = normalizedMethods.filter(method => {
      if (method === 'mobile_transfer') return isPmValid;
      if (method === 'zelle') return isZelleValid;
      if (method === 'cash_usd' || method === 'cash_local' || method === 'card_terminal') return true;
      return false;
    });
    return valid.length > 0;
  }

  readonly isPaymentConfigMissing = computed<boolean>(() => {
    const branch = this.activeBranch();
    if (!branch) return false;
    return !this.hasValidPaymentMethods(branch);
  });

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
    let rawCode = (tenant?.planCode || tenant?.plan_code || tenant?.subscriptionPlanId || 'COMERCIO_PRO').toUpperCase();
    if (rawCode === 'COMERCIO') rawCode = 'COMERCIO_PRO';
    if (rawCode === 'CORPORATIVO') rawCode = 'FRANQUICIA';

    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('pidetelo_tenant_plans');
        if (stored) {
          const map = JSON.parse(stored);
          const local = map[tenant?.id] || (tenant?.slug ? map[tenant?.slug] : null);
          if (local) {
            const cleanLocal = local.toUpperCase() === 'CORPORATIVO' ? 'FRANQUICIA' : (local.toUpperCase() === 'COMERCIO' ? 'COMERCIO_PRO' : local.toUpperCase());
            rawCode = cleanLocal;
          }
        }
      } catch (_) { }
    }

    const found = plans.find(p => p.code === rawCode || p.id === rawCode);
    if (found) {
      return {
        ...found,
        name: rawCode === 'FRANQUICIA' ? 'Plan Pro' : (rawCode === 'COMERCIO_PRO' ? 'Plan Mediano' : 'Plan Básico'),
        hasWhatsappBot: true,
        hasExcelReports: rawCode === 'FRANQUICIA' || rawCode === 'COMERCIO_PRO' || found.hasExcelReports,
        hasFeaturedBanners: rawCode === 'FRANQUICIA' || found.hasFeaturedBanners,
        maxBranches: rawCode === 'FRANQUICIA' ? 4 : (rawCode === 'COMERCIO_PRO' ? 2 : 0),
        maxProducts: rawCode === 'FRANQUICIA' ? 500 : (rawCode === 'COMERCIO_PRO' ? 150 : 50),
        maxMonthlyOrders: -1,
        maxAdditionalUsers: rawCode === 'FRANQUICIA' ? 10 : (rawCode === 'COMERCIO_PRO' ? 3 : 1),
        maxRiders: rawCode === 'FRANQUICIA' ? 10 : (rawCode === 'COMERCIO_PRO' ? 6 : 3)
      };
    }

    return this.api.getDefaultSubscriptionPlans().find(p => p.code === rawCode) || this.api.getDefaultSubscriptionPlans()[1];
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
  readonly isProductLimitReached = computed(() => {
    const plan = this.currentSubscriptionPlan();
    return plan.maxProducts !== -1 && this.products().length >= plan.maxProducts;
  });
  readonly isPlanExpiringSoon = computed(() => {
    const d = this.currentTenant()?.daysRemaining;
    return d !== undefined && d <= 5;
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

  merchantLogoFailed = false;

  get merchantLogoUrl(): string | null {
    if (this.merchantLogoFailed) return null;
    const raw = this.brandingForm.logoUrl ||
                this.activeBranch()?.logoUrl ||
                (this.activeBranch() as any)?.logo_url ||
                this.currentTenant()?.branding?.logoUrl ||
                this.currentTenant()?.logoUrl ||
                (this.currentTenant() as any)?.logo_url;
    return (raw && typeof raw === 'string' && raw.trim().length > 0) ? raw.trim() : null;
  }

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
      const raw = localStorage.getItem('pidetelo_branch_branding_' + branch.id);
      if (raw) cached = JSON.parse(raw);
    } catch (_) { }

    this.brandingForm.name = branch.name || tenant.name || cached?.name || '';
    this.brandingForm.tagline = branch.tagline || tenant.tagline || cached?.tagline || '';
    this.brandingForm.accentColor = branch.accentColor || tenant.branding?.accentColor || cached?.accentColor || '#f97316';
    this.brandingForm.logoUrl = branch.logoUrl || tenant.branding?.logoUrl || cached?.logoUrl || '';
    this.merchantLogoFailed = false;
    this.brandingForm.bannerUrl = branch.bannerUrl || tenant.branding?.bannerUrl || cached?.bannerUrl || '';
    this.brandingForm.whatsappNumber = branch.whatsapp || branch.phone || tenant.contact?.whatsappNumber || cached?.whatsappNumber || '';
    this.brandingForm.phone = branch.phone || tenant.contact?.phone || cached?.phone || '';
    this.brandingForm.address = branch.address || tenant.contact?.address || cached?.address || '';
    this.brandingForm.latitude = branch.latitude ?? tenant.contact?.coordinates?.lat ?? cached?.latitude ?? 10.077715;
    this.brandingForm.longitude = branch.longitude ?? tenant.contact?.coordinates?.lng ?? cached?.longitude ?? -69.2812938;
    this.brandingForm.deliveryRadiusKm = Number(branch.deliveryRadiusKm ?? tenant.deliverySettings?.deliveryRadiusKm ?? cached?.deliveryRadiusKm ?? 8.0);
    this.brandingForm.baseDeliveryFee = Number(branch.baseDeliveryFee ?? tenant.deliverySettings?.baseDeliveryFee ?? cached?.baseDeliveryFee ?? 2.50);

    const branchTiers = (Array.isArray(branch.deliveryTiers) && branch.deliveryTiers.length > 0)
      ? branch.deliveryTiers
      : ((Array.isArray(tenant.deliverySettings?.deliveryTiers) && tenant.deliverySettings!.deliveryTiers!.length > 0) 
          ? tenant.deliverySettings!.deliveryTiers 
          : (Array.isArray(cached?.deliveryTiers) && cached.deliveryTiers.length > 0 ? cached.deliveryTiers : null));

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
    this.brandingForm.exchangeRate = Number(branch.exchangeRate ?? curr?.exchangeRate ?? tenant.currencySettings?.exchangeRate ?? cached?.exchangeRate ?? 45.50);
    this.brandingForm.baseCurrency = (branch.baseCurrency || curr?.baseCurrency || tenant.currencySettings?.baseCurrency || cached?.baseCurrency || 'USD') as 'USD' | 'VES';
    this.brandingForm.displayMode = (branch.displayMode || curr?.displayMode || tenant.currencySettings?.displayMode || cached?.displayMode || 'usd_and_bs') as CurrencyDisplayMode;

    const rawMethods = branch.acceptedPaymentMethods ?? 
                       (branch as any).accepted_payment_methods ?? 
                       curr?.acceptedPaymentMethods ?? 
                       curr?.accepted_payment_methods ?? 
                       cached?.acceptedPaymentMethods;
    if (Array.isArray(rawMethods)) {
      this.brandingForm.acceptedPaymentMethods = [...rawMethods];
    } else {
      this.brandingForm.acceptedPaymentMethods = [];
    }

    const payCreds: any = branch.paymentCredentials || (branch as any).payment_credentials || (branch as any).branch_payment_credentials;
    if (payCreds) {
      const pm = payCreds.pago_movil || payCreds;
      this.brandingForm.pagoMovilBank = pm.bank_name || payCreds.pagoMovilBank || payCreds.pago_movil_bank || cached?.pagoMovilBank || this.brandingForm.pagoMovilBank;
      this.brandingForm.pagoMovilPhone = pm.phone || payCreds.pagoMovilPhone || payCreds.pago_movil_phone || cached?.pagoMovilPhone || this.brandingForm.pagoMovilPhone;
      this.brandingForm.pagoMovilIdNumber = pm.id_number || payCreds.pagoMovilIdNumber || payCreds.pago_movil_id_number || cached?.pagoMovilIdNumber || this.brandingForm.pagoMovilIdNumber;
      this.brandingForm.pagoMovilAccountName = pm.account_name || payCreds.pagoMovilAccountName || payCreds.pago_movil_account_name || cached?.pagoMovilAccountName || this.brandingForm.pagoMovilAccountName;

      const z = payCreds.zelle || payCreds;
      this.brandingForm.zelleEmail = z.email || payCreds.zelleEmail || payCreds.zelle_email || cached?.zelleEmail || this.brandingForm.zelleEmail;
    } else if (cached) {
      if (cached.pagoMovilBank) this.brandingForm.pagoMovilBank = cached.pagoMovilBank;
      if (cached.pagoMovilPhone) this.brandingForm.pagoMovilPhone = cached.pagoMovilPhone;
      if (cached.pagoMovilIdNumber) this.brandingForm.pagoMovilIdNumber = cached.pagoMovilIdNumber;
      if (cached.pagoMovilAccountName) this.brandingForm.pagoMovilAccountName = cached.pagoMovilAccountName;
      if (cached.zelleEmail) this.brandingForm.zelleEmail = cached.zelleEmail;
    }

    const bh = (branch.businessHours || (branch as any).business_hours || {}) as any;
    this.brandingForm.openTime = bh.open || branch.openTime || (branch as any).open_time || (branch as any).openTime || '08:00';
    this.brandingForm.closeTime = bh.close || branch.closeTime || (branch as any).close_time || (branch as any).closeTime || '23:00';
    if (bh?.scheduleDays && Array.isArray(bh.scheduleDays) && bh.scheduleDays.length > 0) {
      this.brandingForm.scheduleDays = JSON.parse(JSON.stringify(bh.scheduleDays));
    } else if (cached?.scheduleDays && Array.isArray(cached.scheduleDays) && cached.scheduleDays.length > 0) {
      this.brandingForm.scheduleDays = JSON.parse(JSON.stringify(cached.scheduleDays));
    }
  }

  applySchedulePreset(preset: 'all' | 'weekdays' | 'weekends' | '24h'): void {
    if (preset === '24h') {
      this.brandingForm.openTime = '00:00';
      this.brandingForm.closeTime = '23:59';
      this.brandingForm.scheduleDays = this.brandingForm.scheduleDays.map((d: any) => ({
        ...d,
        open: true,
        from: '00:00',
        to: '23:59'
      }));
      return;
    }
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

  currentVzlaTimeFormatted(): string {
    try {
      return new Intl.DateTimeFormat('es-VE', {
        timeZone: 'America/Caracas',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(new Date());
    } catch (_) {
      return new Date().toLocaleTimeString();
    }
  }

  isCurrentScheduleOpenNow(): boolean {
    const rawBh = {
      open: this.brandingForm.openTime || '11:00',
      close: this.brandingForm.closeTime || '23:00',
      scheduleDays: this.brandingForm.scheduleDays
    };
    try {
      const formatter = new Intl.DateTimeFormat('es-VE', {
        timeZone: 'America/Caracas',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(new Date());
      let weekday = '', hour = 0, minute = 0;
      for (const p of parts) {
        if (p.type === 'weekday') weekday = p.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (p.type === 'hour') hour = parseInt(p.value, 10);
        if (p.type === 'minute') minute = parseInt(p.value, 10);
      }
      const cur = hour * 60 + minute;
      const todayConfig = (this.brandingForm.scheduleDays || []).find((d: any) => {
        if (!d || !d.day) return false;
        const norm = String(d.day).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return norm === weekday;
      });
      if (todayConfig) {
        if (!todayConfig.open) return false;
        const [oH, oM] = (todayConfig.from || rawBh.open).split(':').map(Number);
        const [cH, cM] = (todayConfig.to || rawBh.close).split(':').map(Number);
        const o = (isNaN(oH) ? 11 : oH) * 60 + (isNaN(oM) ? 0 : oM);
        const c = (isNaN(cH) ? 23 : cH) * 60 + (isNaN(cM) ? 0 : cM);
        return c > o ? (cur >= o && cur < c) : (cur >= o || cur < c);
      }
      return false;
    } catch (_) {
      return true;
    }
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
  readonly isUploadingLogo = signal(false);
  readonly isUploadingBanner = signal(false);
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
          if (type === 'logo') {
            this.brandingForm.logoUrl = dataUrl;
            this.merchantLogoFailed = false;
          } else {
            this.brandingForm.bannerUrl = dataUrl;
          }
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
          this.merchantLogoFailed = false;

          // Subir directamente a Storage de Supabase / Backend
          this.isUploadingLogo.set(true);
          this.api.uploadImage(optimized, `logo-${file.name}`).subscribe({
            next: (res) => {
              if (res?.url) {
                this.brandingForm.logoUrl = res.url;
                this.showToast('success', '¡Logo Almacenado!', 'El logo se subió exitosamente a Storage.');
              }
              this.isUploadingLogo.set(false);
            },
            error: (err) => {
              console.warn('[MerchantAdmin] Aviso subiendo logo a storage:', err);
              this.isUploadingLogo.set(false);
            }
          });
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

          // Subir directamente a Storage de Supabase / Backend
          this.isUploadingBanner.set(true);
          this.api.uploadImage(optimized, `banner-${file.name}`).subscribe({
            next: (res) => {
              if (res?.url) {
                this.brandingForm.bannerUrl = res.url;
                this.showToast('success', '¡Portada Almacenada!', 'La portada se subió exitosamente a Storage.');
              }
              this.isUploadingBanner.set(false);
            },
            error: (err) => {
              console.warn('[MerchantAdmin] Aviso subiendo portada a storage:', err);
              this.isUploadingBanner.set(false);
            }
          });
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
          } catch { }

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
  readonly riderWithdrawals = signal<RiderWithdrawal[]>([]);
  readonly pendingWithdrawalsCount = computed(() => this.riderWithdrawals().filter(w => w.status === 'pending').length);

  readonly storeUsers = signal<AppUser[]>([]);

  // --- VERIFICACIÓN DE PAGO MÓVIL ANTES DE COMANDA DE COCINA (FASE 1) ---
  readonly verifyingPaymentOrder = signal<Order | null>(null);
  readonly paymentRefInput = signal<string>('');
  readonly paymentOriginBankInput = signal<string>('');
  readonly isProcessingVerification = signal<boolean>(false);
  readonly isRejectPaymentConfirmOpen = signal<boolean>(false);

  // --- VERIFICACIÓN Y AUDITORÍA DE PAGO DE PEDIDO ADICIONAL ---
  readonly verifyingAdditionContext = signal<{ order: Order; addition: OrderAddition } | null>(null);
  readonly additionRefInput = signal<string>('');
  readonly additionOriginBankInput = signal<string>('');
  readonly isProcessingAdditionVerification = signal<boolean>(false);
  readonly isRejectAdditionConfirmOpen = signal<boolean>(false);

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
  readonly activeOrdersCount = computed(() => this.receivedOrders().length + this.kitchenOrders().length + this.transitOrders().length);

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
  readonly radarFleetType = signal<'all' | 'own' | 'independent'>('all');

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

  // --- GESTIÓN DE NOTIFICACIONES NATIVAS DEL NAVEGADOR & AUDIO EN SEGUNDO PLANO ---
  readonly notificationPermission = signal<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  private tabBlinkInterval: any = null;
  private originalDocumentTitle: string = '';

  private userAudioContext: AudioContext | null = null;
  private audioUnlocked = false;
  private wakeLockSentinel: any = null;

  async requestScreenWakeLock(): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      }
    } catch (_) {}
  }

  private setupAudioUnlockListeners(): void {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.initOrResumeAudio();
      this.requestScreenWakeLock();
    };
    ['click', 'touchstart', 'touchend'].forEach(evt => {
      window.addEventListener(evt, unlock, { passive: true });
    });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.requestScreenWakeLock();
          this.initOrResumeAudio();
        }
      });
    }
  }

  private initOrResumeAudio(): void {
    try {
      if (!this.userAudioContext) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.userAudioContext = new AudioCtx();
        }
      }
      if (this.userAudioContext && this.userAudioContext.state === 'suspended') {
        this.userAudioContext.resume();
      }
      if (!this.audioUnlocked && this.userAudioContext) {
        this.audioUnlocked = true;
        // Desbloquear formalmente el canal de hardware de audio en iOS WebKit (iPhone/iPad)
        const buffer = this.userAudioContext.createBuffer(1, 1, 22050);
        const source = this.userAudioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.userAudioContext.destination);
        source.start(0);
      }
    } catch (_) {}
  }

  requestNotificationPermission(): void {
    this.initOrResumeAudio();
    if (typeof window === 'undefined' || !('Notification' in window)) {
      this.showToast('info', 'Notificaciones', 'Las notificaciones emergentes no son soportadas directamente por este navegador móvil, pero el sonido de comanda ha sido activado.');
      this.playKitchenBellSound();
      return;
    }
    Notification.requestPermission().then(permission => {
      this.notificationPermission.set(permission);
      this.playKitchenBellSound();
      if (permission === 'granted') {
        this.showToast('success', 'Alertas Activadas', 'Recibirás alertas nativas y sonido en tu dispositivo.');
        try {
          new Notification('🔔 Pídetelo Comercio', {
            body: '¡Notificaciones activadas! Te avisaremos con sonido y alerta en cada nuevo pedido.',
            icon: '/assets/logo.png',
          });
        } catch (_) {}
      } else if (permission === 'denied') {
        this.showToast('error', 'Permiso Denegado', 'Has bloqueado las notificaciones visuales en el navegador.');
      }
    });
  }

  private formatOrderNumber(raw?: string | null): string {
    const clean = (raw || '').toString().trim();
    if (!clean) return '#ORD';
    return clean.startsWith('#') ? clean : `#${clean}`;
  }

  private playChimeSequence(
    notes: Array<{ freq: number; delay: number; duration: number }>,
    vibratePattern: number[]
  ): void {
    try {
      this.initOrResumeAudio();
      const audioCtx = this.userAudioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      for (const n of notes) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, audioCtx.currentTime + n.delay);
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime + n.delay);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + n.delay + n.duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + n.delay);
        osc.stop(audioCtx.currentTime + n.delay + n.duration);
      }

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(vibratePattern);
      }
    } catch (_) {}
  }

  playKitchenBellSound(): void {
    // Timbre característico de comanda de restaurante (Doblete metálico brillante)
    this.playChimeSequence(
      [
        { freq: 880, delay: 0.0, duration: 0.6 },   // Nota A5
        { freq: 1174, delay: 0.12, duration: 0.8 }, // Nota D6
        { freq: 1760, delay: 0.25, duration: 1.0 }  // Nota A6
      ],
      [300, 150, 300, 150, 600]
    );
  }

  playAdditionBellSound(): void {
    // Doble timbre urgente para diferenciar una adición en orden existente
    this.playChimeSequence(
      [
        { freq: 880, delay: 0.0, duration: 0.45 },
        { freq: 1174, delay: 0.12, duration: 0.55 },
        { freq: 1760, delay: 0.25, duration: 0.7 },
        { freq: 1046, delay: 0.55, duration: 0.45 },
        { freq: 1318, delay: 0.67, duration: 0.55 },
        { freq: 1760, delay: 0.80, duration: 0.9 }
      ],
      [300, 120, 300, 120, 500]
    );
  }

  playStatusChimeSound(): void {
    // Timbre suave de estado de reparto (asignado, llegó al local, en camino, entregado)
    this.playChimeSequence(
      [
        { freq: 660, delay: 0.0, duration: 0.35 },
        { freq: 990, delay: 0.14, duration: 0.55 }
      ],
      [180, 80, 180]
    );
  }

  private triggerDesktopNotification(
    title: string,
    body: string,
    tag: string,
    playSound = true,
    onClick?: () => void,
    options?: { requireInteraction?: boolean; replaceKey?: string }
  ): void {
    if (playSound) {
      this.playKitchenBellSound();
    }
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const replaceKey = options?.replaceKey;
        if (replaceKey) {
          const prevNotif = this.activeOrderNotifications.get(replaceKey);
          if (prevNotif) {
            try { prevNotif.close(); } catch (_) {}
            this.activeOrderNotifications.delete(replaceKey);
          }
        }
        const n = new Notification(title, {
          body,
          icon: '/assets/logo.png',
          badge: '/assets/logo.png',
          tag: replaceKey || tag,
          renotify: Boolean(replaceKey),
          requireInteraction: options?.requireInteraction ?? true,
        } as any);
        if (replaceKey) {
          this.activeOrderNotifications.set(replaceKey, n);
          n.onclose = () => {
            if (this.activeOrderNotifications.get(replaceKey) === n) {
              this.activeOrderNotifications.delete(replaceKey);
            }
          };
        }
        n.onclick = () => {
          window.focus();
          n.close();
          if (onClick) {
            onClick();
          } else {
            this.activeTab.set('orders');
          }
        };
      } catch (_) {}
    }
  }

  private startTabTitleBlink(titleA: string, titleB: string): void {
    if (typeof document !== 'undefined' && document.hidden) {
      if (!this.originalDocumentTitle) {
        this.originalDocumentTitle = document.title;
      }
      clearInterval(this.tabBlinkInterval);
      let isBlink = false;
      this.tabBlinkInterval = setInterval(() => {
        if (!document.hidden) {
          clearInterval(this.tabBlinkInterval);
          this.tabBlinkInterval = null;
          if (this.originalDocumentTitle) document.title = this.originalDocumentTitle;
          return;
        }
        document.title = isBlink ? titleA : titleB;
        isBlink = !isBlink;
      }, 1000);
    }
  }

  private resolveRiderPhase(status?: string | null, notes?: string | null, driverId?: string | null): OrderRiderPhase {
    const st = (status || '').toLowerCase().trim();
    const n = (notes || '').toString();
    const hasDriver = Boolean(driverId && String(driverId).trim());

    if (st === 'cancelled') return 'cancelled';
    if (st === 'delivered') return 'delivered';
    if (n.includes('[RIDER_REJECTED') && !hasDriver) return 'rejected';
    if (st === 'on_the_way' || n.includes('[RIDER_ON_THE_WAY]')) return 'on_the_way';
    if (st === 'picked_up' || n.includes('[RIDER_PICKED_UP]')) return 'picked_up';
    if (st === 'at_merchant' || n.includes('[RIDER_AT_MERCHANT]')) return 'at_merchant';
    if (n.includes('[RIDER_ACCEPTED]')) return 'accepted';
    if (hasDriver || st === 'assigned_driver') return 'assigned_pending';
    return 'none';
  }

  private resolveRiderDisplayName(driverId?: string | null, fallbackName?: string | null): string {
    const cleanId = (driverId || '').trim();
    if (cleanId) {
      const fromFleet = this.riders().find(r => r.id === cleanId);
      if (fromFleet?.name) return fromFleet.name;
      const fromNearby = this.nearbyRiders().find(r => r.id === cleanId);
      if (fromNearby?.name) return fromNearby.name;
    }
    const cleanFallback = (fallbackName || '').trim();
    return cleanFallback || 'El motorizado';
  }

  private clearLifecycleDedupPrefixes(orderId: string, prefixes: string[]): void {
    for (const key of Array.from(this.alertedLifecycleKeys)) {
      if (prefixes.some(p => key.startsWith(`${orderId}:${p}`))) {
        this.alertedLifecycleKeys.delete(key);
      }
    }
  }

  private emitLifecycleNotification(
    dedupKey: string,
    opts: {
      toastType: 'success' | 'info' | 'warning' | 'error';
      title: string;
      message: string;
      desktopTag: string;
      replaceKey?: string;
      playSound?: boolean;
      blinkTitle?: string;
    }
  ): void {
    if (this.alertedLifecycleKeys.has(dedupKey)) return;
    this.alertedLifecycleKeys.add(dedupKey);

    if (opts.playSound !== false) {
      this.playStatusChimeSound();
    }
    this.showToast(opts.toastType, opts.title, opts.message, opts.replaceKey);
    this.triggerDesktopNotification(opts.title, opts.message, opts.desktopTag, false, undefined, {
      requireInteraction: false,
      replaceKey: opts.replaceKey,
    });
    if (opts.blinkTitle) {
      this.startTabTitleBlink(opts.blinkTitle, '⚡ Pídetelo Comercio');
    }
  }

  private triggerRiderRejectionAlert(orderNumber: string, riderName?: string, orderId?: string): void {
    const displayNum = this.formatOrderNumber(orderNumber);
    const replaceKey = orderId ? `order-lifecycle-${orderId}` : undefined;
    this.rejectedAlert.set({
      orderNumber: displayNum,
      message: `El repartidor ${riderName ? riderName + ' ' : ''}rechazó la asignación de ${displayNum}. Reasigna otro repartidor disponible.`
    });
    this.showToast(
      'warning',
      `⚠️ Asignación rechazada ${displayNum}`,
      `${riderName || 'El motorizado'} rechazó el pedido ${displayNum}. Asigna otro repartidor disponible.`,
      replaceKey
    );
    this.triggerDesktopNotification(
      `⚠️ REPARTIDOR RECHAZÓ ${displayNum}`,
      `${riderName || 'El repartidor'} rechazó el pedido ${displayNum}. Reasigna otro motorizado.`,
      replaceKey || `rider-rejected-${displayNum}-${Date.now()}`,
      false,
      undefined,
      { requireInteraction: false, replaceKey }
    );
    try {
      const audioCtx = this.userAudioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
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
    } catch (_) { }
  }

  private evaluateOrderLifecycleTransition(params: {
    id: string;
    orderNumber: string;
    customerName: string;
    status: string;
    driverId: string;
    driverName?: string;
    notes: string;
    paymentStatus: string;
    source?: 'realtime' | 'poll' | 'local';
  }): void {
    if (!this.ordersBaselineInitialized || !params.id) return;

    const source = params.source || 'poll';
    const currPhase = this.resolveRiderPhase(params.status, params.notes, params.driverId);
    const prev = this.knownOrderLifecycleMap.get(params.id);

    if (source === 'poll' && prev) {
      const assignedAge = Date.now() - (this.localAssignedAt.get(params.id) || 0);
      if (prev.driverId && assignedAge < 8000 && !params.driverId) {
        return;
      }
      if (
        currPhase !== 'rejected' &&
        currPhase !== 'cancelled' &&
        params.driverId === prev.driverId &&
        this.PHASE_RANK[currPhase] < this.PHASE_RANK[prev.riderPhase]
      ) {
        return;
      }
    }

    this.knownOrderLifecycleMap.set(params.id, {
      status: params.status || '',
      driverId: params.driverId || '',
      riderPhase: currPhase,
      paymentStatus: params.paymentStatus || ''
    });

    if (!prev) return;

    const orderNum = this.formatOrderNumber(params.orderNumber || params.id);
    const customer = params.customerName || 'Cliente';
    const riderName = this.resolveRiderDisplayName(params.driverId, params.driverName);
    const replaceKey = `order-lifecycle-${params.id}`;

    if (params.driverId && prev.driverId !== params.driverId) {
      this.clearLifecycleDedupPrefixes(params.id, ['accepted:', 'at_merchant:', 'on_the_way:', 'rejected:']);
    }

    if (
      currPhase === 'assigned_pending' &&
      Boolean(params.driverId) &&
      (prev.driverId !== params.driverId || prev.riderPhase === 'none' || prev.riderPhase === 'rejected')
    ) {
      this.clearLifecycleDedupPrefixes(params.id, ['rejected:']);
      this.emitLifecycleNotification(`${params.id}:assigned:${params.driverId}`, {
        toastType: 'info',
        title: `🛵 Repartidor asignado ${orderNum}`,
        message: `${riderName} fue asignado al pedido de ${customer}. Esperando su confirmación.`,
        desktopTag: replaceKey,
        replaceKey,
      });
    } else if (currPhase === 'accepted' && prev.riderPhase !== 'accepted') {
      this.clearLifecycleDedupPrefixes(params.id, ['rejected:']);
      this.emitLifecycleNotification(`${params.id}:accepted:${params.driverId || 'any'}`, {
        toastType: 'success',
        title: `✅ Repartidor aceptó ${orderNum}`,
        message: `${riderName} confirmó el pedido de ${customer} y va rumbo al local.`,
        desktopTag: replaceKey,
        replaceKey,
      });
    } else if (currPhase === 'at_merchant' && prev.riderPhase !== 'at_merchant') {
      this.emitLifecycleNotification(`${params.id}:at_merchant:${params.driverId || 'any'}`, {
        toastType: 'info',
        title: `📍 Repartidor llegó al local ${orderNum}`,
        message: `${riderName} ya está en el comercio para retirar el pedido de ${customer}.`,
        desktopTag: replaceKey,
        replaceKey,
        blinkTitle: `📍 Repartidor en local ${orderNum}`
      });
    } else if (
      (currPhase === 'picked_up' || currPhase === 'on_the_way') &&
      prev.riderPhase !== 'picked_up' &&
      prev.riderPhase !== 'on_the_way'
    ) {
      this.emitLifecycleNotification(`${params.id}:on_the_way:${params.driverId || 'any'}`, {
        toastType: 'info',
        title: `🚀 Pedido retirado • En camino ${orderNum}`,
        message: `${riderName} retiró el pedido ${orderNum} de ${customer} y va en camino al cliente.`,
        desktopTag: replaceKey,
        replaceKey,
      });
    } else if (currPhase === 'delivered' && prev.riderPhase !== 'delivered') {
      this.emitLifecycleNotification(`${params.id}:delivered`, {
        toastType: 'success',
        title: `🎉 Pedido entregado ${orderNum}`,
        message: `${riderName} entregó exitosamente el pedido ${orderNum} a ${customer}.`,
        desktopTag: replaceKey,
        replaceKey,
      });
    } else if (currPhase === 'cancelled' && prev.riderPhase !== 'cancelled') {
      this.emitLifecycleNotification(`${params.id}:cancelled`, {
        toastType: 'error',
        title: `❌ Pedido cancelado ${orderNum}`,
        message: `El pedido ${orderNum} de ${customer} fue cancelado.`,
        desktopTag: replaceKey,
        replaceKey,
      });
    } else if (currPhase === 'rejected' && prev.riderPhase !== 'rejected') {
      const rejectedName =
        params.notes.match(/\[RIDER_REJECTED(?::([^\]]+))?\]/)?.[1] ||
        this.resolveRiderDisplayName(prev.driverId, undefined);
      const dedupKey = `${params.id}:rejected:${prev.driverId || rejectedName}`;
      this.clearLifecycleDedupPrefixes(params.id, ['assigned:', 'accepted:', 'at_merchant:']);
      if (!this.alertedLifecycleKeys.has(dedupKey)) {
        this.alertedLifecycleKeys.add(dedupKey);
        this.triggerRiderRejectionAlert(orderNum, rejectedName, params.id);
      }
    }
  }

  private evaluateOrderLifecycleList(orderList: Order[]): void {
    for (const ord of orderList) {
      this.evaluateOrderLifecycleTransition({
        id: ord.id,
        orderNumber: ord.orderNumber || ord.id,
        customerName: ord.customer?.name || 'Cliente',
        status: ord.status || '',
        driverId: ord.driverId || '',
        driverName: ord.driverName,
        notes: ord.notes || '',
        paymentStatus: ord.paymentStatus || '',
        source: 'poll',
      });
    }
  }

  private triggerNewOrderDesktopAlert(order: any): void {
    const orderId = order?.id || '';
    const orderNum = this.formatOrderNumber(order?.orderNumber || order?.order_number || orderId || 'Nuevo');
    const dedupKey = `new:${orderId || orderNum}`;
    if (this.alertedLifecycleKeys.has(dedupKey)) return;
    this.alertedLifecycleKeys.add(dedupKey);

    // 1. Sonido fuerte de comanda
    this.playKitchenBellSound();

    const customer = order?.customer?.name || order?.customerName || order?.customer_name || 'Cliente';
    const total = order?.total ? `$${Number(order.total).toFixed(2)}` : '';

    this.showToast(
      'info',
      `🛎️ ¡Nuevo Pedido ${orderNum}!`,
      `${customer} realizó un pedido ${total ? '(' + total + ')' : ''}. Revísalo en comanda.`
    );

    this.triggerDesktopNotification(
      `🛎️ ¡NUEVO PEDIDO RECIBIDO! ${orderNum}`,
      `${customer} ha realizado un pedido ${total ? '(' + total + ')' : ''}. Haz clic para gestionarlo en cocina.`,
      `order-${orderId || orderNum}`,
      false
    );

    // 3. Efecto parpadeante en el título de la pestaña si está en segundo plano
    this.startTabTitleBlink(`🛎️ (1) ¡NUEVO PEDIDO! ${orderNum}`, `⚡ REVISAR COMANDA - Pídetelo`);
  }

  private summarizeNewAdditions(
    addedList: OrderAddition[],
    exchangeRate?: number
  ): {
    addedSummary?: string;
    addedAmountUsd: number;
    addedAmountBs?: number;
    paymentMethod?: 'cash' | 'mobile_transfer';
    paymentReference?: string;
    needsPaymentVerification: boolean;
  } {
    const descriptions = addedList
      .map(a => a.description)
      .filter((d): d is string => Boolean(d && d.trim().length > 0));
    const addedSummary = descriptions.length > 0 ? descriptions.join(', ') : undefined;
    const addedAmountUsd = Number(addedList.reduce((s, a) => s + (a.amountUsd || 0), 0).toFixed(2));
    const totalBsRaw = addedList.reduce((s, a) => s + (a.amountBs || 0), 0);
    const rate = Number(exchangeRate) || 0;
    const addedAmountBs = totalBsRaw > 0
      ? Number(totalBsRaw.toFixed(2))
      : (rate > 1 && addedAmountUsd > 0 ? Number((addedAmountUsd * rate).toFixed(2)) : undefined);
    const hasMobile = addedList.some(a => a.method === 'mobile_transfer');
    const paymentMethod: 'cash' | 'mobile_transfer' | undefined = hasMobile
      ? 'mobile_transfer'
      : (addedList.length > 0 ? 'cash' : undefined);
    const needsPaymentVerification = addedList.some(a => a.method === 'mobile_transfer' && a.status !== 'verified');
    const pendingRef = addedList.find(a => a.method === 'mobile_transfer' && a.status !== 'verified' && a.reference)?.reference;
    const paymentReference = pendingRef || addedList.find(a => a.reference)?.reference;
    return {
      addedSummary,
      addedAmountUsd,
      addedAmountBs,
      paymentMethod,
      paymentReference,
      needsPaymentVerification
    };
  }

  private triggerOrderAdditionAlert(params: {
    dedupKey: string;
    orderId: string;
    orderNumber: string;
    customerName: string;
    addedSummary?: string;
    addedAmountUsd: number;
    addedAmountBs?: number;
    paymentMethod?: 'cash' | 'mobile_transfer';
    paymentReference?: string;
    needsPaymentVerification: boolean;
  }): void {
    if (this.alertedAdditionKeys.has(params.dedupKey)) return;
    this.alertedAdditionKeys.add(params.dedupKey);

    const displayOrderNum = this.formatOrderNumber(params.orderNumber);
    this.playAdditionBellSound();

    const alert: OrderAdditionAlert = {
      id: params.dedupKey,
      orderId: params.orderId,
      orderNumber: displayOrderNum,
      customerName: params.customerName || 'Cliente',
      addedSummary: params.addedSummary,
      addedAmountUsd: params.addedAmountUsd,
      addedAmountBs: params.addedAmountBs,
      paymentMethod: params.paymentMethod,
      paymentReference: params.paymentReference,
      needsPaymentVerification: params.needsPaymentVerification,
      timestamp: new Date().toISOString()
    };

    this.additionAlerts.update(list => [alert, ...list.filter(a => a.id !== alert.id)]);

    const summaryText = params.addedSummary ? `${params.addedSummary} ` : '';
    const amountText = params.addedAmountUsd > 0 ? `(+$${params.addedAmountUsd.toFixed(2)})` : '';
    const verifyText = params.needsPaymentVerification
      ? `Verifica el Pago Móvil${params.paymentReference ? ' (Ref: ' + params.paymentReference + ')' : ''} y la comanda.`
      : 'Por favor verifica la orden en cocina.';

    this.showToast(
      'warning',
      `¡Adición en orden ${displayOrderNum}!`,
      `${alert.customerName} adicionó productos ${summaryText}${amountText}. ${verifyText}`
    );

    this.triggerDesktopNotification(
      `➕ ¡ADICIÓN EN ORDEN ${displayOrderNum}!`,
      `${alert.customerName} hizo una adición ${summaryText}${amountText}. ${verifyText}`,
      `addition-${params.dedupKey}`,
      false,
      () => this.inspectAdditionAlert(alert)
    );

    this.startTabTitleBlink(`➕ ¡ADICIÓN EN ${displayOrderNum}!`, `⚠️ VERIFICAR ORDEN - Pídetelo`);
  }

  private getPendingMobileSignature(notes?: string | null): string {
    return parseOrderAdditions(notes)
      .filter(a => a.method === 'mobile_transfer' && a.status === 'pending')
      .map(a => a.raw)
      .join('||');
  }

  inspectAdditionAlert(alert: OrderAdditionAlert): void {
    this.activeTab.set('orders');
    this.ordersSubTab.set('kanban');
    const found = this.orders().find(
      o => o.id === alert.orderId || this.formatOrderNumber(o.orderNumber) === alert.orderNumber
    );
    if (found) {
      const pendingAdd = parseOrderAdditions(found.notes).find(
        a => a.method === 'mobile_transfer' && a.status === 'pending'
      );
      if (pendingAdd) {
        this.openAdditionVerificationModal({ order: found, addition: pendingAdd });
      } else {
        this.openOrderDetail(found);
      }
    }
    this.dismissAdditionAlert(alert.id);
  }

  dismissAdditionAlert(alertId: string): void {
    this.additionAlerts.update(list => list.filter(a => a.id !== alertId));
  }

  dismissAdditionAlertsForOrder(orderId: string): void {
    this.additionAlerts.update(list => list.filter(a => a.orderId !== orderId));
  }

  private syncOrdersBaseline(orderList: Order[], branchId: string): void {
    this.knownOrderAdditionsMap.clear();
    this.knownOrderLifecycleMap.clear();
    for (const o of orderList) {
      this.knownOrderAdditionsMap.set(o.id, {
        additionsCount: parseOrderAdditions(o.notes).length,
        itemsCount: o.items?.length || 0,
        total: Number(o.total || 0),
        pendingMobileSig: this.getPendingMobileSignature(o.notes)
      });
      this.knownOrderLifecycleMap.set(o.id, {
        status: o.status || '',
        driverId: o.driverId || '',
        riderPhase: this.resolveRiderPhase(o.status, o.notes, o.driverId),
        paymentStatus: o.paymentStatus || ''
      });
    }
    this.baselineBranchId = branchId;
    this.ordersBaselineInitialized = true;
  }

  private detectAdditionsInOrderList(orderList: Order[], branchId: string): void {
    if (!this.ordersBaselineInitialized || this.baselineBranchId !== branchId) {
      this.syncOrdersBaseline(orderList, branchId);
      return;
    }

    for (const ord of orderList) {
      const prev = this.knownOrderAdditionsMap.get(ord.id);
      const currentAdditions = parseOrderAdditions(ord.notes);
      const currentItemsCount = ord.items?.length || 0;
      const currentTotal = Number(ord.total || 0);
      const pendingMobileSig = this.getPendingMobileSignature(ord.notes);

      if (!prev) {
        this.knownOrderAdditionsMap.set(ord.id, {
          additionsCount: currentAdditions.length,
          itemsCount: currentItemsCount,
          total: currentTotal,
          pendingMobileSig
        });
        continue;
      }

      if (currentAdditions.length > prev.additionsCount) {
        const newAdditions = currentAdditions.slice(prev.additionsCount);
        const summary = this.summarizeNewAdditions(newAdditions, ord.exchangeRate);
        this.triggerOrderAdditionAlert({
          dedupKey: `${ord.id}:add:${currentAdditions.length}`,
          orderId: ord.id,
          orderNumber: ord.orderNumber || ord.id,
          customerName: ord.customer?.name || 'Cliente',
          ...summary
        });
      } else if (pendingMobileSig && pendingMobileSig !== prev.pendingMobileSig) {
        const pendingAdditions = currentAdditions.filter(
          a => a.method === 'mobile_transfer' && a.status === 'pending'
        );
        const summary = this.summarizeNewAdditions(pendingAdditions, ord.exchangeRate);
        this.triggerOrderAdditionAlert({
          dedupKey: `${ord.id}:resend:${pendingMobileSig}`,
          orderId: ord.id,
          orderNumber: ord.orderNumber || ord.id,
          customerName: ord.customer?.name || 'Cliente',
          ...summary
        });
      } else if (currentAdditions.length === 0 && currentItemsCount > prev.itemsCount) {
        const extraItems = (ord.items || []).slice(prev.itemsCount);
        const extraSummary = extraItems.map(i => `${i.quantity}x ${i.name}`).join(', ');
        const addedSumFromItems = extraItems.reduce((s, i) => s + Number(i.itemTotal || 0), 0);
        const delta = Math.max(
          Number((currentTotal - prev.total).toFixed(2)),
          Number(addedSumFromItems.toFixed(2))
        );
        this.triggerOrderAdditionAlert({
          dedupKey: `${ord.id}:items:${currentItemsCount}`,
          orderId: ord.id,
          orderNumber: ord.orderNumber || ord.id,
          customerName: ord.customer?.name || 'Cliente',
          addedSummary: extraSummary || undefined,
          addedAmountUsd: delta,
          needsPaymentVerification: false
        });
      }

      this.knownOrderAdditionsMap.set(ord.id, {
        additionsCount: Math.max(prev.additionsCount, currentAdditions.length),
        itemsCount: currentItemsCount,
        total: currentTotal,
        pendingMobileSig
      });
    }
  }
  readonly nearbyRiders = signal<Rider[]>([]);
  readonly isNearbyRidersModalOpen = signal(false);
  readonly isDispatchConfigModalOpen = signal(false);
  readonly isPayoutPolicyModalOpen = signal(false);
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
    } catch (_) { }
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

  // --- RADAR GPS EN VIVO (GESTIÓN DE FLOTA Y ASIGNACIÓN) ---
  readonly allRadarRiders = computed(() => {
    const branchId = this.activeBranchId();
    if (!branchId) return [];
    const isMain = this.isSelectedBranchMain();
    const busy = this.getBusyRiderIds();

    return this.riders()
      .filter(r => (r.branchId === branchId || (isMain && !r.branchId) || r.isIndependent))
      .map(r => {
        const isBusy = busy.has(r.id) || this.orders().some(o => o.driverId === r.id && ['assigned_driver', 'at_merchant', 'picked_up', 'on_the_way'].includes(o.status));
        const status: 'available' | 'delivering' | 'offline' = isBusy ? 'delivering' : (r.status || 'available');
        const lat = r.currentLocation?.lat != null ? r.currentLocation.lat : ((r as any).current_lat != null ? Number((r as any).current_lat) : ((r as any).currentLat != null ? Number((r as any).currentLat) : undefined));
        const lng = r.currentLocation?.lng != null ? r.currentLocation.lng : ((r as any).current_lng != null ? Number((r as any).current_lng) : ((r as any).currentLng != null ? Number((r as any).currentLng) : undefined));
        const currentLocation = (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) ? { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) } : r.currentLocation;
        return {
          ...r,
          status,
          currentLocation
        };
      });
  });

  readonly radarCountAll = computed(() => this.allRadarRiders().length);
  readonly radarCountOwn = computed(() => this.allRadarRiders().filter(r => !r.isIndependent).length);
  readonly radarCountIndependent = computed(() => this.allRadarRiders().filter(r => r.isIndependent).length);
  readonly radarCountAvailable = computed(() => {
    const fleet = this.radarFleetType();
    let list = this.allRadarRiders();
    if (fleet === 'own') list = list.filter(r => !r.isIndependent);
    if (fleet === 'independent') list = list.filter(r => r.isIndependent);
    return list.filter(r => r.status === 'available').length;
  });
  readonly radarCountDelivering = computed(() => {
    const fleet = this.radarFleetType();
    let list = this.allRadarRiders();
    if (fleet === 'own') list = list.filter(r => !r.isIndependent);
    if (fleet === 'independent') list = list.filter(r => r.isIndependent);
    return list.filter(r => r.status === 'delivering').length;
  });

  readonly radarRiders = computed(() => {
    const fleetType = this.radarFleetType();
    const statusFilter = this.radarFilter();

    let list = this.allRadarRiders();

    if (fleetType === 'own') {
      list = list.filter(r => !r.isIndependent);
    } else if (fleetType === 'independent') {
      list = list.filter(r => r.isIndependent);
    }

    if (statusFilter !== 'all') {
      list = list.filter(r => r.status === statusFilter);
    }

    return list;
  });

  getRiderActiveOrder(riderId: string): Order | undefined {
    return this.orders().find(o => o.driverId === riderId && ['assigned_driver', 'at_merchant', 'picked_up', 'on_the_way'].includes(o.status));
  }

  readonly ownFleetRiders = computed(() => {
    const branchId = this.activeBranchId();
    const isMain = this.isSelectedBranchMain();
    const currentTid = this.currentTenant()?.id || this.auth.currentUser()?.tenantId;
    return this.riders().filter(r => {
      const belongsToStore = (currentTid && (r.tenantId === currentTid || (r as any).tenant_id === currentTid));
      if (belongsToStore) {
        return !branchId || branchId === 'all' || !r.branchId || r.branchId === branchId || isMain;
      }
      return !r.isIndependent && (!branchId || branchId === 'all' || !r.branchId || r.branchId === branchId || isMain);
    });
  });

  readonly networkRiders = computed(() => {
    const currentTid = this.currentTenant()?.id || this.auth.currentUser()?.tenantId;
    return this.riders().filter(r => {
      const belongsToStore = (currentTid && (r.tenantId === currentTid || (r as any).tenant_id === currentTid));
      if (belongsToStore) return false;
      return r.isIndependent;
    });
  });

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

  // Alertas sonoras y visuales de adiciones a pedidos activos
  readonly additionAlerts = signal<OrderAdditionAlert[]>([]);
  readonly highlightedAdditionOrderIds = computed(() => this.additionAlerts().map(a => a.orderId));
  private knownOrderAdditionsMap = new Map<string, { additionsCount: number; itemsCount: number; total: number; pendingMobileSig: string }>();
  private knownOrderLifecycleMap = new Map<string, { status: string; driverId: string; riderPhase: OrderRiderPhase; paymentStatus: string }>();
  private activeOrderNotifications = new Map<string, Notification>();
  private localAssignedAt = new Map<string, number>();
  private reloadOrdersSeq = 0;
  private readonly PHASE_RANK: Record<OrderRiderPhase, number> = {
    none: 0,
    rejected: 0,
    assigned_pending: 1,
    accepted: 2,
    at_merchant: 3,
    picked_up: 4,
    on_the_way: 5,
    delivered: 6,
    cancelled: 7
  };
  private baselineBranchId = '';
  private ordersBaselineInitialized = false;
  private alertedAdditionKeys = new Set<string>();
  private alertedLifecycleKeys = new Set<string>();
  private realtimeTenantId = '';

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
          } catch (_) { }
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
          } catch (_) { }
          this.branchesMap = undefined;
        }
      }

      if (tab === 'settings') {
        setTimeout(() => this.initSettingsLocationMap(), 200);
      } else {
        if (this.settingsLocationMap) {
          try {
            this.settingsLocationMap.remove();
          } catch (_) { }
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

  private subscribeOrdersRealtime(
    tenantUuid: string,
    reloadOrders: () => void,
    triggerRejectionAlert: (orderNumber: string, riderName?: string, orderId?: string) => void
  ): void {
    const cleanId = (tenantUuid || '').trim();
    if (!cleanId || this.realtimeTenantId === cleanId) return;

    if (this.realtimeChannel && typeof this.realtimeChannel.unsubscribe === 'function') {
      try {
        this.realtimeChannel.unsubscribe();
      } catch (_) {}
      this.realtimeChannel = null;
    }

    this.realtimeTenantId = cleanId;
    try {
      this.realtimeChannel = this.supabase.subscribeToOrders(cleanId, (payload) => {
        console.log('[MerchantAdmin] Realtime event from Supabase:', payload);
        if (payload) {
          const eventType = payload.eventType || (payload.old ? 'UPDATE' : 'INSERT');
          const newRow = payload.new || payload.order || payload;
          const oldRow = payload.old;

          const bFilter = this.activeBranchId();
          const isMain = Boolean(this.activeBranch()?.isMain || this.activeBranch()?.name?.toLowerCase().includes('principal'));

          if (eventType === 'INSERT' && newRow) {
            const rowBranchId = newRow.branch_id ?? newRow.branchId;
            const belongsToActiveBranch = Boolean(bFilter) && (rowBranchId === bFilter || (isMain && !rowBranchId));
            if (belongsToActiveBranch) {
              if (newRow.id) {
                this.knownOrderAdditionsMap.set(newRow.id, {
                  additionsCount: parseOrderAdditions(newRow.notes).length,
                  itemsCount: 0,
                  total: Number(newRow.total || 0),
                  pendingMobileSig: this.getPendingMobileSignature(newRow.notes)
                });
                const initialDriverId = (newRow.driver_id ?? newRow.driverId ?? '').toString();
                const initialStatus = (newRow.status ?? 'received').toString();
                this.knownOrderLifecycleMap.set(newRow.id, {
                  status: initialStatus,
                  driverId: initialDriverId,
                  riderPhase: this.resolveRiderPhase(initialStatus, newRow.notes, initialDriverId),
                  paymentStatus: (newRow.payment_status ?? newRow.paymentStatus ?? '').toString()
                });
              }
              this.triggerNewOrderDesktopAlert(newRow);
            }
          } else if (eventType === 'UPDATE' && newRow) {
            const existingOrder = this.orders().find(o => o.id === newRow.id);
            const rowBranchId = newRow.branch_id ?? newRow.branchId ?? existingOrder?.branchId;
            const belongsToActiveBranch = Boolean(bFilter) && (rowBranchId === bFilter || (isMain && !rowBranchId));

            if (belongsToActiveBranch && this.ordersBaselineInitialized) {
              const prev = this.knownOrderAdditionsMap.get(newRow.id);
              const rawNotes = (newRow.notes !== undefined && newRow.notes !== null)
                ? String(newRow.notes)
                : (existingOrder?.notes || '');
              const newAdditions = parseOrderAdditions(rawNotes);
              const prevCount = prev
                ? prev.additionsCount
                : (existingOrder ? parseOrderAdditions(existingOrder.notes).length : parseOrderAdditions(oldRow?.notes).length);
              const newPendingSig = this.getPendingMobileSignature(rawNotes);
              const prevPendingSig = prev
                ? prev.pendingMobileSig
                : (existingOrder ? this.getPendingMobileSignature(existingOrder.notes) : '');

              if (newAdditions.length > prevCount) {
                const addedList = newAdditions.slice(prevCount);
                const summary = this.summarizeNewAdditions(
                  addedList,
                  Number(newRow.exchange_rate ?? existingOrder?.exchangeRate ?? 0)
                );
                this.knownOrderAdditionsMap.set(newRow.id, {
                  additionsCount: newAdditions.length,
                  itemsCount: prev?.itemsCount ?? existingOrder?.items?.length ?? 0,
                  total: Number(newRow.total ?? prev?.total ?? existingOrder?.total ?? 0),
                  pendingMobileSig: newPendingSig
                });
                this.triggerOrderAdditionAlert({
                  dedupKey: `${newRow.id}:add:${newAdditions.length}`,
                  orderId: newRow.id,
                  orderNumber: newRow.order_number || newRow.orderNumber || existingOrder?.orderNumber || newRow.id,
                  customerName: newRow.customer_name || newRow.customerName || existingOrder?.customer?.name || 'Cliente',
                  ...summary
                });
                setTimeout(() => reloadOrders(), 1500);
              } else if (newPendingSig && newPendingSig !== prevPendingSig) {
                const pendingAdditions = newAdditions.filter(
                  a => a.method === 'mobile_transfer' && a.status === 'pending'
                );
                const summary = this.summarizeNewAdditions(
                  pendingAdditions,
                  Number(newRow.exchange_rate ?? existingOrder?.exchangeRate ?? 0)
                );
                this.knownOrderAdditionsMap.set(newRow.id, {
                  additionsCount: Math.max(prevCount, newAdditions.length),
                  itemsCount: prev?.itemsCount ?? existingOrder?.items?.length ?? 0,
                  total: Number(newRow.total ?? prev?.total ?? existingOrder?.total ?? 0),
                  pendingMobileSig: newPendingSig
                });
                this.triggerOrderAdditionAlert({
                  dedupKey: `${newRow.id}:resend:${newPendingSig}`,
                  orderId: newRow.id,
                  orderNumber: newRow.order_number || newRow.orderNumber || existingOrder?.orderNumber || newRow.id,
                  customerName: newRow.customer_name || newRow.customerName || existingOrder?.customer?.name || 'Cliente',
                  ...summary
                });
                setTimeout(() => reloadOrders(), 1500);
              }

              const resolvedDriverId = newRow.driver_id !== undefined
                ? (newRow.driver_id || '')
                : (newRow.driverId !== undefined ? (newRow.driverId || '') : (existingOrder?.driverId || ''));
              const resolvedStatus = (newRow.status || existingOrder?.status || '').toString();
              let resolvedNotes = (newRow.notes !== undefined && newRow.notes !== null)
                ? String(newRow.notes)
                : (existingOrder?.notes || '');
              if ((newRow.notes === undefined || newRow.notes === null) && newRow.riderTag) {
                const cleaned = resolvedNotes.replace(/\[RIDER_[A-Z_]+(?::[^\]]*)?\]\s*/g, '').trim();
                resolvedNotes = cleaned ? `${newRow.riderTag} ${cleaned}` : String(newRow.riderTag);
              }
              const resolvedOrderNum = newRow.order_number || newRow.orderNumber || existingOrder?.orderNumber || newRow.id;
              const resolvedCustomer = newRow.customer_name || newRow.customerName || existingOrder?.customer?.name || 'Cliente';
              const resolvedDriverName = newRow.driver_name || newRow.driverName || existingOrder?.driverName;

              let patchedStatus = resolvedStatus;
              if (resolvedStatus === 'in_kitchen' && resolvedDriverId) {
                if (resolvedNotes.includes('[RIDER_PICKED_UP]')) {
                  patchedStatus = 'picked_up';
                } else if (resolvedNotes.includes('[RIDER_AT_MERCHANT]')) {
                  patchedStatus = 'at_merchant';
                } else {
                  patchedStatus = 'assigned_driver';
                }
              }

              const liveRiderAccepted =
                resolvedNotes.includes('[RIDER_ACCEPTED]') ||
                resolvedNotes.includes('[RIDER_AT_MERCHANT]') ||
                resolvedNotes.includes('[RIDER_PICKED_UP]') ||
                patchedStatus === 'on_the_way' ||
                patchedStatus === 'delivered';
              const liveRiderRejected = resolvedNotes.includes('[RIDER_REJECTED') && !resolvedDriverId;

              if (existingOrder) {
                const displayDriverName = resolvedDriverId
                  ? (resolvedDriverName && String(resolvedDriverName).trim().length > 0
                      ? String(resolvedDriverName).trim()
                      : (this.resolveRiderDisplayName(String(resolvedDriverId), existingOrder.driverName) || existingOrder.driverName))
                  : undefined;
                this.orders.update(list =>
                  list.map(o => o.id === newRow.id ? {
                    ...o,
                    status: patchedStatus as OrderStatus,
                    driverId: resolvedDriverId ? String(resolvedDriverId) : undefined,
                    driverName: displayDriverName,
                    notes: resolvedNotes,
                    riderAccepted: liveRiderAccepted,
                    riderRejected: liveRiderRejected,
                  } : o)
                );
              }

              this.evaluateOrderLifecycleTransition({
                id: newRow.id,
                orderNumber: resolvedOrderNum,
                customerName: resolvedCustomer,
                status: patchedStatus,
                driverId: String(resolvedDriverId),
                driverName: resolvedDriverName,
                notes: resolvedNotes,
                paymentStatus: (newRow.payment_status || newRow.paymentStatus || existingOrder?.paymentStatus || '').toString(),
                source: 'realtime'
              });
            }
          } else if (eventType === 'REJECTED_BY_RIDER' && payload.order) {
            const ordId = payload.order.id || '';
            const ordNum = this.formatOrderNumber(payload.order.orderNumber || payload.order.order_number || ordId);
            const rName = payload.order.riderName || 'Repartidor';
            const prevLifecycle = ordId ? this.knownOrderLifecycleMap.get(ordId) : undefined;
            const rejKey = ordId ? `${ordId}:rejected:${prevLifecycle?.driverId || rName}` : `rej:${ordNum}:${rName}`;
            if (!this.alertedLifecycleKeys.has(rejKey)) {
              this.alertedLifecycleKeys.add(rejKey);
              if (ordId) {
                this.clearLifecycleDedupPrefixes(ordId, ['assigned:', 'accepted:', 'at_merchant:']);
                this.knownOrderLifecycleMap.set(ordId, {
                  status: prevLifecycle?.status || 'in_kitchen',
                  driverId: '',
                  riderPhase: 'rejected',
                  paymentStatus: prevLifecycle?.paymentStatus || ''
                });
              }
              triggerRejectionAlert(ordNum, rName, ordId);
            }
          }
        }
        this.reloadOrdersSeq++;
        reloadOrders();
      });
    } catch (e) {
      console.warn('[MerchantAdmin] Realtime subscribeToOrders caught error:', e);
    }
  }

  ngOnInit(): void {
    this.setupAudioUnlockListeners();
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('pidetelo_riders_auth');
      } catch (_) { }
    }
    const user = this.auth.currentUser();
    const activeTenantId = user?.tenantId;

    if (user?.tenantName) {
      this.brandingForm.name = user.tenantName;
      this.currentTenant.update(t => ({ ...t, name: user.tenantName! }));
    }

    const triggerRejectionAlert = (orderNumber: string, riderName?: string, orderId?: string) => {
      this.triggerRiderRejectionAlert(orderNumber, riderName, orderId);
    };

    const reloadOrders = () => {
      const tid = this.currentTenant()?.id || activeTenantId;
      if (!tid) return;
      const bFilter = this.activeBranchId();
      if (!bFilter) return;
      const reqSeq = ++this.reloadOrdersSeq;
      this.api.getOrders(tid, undefined, bFilter).subscribe(orders => {
        if (reqSeq !== this.reloadOrdersSeq) return;
        const isMain = Boolean(this.activeBranch()?.isMain || this.activeBranch()?.name?.toLowerCase().includes('principal'));
        const orderList = (orders || []).filter(o => {
          if (o.branchId === bFilter) return true;
          if (isMain && !o.branchId) return true;
          return false;
        });

        const baselineReady = this.ordersBaselineInitialized && this.baselineBranchId === bFilter;
        if (baselineReady) {
          const newOrders = orderList.filter(no => !this.knownOrderLifecycleMap.has(no.id));
          for (const latestOrder of newOrders) {
            this.triggerNewOrderDesktopAlert(latestOrder);
          }
        }

        this.detectAdditionsInOrderList(orderList, bFilter);
        if (baselineReady) {
          this.evaluateOrderLifecycleList(orderList);
        }
        this.orders.set(orderList);

        const currentDetailOrd = this.selectedOrderDetail();
        if (currentDetailOrd) {
          const refreshedDetail = orderList.find(o => o.id === currentDetailOrd.id);
          if (refreshedDetail) {
            this.selectedOrderDetail.set(refreshedDetail);
          }
        }
        const currentAddCtx = this.verifyingAdditionContext();
        if (currentAddCtx) {
          const refreshedOrder = orderList.find(o => o.id === currentAddCtx.order.id);
          if (refreshedOrder) {
            const refreshedAdd = parseOrderAdditions(refreshedOrder.notes).find(
              a => a.raw === currentAddCtx.addition.raw || a.index === currentAddCtx.addition.index
            );
            this.verifyingAdditionContext.set({
              order: refreshedOrder,
              addition: refreshedAdd || currentAddCtx.addition
            });
          }
        }
        const currentRouteOrd = this.selectedRouteOrder();
        if (currentRouteOrd) {
          const refreshed = orderList.find(o => o.id === currentRouteOrd.id);
          if (refreshed) {
            this.selectedRouteOrder.set(refreshed);
          }
        }
      });
    };

    // 1. Cargar datos del comercio real desde la base de datos (para reflejar cualquier cambio de nombre en SuperAdmin)
    const tenantIdentifier = activeTenantId || 'burger-king';
    this.api.getTenantBySlug(tenantIdentifier).subscribe(tenant => {
      if (tenant) {
        this.currentTenant.set(tenant);
        this.brandingForm.name = tenant.name;
        if (tenant.tagline) this.brandingForm.tagline = tenant.tagline;
        if (tenant.branding?.accentColor) this.brandingForm.accentColor = tenant.branding.accentColor;
        if (tenant.branding?.logoUrl) this.brandingForm.logoUrl = tenant.branding.logoUrl;
        if (tenant.branding?.bannerUrl) this.brandingForm.bannerUrl = tenant.branding.bannerUrl;
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

        // Mantener sincronizado el usuario en sesión con el nombre real de la tienda
        const cur = this.auth.currentUser();
        if (cur && cur.tenantName !== tenant.name) {
          this.auth.login({ ...cur, tenantName: tenant.name, tenantId: tenant.id });
        }
        if (tenant.id && tenant.id !== this.realtimeTenantId) {
          this.subscribeOrdersRealtime(tenant.id, reloadOrders, triggerRejectionAlert);
        }
      } else {
        // Fallback: buscar en la lista general de tenants
        this.api.getTenants(true).subscribe(list => {
          const match = list.find(t => t.id === activeTenantId || t.slug === activeTenantId || t.slug === 'burger-king');
          if (match) {
            this.currentTenant.set(match);
            this.brandingForm.name = match.name;
            const cur = this.auth.currentUser();
            if (cur && cur.tenantName !== match.name) {
              this.auth.login({ ...cur, tenantName: match.name, tenantId: match.id });
            }
            if (match.id && match.id !== this.realtimeTenantId) {
              this.subscribeOrdersRealtime(match.id, reloadOrders, triggerRejectionAlert);
            }
          }
        });
      }
    });

    if (activeTenantId) {
      // 0. Intentar precargar caché local inmediato de marca y moneda
      try {
        const cached = localStorage.getItem('pidetelo_branding_' + activeTenantId);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.name && !this.currentTenant().name) this.brandingForm.name = parsed.name;
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
      } catch (_) { }

      // 2. Cargar categorías de productos del comercio
      this.loadCategories(activeTenantId);

      // 3. Cargar sucursales reales (esto fija la sede activa y dispara la carga aislada de pedidos, productos, motorizados y colaboradores)
      this.loadBranches(activeTenantId);
      this.loadCoupons();
      this.loadBranchReviews();
      this.loadRiderWithdrawals();
      if (activeTenantId) {
        this.supabase.subscribeToRiderWithdrawals(activeTenantId, () => {
          this.loadRiderWithdrawals();
        });
      }
      this.api.getSubscriptionPlans().subscribe(plans => {
        if (plans && plans.length > 0) {
          this.subscriptionPlans.set(plans);
        }
      });

      this.subscribeOrdersRealtime(activeTenantId, reloadOrders, triggerRejectionAlert);
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
    if (this.tabBlinkInterval) {
      clearInterval(this.tabBlinkInterval);
      this.tabBlinkInterval = null;
    }
    if (this.originalDocumentTitle && typeof document !== 'undefined') {
      document.title = this.originalDocumentTitle;
    }
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
      const rawLat = r.current_lat != null
        ? Number(r.current_lat)
        : (r.currentLat != null
          ? Number(r.currentLat)
          : (r.latitude != null
            ? Number(r.latitude)
            : (r.currentLocation?.lat != null ? Number(r.currentLocation.lat) : undefined)));

      const rawLng = r.current_lng != null
        ? Number(r.current_lng)
        : (r.currentLng != null
          ? Number(r.currentLng)
          : (r.longitude != null
            ? Number(r.longitude)
            : (r.currentLocation?.lng != null ? Number(r.currentLocation.lng) : undefined)));

      const isValid = typeof rawLat === 'number' && !isNaN(rawLat) && typeof rawLng === 'number' && !isNaN(rawLng);
      let currentLocation: { lat: number; lng: number } | undefined = undefined;
      if (isValid) {
        currentLocation = { lat: Number(rawLat.toFixed(6)), lng: Number(rawLng.toFixed(6)) };
      }
      const rTenant = r.tenant_id || (r as any).tenantId;
      // Si el repartidor viene en la lista propia (isOwn === true) o pertenece a este comercio
      const isIndependent = r.isOwn === true ? false : (r.isOwn === false ? true : (!rTenant || r.isIndependent === true));
      const resolvedRiderBranchId = isIndependent ? undefined : (r.branch_id || (r as any).branchId || branchFilter);
      const branch = resolvedRiderBranchId ? this.branches().find(b => b.id === resolvedRiderBranchId) : undefined;

      return {
        id: r.id,
        name: r.name,
        phone: r.phone || '',
        vehiclePlate: r.vehicle_plate || (r as any).vehiclePlate || 'N/D',
        vehicleType: (r.vehicle_type as any) || (r as any).vehicleType || 'moto',
        status: (r.status as any) || 'available',
        branchId: resolvedRiderBranchId,
        branchName: isIndependent
          ? 'Red Libre Pídetelo (Independiente)'
          : (branch?.name || this.activeBranch()?.name || 'Sede Principal'),
        currentLocation,
        distanceKm: r.distanceKm != null ? Number(r.distanceKm) : (r.distance_km != null ? Number(r.distance_km) : undefined),
        isIndependent,
        isCertified: !!(r.is_certified || (r as any).isCertified),
        rating: r.rating != null ? Number(r.rating) : 5.0,
        totalDeliveries: Number(r.total_deliveries || (r as any).totalDeliveries || 0),
        walletBalance: Number(r.wallet_balance !== undefined ? r.wallet_balance : ((r as any).walletBalance || 0)),
        tenantId: rTenant
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
          const mappedOwn = (pool.ownRiders || []).map((r: any) => mapRawToRider({ ...r, isOwn: true, isIndependent: false }));
          const mappedNearby = (pool.nearbyRiders || []).map((r: any) => mapRawToRider({ ...r, isOwn: false, isIndependent: true }));

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
            const mapped = riders.map((r: any) => {
              const belongsToThisTenant = r.tenant_id === activeTenantId || (r as any).tenantId === activeTenantId || r.tenant_id === this.currentTenant().id;
              return mapRawToRider({ ...r, isOwn: belongsToThisTenant, isIndependent: !belongsToThisTenant });
            });
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
      } catch (_) { }
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

    const visibleRiders = this.radarRiders();

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
      const fleetLabel = r.isIndependent ? 'Red Libre Pídetelo' : 'Flota Propia';
      const fleetColor = r.isIndependent ? '#a855f7' : '#f59e0b';

      const riderIcon = L.divIcon({
        className: 'leaflet-rider-marker',
        html: `
          <div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;width:44px;height:44px;border-radius:9999px;background:${statusColor};opacity:0.25;${r.status === 'delivering' ? 'animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;' : ''}"></div>
            <div style="background:${statusColor};color:white;width:34px;height:34px;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);border:2.5px solid white;z-index:2;cursor:pointer;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
            </div>
            <div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.9);backdrop-filter:blur(4px);color:white;font-size:10px;font-weight:bold;padding:1px 6px;border-radius:6px;white-space:nowrap;border:1px solid rgba(255,255,255,0.2);display:flex;align-items:center;gap:3px;">
              <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${fleetColor};"></span>
              <span>${r.name.split(' ')[0]}</span>
            </div>
          </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24]
      });

      const marker = L.marker([lat, lng], { icon: riderIcon }).addTo(this.fleetRadarMap!);

      const activeOrder = this.getRiderActiveOrder(r.id);

      marker.bindPopup(`
        <div style="font-family:sans-serif;padding:4px;min-width:200px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;">
            <b style="font-size:13px;color:#0f172a;">${r.name}</b>
            <span style="font-size:9px;font-weight:800;padding:2px 6px;border-radius:6px;background:${r.isIndependent ? '#f3e8ff' : '#fef3c7'};color:${r.isIndependent ? '#7e22ce' : '#b45309'};border:1px solid ${r.isIndependent ? '#d8b4fe' : '#fde68a'};">
              ${fleetLabel}
            </span>
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
            <div style="background:#eff6ff;padding:6px 8px;border-radius:8px;font-size:10px;color:#1e40af;margin-bottom:8px;border:1px solid #bfdbfe;">
              🛵 <b>En Entrega: ${activeOrder.orderNumber}</b><br>
              Destino: ${activeOrder.customer?.deliveryAddress || 'En ruta de entrega'}
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

  async flyToRider(rider: Rider): Promise<void> {
    this.selectedRadarRider.set(rider);
    if (!this.fleetRadarMap) return;

    const rawLat = rider.currentLocation?.lat != null ? rider.currentLocation.lat : ((rider as any).current_lat != null ? Number((rider as any).current_lat) : (rider as any).currentLat);
    const rawLng = rider.currentLocation?.lng != null ? rider.currentLocation.lng : ((rider as any).current_lng != null ? Number((rider as any).current_lng) : (rider as any).currentLng);

    if (!rawLat || !rawLng || isNaN(Number(rawLat)) || isNaN(Number(rawLng))) {
      await this.confirmModal.confirm({
        title: 'Ubicación Satelital No Reportada',
        message: `El motorizado ${rider.name} aún no ha reportado su ubicación GPS satelital desde su teléfono móvil.\n\nIndícale que inicie turno en la App de Repartidores para activar la señal GPS en vivo.`,
        confirmText: 'Entendido',
        cancelText: '',
        isDanger: false
      });
      return;
    }

    const lat = Number(rawLat);
    const lng = Number(rawLng);

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
      } catch (_) { }
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
      try { this.settingsLocationMap.remove(); } catch (_) { }
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

  // --- VERIFICACIÓN DE PAGO MÓVIL ANTES DE COMANDA DE COCINA (FASE 1) ---
  getOrderBsTotal(usd: number, order?: Order | null): string {
    if (order?.totalBs !== undefined && order?.totalBs !== null) {
      return order.totalBs.toFixed(2);
    }
    const rate = order?.exchangeRate || this.activeExchangeRate() || 54.50;
    return ((usd || 0) * rate).toFixed(2);
  }

  handleSendToKitchen(order: Order): void {
    const isPagoMovil = order.paymentMethod === 'mobile_transfer' || (order.paymentMethod as any) === 'pago_movil';
    if (isPagoMovil && order.paymentStatus !== 'verified') {
      this.openPaymentVerificationModal(order);
      return;
    }
    this.advanceOrderStatus(order.id, 'in_kitchen');
  }

  openPaymentVerificationModal(order: Order): void {
    this.verifyingPaymentOrder.set(order);
    this.paymentRefInput.set(order.paymentReference || '');
    this.paymentOriginBankInput.set(order.paymentOriginBank || '');
  }

  closePaymentVerificationModal(): void {
    this.verifyingPaymentOrder.set(null);
    this.paymentRefInput.set('');
    this.paymentOriginBankInput.set('');
    this.isProcessingVerification.set(false);
    this.isRejectPaymentConfirmOpen.set(false);
  }

  confirmPaymentAndSendToKitchen(sendToKitchen: boolean = true): void {
    const order = this.verifyingPaymentOrder();
    if (!order) return;

    const ref = this.paymentRefInput().trim();
    if (!ref) {
      alert('Por favor introduce el número o últimos dígitos de la referencia de Pago Móvil para auditar el ingreso.');
      return;
    }

    this.isProcessingVerification.set(true);
    const newStatus: OrderStatus = sendToKitchen ? 'in_kitchen' : order.status;

    // Actualización reactiva inmediata en la UI local
    this.orders.update(list =>
      list.map(o => o.id === order.id ? {
        ...o,
        paymentStatus: 'verified',
        paymentReference: ref,
        paymentOriginBank: this.paymentOriginBankInput().trim() || o.paymentOriginBank,
        status: newStatus,
        updatedAt: new Date().toISOString()
      } : o)
    );

    // Sincronizar Backend NestJS primero; solo usar Supabase directo como fallback si el backend falla (evita sobrescritura concurrente de notas/PIN)
    this.api.verifyOrderPayment(order.id, {
      status: 'verified',
      reference: ref,
      originBank: this.paymentOriginBankInput().trim(),
      autoSendToKitchen: sendToKitchen
    }).subscribe({
      next: () => {
        this.isProcessingVerification.set(false);
        this.closePaymentVerificationModal();
      },
      error: (err) => {
        console.warn('[MerchantAdmin] Error sincronizando verificación en backend, usando fallback Supabase:', err);
        this.supabase.verifyOrderPayment(order.id, {
          status: 'verified',
          reference: ref,
          originBank: this.paymentOriginBankInput().trim() || undefined,
          orderStatus: newStatus
        }).finally(() => {
          this.isProcessingVerification.set(false);
          this.closePaymentVerificationModal();
        });
      }
    });
  }

  openRejectPaymentConfirm(): void {
    this.isRejectPaymentConfirmOpen.set(true);
  }

  cancelRejectPaymentConfirm(): void {
    this.isRejectPaymentConfirmOpen.set(false);
  }

  getOrderBaseTotal(order: Order | null | undefined): number {
    if (!order) return 0;
    const addSum = parseOrderAdditions(order.notes).reduce((s, a) => s + a.amountUsd, 0);
    return Math.max(0, Number(((order.total || 0) - addSum).toFixed(2)));
  }

  getAdditionBsAmount(addition: OrderAddition, order: Order | null | undefined): number {
    if (addition.amountBs !== undefined && addition.amountBs !== null) {
      return addition.amountBs;
    }
    const rate = order?.exchangeRate || this.activeExchangeRate() || 1;
    return Number((addition.amountUsd * rate).toFixed(2));
  }

  openAdditionVerificationModal(event: { order: Order; addition: OrderAddition }): void {
    const latestOrder = this.orders().find(o => o.id === event.order.id) || event.order;
    const latestAddition =
      parseOrderAdditions(latestOrder.notes).find(a => a.raw === event.addition.raw || a.index === event.addition.index) ||
      event.addition;
    this.verifyingAdditionContext.set({ order: latestOrder, addition: latestAddition });
    this.additionRefInput.set(latestAddition.reference || '');
    this.additionOriginBankInput.set(latestAddition.originBank || '');
    this.isProcessingAdditionVerification.set(false);
    this.isRejectAdditionConfirmOpen.set(false);
  }

  closeAdditionVerificationModal(): void {
    this.verifyingAdditionContext.set(null);
    this.additionRefInput.set('');
    this.additionOriginBankInput.set('');
    this.isProcessingAdditionVerification.set(false);
    this.isRejectAdditionConfirmOpen.set(false);
  }

  openRejectAdditionConfirm(): void {
    this.isRejectAdditionConfirmOpen.set(true);
  }

  cancelRejectAdditionConfirm(): void {
    this.isRejectAdditionConfirmOpen.set(false);
  }

  private async persistAdditionStatus(
    order: Order,
    addition: OrderAddition,
    status: 'verified' | 'rejected',
    reference?: string,
    originBank?: string
  ): Promise<boolean> {
    if (!order?.notes) return false;

    const verifiedBy = this.auth.currentUser()?.name || 'Comercio';
    const updatedNotes = updateAdditionTagInNotes(order.notes, addition.raw, {
      status,
      reference,
      originBank,
      verifiedBy
    });

    const newPendingSig = this.getPendingMobileSignature(updatedNotes);
    const prevEntry = this.knownOrderAdditionsMap.get(order.id);
    this.knownOrderAdditionsMap.set(order.id, {
      additionsCount: Math.max(prevEntry?.additionsCount ?? 0, parseOrderAdditions(updatedNotes).length),
      itemsCount: prevEntry?.itemsCount ?? order.items?.length ?? 0,
      total: Number(prevEntry?.total ?? order.total ?? 0),
      pendingMobileSig: newPendingSig
    });

    let persisted = false;
    try {
      await firstValueFrom(
        this.api.verifyAdditionPayment(order.id, {
          additionRaw: addition.raw,
          status,
          reference: reference?.trim() || undefined,
          originBank: originBank?.trim() || undefined,
          verifiedBy
        })
      );
      persisted = true;
    } catch (apiErr) {
      console.warn('[MerchantAdmin] Backend verifyAdditionPayment falló, intentando Supabase directo:', apiErr);
    }

    if (!persisted) {
      const client = this.supabase.rawClient;
      if (client) {
        const { error } = await client
          .from('orders')
          .update({
            notes: updatedNotes,
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);
        if (!error) {
          persisted = true;
        }
      }
    }

    if (!persisted) {
      return false;
    }

    this.orders.update(list =>
      list.map(o => o.id === order.id ? { ...o, notes: updatedNotes, updatedAt: new Date().toISOString() } : o)
    );
    const currentDetail = this.selectedOrderDetail();
    if (currentDetail && currentDetail.id === order.id) {
      this.selectedOrderDetail.set({ ...currentDetail, notes: updatedNotes });
    }

    const remainingPending = parseOrderAdditions(updatedNotes).some(
      a => a.method === 'mobile_transfer' && a.status === 'pending'
    );
    this.additionAlerts.update(list => {
      if (!remainingPending) {
        return list.filter(a => a.orderId !== order.id);
      }
      return list.map(a => a.orderId === order.id ? { ...a, needsPaymentVerification: true } : a);
    });

    return true;
  }

  async confirmAdditionPaymentVerification(): Promise<void> {
    const ctx = this.verifyingAdditionContext();
    if (!ctx) return;

    const ref = this.additionRefInput().trim();
    if (ref.length < 4) {
      alert('Por favor confirma o ingresa los últimos dígitos (mínimo 4) de la referencia de Pago Móvil adicional.');
      return;
    }

    this.isProcessingAdditionVerification.set(true);
    const bank = this.additionOriginBankInput().trim();
    const ok = await this.persistAdditionStatus(ctx.order, ctx.addition, 'verified', ref, bank);
    this.isProcessingAdditionVerification.set(false);

    if (ok) {
      this.showToast(
        'success',
        'Pago Adicional Verificado',
        `Pago Móvil adicional de la orden ${this.formatOrderNumber(ctx.order.orderNumber)} (+$${ctx.addition.amountUsd.toFixed(2)}) confirmado.`
      );
      this.closeAdditionVerificationModal();
    } else {
      this.showToast('error', 'Error', 'No se pudo confirmar el pago adicional en el servidor.');
    }
  }

  async executeRejectAdditionPayment(): Promise<void> {
    const ctx = this.verifyingAdditionContext();
    if (!ctx) return;

    this.isProcessingAdditionVerification.set(true);
    const ref = this.additionRefInput().trim();
    const bank = this.additionOriginBankInput().trim();
    const ok = await this.persistAdditionStatus(ctx.order, ctx.addition, 'rejected', ref, bank);
    this.isProcessingAdditionVerification.set(false);
    this.isRejectAdditionConfirmOpen.set(false);

    if (ok) {
      this.showToast(
        'info',
        'Pago Adicional Rechazado',
        `Se notificó al cliente de la orden ${this.formatOrderNumber(ctx.order.orderNumber)} para que reenvíe la referencia.`
      );
      this.closeAdditionVerificationModal();
    } else {
      this.showToast('error', 'Error', 'No se pudo rechazar el pago adicional en el servidor.');
    }
  }

  async handleVerifyAdditionPayment(event: { order: Order; addition: OrderAddition }): Promise<void> {
    this.openAdditionVerificationModal(event);
  }

  handleAdvanceOrderStatus(event: { orderId: string; status: OrderStatus }): void {
    if (event.status === 'on_the_way') {
      const order = this.orders().find(o => o.id === event.orderId);
      if (order) {
        const pendingAdd = parseOrderAdditions(order.notes).find(
          a => a.method === 'mobile_transfer' && a.status === 'pending'
        );
        if (pendingAdd) {
          this.showToast(
            'warning',
            `Verificar Adicional ${this.formatOrderNumber(order.orderNumber)}`,
            'Verifica primero el Pago Móvil del pedido adicional antes de despachar.'
          );
          this.openAdditionVerificationModal({ order, addition: pendingAdd });
          return;
        }
      }
    }
    this.advanceOrderStatus(event.orderId, event.status);
  }

  executeRejectPayment(): void {
    const order = this.verifyingPaymentOrder();
    if (!order) return;

    this.isProcessingVerification.set(true);

    this.orders.update(list =>
      list.map(o => o.id === order.id ? {
        ...o,
        paymentStatus: 'rejected',
        updatedAt: new Date().toISOString()
      } : o)
    );

    this.api.verifyOrderPayment(order.id, {
      status: 'rejected',
      reference: this.paymentRefInput().trim(),
      autoSendToKitchen: false
    }).subscribe({
      next: () => {
        this.isProcessingVerification.set(false);
        this.isRejectPaymentConfirmOpen.set(false);
        this.closePaymentVerificationModal();
      },
      error: () => {
        this.supabase.verifyOrderPayment(order.id, {
          status: 'rejected',
          reference: this.paymentRefInput().trim()
        }).finally(() => {
          this.isProcessingVerification.set(false);
          this.isRejectPaymentConfirmOpen.set(false);
          this.closePaymentVerificationModal();
        });
      }
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

    const currentOrder = this.orders().find(o => o.id === orderId);
    // Si ya tiene asignado este motorizado y ya había aceptado o está en local/camino, no resetear la aceptación
    if (currentOrder && currentOrder.driverId === targetRiderId && (currentOrder.riderAccepted || currentOrder.status === 'at_merchant' || currentOrder.status === 'picked_up')) {
      console.log(`[MerchantAdmin] El repartidor ya está asignado y activo en la orden ${orderId}. Manteniendo estado.`);
      return;
    }

    const rider = this.riders().find(r => r.id === targetRiderId);
    const busy = this.getBusyRiderIds(orderId);
    if (rider && (rider.status === 'offline' || rider.status === 'delivering' || busy.has(rider.id))) {
      const isDelivering = rider.status === 'delivering' || busy.has(rider.id);
      this.confirmModal.confirm({
        title: isDelivering ? 'Motorizado en Reparto' : 'Motorizado Desconectado',
        message: `El motorizado ${rider.name} se encuentra actualmente ${isDelivering ? 'en una entrega en curso' : 'desconectado (offline)'} y no puede recibir nuevos pedidos hasta quedar disponible.`,
        confirmText: 'Entendido',
        cancelText: '',
        isDanger: false
      });
      return;
    }
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

    if (currentOrder && targetRiderId) {
      this.localAssignedAt.set(orderId, Date.now());
      this.evaluateOrderLifecycleTransition({
        id: orderId,
        orderNumber: currentOrder.orderNumber || orderId,
        customerName: currentOrder.customer?.name || 'Cliente',
        status: 'assigned_driver',
        driverId: targetRiderId,
        driverName: rider?.name,
        notes: (currentOrder.notes || '').replace(/\[RIDER_[A-Z_]+(?::[^\]]*)?\]\s*/g, '').trim(),
        paymentStatus: currentOrder.paymentStatus || '',
        source: 'local'
      });
    }

    // Backend primary (evita doble escritura simultánea sobre orders.notes); Supabase fallback solo si falla el backend
    this.api.assignRider(orderId, targetRiderId).subscribe({
      next: () => console.log(`[MerchantAdmin] Repartidor asignado en backend a orden ${orderId}`),
      error: (err) => {
        console.warn('[MerchantAdmin] Backend assignRider falló, intentando Supabase directo:', err);
        this.supabase.assignRider(orderId, targetRiderId).then(ok => {
          if (ok) console.log(`[MerchantAdmin] Repartidor asignado en Supabase (fallback): ${orderId} -> ${targetRiderId}`);
        });
      }
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

    const cleanPlate = (riderPayload.vehicle_plate || riderPayload.vehiclePlate || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanPlate || cleanPlate === 'SIN-PLACA' || cleanPlate.length < 3) {
      alert('La placa del vehículo es obligatoria y debe tener al menos 3 caracteres alfanuméricos.');
      return;
    }

    const formattedPayload = {
      tenant_id: activeTenantId,
      tenantId: activeTenantId,
      branch_id: branchId,
      branchId: branchId,
      name: (riderPayload.name || '').trim(),
      email: (riderPayload.email || '').trim().toLowerCase(),
      password: riderPayload.password,
      phone: (riderPayload.phone || '').trim(),
      national_id: (riderPayload.national_id || riderPayload.nationalId || '').trim().toUpperCase(),
      nationalId: (riderPayload.national_id || riderPayload.nationalId || '').trim().toUpperCase(),
      vehicle_plate: cleanPlate,
      vehiclePlate: cleanPlate,
      vehicle_type: riderPayload.vehicle_type || riderPayload.vehicleType || 'moto',
      vehicleType: riderPayload.vehicle_type || riderPayload.vehicleType || 'moto'
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('pidetelo_riders_auth');
      } catch { }
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

  async loadRiderWithdrawals(): Promise<void> {
    const tid = this.currentTenant().id || this.auth.currentUser()?.tenantId;
    if (!tid) return;
    const list = await this.supabase.getRiderWithdrawalsByTenant(tid);
    this.riderWithdrawals.set(list);
  }

  async handleProcessWithdrawal(event: {
    withdrawal: RiderWithdrawal;
    status: 'completed' | 'rejected';
    referenceCode?: string;
    rejectionReason?: string;
  }): Promise<void> {
    const ok = await this.supabase.processRiderWithdrawal(
      event.withdrawal.id,
      event.status,
      event.referenceCode,
      event.rejectionReason
    );
    if (ok) {
      await this.loadRiderWithdrawals();
      this.isSavedNotificationVisible.set(true);
      setTimeout(() => this.isSavedNotificationVisible.set(false), 2500);
    }
  }

  handleUpdatePayoutPolicy(policy: any): void {
    const tid = this.currentTenant().id || this.auth.currentUser()?.tenantId;
    if (!tid) return;

    this.api.updatePayoutPolicy(tid, policy).subscribe({
      next: (res) => {
        this.currentTenant.update(t => ({
          ...t,
          riderPayoutPolicy: res,
          rider_payout_policy: res
        }));

        // Sincronizar en branches en Supabase directamente para disponibilidad inmediata en apps móviles
        try {
          const currentCur = this.currentTenant().currencySettings || {};
          const sbClient = this.supabase.getClient();
          if (sbClient) {
            sbClient
              .from('branches')
              .update({
                currency_settings: {
                  ...currentCur,
                  riderPayoutPolicy: res,
                  rider_payout_policy: res,
                }
              })
              .eq('company_id', tid)
              .then(() => {});
          }
        } catch (_) {}

        this.isSavedNotificationVisible.set(true);
        setTimeout(() => this.isSavedNotificationVisible.set(false), 3000);
      },
      error: (err) => {
        console.warn('[MerchantAdmin] Error guardando política de pagos:', err);
      }
    });
  }

  handleSendEmailReminder(summary: any): void {
    const tid = this.currentTenant().id || this.auth.currentUser()?.tenantId;
    if (!tid) return;

    this.api.sendPayoutReminderEmail(tid, summary).subscribe({
      next: () => {
        this.isSavedNotificationVisible.set(true);
        setTimeout(() => this.isSavedNotificationVisible.set(false), 3000);
      },
      error: (err) => {
        console.warn('[MerchantAdmin] Error enviando recordatorio por correo:', err);
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
    let pin = String(Math.floor(1000 + Math.random() * 9000));
    while (pin === String(num) || pin === '1234' || pin === '0000') {
      pin = String(Math.floor(1000 + Math.random() * 9000));
    }
    const resolvedTenantId = this.currentTenant().id || this.auth.currentUser()?.tenantId || '';
    const targetBranch = this.selectedBranch() || (this.branches().length > 0 ? this.branches()[0] : null);

    const newOrd: Order = {
      id: `ord_${Date.now()}`,
      orderNumber: `ORD-${num}`,
      deliveryPin: pin,
      notes: `[PIN:${pin}]`,
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
      exchangeRate: this.activeExchangeRate() || 54.50,
      currency: 'USD',
      subtotalBs: Number((9.99 * (this.activeExchangeRate() || 54.50)).toFixed(2)),
      deliveryFeeBs: Number(((targetBranch?.baseDeliveryFee || 2.50) * (this.activeExchangeRate() || 54.50)).toFixed(2)),
      totalBs: Number(((9.99 + (targetBranch?.baseDeliveryFee || 2.50)) * (this.activeExchangeRate() || 54.50)).toFixed(2)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.orders.update(list => [newOrd, ...list]);

    // Persistir en el Backend & Supabase
    this.api.createOrder({
      tenant_id: resolvedTenantId,
      branch_id: targetBranch?.id,
      order_number: `ORD-${num}`,
      delivery_pin: pin,
      notes: `[PIN:${pin}]`,
      source: 'whatsapp_link',
      status: 'received',
      fulfillment_type: 'delivery',
      payment_method: 'mobile_transfer',
      payment_reference: `SIM-${num}`,
      customer_name: 'Cliente WhatsApp Simulado',
      customer_phone: '+584128889900',
      delivery_address: 'Av. Libertador, Edif. Centro',
      subtotal: 9.99,
      delivery_fee: targetBranch?.baseDeliveryFee || 2.50,
      total: 9.99 + (targetBranch?.baseDeliveryFee || 2.50),
      exchange_rate: this.activeExchangeRate() || 54.50,
      currency: 'USD',
      subtotal_bs: Number((9.99 * (this.activeExchangeRate() || 54.50)).toFixed(2)),
      delivery_fee_bs: Number(((targetBranch?.baseDeliveryFee || 2.50) * (this.activeExchangeRate() || 54.50)).toFixed(2)),
      total_bs: Number(((9.99 + (targetBranch?.baseDeliveryFee || 2.50)) * (this.activeExchangeRate() || 54.50)).toFixed(2)),
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

  async saveSettings(e?: Event): Promise<void> {
    if (e) e.preventDefault();
    this.isSavingBranding.set(true);

    const targetBranch = this.currentConfigBranch();
    const activeTenantId = this.currentTenant().id || this.auth.currentUser()?.tenantId || targetBranch?.companyId || '';

    // Si aún hay una imagen en base64 sin subir, subirla a Storage primero
    if (this.brandingForm.logoUrl && this.brandingForm.logoUrl.startsWith('data:image/')) {
      try {
        const res = await firstValueFrom(this.api.uploadImage(this.brandingForm.logoUrl, `logo-${this.brandingForm.name || 'comercio'}.webp`));
        if (res?.url) {
          this.brandingForm.logoUrl = res.url;
        }
      } catch (uErr) {
        console.warn('[MerchantAdmin] Error subiendo logo a storage en saveSettings:', uErr);
      }
    }

    if (this.brandingForm.bannerUrl && this.brandingForm.bannerUrl.startsWith('data:image/')) {
      try {
        const res = await firstValueFrom(this.api.uploadImage(this.brandingForm.bannerUrl, `banner-${this.brandingForm.name || 'comercio'}.webp`));
        if (res?.url) {
          this.brandingForm.bannerUrl = res.url;
        }
      } catch (uErr) {
        console.warn('[MerchantAdmin] Error subiendo portada a storage en saveSettings:', uErr);
      }
    }

    if (targetBranch) {
      try {
        localStorage.setItem('pidetelo_branch_branding_' + targetBranch.id, JSON.stringify(this.brandingForm));
      } catch (_) { }
    }
    if (activeTenantId && typeof window !== 'undefined') {
      try {
        localStorage.setItem('pidetelo_branding_' + activeTenantId, JSON.stringify(this.brandingForm));
      } catch (_) { }
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
        pagoMovilBank: this.brandingForm.pagoMovilBank,
        pagoMovilPhone: this.brandingForm.pagoMovilPhone,
        pagoMovilIdNumber: this.brandingForm.pagoMovilIdNumber,
        pagoMovilAccountName: this.brandingForm.pagoMovilAccountName,
        zelle_email: this.brandingForm.zelleEmail,
        zelleEmail: this.brandingForm.zelleEmail,
      },
      pagoMovilBank: this.brandingForm.pagoMovilBank,
      pagoMovilPhone: this.brandingForm.pagoMovilPhone,
      pagoMovilIdNumber: this.brandingForm.pagoMovilIdNumber,
      pagoMovilAccountName: this.brandingForm.pagoMovilAccountName,
      zelleEmail: this.brandingForm.zelleEmail,
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
        lastRateUpdate: new Date().toISOString(),
        acceptedPaymentMethods: this.brandingForm.acceptedPaymentMethods || []
      },
      currency_settings: {
        baseCurrency: this.brandingForm.baseCurrency,
        displayMode: this.brandingForm.displayMode,
        exchangeRate: Number(this.brandingForm.exchangeRate),
        lastRateUpdate: new Date().toISOString(),
        acceptedPaymentMethods: this.brandingForm.acceptedPaymentMethods || []
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
            paymentCredentials: {
              pagoMovilBank: this.brandingForm.pagoMovilBank,
              pagoMovilPhone: this.brandingForm.pagoMovilPhone,
              pagoMovilIdNumber: this.brandingForm.pagoMovilIdNumber,
              pagoMovilAccountName: this.brandingForm.pagoMovilAccountName,
              zelleEmail: this.brandingForm.zelleEmail,
              zelleAccountName: '',
              isActive: true
            },
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

    // Actualizar también el tenant global
    if (activeTenantId && (!targetBranch || targetBranch.isMain || targetBranch.name.toLowerCase().includes('principal'))) {
      this.currentTenant.update(prev => ({
        ...prev,
        name: this.brandingForm.name,
        tagline: this.brandingForm.tagline,
        logoUrl: this.brandingForm.logoUrl,
        bannerUrl: this.brandingForm.bannerUrl,
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

      this.api.updateTenant(activeTenantId, {
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
          isOpenToday: true,
          scheduleDays: this.brandingForm.scheduleDays
        }
      }).subscribe({ error: (err) => console.warn('[MerchantAdmin] Sync tenant warning:', err) });
    }

    try {
      const storageKey = 'pidetelo_branding_' + (targetBranch?.id || activeTenantId);
      localStorage.setItem(storageKey, JSON.stringify({
        ...branchPayload,
        openTime: this.brandingForm.openTime,
        closeTime: this.brandingForm.closeTime
      }));
    } catch (_) { }

    // Guardar específicamente la sucursal seleccionada en el backend
    if (targetBranch) {
      this.api.updateBranch(targetBranch.id, branchPayload).subscribe({
        next: (updatedBranch) => {
          this.isSavingBranding.set(false);
          this.isSavedNotificationVisible.set(true);
          this.showToast('success', '¡Configuración Guardada!', 'Logotipo, portada y datos guardados exitosamente en la base de datos y Storage.');
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
      this.showToast('success', '¡Configuración Guardada!', 'Datos guardados exitosamente en la base de datos y Storage.');
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
          const baselineReady = this.ordersBaselineInitialized && this.baselineBranchId === bFilter;
          this.detectAdditionsInOrderList(orderList, bFilter);
          if (baselineReady) {
            this.evaluateOrderLifecycleList(orderList);
          }
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
      this.confirmModal.confirm({ title: 'Acceso Restringido', message: 'Una sucursal secundaria no tiene permisos para crear sucursales. Esta función es exclusiva de la Sede Principal del comercio.', confirmText: 'Entendido', cancelText: '', isDanger: false });
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
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://pidetelo.app';
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
      this.confirmModal.confirm({ title: 'Acceso Denegado', message: 'Solo la Sede Principal o el encargado asignado a esta sucursal pueden modificar su estado.', confirmText: 'Entendido', cancelText: '', isDanger: false });
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
      this.confirmModal.confirm({ title: 'Acceso Denegado', message: 'Solo la Sede Principal o dueños del comercio pueden eliminar sucursales.', confirmText: 'Entendido', cancelText: '', isDanger: false });
      return;
    }
    if (branch.isMain || branch.name.toLowerCase().includes('principal')) {
      this.confirmModal.confirm({ title: 'Acción No Permitida', message: 'No es posible eliminar la Sede Principal (Matriz) del comercio.', confirmText: 'Entendido', cancelText: '', isDanger: false });
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

  loadBranchReviews(): void {
    const tenantId = this.currentTenant().id || this.auth.currentUser()?.tenantId;
    if (!tenantId) return;

    this.isLoadingReviews.set(true);
    const branchId = this.selectedReviewBranchId() !== 'all' 
      ? this.selectedReviewBranchId() 
      : (this.isBranchLocked() ? this.activeBranchId() : undefined);
    this.api.getTenantReviews(tenantId, branchId).subscribe({
      next: (reviews) => {
        this.branchReviews.set(reviews || []);
        this.isLoadingReviews.set(false);
      },
      error: (err) => {
        console.error('[MerchantAdmin] Error al cargar valoraciones:', err);
        this.isLoadingReviews.set(false);
      }
    });
  }

  setReviewBranchFilter(branchId: string): void {
    this.selectedReviewBranchId.set(branchId);
    this.loadBranchReviews();
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
  async deleteSelectedWhatsAppConversation(conversationId?: string): Promise<void> {
    const id = conversationId || this.selectedWhatsAppConversation()?.id;
    if (!id) return;

    const confirmed = await this.confirmModal.confirm({
      title: 'Eliminar Conversación',
      message: '¿Estás seguro de que deseas eliminar esta conversación y todo su historial de mensajes de WhatsApp? Esta acción no se puede deshacer.',
      confirmText: 'Sí, Eliminar Chat',
      cancelText: 'Cancelar',
      isDanger: true
    });

    if (!confirmed) return;

    this.api.deleteWhatsAppConversation(id).subscribe({
      next: () => {
        this.whatsappConversations.update(list => list.filter(c => c.id !== id));
        if (this.selectedWhatsAppConversation()?.id === id) {
          this.selectedWhatsAppConversation.set(null);
          this.whatsappMessages.set([]);
        }
        this.showToast('success', 'Conversación Eliminada', 'El chat ha sido eliminado de la bandeja.');
      },
      error: (err) => {
        this.showToast('error', 'Error al Eliminar', err.error?.message || 'No se pudo eliminar la conversación.');
      }
    });
  }

  async clearAllWhatsAppConversations(): Promise<void> {
    const tenantId = this.getEffectiveTenantId();
    if (!tenantId) return;

    const confirmed = await this.confirmModal.confirm({
      title: 'Vaciar Bandeja de WhatsApp',
      message: '¿Estás seguro de que deseas eliminar TODAS las conversaciones y mensajes de WhatsApp de este comercio? Esta acción limpiará por completo tu historial.',
      confirmText: 'Sí, Vaciar Bandeja',
      cancelText: 'Cancelar',
      isDanger: true
    });

    if (!confirmed) return;

    this.api.clearAllWhatsAppConversations(tenantId).subscribe({
      next: () => {
        this.whatsappConversations.set([]);
        this.selectedWhatsAppConversation.set(null);
        this.whatsappMessages.set([]);
        this.showToast('success', 'Bandeja Vaciada', 'Se han eliminado todas las conversaciones de WhatsApp.');
      },
      error: (err) => {
        this.showToast('error', 'Error al Vaciar', err.error?.message || 'No se pudieron eliminar las conversaciones.');
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
      this.showToast('info', 'Reporte Vacío', 'No hay pedidos disponibles para exportar en el rango seleccionado.');
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
