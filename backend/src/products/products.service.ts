import * as fs from 'fs';
import * as path from 'path';
import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { PlansService } from '../plans/plans.service.js';

@Injectable()
export class ProductsService {
  private metadataFilePath = path.join(process.cwd(), 'data', 'product_metadata.json');

  constructor(
    private supabase: SupabaseService,
    private plansService: PlansService,
  ) {}

  private loadMetadata(): Record<string, any> {
    try {
      if (fs.existsSync(this.metadataFilePath)) {
        const raw = fs.readFileSync(this.metadataFilePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (_) {}
    return {};
  }

  private saveProductMetadata(productId: string, metadata: Record<string, any>) {
    try {
      const data = this.loadMetadata();
      data[productId] = { ...(data[productId] || {}), ...metadata };
      const dir = path.dirname(this.metadataFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.metadataFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[ProductsService] Error saving product metadata:', e);
    }
  }

  private getProductMetadata(productId: string): Record<string, any> {
    try {
      const data = this.loadMetadata();
      return data[productId] || {};
    } catch (_) {
      return {};
    }
  }

  private mergeProductWithMetadata(product: any): any {
    if (!product) return product;
    const meta = this.getProductMetadata(product.id);
    return {
      ...product,
      is_popular: Boolean(product.is_popular ?? meta.is_popular ?? false),
      isPopular: Boolean(product.is_popular ?? meta.is_popular ?? false),
      is_featured: Boolean(product.is_featured ?? meta.is_featured ?? false),
      isFeatured: Boolean(product.is_featured ?? meta.is_featured ?? false),
      is_on_sale: Boolean(product.is_on_sale ?? meta.is_on_sale ?? false),
      isOnSale: Boolean(product.is_on_sale ?? meta.is_on_sale ?? false),
      compare_at_price: (product.compare_at_price ?? meta.compare_at_price) ? Number(product.compare_at_price ?? meta.compare_at_price) : null,
      compareAtPrice: (product.compare_at_price ?? meta.compare_at_price) ? Number(product.compare_at_price ?? meta.compare_at_price) : null,
      discount_percentage: Number(product.discount_percentage ?? meta.discount_percentage) || 0,
      discountPercentage: Number(product.discount_percentage ?? meta.discount_percentage) || 0,
    };
  }

  async findByTenant(tenantId: string, branchId?: string, onlyAvailable = false) {
    let query = this.supabase
      .getClient()
      .from('products')
      .select('*, categories(id, name), modifier_groups(*, modifier_options(*))')
      .eq('tenant_id', tenantId);

    if (branchId && branchId !== 'all') {
      // Check if branch is main branch
      const { data: bData } = await this.supabase
        .getClient()
        .from('branches')
        .select('is_main')
        .eq('id', branchId)
        .maybeSingle();

      const isMain = bData?.is_main === true;
      if (isMain) {
        query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
      } else {
        query = query.eq('branch_id', branchId);
      }
    }

    if (onlyAvailable) {
      query = query.or('is_available.eq.true,is_available.is.null');
    }

    let { data, error } = await query.order('sort_order', { ascending: true });

    if (error) {
      console.warn(`[ProductsService] Error fetching products: ${error.message}`);
    }

    return (data || []).map(p => this.mergeProductWithMetadata(p));
  }

  async getCategories(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(`Error fetching categories: ${error.message}`);
    }
    return data;
  }

  async createCategory(tenantId: string, payload: { name: string; sort_order?: number }) {
    const name = payload.name?.trim();
    if (!name) {
      throw new InternalServerErrorException('El nombre de la categoría es requerido');
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('categories')
      .insert({
        tenant_id: tenantId,
        name,
        sort_order: payload.sort_order ?? 0,
        is_active: true
      })
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Error creando categoría: ${error?.message}`);
    }
    return data;
  }

  async updateCategory(tenantId: string, id: string, payload: { name?: string; sort_order?: number; is_active?: boolean }) {
    const updateData: any = {};
    if (payload.name !== undefined) updateData.name = payload.name.trim();
    if (payload.sort_order !== undefined) updateData.sort_order = payload.sort_order;
    if (payload.is_active !== undefined) updateData.is_active = payload.is_active;

    const { data, error } = await this.supabase
      .getClient()
      .from('categories')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(`Error actualizando categoría: ${error?.message}`);
    }
    return data;
  }

  async deleteCategory(tenantId: string, id: string) {
    const { error } = await this.supabase
      .getClient()
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new InternalServerErrorException(`Error eliminando categoría: ${error.message}`);
    }
    return { success: true, message: 'Categoría eliminada' };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('products')
      .select('*, categories(id, name), modifier_groups(*, modifier_options(*))')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Producto '${id}' no encontrado`);
    }
    return this.mergeProductWithMetadata(data);
  }

  async create(productData: any) {
    const modifierGroups = productData.modifierGroups || productData.modifier_groups;
    const targetTenantId = productData.tenant_id || productData.tenantId;

    if (targetTenantId) {
      // Validar límite de productos según el plan de suscripción del comercio
      await this.plansService.checkLimit(targetTenantId, 'product');
    }

    let targetBranchId = (productData.branch_id || productData.branchId) && productData.branch_id !== 'all' && productData.branchId !== 'all' ? (productData.branch_id || productData.branchId) : null;
    if (!targetBranchId && targetTenantId) {
      try {
        const { data: mainB } = await this.supabase
          .getClient()
          .from('branches')
          .select('id')
          .eq('company_id', targetTenantId)
          .eq('is_main', true)
          .maybeSingle();
        if (mainB?.id) {
          targetBranchId = mainB.id;
        }
      } catch (_) {}
    }

    const productRow: any = {
      tenant_id: targetTenantId,
      branch_id: targetBranchId,
      name: productData.name,
      description: productData.description || null,
      price: Number(productData.price) || 0,
      currency: productData.currency || 'USD',
      category_id: productData.category_id || productData.categoryId || null,
      image_url: productData.image_url || productData.imageUrl || null,
      is_available: productData.is_available ?? productData.isAvailable ?? true,
      sku: productData.sku ? String(productData.sku).trim() : null,
      barcode: productData.barcode ? String(productData.barcode).trim() : null,
      sort_order: Number(productData.sort_order ?? productData.sortOrder) || 0,
      is_popular: Boolean(productData.is_popular ?? productData.isPopular ?? false),
      is_featured: Boolean(productData.is_featured ?? productData.isFeatured ?? false),
      is_on_sale: Boolean(productData.is_on_sale ?? productData.isOnSale ?? false),
      compare_at_price: productData.compare_at_price || productData.compareAtPrice ? Number(productData.compare_at_price || productData.compareAtPrice) : null,
      discount_percentage: Number(productData.discount_percentage ?? productData.discountPercentage) || 0,
      track_stock: Boolean(productData.track_stock ?? productData.trackStock ?? false),
      stock_quantity: (productData.stock_quantity !== undefined && productData.stock_quantity !== null && productData.stock_quantity !== '')
        ? Number(productData.stock_quantity) : null,
      previous_stock: (productData.stock_quantity !== undefined && productData.stock_quantity !== null && productData.stock_quantity !== '')
        ? Number(productData.stock_quantity) : null,
    };

    let createdProduct: any = null;
    let createErr: any = null;

    try {
      const res = await this.supabase
        .getClient()
        .from('products')
        .insert(productRow)
        .select()
        .single();
      createdProduct = res.data;
      createErr = res.error;
    } catch (e: any) {
      createErr = e;
    }

    if (createErr) {
      // Fallback si las nuevas columnas aún no se crearon en Supabase
      const fallbackRow = { ...productRow };
      delete fallbackRow.is_popular;
      delete fallbackRow.is_featured;
      delete fallbackRow.is_on_sale;
      delete fallbackRow.compare_at_price;
      delete fallbackRow.discount_percentage;
      const { data: retryData, error: retryErr } = await this.supabase
        .getClient()
        .from('products')
        .insert(fallbackRow)
        .select()
        .single();
      if (retryErr || !retryData) {
        throw new InternalServerErrorException(`Error creating product: ${retryErr?.message || createErr.message}`);
      }
      createdProduct = retryData;
    }

    // Save modifier groups if provided
    if (Array.isArray(modifierGroups) && modifierGroups.length > 0) {
      await this.saveModifierGroups(createdProduct.id, modifierGroups);
    }

    this.saveProductMetadata(createdProduct.id, {
      is_popular: productRow.is_popular,
      is_featured: productRow.is_featured,
      is_on_sale: productRow.is_on_sale,
      compare_at_price: productRow.compare_at_price,
      discount_percentage: productRow.discount_percentage,
    });
    return this.findById(createdProduct.id);
  }

  async update(id: string, updateData: any) {
    const modifierGroups = updateData.modifierGroups !== undefined 
      ? updateData.modifierGroups 
      : updateData.modifier_groups;

    const productRow: any = {
      updated_at: new Date().toISOString()
    };

    if (updateData.name !== undefined) productRow.name = updateData.name;
    if (updateData.description !== undefined) productRow.description = updateData.description;
    if (updateData.price !== undefined) productRow.price = Number(updateData.price);
    if (updateData.currency !== undefined) productRow.currency = updateData.currency;
    if (updateData.category_id !== undefined || updateData.categoryId !== undefined) {
      productRow.category_id = updateData.category_id ?? updateData.categoryId;
    }
    if (updateData.image_url !== undefined || updateData.imageUrl !== undefined) {
      productRow.image_url = updateData.image_url ?? updateData.imageUrl;
    }
    if (updateData.is_available !== undefined || updateData.isAvailable !== undefined) {
      productRow.is_available = updateData.is_available ?? updateData.isAvailable;
    }
    if (updateData.sku !== undefined) {
      productRow.sku = updateData.sku ? String(updateData.sku).trim() : null;
    }
    if (updateData.barcode !== undefined) {
      productRow.barcode = updateData.barcode ? String(updateData.barcode).trim() : null;
    }
    if (updateData.branch_id !== undefined || updateData.branchId !== undefined) {
      const bId = updateData.branch_id ?? updateData.branchId;
      productRow.branch_id = (bId && bId !== 'all') ? bId : null;
    }
    if (updateData.sort_order !== undefined || updateData.sortOrder !== undefined) {
      productRow.sort_order = Number(updateData.sort_order ?? updateData.sortOrder);
    }
    if (updateData.is_popular !== undefined || updateData.isPopular !== undefined) {
      productRow.is_popular = Boolean(updateData.is_popular ?? updateData.isPopular);
    }
    if (updateData.is_featured !== undefined || updateData.isFeatured !== undefined) {
      productRow.is_featured = Boolean(updateData.is_featured ?? updateData.isFeatured);
    }
    if (updateData.is_on_sale !== undefined || updateData.isOnSale !== undefined) {
      productRow.is_on_sale = Boolean(updateData.is_on_sale ?? updateData.isOnSale);
    }
    if (updateData.compare_at_price !== undefined || updateData.compareAtPrice !== undefined) {
      const val = updateData.compare_at_price ?? updateData.compareAtPrice;
      productRow.compare_at_price = val ? Number(val) : null;
    }
    if (updateData.discount_percentage !== undefined || updateData.discountPercentage !== undefined) {
      productRow.discount_percentage = Number(updateData.discount_percentage ?? updateData.discountPercentage) || 0;
    }

    let previousStockFound: number | null = null;
    let tenantIdForHistory: string | null = null;
    try {
      const { data: currP } = await this.supabase.getClient().from('products').select('stock_quantity, track_stock, tenant_id').eq('id', id).maybeSingle();
      if (currP) {
        previousStockFound = currP.stock_quantity !== null && currP.stock_quantity !== undefined ? Number(currP.stock_quantity) : null;
        tenantIdForHistory = currP.tenant_id || null;
      }
    } catch (_) {}

    if (updateData.track_stock !== undefined || updateData.trackStock !== undefined) {
      productRow.track_stock = Boolean(updateData.track_stock ?? updateData.trackStock);
    }
    if (updateData.stock_quantity !== undefined || updateData.stockQuantity !== undefined) {
      const rawSq = updateData.stock_quantity ?? updateData.stockQuantity;
      const newStock = (rawSq !== null && rawSq !== undefined && rawSq !== '') ? Math.max(0, parseInt(rawSq, 10)) : null;
      productRow.stock_quantity = newStock;
      productRow.previous_stock = previousStockFound;

      // Registrar en historial si el stock cambió numéricamente
      if (newStock !== null && previousStockFound !== null && newStock !== previousStockFound) {
        try {
          await this.supabase.getClient().from('stock_history').insert({
            product_id: id,
            tenant_id: tenantIdForHistory || updateData.tenant_id,
            previous_stock: previousStockFound,
            new_stock: newStock,
            difference: newStock - previousStockFound,
            change_type: 'manual_update',
            notes: `Actualización manual de stock: de ${previousStockFound} a ${newStock} unidades`
          });
        } catch (_) {}
      }
    }

    let updatedProduct: any = null;
    const { data, error } = await this.supabase
      .getClient()
      .from('products')
      .update(productRow)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Fallback sin columnas extendidas si aún no existen en Supabase
      const fallbackRow = { ...productRow };
      delete fallbackRow.is_popular;
      delete fallbackRow.is_featured;
      delete fallbackRow.is_on_sale;
      delete fallbackRow.compare_at_price;
      delete fallbackRow.discount_percentage;
      const { data: retryData, error: retryErr } = await this.supabase
        .getClient()
        .from('products')
        .update(fallbackRow)
        .eq('id', id)
        .select()
        .single();
      if (retryErr) {
        throw new InternalServerErrorException(`Error updating product: ${retryErr.message}`);
      }
      updatedProduct = retryData;
    } else {
      updatedProduct = data;
    }

    // If modifier groups were explicitly provided, replace them
    if (Array.isArray(modifierGroups)) {
      await this.supabase.getClient().from('modifier_groups').delete().eq('product_id', id);
      if (modifierGroups.length > 0) {
        await this.saveModifierGroups(id, modifierGroups);
      }
    }

    this.saveProductMetadata(id, {
      is_popular: productRow.is_popular,
      is_featured: productRow.is_featured,
      is_on_sale: productRow.is_on_sale,
      compare_at_price: productRow.compare_at_price,
      discount_percentage: productRow.discount_percentage,
    });
    return this.findById(id);
  }

  private async saveModifierGroups(productId: string, groups: any[]) {
    const client = this.supabase.getClient();

    for (let gIndex = 0; gIndex < groups.length; gIndex++) {
      const g = groups[gIndex];
      const { data: createdGroup, error: groupErr } = await client
        .from('modifier_groups')
        .insert({
          product_id: productId,
          title: g.title || 'Opciones',
          min_selections: Number(g.minSelections ?? g.min_selections) || 0,
          max_selections: Number(g.maxSelections ?? g.max_selections) || 1,
          sort_order: gIndex
        })
        .select()
        .single();

      if (!groupErr && createdGroup && Array.isArray(g.options) && g.options.length > 0) {
        const optionRows = g.options.map((opt: any, oIndex: number) => ({
          group_id: createdGroup.id,
          name: opt.name || `Opción ${oIndex + 1}`,
          price_delta: Number(opt.priceDelta ?? opt.price_delta) || 0,
          is_available: opt.isAvailable ?? opt.is_available ?? true,
          sort_order: oIndex
        }));

        await client.from('modifier_options').insert(optionRows);
      }
    }
  }

  async bulkImport(tenantId: string, products: any[], branchId?: string) {
    if (!Array.isArray(products) || products.length === 0) {
      return { success: true, count: 0, message: 'No hay productos para importar', errors: [] };
    }

    const client = this.supabase.getClient();
    const errors: string[] = [];
    let totalImported = 0;

    // 1. Preload categories to map by name
    const { data: existingCategories } = await client
      .from('categories')
      .select('id, name')
      .eq('tenant_id', tenantId);

    const categoryMap = new Map<string, string>();
    if (existingCategories) {
      existingCategories.forEach((c: any) => {
        categoryMap.set(c.name.trim().toLowerCase(), c.id);
      });
    }

    // 2. Discover missing categories and create them
    const uniqueCategoryNames = new Set<string>();
    for (const p of products) {
      const catName = (p.categoryName || p.categoria || p.category || '').toString().trim();
      if (catName && !categoryMap.has(catName.toLowerCase())) {
        uniqueCategoryNames.add(catName);
      }
    }

    for (const catName of uniqueCategoryNames) {
      const { data: newCat, error: catErr } = await client
        .from('categories')
        .insert({
          tenant_id: tenantId,
          name: catName,
          is_active: true
        })
        .select('id, name')
        .single();

      if (!catErr && newCat) {
        categoryMap.set(newCat.name.trim().toLowerCase(), newCat.id);
      }
    }

    // 3. Process products in batches of 150 (optimal for Supabase payload & memory)
    const BATCH_SIZE = 150;
    const totalBatches = Math.ceil(products.length / BATCH_SIZE);

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const chunk = products.slice(i, i + BATCH_SIZE);
      const rowsToInsert = chunk.map((p, idx) => {
        const catName = (p.categoryName || p.categoria || p.category || '').toString().trim().toLowerCase();
        const categoryId = p.category_id || p.categoryId || (catName ? categoryMap.get(catName) : null) || null;
        const targetBranch = p.branch_id || p.branchId || branchId || null;

        return {
          tenant_id: tenantId,
          branch_id: (targetBranch && targetBranch !== 'all') ? targetBranch : null,
          name: String(p.name || p.nombre || `Producto ${i + idx + 1}`).trim(),
          description: p.description || p.descripcion || null,
          price: Number(p.price || p.precio) || 0,
          currency: p.currency || p.moneda || 'USD',
          category_id: categoryId,
          image_url: p.imageUrl || p.image_url || p.imagen || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
          is_available: p.isAvailable !== undefined ? Boolean(p.isAvailable) : (p.disponible !== undefined ? Boolean(p.disponible) : true),
          sku: p.sku ? String(p.sku).trim() : null,
          barcode: p.barcode || p.codigoDeBarra || p.codigo_barra ? String(p.barcode || p.codigoDeBarra || p.codigo_barra).trim() : null,
          sort_order: i + idx
        };
      });

      const { data: inserted, error: insertErr } = await client
        .from('products')
        .insert(rowsToInsert)
        .select('id, name');

      if (insertErr) {
        errors.push(`Error en lote ${Math.floor(i / BATCH_SIZE) + 1}: ${insertErr.message}`);
      } else if (inserted) {
        totalImported += inserted.length;

        // If chunk items have modifier groups, insert them
        for (let j = 0; j < chunk.length; j++) {
          const original = chunk[j];
          const modifierGroups = original.modifierGroups || original.modifier_groups;
          if (Array.isArray(modifierGroups) && modifierGroups.length > 0 && inserted[j]) {
            await this.saveModifierGroups(inserted[j].id, modifierGroups);
          }
        }
      }
    }

    return {
      success: errors.length === 0 || totalImported > 0,
      count: totalImported,
      totalExpected: products.length,
      totalBatches,
      errors
    };
  }

