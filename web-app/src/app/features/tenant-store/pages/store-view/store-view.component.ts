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
import { Branch } from '../../../../core/models/branch.model';

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
    OrderSuccessModalComponent
  ],
  templateUrl: './store-view.component.html'
})
export class StoreViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  readonly cart = inject(CartStore);
  readonly currency = inject(CurrencyService);

  readonly tenant = signal<Tenant | null>(null);
  readonly categories = signal<ProductCategory[]>([]);
  readonly products = signal<Product[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isBranchModalOpen = signal<boolean>(false);
  
  readonly selectedCategory = signal<string | null>(null);
  searchQuery = '';
  
  readonly activeModalProduct = signal<Product | null>(null);

  readonly activeBranchRate = computed(() => {
    return this.cart.selectedBranch()?.currencySettings?.exchangeRate ||
           this.cart.selectedBranch()?.exchangeRate ||
           this.tenant()?.currencySettings?.exchangeRate || 45.50;
  });

  formatPrice(price: number, itemCurrency: 'USD' | 'VES' = 'USD') {
    const branchCurr = this.cart.selectedBranch()?.currencySettings;
    return this.currency.formatPrice(price, itemCurrency, branchCurr || this.tenant()?.currencySettings);
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
        this.isLoading.set(false);
      });
    }
  }

  ngOnInit(): void {
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
            this.products.set(prods);
            this.isLoading.set(false);
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

    const cat = this.selectedCategory();
    const query = this.searchQuery.trim().toLowerCase();

    if (cat) {
      list = list.filter(p => p.categoryId === cat);
    }

    if (query) {
      list = list.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.description.toLowerCase().includes(query)
      );
    }

    return list;
  });

  openProductDetail(product: Product): void {
    this.activeModalProduct.set(product);
  }

  onProductAdd(event: { product: Product; quantity: number; modifiers: any[]; notes?: string }): void {
    this.cart.addItem(event.product, event.quantity, event.modifiers, event.notes);
  }
}
