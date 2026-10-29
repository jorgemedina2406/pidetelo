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

  formatPrice(price: number, itemCurrency: 'USD' | 'VES' = 'USD') {
    return this.currency.formatPrice(price, itemCurrency, this.tenant()?.currencySettings);
  }

  selectBranch(branch: Branch): void {
    this.cart.setBranch(branch);
    this.isBranchModalOpen.set(false);
    const t = this.tenant();
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
          // Filtrar únicamente sucursales activas y operativas para el cliente (nunca inactivas o pendientes)
          const activeBranches: Branch[] = (storeData.branches || []).filter((b: Branch) => {
            return b.status === 'active';
          });

          // Sanitizar storeData para que la plantilla solo conozca sucursales activas
          const cleanStoreData: Tenant = {
            ...storeData,
            branches: activeBranches
          };

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
