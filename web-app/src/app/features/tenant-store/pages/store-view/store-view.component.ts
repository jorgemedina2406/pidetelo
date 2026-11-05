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
    BranchSelectModalComponent
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

  readonly tenant = signal<Tenant | null>(null);
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
    if (!t) return { isOpen: true, label: 'Abierto', openStr: '09:00', closeStr: '23:00' };
    const b = this.cart.selectedBranch();
    const hours = b?.businessHours || t.deliverySettings?.businessHours;
    const openStr = hours?.open || '09:00';
    const closeStr = hours?.close || '23:00';

    const [openH, openM] = openStr.split(':').map(Number);
    const [closeH, closeM] = closeStr.split(':').map(Number);
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const o = (openH || 9) * 60 + (openM || 0);
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
  });

  readonly formatPriceBound = (price: number, itemCurrency: 'USD' | 'VES' = 'USD') => {
    return this.formatPrice(price, itemCurrency);
  };

  formatPrice(price: number, itemCurrency: 'USD' | 'VES' = 'USD') {
    const rate = this.activeBranchRate();
    const branchCurr = this.cart.selectedBranch()?.currencySettings;
    const displayPrimary = branchCurr?.defaultDisplayCurrency || 'USD';

    let usdPrice = 0;
    let vesPrice = 0;

    if (itemCurrency === 'VES') {
      vesPrice = price;
      usdPrice = rate > 0 ? price / rate : 0;
    } else {
      usdPrice = price;
      vesPrice = price * rate;
    }

    if (displayPrimary === 'VES') {
      return {
        primary: `Bs. ${vesPrice.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        secondary: `$${usdPrice.toFixed(2)}`
      };
    } else {
      return {
        primary: `$${usdPrice.toFixed(2)}`,
        secondary: `Bs. ${vesPrice.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      };
    }
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
    const tenantSlug = this.route.snapshot.paramMap.get('tenantSlug') || 'burger-lab';
    this.loadStoreData(tenantSlug);
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

        const currentSelectedBranch = this.cart.selectedBranch();
        if (t.branches && t.branches.length > 0) {
          const validBranch = currentSelectedBranch
            ? t.branches.find(b => b.id === currentSelectedBranch.id)
            : (t.branches.find(b => b.isMain) || t.branches[0]);
          this.cart.setSelectedBranch(validBranch || null);
        } else {
          this.cart.setSelectedBranch(null);
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
    this.currency.getUsdExchangeRate().subscribe({
      next: (rate) => {
        if (rate && rate > 0) {
          this.liveBcvRate.set(rate);
        }
      },
      error: () => {}
    });
  }

  private loadCatalog(tenantId: string, branchId?: string): void {
    this.api.getCategories(tenantId, branchId).subscribe({
      next: (cats) => {
        this.categories.set(cats || []);
      }
    });

    this.api.getProducts(tenantId, branchId).subscribe({
      next: (prods) => {
        this.products.set(prods || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  selectBranch(branch: Branch): void {
    this.cart.setSelectedBranch(branch);
    this.isBranchModalOpen.set(false);
    const t = this.tenant();
    if (t) {
      this.isLoading.set(true);
      this.loadCatalog(t.id, branch.id);
    }
  }

  openProductDetail(product: Product): void {
    this.activeModalProduct.set(product);
  }

  onProductAdd(event: { product: Product; quantity: number; selectedModifiers: any[]; specialInstructions?: string }): void {
    this.cart.addItem(event.product, event.quantity, event.selectedModifiers, event.specialInstructions);
    this.activeModalProduct.set(null);
  }
}
