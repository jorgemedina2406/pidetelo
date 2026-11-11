import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { CartStore } from '../../stores/cart.store';
import { Tenant } from '../../../../core/models/tenant.model';
import { Product, ProductCategory } from '../../../../core/models/product.model';
import { ProductDetailModalComponent } from '../../components/product-detail-modal/product-detail-modal.component';
import { CartDrawerComponent } from '../../components/cart-drawer/cart-drawer.component';
import { CheckoutModalComponent } from '../../components/checkout-modal/checkout-modal.component';
import { OrderSuccessModalComponent } from '../../components/order-success-modal/order-success-modal.component';
import { CurrencyService } from '../../../../core/services/currency.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { Branch } from '../../../../core/models/branch.model';
import { StoreHeaderComponent } from '../../components/store-header/store-header.component';
import { StoreFiltersComponent } from '../../components/store-filters/store-filters.component';
import { StoreProductGridComponent } from '../../components/store-product-grid/store-product-grid.component';
import { BranchSelectModalComponent } from '../../components/branch-select-modal/branch-select-modal.component';
import { StoreReviewsModalComponent } from '../../components/store-reviews-modal/store-reviews-modal.component';

@Component({
  selector: 'app-store-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ProductDetailModalComponent,
    CartDrawerComponent,
    CheckoutModalComponent,
    OrderSuccessModalComponent,
    StoreHeaderComponent,
    StoreFiltersComponent,
    StoreProductGridComponent,
    BranchSelectModalComponent,
    StoreReviewsModalComponent
  ],
  templateUrl: './store-view.component.html'
})
export class StoreViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  readonly cart = inject(CartStore);
  readonly currency = inject(CurrencyService);
  readonly theme = inject(ThemeService);

  readonly isReviewsModalOpen = signal<boolean>(false);

  onRatingUpdated(stats: { rating: number; reviewCount: number }) {
    const current = this.tenant();
    if (current) {
      this.tenant.set({
        ...current,
        rating: stats.rating,
        reviewCount: stats.reviewCount
      });
    }
  }

  readonly tenant = signal<Tenant | null>(null);
  get store(): Tenant | null { return this.tenant(); }
  readonly categories = signal<ProductCategory[]>([]);
  readonly products = signal<Product[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isBranchModalOpen = signal<boolean>(false);
  readonly liveBcvRate = signal<number | null>(null);
  
  readonly selectedCategory = signal<string | null>(null);
  readonly specialFilter = signal<'all' | 'offers' | 'featured'>('all');
  readonly viewMode = signal<'grid' | 'list'>('grid');
  readonly searchQuery = signal<string>('');
  
  readonly activeModalProduct = signal<Product | null>(null);
  readonly isStoreSwitchModalOpen = signal<boolean>(false);
  readonly storeSwitchModalData = signal<{ title: string; message: string; type: 'store' | 'branch' } | null>(null);
  readonly pendingProductAdd = signal<{ product: Product; quantity: number; modifiers: any[]; notes?: string } | null>(null);
  readonly pendingBranchSwitch = signal<Branch | null>(null);

  readonly activeBranchRate = computed(() => {
    const bRate = this.cart.selectedBranch()?.currencySettings?.exchangeRate ||
                  this.cart.selectedBranch()?.exchangeRate;
    if (bRate && bRate > 0 && bRate !== 45.50) return Number(bRate.toFixed(2));

    const tRate = this.tenant()?.currencySettings?.exchangeRate;
    if (tRate && tRate > 0 && tRate !== 45.50) return Number(tRate.toFixed(2));

    const live = this.liveBcvRate();
    if (live && live > 0) return Number(live.toFixed(2));

    return Number((bRate || tRate || 52.80).toFixed(2));
  });

  readonly isStoreOpen = computed(() => {
    const t = this.tenant();
    if (!t) return { isOpen: true, label: 'Abierto', openStr: '11:00', closeStr: '23:00' };
    const b = this.cart.selectedBranch();
    const rawBh = (b as any)?.business_hours || b?.businessHours || (t as any).business_hours || (t as any).businessHours || t.deliverySettings?.businessHours;
    const scheduleDays = rawBh?.scheduleDays;
    const fallbackOpen = rawBh?.open || (b as any)?.open_time || (b as any)?.openTime || '11:00';
    const fallbackClose = rawBh?.close || (b as any)?.close_time || (b as any)?.closeTime || '23:00';

    const now = new Date();
    const daysMap = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const todayName = daysMap[now.getDay()];

    if (Array.isArray(scheduleDays) && scheduleDays.length > 0) {
      const todayConfig = scheduleDays.find((d: any) => {
        if (!d || !d.day) return false;
        const norm = String(d.day).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const target = todayName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return norm === target;
      });

      if (todayConfig) {
        if (todayConfig.open === false) {
          return {
            isOpen: false,
            label: 'Cerrado hoy',
            openStr: todayConfig.from || fallbackOpen,
            closeStr: todayConfig.to || fallbackClose
          };
        }
        const openStr = todayConfig.from || fallbackOpen;
        const closeStr = todayConfig.to || fallbackClose;
        const [openH, openM] = openStr.split(':').map(Number);
        const [closeH, closeM] = closeStr.split(':').map(Number);
        const cur = now.getHours() * 60 + now.getMinutes();
        const o = (openH || 11) * 60 + (openM || 0);
        const c = (closeH || 23) * 60 + (closeM || 0);

        let open = false;
        if (c > o) {
          open = cur >= o && cur < c;
        } else {
          open = cur >= o || cur < c;
        }

        return {
          isOpen: open,
          label: open ? `Abierto • Cierra a las ${closeStr}` : `Cerrado • Abre a las ${openStr}`,
          openStr,
          closeStr
        };
      }
    }

    const [openH, openM] = fallbackOpen.split(':').map(Number);
    const [closeH, closeM] = fallbackClose.split(':').map(Number);
    const cur = now.getHours() * 60 + now.getMinutes();
    const o = (openH || 11) * 60 + (openM || 0);
    const c = (closeH || 23) * 60 + (closeM || 0);

    let open = false;
    if (c > o) {
      open = cur >= o && cur < c;
    } else {
      open = cur >= o || cur < c;
    }
    return {
      isOpen: open,
      label: open ? `Abierto • Cierra a las ${fallbackClose}` : `Cerrado • Abre a las ${fallbackOpen}`,
      openStr: fallbackOpen,
      closeStr: fallbackClose
    };
  });

  readonly formatPriceBound = (price: number, itemCurrency: 'USD' | 'VES' = 'USD'): { primary: string; secondary: string } => {
    return this.formatPrice(price, itemCurrency);
  };

  formatPrice(price: number, itemCurrency: 'USD' | 'VES' = 'USD'): { primary: string; secondary: string } {
    const rate = this.activeBranchRate();
    const branchCurr = this.cart.selectedBranch()?.currencySettings;
    const settings = {
      ...(branchCurr || this.tenant()?.currencySettings || {}),
      exchangeRate: rate
    } as any;
    const formatted = this.currency.formatPrice(price, itemCurrency, settings);
    return {
      primary: formatted.primary,
      secondary: formatted.secondary || ''
    };
  }

  readonly filteredProducts = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const cat = this.selectedCategory();
    const filter = this.specialFilter();

    return this.products().filter(p => {
      const matchesSearch = !query ||
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query);

      const matchesCat = !cat || p.categoryId === cat;

      let matchesSpecial = true;
      if (filter === 'offers') {
        matchesSpecial = !!(p.isOnSale || (p.compareAtPrice && p.compareAtPrice > p.price));
      } else if (filter === 'featured') {
        matchesSpecial = !!(p.isPopular || p.isFeatured);
      }

      return matchesSearch && matchesCat && matchesSpecial;
    });
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const tenantSlug = params.get('slug') || params.get('tenantSlug') || 'burger-king';
      this.loadStoreData(tenantSlug);
    });
  }

  private loadStoreData(slug: string): void {
    this.isLoading.set(true);
    this.api.getTenantBySlug(slug).subscribe({
      next: (t) => {
        if (!t) {
          this.router.navigate(['/']);
          return;
        }
        this.tenant.set(t);
        this.cart.setTenant(t);

        const currentSelectedBranch = this.cart.selectedBranch();
        if (t.branches && t.branches.length > 0) {
          const validBranch = currentSelectedBranch
            ? t.branches.find(b => b.id === currentSelectedBranch.id)
            : (t.branches.find(b => b.isMain) || t.branches[0]);
          this.cart.setBranch(validBranch || null);
        } else {
          this.cart.setBranch(null);
        }

        const bId = this.cart.selectedBranch()?.id;
        this.loadCatalog(t.id, bId);
        this.fetchLiveBcvRate();
      },
      error: () => {
        this.router.navigate(['/']);
      }
    });
  }

  private fetchLiveBcvRate(): void {
    this.currency.fetchDolarApiRate('oficial').then(liveData => {
      if (liveData && typeof liveData.promedio === 'number' && liveData.promedio > 0) {
        this.liveBcvRate.set(Number(liveData.promedio.toFixed(2)));
      }
    }).catch(() => {});
  }

  private loadCatalog(tenantId: string, branchId?: string): void {
    this.api.getCategories(tenantId).subscribe({
      next: (cats) => {
        this.categories.set(cats || []);
      }
    });

    this.api.getProducts(tenantId, branchId, true).subscribe({
      next: (prods) => {
        this.products.set(prods || []);
        this.cart.setStoreProducts(prods || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  selectBranch(branch: Branch): void {
    if (this.cart.items().length > 0 && this.cart.cartBranchId() && this.cart.cartBranchId() !== branch.id) {
      const curBranch = this.cart.cartBranchName() || 'la sede anterior';
      this.pendingBranchSwitch.set(branch);
      this.storeSwitchModalData.set({
        title: '¿Cambiar de sucursal?',
        message: `Tienes productos de la sucursal "${curBranch}" en tu carrito.\n\nLos pedidos en Pídetelo solo pueden pertenecer a una misma sede. Si cambias a "${branch.name}", se vaciará el carrito para sincronizar disponibilidad y tarifas. ¿Deseas continuar?`,
        type: 'branch'
      });
      this.isStoreSwitchModalOpen.set(true);
      this.isBranchModalOpen.set(false);
      return;
    }

    this.applyBranchSwitch(branch, false);
    this.isBranchModalOpen.set(false);
  }

  private applyBranchSwitch(branch: Branch, forceClear: boolean): void {
    const t = this.tenant();
    const effectiveRadius = t?.deliverySettings?.deliveryRadiusKm
      ? Math.max(Number(branch.deliveryRadiusKm) || 0, Number(t.deliverySettings.deliveryRadiusKm))
      : Number(branch.deliveryRadiusKm) || 8.0;
    const effectiveTiers = (Array.isArray(t?.deliverySettings?.deliveryTiers) && t.deliverySettings.deliveryTiers.length > 0)
      ? t.deliverySettings.deliveryTiers
      : branch.deliveryTiers;

    const enrichedBranch: Branch = {
      ...branch,
      deliveryRadiusKm: effectiveRadius,
      deliveryTiers: effectiveTiers
    };

    this.cart.setBranch(enrichedBranch, forceClear);
    if (t) {
      this.isLoading.set(true);
      this.loadCatalog(t.id, branch.id);
    }
  }

  openProductDetail(product: Product): void {
    this.activeModalProduct.set(product);
  }

  onProductAdd(event: { product: Product; quantity: number; modifiers: any[]; notes?: string }): void {
    const t = this.tenant();
    const b = this.cart.selectedBranch();
    if (this.cart.isDifferentStore(t?.id, b?.id)) {
      const curStore = this.cart.cartTenantName() || 'otro comercio';
      const curBranch = this.cart.cartBranchName();
      const currentFull = curBranch ? `${curStore} (${curBranch})` : curStore;
      const targetStore = t?.name || 'este comercio';
      const targetBranch = b?.name;
      const targetFull = targetBranch ? `${targetStore} (${targetBranch})` : targetStore;

      this.pendingProductAdd.set(event);
      this.storeSwitchModalData.set({
        title: '¿Empezar un nuevo pedido?',
        message: `Ya tienes productos en tu carrito de "${currentFull}".\n\nLos pedidos en Pídetelo solo pueden ser de un mismo comercio y sucursal.\n\n¿Deseas vaciar tu carrito actual para agregar productos de "${targetFull}"?`,
        type: 'store'
      });
      this.isStoreSwitchModalOpen.set(true);
      return;
    }

    this.cart.addItem(event.product, event.quantity, event.modifiers, event.notes);
    this.activeModalProduct.set(null);
  }

  confirmStoreSwitch(): void {
    const t = this.tenant();
    const b = this.cart.selectedBranch();
    const pendingAdd = this.pendingProductAdd();
    const pendingBranch = this.pendingBranchSwitch();

    if (pendingAdd && t) {
      this.cart.clearForNewStore(t, b);
      this.cart.addItem(pendingAdd.product, pendingAdd.quantity, pendingAdd.modifiers, pendingAdd.notes);
      this.activeModalProduct.set(null);
      this.pendingProductAdd.set(null);
    } else if (pendingBranch && t) {
      this.applyBranchSwitch(pendingBranch, true);
      this.pendingBranchSwitch.set(null);
    }

    this.isStoreSwitchModalOpen.set(false);
    this.storeSwitchModalData.set(null);
  }

  cancelStoreSwitch(): void {
    this.pendingProductAdd.set(null);
    this.pendingBranchSwitch.set(null);
    this.isStoreSwitchModalOpen.set(false);
    this.storeSwitchModalData.set(null);
  }
}
