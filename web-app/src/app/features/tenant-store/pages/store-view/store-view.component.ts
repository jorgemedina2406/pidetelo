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
import { IconComponent } from '../../../../shared/components/icon.component';

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
    IconComponent
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
  searchQuery = '';
  
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

  formatPrice(price: number, itemCurrency: 'USD' | 'VES' = 'USD') {
    const rate = this.activeBranchRate();
    const branchCurr = this.cart.selectedBranch()?.currencySettings;
    const settings = {
      ...(branchCurr || this.tenant()?.currencySettings || {}),
      exchangeRate: rate
    } as any;
    return this.currency.formatPrice(price, itemCurrency, settings);
  }

  selectBranch(branch: Branch): void {
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

    this.cart.setBranch(enrichedBranch);
    this.isBranchModalOpen.set(false);
    if (t) {
      this.isLoading.set(true);
      this.api.getProducts(t.id, branch.id, true).subscribe(prods => {
        this.products.set(prods);
        this.cart.setStoreProducts(prods);
        this.isLoading.set(false);
      });
    }
  }

  ngOnInit(): void {
    this.currency.fetchDolarApiRate('oficial').then(data => {
      if (data && typeof data.promedio === 'number' && data.promedio > 0) {
        this.liveBcvRate.set(Number(data.promedio.toFixed(2)));
      }
    });

    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (!slug) {
        this.isLoading.set(false);
        this.router.navigate(['/explorar']);
        return;
      }
      this.isLoading.set(true);
      
      this.api.getTenantBySlug(slug).subscribe(storeData => {
        if (storeData) {
          const cleanStoreData: Tenant = {
            ...storeData,
            deliverySettings: { ...storeData.deliverySettings }
          };

          try {
            const cached = localStorage.getItem('deliveryhub_branding_' + storeData.id);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed.deliveryRadiusKm) {
                cleanStoreData.deliverySettings.deliveryRadiusKm = Number(parsed.deliveryRadiusKm);
              }
              if (parsed.baseDeliveryFee) {
                cleanStoreData.deliverySettings.baseDeliveryFee = Number(parsed.baseDeliveryFee);
              }
              if (Array.isArray(parsed.deliveryTiers) && parsed.deliveryTiers.length > 0) {
                cleanStoreData.deliverySettings.deliveryTiers = parsed.deliveryTiers;
                cleanStoreData.deliveryTiers = parsed.deliveryTiers;
              }
            }
          } catch (_) {}

          // Filtrar únicamente sucursales activas y enriquecer con cobertura y tarifas del comercio
          const globalRadius = Number(cleanStoreData.deliverySettings?.deliveryRadiusKm) || 8.0;
          const globalTiers = cleanStoreData.deliverySettings?.deliveryTiers || [];

          const activeBranches: Branch[] = (storeData.branches || []).filter((b: Branch) => {
            return b.status === 'active';
          }).map((b: Branch) => {
            const bRadius = Math.max(Number(b.deliveryRadiusKm) || 0, globalRadius);
            const bTiers = (Array.isArray(b.deliveryTiers) && b.deliveryTiers.length >= globalTiers.length)
              ? b.deliveryTiers
              : (globalTiers.length > 0 ? globalTiers : b.deliveryTiers);
            return {
              ...b,
              deliveryRadiusKm: bRadius > 0 ? bRadius : globalRadius,
              deliveryTiers: bTiers
            };
          });

          cleanStoreData.branches = activeBranches;
          this.tenant.set(cleanStoreData);
          this.cart.setTenant(cleanStoreData);

          // Asegurar carga de todas las sedes activas desde el backend si no venian completas
          this.api.getBranches(storeData.id).subscribe(branches => {
            if (branches && branches.length > 0) {
              const active = branches.filter((b: Branch) => b.status === 'active');
              if (active.length > 0) {
                const mergedBranches = active.map((b: Branch) => ({
                  ...b,
                  deliveryRadiusKm: Math.max(Number(b.deliveryRadiusKm) || 0, globalRadius),
                  deliveryTiers: (Array.isArray(b.deliveryTiers) && b.deliveryTiers.length >= globalTiers.length)
                    ? b.deliveryTiers
                    : (globalTiers.length > 0 ? globalTiers : b.deliveryTiers)
                }));
                cleanStoreData.branches = mergedBranches;
                this.tenant.set({ ...cleanStoreData, branches: mergedBranches });
              }
            }
          });

          // Resolver sucursal desde query param (?branch=slug-o-id o ?sucursal=...)
          const branchParam = this.route.snapshot.queryParamMap.get('branch') ||
                              this.route.snapshot.queryParamMap.get('sucursal') ||
                              this.route.snapshot.queryParamMap.get('branchId');

          let assignedBranch: Branch | null = null;

          if (branchParam && activeBranches.length > 0) {
            const query = branchParam.toLowerCase().trim();
            assignedBranch = activeBranches.find((b: Branch) =>
              b.id === query ||
              (b.slug && b.slug.toLowerCase() === query) ||
              (b.name && b.name.toLowerCase().includes(query))
            ) || null;
          }

          if (!assignedBranch && activeBranches.length > 0) {
            assignedBranch = activeBranches.find((b: Branch) => b.isMain || b.name?.toLowerCase().includes('principal')) || activeBranches[0];
          }

          if (assignedBranch) {
            const effectiveRadius = cleanStoreData.deliverySettings?.deliveryRadiusKm
              ? Math.max(Number(assignedBranch.deliveryRadiusKm) || 0, Number(cleanStoreData.deliverySettings.deliveryRadiusKm))
              : Number(assignedBranch.deliveryRadiusKm) || 8.0;
            const effectiveTiers = (Array.isArray(cleanStoreData.deliverySettings?.deliveryTiers) && cleanStoreData.deliverySettings.deliveryTiers.length > 0)
              ? cleanStoreData.deliverySettings.deliveryTiers
              : assignedBranch.deliveryTiers;

            assignedBranch = {
              ...assignedBranch,
              deliveryRadiusKm: effectiveRadius,
              deliveryTiers: effectiveTiers
            };
            this.cart.setBranch(assignedBranch);
          }

          // Cargar categorías y productos del backend aislados por la sucursal seleccionada
          this.api.getCategories(storeData.id).subscribe(cats => {
            this.categories.set(cats);
          });

          const branchIdToLoad = assignedBranch?.id;
          this.api.getProducts(storeData.id, branchIdToLoad, true).subscribe(prods => {
            if (!prods || prods.length === 0) {
              this.api.getProducts(storeData.id, undefined, true).subscribe(allProds => {
                this.products.set(allProds || []);
                this.cart.setStoreProducts(allProds || []);
                this.isLoading.set(false);
              });
            } else {
              this.products.set(prods);
              this.cart.setStoreProducts(prods);
              this.isLoading.set(false);
            }
          });

          // Fetch live official BCV rate from dolarapi.com
          this.currency.fetchDolarApiRate('oficial').then(liveData => {
            if (liveData && typeof liveData.promedio === 'number' && liveData.promedio > 0) {
              const current = this.tenant();
              if (current) {
                const updatedTenant: Tenant = {
                  ...current,
                  currencySettings: {
                    ...current.currencySettings,
                    exchangeRate: Number(liveData.promedio.toFixed(2)),
                    lastRateUpdate: liveData.fechaActualizacion
                  }
                };
                this.tenant.set(updatedTenant);
                this.cart.setTenant(updatedTenant);
              }
            }
          });
        } else {
          this.isLoading.set(false);
        }
      });
    });
  }

  readonly filteredProducts = computed(() => {
    let list = this.products();
    const activeBranch = this.cart.selectedBranch();
    const isMain = activeBranch?.name?.toLowerCase().includes('principal') || false;

    if (activeBranch) {
      list = list.filter(p => {
        if (p.branchId === activeBranch.id) return true;
        if (isMain && (!p.branchId || p.branchId === 'all')) return true;
        return false;
      });
    }

    const special = this.specialFilter();
    if (special === 'offers') {
      list = list.filter(p => p.isOnSale);
    } else if (special === 'featured') {
      list = list.filter(p => p.isPopular || p.isFeatured);
    } else {
      const cat = this.selectedCategory();
      if (cat) {
        list = list.filter(p => p.categoryId === cat);
      }
    }

    const query = this.searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.description.toLowerCase().includes(query)
      );
    }

    return list;
  });

  setSpecialFilter(filter: 'all' | 'offers' | 'featured'): void {
    this.specialFilter.set(filter);
    if (filter !== 'all') {
      this.selectedCategory.set(null);
    }
  }

  selectCategoryFilter(catId: string | null): void {
    this.selectedCategory.set(catId);
    this.specialFilter.set('all');
  }

  openProductDetail(product: Product): void {
    this.activeModalProduct.set(product);
  }

  onProductAdd(event: { product: Product; quantity: number; modifiers: any[]; notes?: string }): void {
    this.cart.addItem(event.product, event.quantity, event.modifiers, event.notes);
  }
}