  async copyFromMainBranch(tenantId: string, targetBranchId: string) {
    const client = this.supabase.getClient();

    // 1. Obtener todas las sedes del comercio
    const { data: branches, error: bErr } = await client
      .from('branches')
      .select('id, name')
      .eq('company_id', tenantId);

    if (bErr || !branches || branches.length === 0) {
      throw new NotFoundException('No se encontraron sucursales registradas para este comercio.');
    }

    // 2. Identificar la Sede Principal
    const mainBranch = branches.find(b => b.name?.toLowerCase().includes('principal')) || branches[0];
    if (mainBranch.id === targetBranchId && branches.length > 1) {
      throw new InternalServerErrorException('Esta sucursal ya es la Sede Principal.');
    }

    // 3. Obtener los productos de la Sede Principal (incluyendo los que tengan branch_id null o el id de la principal)
    const { data: sourceProducts, error: pErr } = await client
      .from('products')
      .select('*, modifier_groups(*, modifier_options(*))')
      .eq('tenant_id', tenantId)
      .or(`branch_id.eq.${mainBranch.id},branch_id.is.null`)
      .order('sort_order', { ascending: true });

    if (pErr) {
      throw new InternalServerErrorException(`Error consultando productos de la sede principal: ${pErr.message}`);
    }

    if (!sourceProducts || sourceProducts.length === 0) {
      return {
        success: true,
        count: 0,
        message: 'La Sede Principal aún no tiene productos para copiar.',
        sourceBranchName: mainBranch.name
      };
    }

    let copiedCount = 0;

    // 4. Clonar cada producto para la nueva sucursal con stock independiente
    for (const p of sourceProducts) {
      const newProductRow: any = {
        tenant_id: tenantId,
        branch_id: targetBranchId,
        category_id: p.category_id,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency || 'USD',
        image_url: p.image_url,
        is_available: true, // Inicia disponible de forma independiente
        sku: p.sku ? `${p.sku}` : null,
        barcode: p.barcode,
        sort_order: p.sort_order
      };

      const { data: createdProd, error: createErr } = await client
        .from('products')
        .insert(newProductRow)
        .select()
        .single();

      if (!createErr && createdProd) {
        copiedCount++;

        // Clonar grupos de modificadores y extras
        if (Array.isArray(p.modifier_groups) && p.modifier_groups.length > 0) {
          const modGroupsToSave = p.modifier_groups.map((g: any) => ({
            title: g.title,
            description: g.description,
            minSelections: g.min_selections ?? 0,
            maxSelections: g.max_selections ?? 1,
            options: (g.modifier_options || []).map((o: any) => ({
              name: o.name,
              priceDelta: Number(o.price_delta) || 0,
              isAvailable: o.is_available ?? true
            }))
          }));
          await this.saveModifierGroups(createdProd.id, modGroupsToSave);
        }
      }
    }

    return {
      success: true,
      count: copiedCount,
      sourceBranchName: mainBranch.name,
      message: `¡Éxito! Se copiaron ${copiedCount} productos y sus modificadores desde ${mainBranch.name}.`
    };
  }

  async getStockHistory(tenantId?: string, productId?: string) {
    try {
      let query = this.supabase.getClient().from('stock_history').select('*').order('created_at', { ascending: false }).limit(100);
      if (productId) {
        query = query.eq('product_id', productId);
      }
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      const { data, error } = await query;
      if (!error && data) return data;
    } catch (_) {}
    return [];
  }
}
