import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, from, firstValueFrom, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Tenant } from '../models/tenant.model';
import { Product, ProductCategory } from '../models/product.model';
import { Order } from '../models/order.model';
import { Branch, SubscriptionPlan } from '../models/branch.model';
import { AppUser } from '../models/user.model';
import { Banner } from '../models/banner.model';
import { BusinessCategory } from '../models/category.model';
import { Coupon } from '../models/coupon.model';
import { MockDataService } from './mock-data.service';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly mockData = inject(MockDataService);
  private readonly supabase = inject(SupabaseService);
  private readonly baseUrl = environment.apiUrl || 'http://localhost:3000/api';

  // --- TENANTS / COMERCIOS ---
  getTenants(includeInactive = false): Observable<Tenant[]> {
    const url = includeInactive ? `${this.baseUrl}/tenants?all=true` : `${this.baseUrl}/tenants`;
    return this.http.get<any[]>(url).pipe(
      map(rows => (rows || []).map(r => this.mapTenant(r))),
      catchError(async () => {
        // Fallback directo a Supabase
        const client = this.supabase.rawClient;
        if (client) {
          let query = client.from('tenants').select('*').order('name');
          if (!includeInactive) {
            query = query.eq('is_active', true);
          }
          const { data } = await query;
          if (data && data.length > 0) {
            return data.map(r => this.mapTenant(r));
          }
        }
        return [];
      })
    );
  }

  getTenantBySlug(slug: string): Observable<Tenant | null> {
    return this.http.get<any>(`${this.baseUrl}/tenants/${slug}`).pipe(
      map(row => (row ? this.mapTenant(row) : null)),
      catchError(async () => {
        const client = this.supabase.rawClient;
        if (client) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
          const query = isUuid
            ? client.from('tenants').select('*').eq('id', slug).maybeSingle()
            : client.from('tenants').select('*').eq('slug', slug).maybeSingle();
          const { data } = await query;
          if (data) return this.mapTenant(data);
        }
        return null;
      })
    );
  }

  createTenant(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/tenants`, payload);
  }

  // --- CATEGORIAS ---
  getCategories(tenantId: string): Observable<ProductCategory[]> {
    return this.http.get<any[]>(`${this.baseUrl}/tenants/${tenantId}/categories`).pipe(
      map(rows => {
        if (!rows || rows.length === 0) return [];
        return rows.map(r => ({
          id: r.id,
          name: r.name,
          slug: r.name.toLowerCase().replace(/\s+/g, '-'),
          displayOrder: r.sort_order ?? 0,
        }));
      }),
      catchError(err => {
        console.warn(`[ApiService] Error obteniendo categorías de '${tenantId}':`, err);
        return of([]);
      })
    );
  }

  createCategory(tenantId: string, name: string): Observable<ProductCategory> {
    return this.http.post<any>(`${this.baseUrl}/tenants/${tenantId}/categories`, { name }).pipe(
      map(r => ({
        id: r.id,
        name: r.name,
        slug: r.name.toLowerCase().replace(/\s+/g, '-'),
        displayOrder: r.sort_order ?? 0,
      }))
    );
  }

  updateCategory(tenantId: string, id: string, name: string): Observable<ProductCategory> {
    return this.http.put<any>(`${this.baseUrl}/tenants/${tenantId}/categories/${id}`, { name }).pipe(
      map(r => ({
        id: r.id,
        name: r.name,
        slug: r.name.toLowerCase().replace(/\s+/g, '-'),
        displayOrder: r.sort_order ?? 0,
      }))
    );
  }

  deleteCategory(tenantId: string, id: string): Observable<boolean> {
    return this.http.delete<any>(`${this.baseUrl}/tenants/${tenantId}/categories/${id}`).pipe(
      map(() => true)
    );
  }

  uploadImage(data: string, filename?: string): Observable<{ success: boolean; url: string; filename: string }> {
    return this.http.post<{ success: boolean; url: string; filename: string }>(
      `${this.baseUrl}/uploads`,
      { data, filename }
    );
  }

  // --- PRODUCTOS ---
  getProducts(tenantId: string, branchId?: string, onlyAvailable = false): Observable<Product[]> {
    let url = `${this.baseUrl}/tenants/${tenantId}/products`;
    const params: string[] = [];
    if (branchId && branchId !== 'all') params.push(`branchId=${encodeURIComponent(branchId)}`);
    if (onlyAvailable) params.push(`onlyAvailable=true`);
    if (params.length > 0) url += `?${params.join('&')}`;

    return this.http.get<any[]>(url).pipe(
      map(rows => {
        if (!rows || rows.length === 0) return [];
        return rows.map(r => this.mapProduct(r));
      }),
      catchError(async () => {
        const client = this.supabase.rawClient;
        if (client) {
          let query = client
            .from('products')
            .select('*, modifier_groups(*, modifier_options(*))')
            .eq('tenant_id', tenantId);

          if (branchId && branchId !== 'all') {
            query = query.eq('branch_id', branchId);
          }
          if (onlyAvailable) {
            query = query.eq('is_available', true);
          }

          const { data } = await query.order('sort_order');
          if (data) {
            return data.map(r => this.mapProduct(r));
          }
        }
        return [];
      })
    );
  }

  createProduct(productData: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/products`, productData).pipe(
      catchError(async () => {
        const client = this.supabase.rawClient;
        if (client) {
          const row: any = {
            tenant_id: productData.tenant_id || productData.tenantId,
            branch_id: (productData.branch_id || productData.branchId) && productData.branch_id !== 'all' && productData.branchId !== 'all' ? (productData.branch_id || productData.branchId) : null,
            name: productData.name,
            description: productData.description || null,
            price: Number(productData.price) || 0,
            currency: productData.currency || 'USD',
            category_id: productData.category_id || productData.categoryId || null,
            image_url: productData.image_url || productData.imageUrl || null,
            is_available: productData.is_available ?? productData.isAvailable ?? true,
            sku: productData.sku ? String(productData.sku).trim() : null,
            barcode: productData.barcode ? String(productData.barcode).trim() : null,
            is_popular: Boolean(productData.is_popular ?? productData.isPopular ?? false),
            is_featured: Boolean(productData.is_featured ?? productData.isFeatured ?? false),
            is_on_sale: Boolean(productData.is_on_sale ?? productData.isOnSale ?? false),
            compare_at_price: (productData.compare_at_price || productData.compareAtPrice) ? Number(productData.compare_at_price || productData.compareAtPrice) : null,
            discount_percentage: Number(productData.discount_percentage ?? productData.discountPercentage) || 0,
            sort_order: Number(productData.sort_order ?? productData.sortOrder) || 0
          };
          const { data, error } = await client.from('products').insert(row).select().single();
          if (!error && data) {
            const groups = productData.modifierGroups || productData.modifier_groups;
            if (Array.isArray(groups)) {
              for (let gIdx = 0; gIdx < groups.length; gIdx++) {
                const g = groups[gIdx];
                const { data: gData } = await client.from('modifier_groups').insert({
                  product_id: data.id,
                  title: g.title,
                  min_selections: Number(g.minSelections ?? g.min_selections) || 0,
                  max_selections: Number(g.maxSelections ?? g.max_selections) || 1,
                  sort_order: gIdx
                }).select().single();
                if (gData && Array.isArray(g.options)) {
                  const opts = g.options.map((o: any, oIdx: number) => ({
                    group_id: gData.id,
                    name: o.name,
                    price_delta: Number(o.priceDelta ?? o.price_delta) || 0,
                    is_available: o.isAvailable ?? o.is_available ?? true,
                    sort_order: oIdx
                  }));
                  await client.from('modifier_options').insert(opts);
                }
              }
            }
            return data;
          }
        }
        return productData;
      })
    );
  }

  updateProduct(productId: string, productData: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/products/${productId}`, productData).pipe(
      catchError(async () => {
        const client = this.supabase.rawClient;
        if (client) {
          const row: any = { updated_at: new Date().toISOString() };
          if (productData.name !== undefined) row.name = productData.name;
          if (productData.description !== undefined) row.description = productData.description;
          if (productData.price !== undefined) row.price = Number(productData.price);
          if (productData.currency !== undefined) row.currency = productData.currency;
          if (productData.category_id !== undefined || productData.categoryId !== undefined) {
            row.category_id = productData.category_id ?? productData.categoryId;
          }
          if (productData.image_url !== undefined || productData.imageUrl !== undefined) {
            row.image_url = productData.image_url ?? productData.imageUrl;
          }
          if (productData.is_available !== undefined || productData.isAvailable !== undefined) {
            row.is_available = productData.is_available ?? productData.isAvailable;
          }
          if (productData.branch_id !== undefined || productData.branchId !== undefined) {
            const bId = productData.branch_id ?? productData.branchId;
            row.branch_id = (bId && bId !== 'all') ? bId : null;
          }
          if (productData.sku !== undefined) row.sku = productData.sku ? String(productData.sku).trim() : null;
          if (productData.barcode !== undefined) row.barcode = productData.barcode ? String(productData.barcode).trim() : null;
          if (productData.is_popular !== undefined || productData.isPopular !== undefined) {
            row.is_popular = Boolean(productData.is_popular ?? productData.isPopular);
          }
          if (productData.is_featured !== undefined || productData.isFeatured !== undefined) {
            row.is_featured = Boolean(productData.is_featured ?? productData.isFeatured);
          }
          if (productData.is_on_sale !== undefined || productData.isOnSale !== undefined) {
            row.is_on_sale = Boolean(productData.is_on_sale ?? productData.isOnSale);
          }
          if (productData.compare_at_price !== undefined || productData.compareAtPrice !== undefined) {
            const cap = productData.compare_at_price ?? productData.compareAtPrice;
            row.compare_at_price = cap ? Number(cap) : null;
          }
          if (productData.discount_percentage !== undefined || productData.discountPercentage !== undefined) {
            row.discount_percentage = Number(productData.discount_percentage ?? productData.discountPercentage) || 0;
          }

          await client.from('products').update(row).eq('id', productId);

          const groups = productData.modifierGroups !== undefined ? productData.modifierGroups : productData.modifier_groups;
          if (Array.isArray(groups)) {
            await client.from('modifier_groups').delete().eq('product_id', productId);
            for (let gIdx = 0; gIdx < groups.length; gIdx++) {
              const g = groups[gIdx];
              const { data: gData } = await client.from('modifier_groups').insert({
                product_id: productId,
                title: g.title,
                min_selections: Number(g.minSelections ?? g.min_selections) || 0,
                max_selections: Number(g.maxSelections ?? g.max_selections) || 1,
                sort_order: gIdx
              }).select().single();
              if (gData && Array.isArray(g.options)) {
                const opts = g.options.map((o: any, oIdx: number) => ({
                  group_id: gData.id,
                  name: o.name,
                  price_delta: Number(o.priceDelta ?? o.price_delta) || 0,
                  is_available: o.isAvailable ?? o.is_available ?? true,
                  sort_order: oIdx
                }));
                await client.from('modifier_options').insert(opts);
              }
            }
          }
        }
        return { id: productId, ...productData };
      })
    );
  }

  copyProductsFromMainBranch(tenantId: string, branchId: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/tenants/${tenantId}/branches/${branchId}/copy-from-main`, {});
  }

  bulkImportProducts(tenantId: string, products: any[], branchId?: string): Observable<{ success: boolean; count: number; totalExpected: number; errors: string[] }> {
    return this.http.post<any>(`${this.baseUrl}/tenants/${tenantId}/products/bulk`, { products, branchId }).pipe(
      catchError(async () => {
        // Direct Supabase fallback
        const client = this.supabase.rawClient;
        if (!client) {
          return { success: true, count: products.length, totalExpected: products.length, errors: [] };
        }

        let totalImported = 0;
        const errors: string[] = [];
        const BATCH_SIZE = 100;

        for (let i = 0; i < products.length; i += BATCH_SIZE) {
          const chunk = products.slice(i, i + BATCH_SIZE);
          const rows = chunk.map((p, idx) => ({
            tenant_id: tenantId,
            name: String(p.name || p.nombre || `Producto ${i + idx + 1}`).trim(),
            description: p.description || p.descripcion || null,
            price: Number(p.price || p.precio) || 0,
            currency: p.currency || p.moneda || 'USD',
            category_id: p.category_id || p.categoryId || null,
            image_url: p.imageUrl || p.image_url || p.imagen || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
            is_available: p.isAvailable !== undefined ? Boolean(p.isAvailable) : (p.disponible !== undefined ? Boolean(p.disponible) : true),
            sku: p.sku ? String(p.sku).trim() : null,
            barcode: p.barcode || p.codigoDeBarra || p.codigo_barra ? String(p.barcode || p.codigoDeBarra || p.codigo_barra).trim() : null,
            sort_order: i + idx
          }));

          const { data, error } = await client.from('products').insert(rows).select('id');
          if (error) {
            errors.push(`Error en lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
          } else if (data) {
            totalImported += data.length;
          }
        }

        return {
          success: totalImported > 0 || errors.length === 0,
          count: totalImported,
          totalExpected: products.length,
          errors
        };
      })
    );
  }

  // --- PEDIDOS / CHECKOUT ---
  createOrder(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/orders`, payload).pipe(
      catchError(err => {
        console.error('[ApiService] Error creando pedido en el backend:', err);
        throw err;
      })
    );
  }

  getOrder(id: string): Observable<Order | null> {
    return this.http.get<any>(`${this.baseUrl}/orders/${id}`).pipe(
      map(row => (row ? this.mapOrder(row) : null)),
      catchError(err => {
        console.warn(`[ApiService] Error consultando pedido '${id}' del backend:`, err);
        return of(null);
      })
    );
  }

  getOrders(tenantId: string, status?: string, branchId?: string): Observable<Order[]> {
    const params: string[] = [];
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    if (branchId && branchId !== 'all') params.push(`branchId=${encodeURIComponent(branchId)}`);
    const queryStr = params.length > 0 ? `?${params.join('&')}` : '';
    const url = `${this.baseUrl}/orders/tenant/${tenantId}${queryStr}`;

    return this.http.get<any[]>(url).pipe(
      map(rows => {
        if (!rows || rows.length === 0) {
          return [];
        }
        return rows.map(r => this.mapOrder(r));
      }),
      catchError(err => {
        console.warn(`[ApiService] Error obteniendo pedidos de '${tenantId}':`, err);
        return of([]);
      })
    );
  }

  updateOrderStatus(orderId: string, status: string): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/orders/${orderId}/status`, { status }).pipe(
      catchError(err => {
        console.error(`[ApiService] Error actualizando estado de pedido '${orderId}':`, err);
        throw err;
      })
    );
  }

  assignRider(orderId: string, riderId: string): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/orders/${orderId}/assign-rider`, { riderId }).pipe(
      catchError(err => {
        console.error(`[ApiService] Error asignando repartidor a '${orderId}':`, err);
        throw err;
      })
    );
  }

  getFastestRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Observable<{ distanceKm: number; durationMinutes: number; waypoints: [number, number][] } | null> {
    const computeOptimalClientSide = async (): Promise<{ distanceKm: number; durationMinutes: number; waypoints: [number, number][] } | null> => {
      const queryStr = `${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson&alternatives=3&continue_straight=false`;
      const endpoints = [
        `https://routing.openstreetmap.de/routed-car/route/v1/driving/${queryStr}`,
        `https://router.project-osrm.org/route/v1/driving/${queryStr}`,
        `https://routing.openstreetmap.de/routed-bike/route/v1/driving/${queryStr}`,
      ];

      const fetchCandidate = async (ep: string) => {
        try {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 3500);
          const res = await fetch(ep, { signal: ctrl.signal });
          clearTimeout(tid);
          if (!res.ok) return [];
          const data = await res.json();
          if (data?.code === 'Ok' && Array.isArray(data.routes)) {
            return data.routes
              .filter((r: any) => r?.geometry?.coordinates?.length >= 2)
              .map((r: any) => {
                const distanceKm = Number((r.distance / 1000).toFixed(2));
                const rawMins = r.duration / 60;
                const durationMinutes = Math.max(1, Math.round(Math.min(rawMins, (distanceKm / 28) * 60)));
                const waypoints: [number, number][] = r.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
                const score = distanceKm * 1.7 + durationMinutes * 0.3;
                return { distanceKm, durationMinutes, waypoints, score };
              });
          }
        } catch {}
        return [];
      };

      const lists = await Promise.all(endpoints.map(fetchCandidate));
      const all = lists.flat();
      if (all.length > 0) {
        all.sort((a, b) => a.score - b.score);
        const best = all[0];
        return {
          distanceKm: best.distanceKm,
          durationMinutes: best.durationMinutes,
          waypoints: best.waypoints,
        };
      }
      return null;
    };

    const url = `${this.baseUrl}/orders/fastest-route?originLat=${originLat}&originLng=${originLng}&destLat=${destLat}&destLng=${destLng}`;
    return from(computeOptimalClientSide()).pipe(
      switchMap(clientRes => {
        if (clientRes && clientRes.waypoints.length >= 2) {
          return of(clientRes);
        }
        return this.http.get<any>(url).pipe(catchError(() => of(null)));
      }),
      catchError(() => this.http.get<any>(url).pipe(catchError(() => of(null))))
    );
  }

  // --- REPARTIDORES & TELEMETRÍA ---
  getRiders(tenantId?: string, branchId?: string): Observable<any[]> {
    const params: string[] = [];
    if (tenantId) params.push(`tenantId=${tenantId}`);
    if (branchId && branchId !== 'all') params.push(`branchId=${branchId}`);
    const queryStr = params.length > 0 ? `?${params.join('&')}` : '';
    const url = `${this.baseUrl}/riders${queryStr}`;

    return this.http.get<any[]>(url).pipe(
      catchError(err => {
        console.warn('[ApiService] Error obteniendo repartidores del backend:', err);
        return of([]);
      })
    );
  }

  createRider(payload: { tenant_id?: string; branch_id?: string; name: string; email?: string; password?: string; phone: string; national_id?: string; vehicle_plate: string; vehicle_type?: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/riders`, payload).pipe(
      catchError(err => {
        console.error('[ApiService] Error creando repartidor en backend:', err);
        throw err;
      })
    );
  }

  deleteRider(riderId: string, branchId?: string): Observable<any> {
    const url = branchId && branchId !== 'all'
      ? `${this.baseUrl}/riders/${riderId}?branchId=${branchId}`
      : `${this.baseUrl}/riders/${riderId}`;
    return this.http.delete<any>(url).pipe(
      catchError(async (err) => {
        console.warn('[ApiService] Error eliminando motorizado en backend, intentando fallback en Supabase:', err);
        try {
          if (this.supabase.rawClient) {
            await this.supabase.rawClient.from('riders').delete().eq('id', riderId);
          }
          return { success: true };
        } catch (sbErr) {
          throw err;
        }
      })
    );
  }

  loginRider(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/riders/login`, { email, password });
  }

  getOrdersByDriver(driverId: string): Observable<Order[]> {
    return this.http.get<any[]>(`${this.baseUrl}/orders/driver/${driverId}`).pipe(
      map(rows => (rows || []).map(r => this.mapOrder(r))),
      catchError(err => {
        console.warn(`[ApiService] Error obteniendo pedidos del repartidor '${driverId}':`, err);
        return of([]);
      })
    );
  }

  updateRiderLocation(riderId: string, lat: number, lng: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/riders/${riderId}/location`, { lat, lng }).pipe(
      catchError(err => {
        console.warn('[ApiService] Error actualizando ubicación GPS:', err);
        return of(null);
      })
    );
  }

  getRiderProfile(riderId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/riders/${riderId}`).pipe(
      catchError(err => {
        console.warn(`[ApiService] Error obteniendo perfil de repartidor '${riderId}':`, err);
        return of(null);
      })
    );
  }

  updateRiderProfile(riderId: string, profileData: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/riders/${riderId}/profile`, profileData).pipe(
      catchError(err => {
        console.warn(`[ApiService] Error actualizando perfil de repartidor '${riderId}':`, err);
        return of(profileData);
      })
    );
  }

  saveTelemetry(telemetry: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/riders/telemetry`, telemetry).pipe(
      catchError(err => {
        console.warn('[ApiService] Error registrando telemetría GPS:', err);
        return of(null);
      })
    );
  }

  getOrderTelemetry(orderId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/riders/orders/${orderId}/telemetry`).pipe(
      catchError(err => {
        console.warn(`[ApiService] Error obteniendo telemetría de orden '${orderId}':`, err);
        return of([]);
      })
    );
  }

  // --- BANNERS & PROMOCIONES GLOBALES (SUPER ADMIN) ---
  getBanners(onlyActive = true): Observable<Banner[]> {
    const url = onlyActive ? `${this.baseUrl}/banners` : `${this.baseUrl}/banners?all=true`;
    return this.http.get<any[]>(url).pipe(
      map(rows => (rows || []).map(r => this.mapBanner(r))),
      catchError(async () => {
        const client = this.supabase.rawClient;
        if (client) {
          let query = client.from('banners').select('*').order('sort_order', { ascending: true });
          if (onlyActive) query = query.eq('is_active', true);
          const { data } = await query;
          if (data && data.length > 0) return data.map(r => this.mapBanner(r));
        }
        return [
          {
            id: 'banner_flash_30',
            title: '30% OFF en tu primer pedido',
            subtitle: 'Usa el cupón FLASHNOW al pagar',
            couponCode: 'FLASHNOW',
            badgeText: '⚡ ENTREGA FLASH 20 MIN',
            buttonText: 'Pedir ahora',
            linkUrl: '/explorar',
            imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=80',
            bgGradientStart: '#f97316',
            bgGradientEnd: '#ea580c',
            sortOrder: 1,
            isActive: true
          }
        ];
      })
    );
  }

  createBanner(payload: Partial<Banner>): Observable<Banner> {
    const body = {
      title: payload.title,
      subtitle: payload.subtitle,
      coupon_code: payload.couponCode,
      badge_text: payload.badgeText,
      button_text: payload.buttonText,
      link_url: payload.linkUrl,
      image_url: payload.imageUrl,
      bg_gradient_start: payload.bgGradientStart,
      bg_gradient_end: payload.bgGradientEnd,
      sort_order: payload.sortOrder ?? 0,
      is_active: payload.isActive ?? true
    };
    return this.http.post<any>(`${this.baseUrl}/banners`, body).pipe(
      map(row => this.mapBanner(row))
    );
  }

  updateBanner(id: string, payload: Partial<Banner>): Observable<Banner> {
    const body: any = {};
    if (payload.title !== undefined) body.title = payload.title;
    if (payload.subtitle !== undefined) body.subtitle = payload.subtitle;
    if (payload.couponCode !== undefined) body.coupon_code = payload.couponCode;
    if (payload.badgeText !== undefined) body.badge_text = payload.badgeText;
    if (payload.buttonText !== undefined) body.button_text = payload.buttonText;
    if (payload.linkUrl !== undefined) body.link_url = payload.linkUrl;
    if (payload.imageUrl !== undefined) body.image_url = payload.imageUrl;
    if (payload.bgGradientStart !== undefined) body.bg_gradient_start = payload.bgGradientStart;
    if (payload.bgGradientEnd !== undefined) body.bg_gradient_end = payload.bgGradientEnd;
    if (payload.sortOrder !== undefined) body.sort_order = payload.sortOrder;
    if (payload.isActive !== undefined) body.is_active = payload.isActive;

    return this.http.patch<any>(`${this.baseUrl}/banners/${id}`, body).pipe(
      map(row => this.mapBanner(row))
    );
  }

  deleteBanner(id: string): Observable<boolean> {
    return this.http.delete<any>(`${this.baseUrl}/banners/${id}`).pipe(
      map(() => true),
      catchError(async () => true)
    );
  }

  // --- CATEGORIAS GLOBALES DEL MARKETPLACE ---
  getBusinessCategories(includeInactive = false): Observable<BusinessCategory[]> {
    const url = includeInactive ? `${this.baseUrl}/categories?includeInactive=true` : `${this.baseUrl}/categories`;
    return this.http.get<any[]>(url).pipe(
      map(rows => {
        if (!rows || rows.length === 0) return [];
        return rows.map(r => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          icon: r.icon || '🛍️',
          subcategories: Array.isArray(r.subcategories) ? r.subcategories : [],
          sort_order: r.sort_order ?? 0,
          is_active: r.is_active ?? true,
          created_at: r.created_at,
          updated_at: r.updated_at
        }));
      }),
      catchError(async () => {
        const client = this.supabase.rawClient;
        if (client) {
          try {
            let query = client.from('business_categories').select('*').order('sort_order');
            if (!includeInactive) query = query.eq('is_active', true);
            const { data } = await query;
            if (data && data.length > 0) {
              return data.map(r => ({
                id: r.id,
                name: r.name,
                slug: r.slug,
                icon: r.icon || '🛍️',
                subcategories: Array.isArray(r.subcategories) ? r.subcategories : [],
                sort_order: r.sort_order ?? 0,
                is_active: r.is_active ?? true,
                created_at: r.created_at,
                updated_at: r.updated_at
              }));
            }
          } catch (_) {}
        }
        return [
          { id: 'cat_restaurantes', name: 'Restaurantes', slug: 'restaurantes', icon: '🍽️', subcategories: ['Hamburguesas', 'Sushi & Asiática', 'Pastas & Italiana', 'Pizzas', 'Pollos & Brasas', 'Carnes & Grill', 'Comida Rápida', 'Comida Mexicana', 'Café & Bakery', 'Desayunos', 'Arepas & Empanadas'], sort_order: 1, is_active: true },
          { id: 'cat_super', name: 'Súper', slug: 'super', icon: '🛒', subcategories: ['Víveres', 'Lácteos & Huevos', 'Frutas & Verduras', 'Carnicería & Aves', 'Limpieza', 'Bebidas'], sort_order: 2, is_active: true },
          { id: 'cat_farmacias', name: 'Farmacias', slug: 'farmacias', icon: '💊', subcategories: ['Medicamentos', 'Cuidado Personal', 'Bebés & Maternidad', 'Primeros Auxilios', 'Vitaminas'], sort_order: 3, is_active: true },
          { id: 'cat_mascotas', name: 'Mascotas', slug: 'mascotas', icon: '🐾', subcategories: ['Alimento Perros', 'Alimento Gatos', 'Snacks & Premios', 'Higiene & Farmacia', 'Accesorios'], sort_order: 4, is_active: true },
          { id: 'cat_licores', name: 'Licores', slug: 'licores', icon: '🍷', subcategories: ['Cervezas', 'Vinos', 'Rones', 'Whiskies', 'Snacks & Hielo'], sort_order: 5, is_active: true },
          { id: 'cat_postres', name: 'Postres', slug: 'postres', icon: '🧁', subcategories: ['Tortas & Pasteles', 'Helados', 'Donas & Churros', 'Chocolatería', 'Galletas'], sort_order: 6, is_active: true }
        ];
      })
    );
  }

  createBusinessCategory(payload: any): Observable<BusinessCategory> {
    return this.http.post<BusinessCategory>(`${this.baseUrl}/categories`, payload);
  }

  updateBusinessCategory(id: string, payload: any): Observable<BusinessCategory> {
    return this.http.patch<BusinessCategory>(`${this.baseUrl}/categories/${id}`, payload);
  }

  deleteBusinessCategory(id: string): Observable<boolean> {
    return this.http.delete<any>(`${this.baseUrl}/categories/${id}`).pipe(
      map(() => true),
      catchError(async () => true)
    );
  }

  // --- CUPONES DE OFERTA DE COMERCIO ---
  getCoupons(tenantId: string): Observable<Coupon[]> {
    return this.http.get<any[]>(`${this.baseUrl}/coupons/tenant/${tenantId}`).pipe(
      map(rows => {
        if (!rows || rows.length === 0) return [];
        return rows.map(r => this.mapCoupon(r));
      }),
      catchError(async () => {
        const client = this.supabase.rawClient;
        if (client) {
          try {
            const { data } = await client.from('coupons').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
            if (data && data.length > 0) return data.map(r => this.mapCoupon(r));
          } catch (_) {}
        }
        return [];
      })
    );
  }

  createCoupon(payload: any): Observable<Coupon> {
    const body = {
      tenant_id: payload.tenantId || payload.tenant_id,
      code: payload.code,
      description: payload.description || '',
      discount_type: payload.discountType || payload.discount_type || 'percentage',
      discount_value: payload.discountValue ?? payload.discount_value ?? 10,
      min_order_amount: payload.minOrderAmount ?? payload.min_order_amount ?? 0,
      max_discount: payload.maxDiscountAmount ?? payload.maxDiscount ?? payload.max_discount ?? null,
      usage_limit: payload.usageLimit ?? payload.usage_limit ?? null,
      is_active: payload.isActive ?? payload.is_active ?? true,
      is_global: Boolean(payload.isGlobal ?? payload.is_global),
      target_condition: payload.targetCondition || payload.target_condition || 'all',
      expires_at: payload.expiresAt || payload.expires_at || null
    };
    return this.http.post<any>(`${this.baseUrl}/coupons`, body).pipe(
      map(r => this.mapCoupon(r))
    );
  }

  updateCoupon(id: string, payload: any): Observable<Coupon> {
    const body: any = {};
    if (payload.code !== undefined) body.code = payload.code;
    if (payload.description !== undefined) body.description = payload.description;
    if (payload.discountType !== undefined || payload.discount_type !== undefined) body.discount_type = payload.discountType || payload.discount_type;
    if (payload.discountValue !== undefined || payload.discount_value !== undefined) body.discount_value = payload.discountValue ?? payload.discount_value;
    if (payload.minOrderAmount !== undefined || payload.min_order_amount !== undefined) body.min_order_amount = payload.minOrderAmount ?? payload.min_order_amount;
    if (payload.maxDiscountAmount !== undefined || payload.maxDiscount !== undefined || payload.max_discount !== undefined) {
      body.max_discount = payload.maxDiscountAmount ?? payload.maxDiscount ?? payload.max_discount;
    }
    if (payload.isActive !== undefined || payload.is_active !== undefined) body.is_active = payload.isActive ?? payload.is_active;
    if (payload.expiresAt !== undefined || payload.expires_at !== undefined) body.expires_at = payload.expiresAt ?? payload.expires_at;

    return this.http.patch<any>(`${this.baseUrl}/coupons/${id}`, body).pipe(
      map(r => this.mapCoupon(r))
    );
  }

  deleteCoupon(id: string): Observable<boolean> {
    return this.http.delete<any>(`${this.baseUrl}/coupons/${id}`).pipe(
      map(() => true),
      catchError(async () => true)
    );
  }

  getAllCoupons(): Observable<Coupon[]> {
    return this.http.get<any[]>(`${this.baseUrl}/coupons`).pipe(
      map(list => (list || []).map(r => this.mapCoupon(r))),
      catchError(async () => [])
    );
  }

  notifyCoupon(couponId: string, condition?: string, tenantName?: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<any>(`${this.baseUrl}/coupons/${couponId}/notify`, { condition, tenantName }).pipe(
      catchError(async () => ({ success: false, message: 'Error enviando notificación' }))
    );
  }

  getNotifications(condition = 'all', tenantId?: string): Observable<any[]> {
    let url = `${this.baseUrl}/notifications?condition=${condition}`;
    if (tenantId) url += `&tenantId=${tenantId}`;
    return this.http.get<any[]>(url).pipe(
      catchError(async () => [])
    );
  }

  getPlatformUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/users`).pipe(
      catchError(async () => [])
    );
  }

  getMetricsSummary(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/metrics/summary`).pipe(
      catchError(async () => null)
    );
  }

  getStockHistory(tenantId: string, productId?: string): Observable<any[]> {
    let url = `${this.baseUrl}/tenants/${tenantId}/stock-history`;
    if (productId) url += `?productId=${productId}`;
    return this.http.get<any[]>(url).pipe(
      catchError(async () => [])
    );
  }

  validateCoupon(tenantId: string, code: string, orderAmount: number): Observable<{
    isValid: boolean;
    message: string;
    coupon?: {
      id: string;
      code: string;
      discountType: 'percentage' | 'fixed';
      discountValue: number;
      discountAmount: number;
      finalAmount: number;
    };
  }> {
    return this.http.post<any>(`${this.baseUrl}/coupons/validate`, { tenantId, code, orderAmount }).pipe(
      catchError(async (err) => ({
        isValid: false,
        message: err.error?.message || 'Cupón inválido o expirado'
      }))
    );
  }

  private mapCoupon(r: any): Coupon {
    return {
      id: r.id,
      tenantId: r.tenant_id || r.tenantId,
      code: r.code,
      description: r.description || '',
      discountType: r.discount_type || r.discountType || 'percentage',
      discountValue: Number(r.discount_value ?? r.discountValue) || 0,
      minOrderAmount: Number(r.min_order_amount ?? r.minOrderAmount) || 0,
      maxDiscount: r.max_discount ? Number(r.max_discount) : (r.maxDiscount ? Number(r.maxDiscount) : null),
      maxDiscountAmount: r.max_discount ? Number(r.max_discount) : (r.maxDiscount ? Number(r.maxDiscount) : (r.maxDiscountAmount ? Number(r.maxDiscountAmount) : null)),
      usageLimit: r.usage_limit ? Number(r.usage_limit) : null,
      timesUsed: Number(r.times_used ?? r.timesUsed) || 0,
      isActive: r.is_active ?? r.isActive ?? true,
      isGlobal: Boolean(r.is_global ?? r.isGlobal),
      targetCondition: r.target_condition || r.targetCondition || 'all',
      notificationSentAt: r.notification_sent_at || r.notificationSentAt || null,
      expiresAt: r.expires_at || r.expiresAt || null,
      createdAt: r.created_at || r.createdAt,
      updatedAt: r.updated_at || r.updatedAt
    };
  }

  // --- COMERCIOS (UPDATE CON PERSISTENCIA DUAL BACKEND + SUPABASE) ---
  updateTenant(id: string, updateData: any): Observable<any> {
    const saveToSupabaseDirectly = async () => {
      const client = this.supabase.rawClient;
      if (client) {
        try {
          const supabasePayload: any = { updated_at: new Date().toISOString() };
          if (updateData.name !== undefined) supabasePayload.name = updateData.name;
          if (updateData.category !== undefined) supabasePayload.category = updateData.category;
          if (updateData.subcategories !== undefined) supabasePayload.subcategories = updateData.subcategories;
          if (updateData.is_active !== undefined || updateData.isActive !== undefined) {
            supabasePayload.is_active = Boolean(updateData.is_active ?? updateData.isActive);
          }
          if (updateData.accent_color !== undefined) supabasePayload.accent_color = updateData.accent_color;
          if (updateData.logo_url !== undefined) supabasePayload.logo_url = updateData.logo_url;
          if (updateData.banner_url !== undefined) supabasePayload.banner_url = updateData.banner_url;
          if (updateData.whatsapp_number !== undefined) supabasePayload.whatsapp_number = updateData.whatsapp_number;
          if (updateData.phone !== undefined) supabasePayload.phone = updateData.phone;
          if (updateData.address !== undefined) supabasePayload.address = updateData.address;
          if (updateData.latitude !== undefined) supabasePayload.latitude = Number(updateData.latitude);
          if (updateData.longitude !== undefined) supabasePayload.longitude = Number(updateData.longitude);
          if (updateData.delivery_radius_km !== undefined) supabasePayload.delivery_radius_km = Number(updateData.delivery_radius_km);
          if (updateData.base_delivery_fee !== undefined) supabasePayload.base_delivery_fee = Number(updateData.base_delivery_fee);
          if (updateData.delivery_tiers !== undefined || updateData.deliveryTiers !== undefined) {
            supabasePayload.delivery_tiers = updateData.delivery_tiers || updateData.deliveryTiers;
          }
          if (updateData.is_featured !== undefined || updateData.isFeatured !== undefined) {
            supabasePayload.is_featured = Boolean(updateData.is_featured ?? updateData.isFeatured);
          }

          const { data } = await client.from('tenants').update(supabasePayload).eq('id', id).select('*').maybeSingle();

          // Sincronizar cobertura y tarifas de entrega en todas las sucursales de la empresa
          try {
            const branchPayload: any = { updated_at: new Date().toISOString() };
            if (updateData.delivery_radius_km !== undefined) branchPayload.delivery_radius_km = Number(updateData.delivery_radius_km);
            if (updateData.base_delivery_fee !== undefined) branchPayload.base_delivery_fee = Number(updateData.base_delivery_fee);
            if (updateData.delivery_tiers !== undefined || updateData.deliveryTiers !== undefined) {
              branchPayload.delivery_tiers = updateData.delivery_tiers || updateData.deliveryTiers;
            }
            if (Object.keys(branchPayload).length > 1) {
              await client.from('branches').update(branchPayload).eq('company_id', id);
            }
          } catch (_) {}

          return data;
        } catch (e) {
          console.warn('[ApiService] Direct Supabase tenant update error:', e);
        }
      }
      return null;
    };

    return this.http.put<any>(`${this.baseUrl}/tenants/${id}`, updateData).pipe(
      tap(() => {
        saveToSupabaseDirectly();
      }),
      catchError(async () => {
        const directData = await saveToSupabaseDirectly();
        return directData || updateData;
      })
    );
  }

  // --- COLABORADORES & ENCARGADOS DE SUCURSAL DEL COMERCIO ---
  getStoreUsers(tenantId: string, branchId?: string): Observable<AppUser[]> {
    let url = `${this.baseUrl}/tenants/${tenantId}/users`;
    if (branchId && branchId !== 'all') {
      url += `?branchId=${branchId}`;
    }
    return this.http.get<any[]>(url).pipe(
      map(rows => {
        if (!rows || rows.length === 0) return [];
        return rows.map(r => this.mapStoreUser(r));
      }),
      catchError(err => {
        console.warn('[ApiService] Error obteniendo usuarios del comercio:', err);
        return of([]);
      })
    );
  }

  createStoreUser(tenantId: string, payload: Partial<AppUser> & { password?: string }): Observable<AppUser> {
    return this.http.post<any>(`${this.baseUrl}/tenants/${tenantId}/users`, {
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      role: payload.role,
      branch_id: payload.branchId === 'all' ? null : payload.branchId,
      branch_name: payload.branchName,
      password: payload.password
    }).pipe(
      map(row => this.mapStoreUser(row))
    );
  }

  updateStoreUser(tenantId: string, userId: string, payload: Partial<AppUser>): Observable<AppUser> {
    return this.http.put<any>(`${this.baseUrl}/tenants/${tenantId}/users/${userId}`, {
      name: payload.name,
      phone: payload.phone,
      role: payload.role,
      branch_id: payload.branchId === 'all' ? null : payload.branchId,
      branch_name: payload.branchName,
      is_active: payload.isActive
    }).pipe(
      map(row => this.mapStoreUser(row))
    );
  }

  deleteStoreUser(tenantId: string, userId: string): Observable<boolean> {
    return this.http.delete<any>(`${this.baseUrl}/tenants/${tenantId}/users/${userId}`).pipe(
      map(() => true),
      catchError(err => {
        console.error('[ApiService] Error eliminando colaborador:', err);
        throw err;
      })
    );
  }

  loginStoreUser(email: string, password?: string): Observable<AppUser> {
    return this.http.post<any>(`${this.baseUrl}/users/login`, { email, password }).pipe(
      map(row => this.mapStoreUser(row))
    );
  }

  private mapStoreUser(row: any): AppUser {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone || '',
      role: row.role,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name || row.tenants?.name || '',
      branchId: row.branch_id || undefined,
      branchName: row.branch_name || (row.branch_id ? 'Sucursal Asignada' : 'Todas las Sedes (Acceso Global)'),
      permissions: [],
      avatarUrl: row.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isActive: row.is_active !== false
    };
  }

  // ==========================================
  // HELPERS DE NORMALIZACIÓN (SNAKE -> CAMEL)
  // ==========================================
  private mapTenant(row: any): Tenant {
    // Si ya viene formateado en camelCase, retornarlo
    if (row.deliverySettings && row.branding) {
      return row as Tenant;
    }

    const defaultAccent = row.accent_color || (row.slug === 'burger-lab' ? '#f97316' : '#ea580c');
    const defaultLogo = row.logo_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=300&auto=format&fit=crop&q=80';
    const defaultBanner = row.banner_url || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&auto=format&fit=crop&q=80';

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      tagline: row.tagline || (row.slug === 'burger-lab' ? 'Hamburguesas smash & cortes premium con pan brioche artesanal' : ''),
      description: row.description || (row.slug === 'burger-lab' ? 'Ingredientes 100% frescos, carnes maduradas y salsas de la casa preparadas diariamente.' : ''),
      logoUrl: defaultLogo,
      bannerUrl: defaultBanner,
      rating: Number(row.rating) || 5.0,
      reviewCount: Number(row.review_count) || 0,
      category: row.category || (row.slug === 'burger-lab' ? 'Restaurantes' : 'Restaurantes'),
      subcategories: Array.isArray(row.subcategories) ? row.subcategories : (row.slug === 'burger-lab' ? ['Hamburguesas'] : []),
      isActive: row.is_active ?? true,
      isFeatured: Boolean(row.is_featured ?? row.isFeatured ?? false),
      contact: {
        whatsappNumber: row.whatsapp_number || row.phone || '',
        phone: row.phone || '',
        instagram: row.instagram || (row.slug === 'burger-lab' ? '@burgerlab.artesanal' : ''),
        address: row.address || '',
        coordinates: {
          lat: Number(row.latitude) || 10.4820,
          lng: Number(row.longitude) || -66.8610,
        },
      },
      deliverySettings: {
        hasDelivery: true,
        hasPickup: true,
        deliveryRadiusKm: Number(row.delivery_radius_km ?? row.deliveryRadiusKm ?? row.delivery_radius) || 8.0,
        baseDeliveryFee: Number(row.base_delivery_fee) || 2.50,
        deliveryTiers: (Array.isArray(row.delivery_tiers) ? row.delivery_tiers : (Array.isArray(row.deliveryTiers) ? row.deliveryTiers : null)) || [
          { id: 'tier_1', minKm: 0, maxKm: 2, price: 1.50 },
          { id: 'tier_2', minKm: 2, maxKm: 5, price: 3.00 },
          { id: 'tier_3', minKm: 5, maxKm: 8, price: 4.50 }
        ],
        estimatedDeliveryMinMinutes: 30,
        estimatedDeliveryMaxMinutes: 45,
        freeDeliveryThreshold: 25.00,
        minOrderAmount: Number(row.min_order_amount) || 8.00,
        currency: 'USD',
        currencySymbol: '$',
      },
      businessHours: {
        open: '12:00',
        close: '23:30',
        isOpenToday: true,
      },
      branding: {
        accentColor: defaultAccent,
        logoUrl: defaultLogo,
        bannerUrl: defaultBanner,
      },
      currencySettings: {
        baseCurrency: row.base_currency || row.baseCurrency || row.currency_settings?.baseCurrency || row.currencySettings?.baseCurrency || 'USD',
        displayMode: row.display_mode || row.displayMode || row.currency_settings?.displayMode || row.currencySettings?.displayMode || 'usd_and_bs',
        exchangeRate: Number(row.exchange_rate ?? row.exchangeRate ?? row.currency_settings?.exchangeRate ?? row.currencySettings?.exchangeRate) || 45.50,
        lastRateUpdate: row.last_rate_update || row.lastRateUpdate || row.currency_settings?.lastRateUpdate || new Date().toISOString(),
      },
      commissionPercentage: Number(row.commission_percentage ?? row.commissionPercentage) || 5.0,
      branches: Array.isArray(row.branches) ? row.branches.map((b: any) => this.mapBranch(b)) : [],
    };
  }

  private mapProduct(row: any): Product {
    if (row.modifierGroups) {
      return row as Product;
    }

    const modifierGroups = (row.modifier_groups || []).map((g: any) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      minSelections: g.min_selections ?? 0,
      maxSelections: g.max_selections ?? 1,
      options: (g.modifier_options || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        priceDelta: Number(o.price_delta) || 0,
        isDefault: false,
      })),
    }));

    return {
      id: row.id,
      tenantId: row.tenant_id,
      categoryId: row.category_id,
      name: row.name,
      description: row.description || '',
      price: Number(row.price),
      currency: row.currency || 'USD',
      imageUrl: row.image_url || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
      isAvailable: row.is_available ?? true,
      isPopular: Boolean(row.is_popular ?? row.isPopular ?? false),
      isFeatured: Boolean(row.is_featured ?? row.isFeatured ?? false),
      isOnSale: Boolean(row.is_on_sale ?? row.isOnSale ?? false),
      compareAtPrice: (row.compare_at_price || row.compareAtPrice) ? Number(row.compare_at_price || row.compareAtPrice) : undefined,
      discountPercentage: Number(row.discount_percentage ?? row.discountPercentage) || 0,
      sku: row.sku || '',
      barcode: row.barcode || '',
      branchId: row.branch_id || (row as any).branchId || undefined,
      modifierGroups,
    };
  }

  private mapBanner(row: any): Banner {
    return {
      id: row.id,
      title: row.title || '',
      subtitle: row.subtitle || '',
      couponCode: row.coupon_code || row.couponCode || '',
      badgeText: row.badge_text || row.badgeText || 'PROMOCIÓN',
      buttonText: row.button_text || row.buttonText || 'Pedir ahora',
      linkUrl: row.link_url || row.linkUrl || '/explorar',
      imageUrl: row.image_url || row.imageUrl || '',
      bgGradientStart: row.bg_gradient_start || row.bgGradientStart || '#f97316',
      bgGradientEnd: row.bg_gradient_end || row.bgGradientEnd || '#ea580c',
      sortOrder: Number(row.sort_order ?? row.sortOrder) || 0,
      isActive: row.is_active ?? row.isActive ?? true,
      createdAt: row.created_at || row.createdAt,
      updatedAt: row.updated_at || row.updatedAt,
    };
  }

  private mapOrder(row: any): Order {
    if (row.customer && row.items) {
      return {
        ...row,
        branchId: row.branchId || row.branch_id || undefined,
        branchName: row.branchName || row.branches?.name || undefined,
      } as Order;
    }

    const items = (row.order_items || []).map((i: any) => ({
      cartItemId: i.id || `item-${Date.now()}`,
      productId: i.product_id || '',
      name: i.product_name,
      unitPrice: Number(i.unit_price),
      quantity: i.quantity,
      selectedModifiers: Array.isArray(i.selected_modifiers)
        ? i.selected_modifiers.map((m: any) => ({
            groupId: m.groupId || m.group_id || '',
            groupTitle: m.groupTitle || m.group_title || '',
            optionId: m.optionId || m.option_id || '',
            optionName: m.optionName || m.option_name || m.name || '',
            priceDelta: Number(m.priceDelta ?? m.price_delta ?? 0),
          }))
        : [],
      itemTotal: Number(i.item_total),
    }));

    const riderObj = Array.isArray(row.riders) ? row.riders[0] : row.riders;
    const vehicleText = riderObj?.vehicle_model
      ? `${riderObj.vehicle_type === 'moto' ? 'Moto' : riderObj.vehicle_type} • ${riderObj.vehicle_model}`
      : (riderObj?.vehicle_type ? (riderObj.vehicle_type === 'moto' ? 'Moto' : riderObj.vehicle_type) : undefined);

    let riderAccepted = false;
    let riderRejected = false;
    let rejectedRiderName: string | undefined = undefined;
    const rawNotes = (row.notes || '').toString();
    let cleanNotes = rawNotes;

    if (rawNotes.includes('[RIDER_ACCEPTED]')) {
      riderAccepted = true;
      cleanNotes = cleanNotes.replace('[RIDER_ACCEPTED]', '').trim();
    } else if (rawNotes.includes('[RIDER_AT_MERCHANT]')) {
      riderAccepted = true;
      cleanNotes = cleanNotes.replace('[RIDER_AT_MERCHANT]', '').trim();
    } else if (rawNotes.includes('[RIDER_PICKED_UP]')) {
      riderAccepted = true;
      cleanNotes = cleanNotes.replace('[RIDER_PICKED_UP]', '').trim();
    } else if (rawNotes.includes('[RIDER_REJECTED')) {
      riderRejected = true;
      const match = rawNotes.match(/\[RIDER_REJECTED(?::([^\]]+))?\]/);
      if (match && match[1]) {
        rejectedRiderName = match[1];
      }
      cleanNotes = cleanNotes.replace(/\[RIDER_REJECTED(?::[^\]]+)?\]/, '').trim();
    }

    let mappedStatus = (row.status as any) || 'received';
    if (row.status === 'in_kitchen') {
      if (row.driver_id) {
        if (rawNotes.includes('[RIDER_PICKED_UP]')) {
          mappedStatus = 'picked_up';
        } else if (rawNotes.includes('[RIDER_AT_MERCHANT]')) {
          mappedStatus = 'at_merchant';
        } else {
          mappedStatus = 'assigned_driver';
        }
      }
    }

    return {
      id: row.id,
      orderNumber: row.order_number,
      tenantId: row.tenant_id,
      tenantName: row.tenants?.name || 'Comercio',
      tenantSlug: row.tenants?.slug || row.tenant_slug,
      branchId: row.branch_id || row.branchId || undefined,
      branchName: row.branches?.name || row.branchName || undefined,
      source: row.source || 'whatsapp_link',
      status: mappedStatus,
      fulfillmentType: row.fulfillment_type || 'delivery',
      paymentMethod: row.payment_method || 'mobile_transfer',
      customer: {
        name: row.customer_name,
        phone: row.customer_phone,
        email: row.customer_email || row.customer?.email,
        deliveryAddress: row.delivery_address,
        deliveryLat: row.delivery_lat ? Number(row.delivery_lat) : undefined,
        deliveryLng: row.delivery_lng ? Number(row.delivery_lng) : undefined,
        notes: cleanNotes.length > 0 ? cleanNotes : undefined,
      },
      tenantAddress: row.branches?.address || row.tenants?.address || 'Avenida Lara, Barquisimeto',
      tenantPhone: row.branches?.phone || row.tenants?.phone || '',
      tenantLat: row.branches?.latitude ? Number(row.branches.latitude) : (row.tenants?.latitude ? Number(row.tenants.latitude) : 10.077715),
      tenantLng: row.branches?.longitude ? Number(row.branches.longitude) : (row.tenants?.longitude ? Number(row.tenants.longitude) : -69.2812938),
      deliveryLat: row.delivery_lat ? Number(row.delivery_lat) : undefined,
      deliveryLng: row.delivery_lng ? Number(row.delivery_lng) : undefined,
      driverId: row.driver_id || undefined,
      driverName: row.driver_id ? (riderObj?.name || row.driver_name) : undefined,
      driverPhone: row.driver_id ? (riderObj?.phone || row.driver_phone || '') : undefined,
      driverPlate: row.driver_id ? (riderObj?.vehicle_plate || '') : undefined,
      driverVehicle: row.driver_id ? vehicleText : undefined,
      driverAvatar: row.driver_id ? (riderObj?.avatar_url || '') : undefined,
      driverLat: riderObj?.current_lat !== undefined && riderObj?.current_lat !== null ? Number(riderObj.current_lat) : undefined,
      driverLng: riderObj?.current_lng !== undefined && riderObj?.current_lng !== null ? Number(riderObj.current_lng) : undefined,
      riderAccepted,
      riderRejected,
      rejectedRiderName,
      items,
      subtotal: Number(row.subtotal),
      deliveryFee: Number(row.delivery_fee) || 0,
      discount: Number(row.discount) || 0,
      total: Number(row.total),
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  // --- MULTI-SUCURSAL & SUSCRIPCIONES (100% REAL SUPABASE / BACKEND) ---
  getSubscriptionPlans(): Observable<SubscriptionPlan[]> {
    return this.http.get<any[]>(`${this.baseUrl}/subscription-plans`).pipe(
      map(rows => (rows || []).map(r => this.mapSubscriptionPlan(r))),
      catchError(() => {
        const client = this.supabase.rawClient;
        if (client) {
          return from(client.from('subscription_plans').select('*').order('monthly_fee_usd')).pipe(
            map(({ data }) => (data || []).map(r => this.mapSubscriptionPlan(r)))
          );
        }
        return of([]);
      })
    );
  }

  getBranches(companyId?: string): Observable<Branch[]> {
    const url = companyId ? `${this.baseUrl}/tenants/${companyId}/branches` : `${this.baseUrl}/branches`;
    return this.http.get<any[]>(url).pipe(
      map(rows => (rows || []).map(r => this.mapBranch(r))),
      catchError(() => {
        const client = this.supabase.rawClient;
        if (client) {
          let query = client
            .from('branches')
            .select('*, branch_payment_credentials(*), tenants(id, name, slug)')
            .order('created_at', { ascending: true });

          if (companyId) {
            query = query.eq('company_id', companyId);
          }

          return from(query).pipe(
            map(({ data, error }) => {
              if (error || !data) {
                console.warn('[ApiService] Error cargando sedes de Supabase:', error);
                return [];
              }
              return data.map(r => this.mapBranch(r));
            })
          );
        }
        return of([]);
      })
    );
  }

  getPendingBranches(): Observable<Branch[]> {
    return this.http.get<any[]>(`${this.baseUrl}/branches/pending`).pipe(
      map(rows => (rows || []).map(r => this.mapBranch(r))),
      catchError(() => {
        const client = this.supabase.rawClient;
        if (client) {
          return from(
            client
              .from('branches')
              .select('*, branch_payment_credentials(*), tenants(id, name, slug)')
              .eq('status', 'pending_approval')
              .order('created_at', { ascending: false })
          ).pipe(
            map(({ data, error }) => {
              if (error || !data) return [];
              return data.map(r => this.mapBranch(r));
            })
          );
        }
        return of([]);
      })
    );
  }

  createBranch(branchData: Partial<Branch> & { creatorRole?: string; creatorBranchId?: string; managerEmail?: string; managerPassword?: string; managerName?: string }): Observable<{ success: boolean; branch?: Branch; message?: string }> {
    return this.http.post<any>(`${this.baseUrl}/tenants/${branchData.companyId}/branches`, branchData).pipe(
      map(res => ({ success: true, branch: this.mapBranch(res) })),
      catchError(async (httpErr) => {
        if (httpErr?.error?.message) {
          return { success: false, message: httpErr.error.message };
        }
        const client = this.supabase.rawClient;
        if (client && branchData.companyId) {
          const name = branchData.name?.trim() || 'Nueva Sede';
          const slug = branchData.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          const managerEmail = branchData.managerEmail?.trim().toLowerCase();

          const { data: newB, error: bErr } = await client
            .from('branches')
            .insert({
              company_id: branchData.companyId,
              name: name,
              slug: slug,
              phone: branchData.phone || '+584120000000',
              whatsapp_number: branchData.whatsapp || '584120000000',
              address: branchData.address || '',
              latitude: Number(branchData.latitude) || 10.026743,
              longitude: Number(branchData.longitude) || -69.257153,
              delivery_radius_km: Number(branchData.deliveryRadiusKm) || 8.0,
              base_delivery_fee: Number(branchData.baseDeliveryFee) || 2.50,
              status: 'pending_approval',
              email: managerEmail || null,
              manager_name: branchData.managerName || null,
              is_main: false
            })
            .select()
            .single();

          if (!bErr && newB) {
            const pay = branchData.paymentCredentials;
            if (pay) {
              await client.from('branch_payment_credentials').insert({
                branch_id: newB.id,
                pago_movil: {
                  enabled: true,
                  bank_name: pay.pagoMovilBank || '0102 - Banco de Venezuela',
                  phone: pay.pagoMovilPhone || '04121234567',
                  id_number: pay.pagoMovilIdNumber || 'J-12345678-0',
                  account_name: pay.pagoMovilAccountName || newB.name
                },
                zelle: {
                  enabled: Boolean(pay.zelleEmail),
                  email: pay.zelleEmail || '',
                  account_name: pay.zelleAccountName || ''
                },
                cash_usd: { enabled: true }
              });
            }

            if (managerEmail) {
              try {
                await client.from('store_collaborators').insert({
                  tenant_id: branchData.companyId,
                  branch_id: newB.id,
                  name: branchData.managerName || `Encargado ${name}`,
                  email: managerEmail,
                  phone: branchData.phone || '',
                  role: 'MERCHANT_MANAGER',
                  password_hash: branchData.managerPassword || '123456',
                  is_active: true
                });
              } catch (_) {}
            }

            return { success: true, branch: this.mapBranch(newB) };
          }
        }
        return { success: false, message: httpErr?.message || 'No se pudo guardar la sucursal' };
      })
    );
  }

  approveBranch(branchId: string): Observable<boolean> {
    return this.http.patch<any>(`${this.baseUrl}/branches/${branchId}/approve`, {}).pipe(
      map(() => true),
      catchError(async () => {
        const client = this.supabase.rawClient;
        if (client) {
          const { error } = await client
            .from('branches')
            .update({
              status: 'active',
              approved_at: new Date().toISOString(),
              rejection_reason: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', branchId);
          return !error;
        }
        return false;
      })
    );
  }

  rejectBranch(branchId: string, reason?: string): Observable<boolean> {
    return this.http.patch<any>(`${this.baseUrl}/branches/${branchId}/reject`, { reason }).pipe(
      map(() => true),
      catchError(async () => {
        const client = this.supabase.rawClient;
        if (client) {
          const { error } = await client
            .from('branches')
            .update({
              status: 'rejected',
              rejection_reason: reason || 'Información no válida',
              updated_at: new Date().toISOString()
            })
            .eq('id', branchId);
          return !error;
        }
        return false;
      })
    );
  }

  updateBranch(branchId: string, branchData: Partial<Branch> | any): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/branches/${branchId}`, branchData).pipe(
      map(row => (row ? this.mapBranch(row) : null)),
      catchError(async () => {
        const client = this.supabase.rawClient;
        if (client) {
          const updateData: any = { updated_at: new Date().toISOString() };
          if (branchData.name) updateData.name = branchData.name;
          if (branchData.address) updateData.address = branchData.address;
          if (branchData.latitude !== undefined) updateData.latitude = branchData.latitude;
          if (branchData.longitude !== undefined) updateData.longitude = branchData.longitude;
          if (branchData.deliveryRadiusKm !== undefined) updateData.delivery_radius_km = branchData.deliveryRadiusKm;
          if (branchData.baseDeliveryFee !== undefined) updateData.base_delivery_fee = branchData.baseDeliveryFee;
          if (branchData.phone) updateData.phone = branchData.phone;
          if (branchData.whatsapp) updateData.whatsapp_number = branchData.whatsapp;
          if (branchData.managerEmail) updateData.email = branchData.managerEmail.trim().toLowerCase();
          if (branchData.managerName) updateData.manager_name = branchData.managerName.trim();
          if (branchData.deliveryTiers || branchData.delivery_tiers) {
            updateData.delivery_tiers = branchData.deliveryTiers || branchData.delivery_tiers;
          }
          if (branchData.tagline !== undefined) updateData.tagline = branchData.tagline;
          if (branchData.accentColor || branchData.accent_color) {
            updateData.accent_color = branchData.accentColor || branchData.accent_color;
          }
          if (branchData.logoUrl || branchData.logo_url) {
            updateData.logo_url = branchData.logoUrl || branchData.logo_url;
          }
          if (branchData.bannerUrl || branchData.banner_url) {
            updateData.banner_url = branchData.bannerUrl || branchData.banner_url;
          }
          if (branchData.exchangeRate !== undefined || branchData.exchange_rate !== undefined) {
            updateData.exchange_rate = Number(branchData.exchangeRate ?? branchData.exchange_rate);
          }
          if (branchData.baseCurrency || branchData.base_currency) {
            updateData.base_currency = branchData.baseCurrency || branchData.base_currency;
          }
          if (branchData.displayMode || branchData.display_mode) {
            updateData.display_mode = branchData.displayMode || branchData.display_mode;
          }
          if (branchData.currencySettings || branchData.currency_settings) {
            updateData.currency_settings = branchData.currencySettings || branchData.currency_settings;
          }

          const { data, error } = await client.from('branches').update(updateData).eq('id', branchId).select().single();
          if (!error && data) {
            if (branchData.managerEmail || branchData.managerPassword) {
              try {
                const collabUpdate: any = {};
                if (branchData.managerName) collabUpdate.name = branchData.managerName.trim();
                if (branchData.phone) collabUpdate.phone = branchData.phone;
                if (branchData.managerPassword) collabUpdate.password_hash = branchData.managerPassword;
                await client.from('store_collaborators').update(collabUpdate).eq('branch_id', branchId);
              } catch (_) {}
            }
            return this.mapBranch(data);
          }
        }
        return null;
      })
    );
  }

  deleteBranch(branchId: string, role?: string, userBranchId?: string): Observable<{ success: boolean; message?: string }> {
    let params = new HttpParams();
    if (role) params = params.set('role', role);
    if (userBranchId) params = params.set('branchId', userBranchId);

    return this.http.delete<any>(`${this.baseUrl}/branches/${branchId}`, { params }).pipe(
      map(res => ({ success: true, message: res?.message || 'Sucursal eliminada correctamente' })),
      catchError(async (httpErr) => {
        if (httpErr?.error?.message) {
          return { success: false, message: httpErr.error.message };
        }
        const client = this.supabase.rawClient;
        if (client) {
          const { data: b } = await client.from('branches').select('is_main, name').eq('id', branchId).maybeSingle();
          if (b && (b.is_main || b.name?.toLowerCase().includes('principal'))) {
            return { success: false, message: 'No es posible eliminar la Sede Principal (Matriz) del comercio.' };
          }
          await client.from('store_collaborators').delete().eq('branch_id', branchId);
          await client.from('branch_payment_credentials').delete().eq('branch_id', branchId);
          await client.from('branch_inventory').delete().eq('branch_id', branchId);
          await client.from('orders').update({ branch_id: null }).eq('branch_id', branchId);
          const { error } = await client.from('branches').delete().eq('id', branchId);
          if (!error) {
            return { success: true, message: 'Sucursal eliminada correctamente' };
          }
          return { success: false, message: error.message };
        }
        return { success: false, message: httpErr?.message || 'Error eliminando la sucursal' };
      })
    );
  }

  toggleBranchStatus(branchId: string, isOpen?: boolean, role?: string, userBranchId?: string): Observable<boolean> {
    let params = new HttpParams();
    if (role) params = params.set('role', role);
    if (userBranchId) params = params.set('branchId', userBranchId);

    return this.http.patch<any>(`${this.baseUrl}/branches/${branchId}/toggle`, { isOpen }, { params }).pipe(
      map(res => res?.success ?? true),
      catchError(async () => {
        // Fallback directo a Supabase
        const client = this.supabase.rawClient;
        if (client) {
          const { data: b } = await client.from('branches').select('business_hours, status').eq('id', branchId).single();
          const currentBh = b?.business_hours || {};
          const nextOpen = isOpen !== undefined ? isOpen : !(currentBh.isOpenToday ?? (b?.status === 'active'));
          const nextStatus = nextOpen ? 'active' : 'inactive';

          const { error } = await client
            .from('branches')
            .update({
              status: b?.status === 'pending_approval' ? 'pending_approval' : nextStatus,
              business_hours: {
                ...currentBh,
                isOpenToday: nextOpen
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', branchId);
          return !error;
        }
        return false;
      })
    );
  }

  private mapPaymentCredentials(raw: any) {
    const cred = Array.isArray(raw) ? raw[0] : raw;
    if (!cred) {
      return {
        pagoMovilBank: '',
        pagoMovilPhone: '',
        pagoMovilIdNumber: '',
        pagoMovilAccountName: '',
        zelleEmail: '',
        zelleAccountName: '',
        isActive: false
      };
    }

    const pm = cred.pago_movil || {};
    const z = cred.zelle || {};

    const bank = pm.bank_name || cred.pago_movil_bank || cred.pagoMovilBank || '0102 - Banco de Venezuela';
    const bankCode = pm.bank_code ? `${pm.bank_code} - ` : '';

    return {
      pagoMovilBank: bank.includes(bankCode) ? bank : `${bankCode}${bank}`,
      pagoMovilPhone: pm.phone || cred.pago_movil_phone || cred.pagoMovilPhone || '0412-1234567',
      pagoMovilIdNumber: pm.id_number || cred.pago_movil_id_number || cred.pagoMovilIdNumber || 'J-50123456-1',
      pagoMovilAccountName: pm.account_name || cred.pago_movil_account_name || cred.pagoMovilAccountName || '',
      zelleEmail: z.email || cred.zelle_email || cred.zelleEmail || '',
      zelleAccountName: z.account_name || cred.zelle_account_name || cred.zelleAccountName || '',
      isActive: pm.enabled ?? cred.is_active ?? true
    };
  }

  private mapBranch(r: any): Branch {
    const accentColor = r.accent_color || r.accentColor || r.branding?.accentColor || r.tenants?.accent_color || '#f97316';
    const logoUrl = r.logo_url || r.logoUrl || r.branding?.logoUrl || r.tenants?.logo_url || '';
    const bannerUrl = r.banner_url || r.bannerUrl || r.branding?.bannerUrl || r.tenants?.banner_url || '';
    const tagline = r.tagline || r.tenants?.tagline || '';
    const exchangeRate = Number(r.exchange_rate ?? r.exchangeRate ?? r.currency_settings?.exchangeRate ?? r.currencySettings?.exchangeRate ?? r.tenants?.exchange_rate ?? 45.50);
    const baseCurrency = (r.base_currency || r.baseCurrency || r.currency_settings?.baseCurrency || r.currencySettings?.baseCurrency || r.tenants?.base_currency || 'USD') as 'USD' | 'VES';
    const displayMode = (r.display_mode || r.displayMode || r.currency_settings?.displayMode || r.currencySettings?.displayMode || r.tenants?.display_mode || 'usd_and_bs') as 'usd_and_bs' | 'bs_and_usd' | 'only_usd' | 'only_bs';

    const currencySettings = r.currency_settings || r.currencySettings || {
      baseCurrency,
      displayMode,
      exchangeRate,
      lastRateUpdate: new Date().toISOString()
    };

    return {
      id: r.id,
      companyId: r.company_id || r.companyId,
      companyName: r.tenants?.name || r.companyName || 'Comercio',
      name: r.name,
      slug: r.slug,
      address: r.address,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      deliveryRadiusKm: Number(r.delivery_radius_km || r.deliveryRadiusKm) || 8.0,
      baseDeliveryFee: Number(r.base_delivery_fee || r.baseDeliveryFee) || 2.50,
      deliveryTiers: (Array.isArray(r.delivery_tiers) ? r.delivery_tiers : (Array.isArray(r.deliveryTiers) ? r.deliveryTiers : null)) || [
        { id: 'tier_1', minKm: 0, maxKm: 2, price: 1.50 },
        { id: 'tier_2', minKm: 2, maxKm: 5, price: 3.00 },
        { id: 'tier_3', minKm: 5, maxKm: 8, price: 4.50 }
      ],
      tagline,
      accentColor,
      logoUrl,
      bannerUrl,
      exchangeRate,
      baseCurrency,
      displayMode,
      currencySettings,
      branding: {
        accentColor,
        logoUrl,
        bannerUrl
      },
      status: r.status,
      rejectionReason: r.rejection_reason || r.rejectionReason,
      phone: r.phone,
      whatsapp: r.whatsapp_number || r.whatsapp,
      openTime: r.business_hours?.open || r.open_time || r.openTime || '11:00',
      closeTime: r.business_hours?.close || r.close_time || r.closeTime || '23:00',
      businessHours: {
        open: r.business_hours?.open || r.open_time || r.openTime || '11:00',
        close: r.business_hours?.close || r.close_time || r.closeTime || '23:00'
      },
      isOpenNow: r.business_hours?.isOpenToday ?? r.is_open_now ?? (r.status === 'active'),
      createdAt: r.created_at || r.createdAt,
      paymentCredentials: this.mapPaymentCredentials(r.branch_payment_credentials || r.paymentCredentials),
      isMain: Boolean(r.is_main || r.isMain || r.name?.toLowerCase().includes('principal')),
      managerEmail: r.manager_email || r.managerEmail || r.email || undefined,
      managerName: r.manager_name || r.managerName || undefined,
    };
  }

  private mapSubscriptionPlan(r: any): SubscriptionPlan {
    return {
      id: r.code || r.id,
      name: r.name,
      maxBranches: r.max_branches ?? r.maxBranches ?? 1,
      monthlyPriceUsd: Number(r.monthly_fee_usd ?? r.monthlyPriceUsd ?? 19.99),
      description: r.description,
      features: r.features || [
        `Hasta ${r.max_branches ?? r.maxBranches ?? 1} Sede(s) física(s)`,
        '0% Comisiones por venta',
        'Pago Móvil y Zelle directo a la sede'
      ]
    };
  }
}

