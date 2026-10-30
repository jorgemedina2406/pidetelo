import { Injectable, NotFoundException, InternalServerErrorException, ForbiddenException, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseService } from '../supabase/supabase.service.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class BranchesService {
  private metadataFilePath = path.join(process.cwd(), 'data', 'branch_metadata.json');

  constructor(
    private supabase: SupabaseService,
    private usersService: UsersService,
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

  private saveBranchMetadata(branchId: string, metadata: Record<string, any>) {
    try {
      const data = this.loadMetadata();
      data[branchId] = { ...(data[branchId] || {}), ...metadata };
      const dir = path.dirname(this.metadataFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.metadataFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[BranchesService] Error saving branch metadata:', e);
    }
  }

  private getBranchMetadata(branchId: string): Record<string, any> {
    try {
      const data = this.loadMetadata();
      return data[branchId] || {};
    } catch (_) {
      return {};
    }
  }

  private mergeBranchWithMetadata(branch: any, parentTenant?: any): any {
    if (!branch) return branch;
    const meta = this.getBranchMetadata(branch.id);
    const tenant = parentTenant || branch.tenants || {};

    const exchangeRate = Number(branch.exchange_rate ?? meta.exchange_rate ?? meta.currency_settings?.exchangeRate ?? tenant.exchange_rate ?? 45.50);
    const baseCurrency = branch.base_currency ?? meta.base_currency ?? meta.currency_settings?.baseCurrency ?? tenant.base_currency ?? 'USD';
    const displayMode = branch.display_mode ?? meta.display_mode ?? meta.currency_settings?.displayMode ?? tenant.display_mode ?? 'usd_and_bs';
    const tagline = branch.tagline ?? meta.tagline ?? tenant.tagline ?? '';
    const accentColor = branch.accent_color ?? meta.accent_color ?? tenant.accent_color ?? '#f97316';
    const logoUrl = branch.logo_url ?? meta.logo_url ?? tenant.logo_url ?? '';
    const bannerUrl = branch.banner_url ?? meta.banner_url ?? tenant.banner_url ?? '';

    const currencySettings = {
      baseCurrency,
      displayMode,
      exchangeRate,
      lastRateUpdate: meta.currency_settings?.lastRateUpdate || new Date().toISOString()
    };

    const defaultDeliveryTiers = [
      { id: 'tier_1', minKm: 0, maxKm: 2, price: 1.50 },
      { id: 'tier_2', minKm: 2, maxKm: 5, price: 3.00 },
      { id: 'tier_3', minKm: 5, maxKm: 8, price: 4.50 }
    ];

    const deliveryTiers = branch.delivery_tiers ?? meta.delivery_tiers ?? meta.deliveryTiers ?? tenant.delivery_tiers ?? defaultDeliveryTiers;

    return {
      ...branch,
      tagline,
      accent_color: accentColor,
      accentColor,
      logo_url: logoUrl,
      logoUrl,
      banner_url: bannerUrl,
      bannerUrl,
      exchange_rate: exchangeRate,
      exchangeRate,
      base_currency: baseCurrency,
      baseCurrency,
      display_mode: displayMode,
      displayMode,
      currency_settings: currencySettings,
      currencySettings,
      delivery_tiers: deliveryTiers,
      deliveryTiers,
      branding: {
        accentColor,
        logoUrl,
        bannerUrl
      }
    };
  }

  async findAll(companyId?: string, onlyActive = false) {
    const client = this.supabase.getClient();
    let query = client
      .from('branches')
      .select('*, branch_payment_credentials(*), tenants(id, name, slug)')
      .order('created_at', { ascending: true });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    if (onlyActive) {
      query = query.eq('status', 'active');
    }

    const { data, error } = await query;
    if (error) {
      throw new InternalServerErrorException(`Error fetching branches: ${error.message}`);
    }
    const branchList = data || [];

    // Enriquecer cada sucursal con las credenciales aisladas y su metadata personalizada
    try {
      const allUsers = await this.usersService.findAll(companyId);
      return branchList.map((branch: any) => {
        const isMain = branch.is_main || branch.name?.toLowerCase().includes('principal') || false;
        const assignedCollab = allUsers.find((u: any) => u.branch_id === branch.id);
        const enriched = {
          ...branch,
          is_main: isMain,
          manager_email: branch.email || assignedCollab?.email || null,
          manager_name: branch.manager_name || assignedCollab?.name || null,
        };
        return this.mergeBranchWithMetadata(enriched, branch.tenants);
      });
    } catch (_) {
      return branchList.map(b => this.mergeBranchWithMetadata(b, b.tenants));
    }
  }

  async findPending() {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('branches')
      .select('*, branch_payment_credentials(*), tenants(id, name, slug)')
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Error fetching pending branches: ${error.message}`);
    }
    return (data || []).map(b => this.mergeBranchWithMetadata(b, b.tenants));
  }

  async findById(id: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('branches')
      .select('*, branch_payment_credentials(*), tenants(id, name, slug)')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Sucursal con id '${id}' no encontrada`);
    }

    try {
      const allUsers = await this.usersService.findAll(data.company_id);
      const assignedCollab = allUsers.find((u: any) => u.branch_id === data.id);
      const isMain = data.is_main || data.name?.toLowerCase().includes('principal') || false;
      const enriched = {
        ...data,
        is_main: isMain,
        manager_email: data.email || assignedCollab?.email || null,
        manager_name: data.manager_name || assignedCollab?.name || null,
      };
      return this.mergeBranchWithMetadata(enriched, data.tenants);
    } catch (_) {
      return this.mergeBranchWithMetadata(data, data.tenants);
    }
  }

  async create(companyId: string, branchPayload: any) {
    const client = this.supabase.getClient();

    // Regla de Negocio: Una sucursal secundaria no puede crear sucursales.
    // Solo la sede principal o el dueño del comercio pueden crear sucursales.
    if (branchPayload.creatorRole && !['SUPER_ADMIN', 'MERCHANT_OWNER'].includes(branchPayload.creatorRole)) {
      throw new ForbiddenException('Una sucursal no tiene permisos para crear sucursales. Esta acción solo puede realizarla la Sede Principal.');
    }
    if (branchPayload.creatorBranchId && branchPayload.creatorBranchId !== 'all') {
      throw new ForbiddenException('Una sucursal no tiene permisos para crear sucursales. Esta acción solo puede realizarla la Sede Principal.');
    }

    const name = branchPayload.name?.trim() || 'Nueva Sucursal';
    const slug = branchPayload.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const managerEmail = (branchPayload.managerEmail || branchPayload.email)?.trim().toLowerCase() || null;
    const managerName = branchPayload.managerName?.trim() || `Encargado ${name}`;

    const { data: newBranch, error: branchErr } = await client
      .from('branches')
      .insert({
        company_id: companyId,
        name: name,
        slug: slug,
        phone: branchPayload.phone || '+584120000000',
        whatsapp_number: branchPayload.whatsapp || branchPayload.whatsapp_number || '584120000000',
        address: branchPayload.address || 'Dirección de la sucursal',
        latitude: Number(branchPayload.latitude) || 10.026743,
        longitude: Number(branchPayload.longitude) || -69.257153,
        delivery_radius_km: Number(branchPayload.deliveryRadiusKm || branchPayload.delivery_radius_km) || 8.0,
        base_delivery_fee: Number(branchPayload.baseDeliveryFee || branchPayload.base_delivery_fee) || 2.50,
        min_order_amount: Number(branchPayload.minOrderAmount || branchPayload.min_order_amount) || 5.00,
        business_hours: {
          open: branchPayload.openTime || '11:00',
          close: branchPayload.closeTime || '23:00',
          isOpenToday: true,
        },
        status: 'pending_approval',
        email: managerEmail,
        manager_name: managerName,
        is_main: false,
      })
      .select()
      .single();

    if (branchErr) {
      throw new InternalServerErrorException(`Error creating branch: ${branchErr.message}`);
    }

    // Insert direct payment credentials
    const credentials = branchPayload.paymentCredentials || branchPayload.payment_credentials || {};
    await client.from('branch_payment_credentials').insert({
      branch_id: newBranch.id,
      pago_movil: {
        enabled: true,
        bank_name: credentials.pagoMovilBank || branchPayload.pagoMovilBank || '0102 - Banco de Venezuela',
        phone: credentials.pagoMovilPhone || branchPayload.pagoMovilPhone || '04121234567',
        id_number: credentials.pagoMovilIdNumber || branchPayload.pagoMovilIdNumber || 'J-12345678-0',
        account_name: credentials.pagoMovilAccountName || branchPayload.pagoMovilAccountName || name,
      },
      zelle: {
        enabled: Boolean(credentials.zelleEmail || branchPayload.zelleEmail),
        email: credentials.zelleEmail || branchPayload.zelleEmail || '',
        account_name: credentials.zelleAccountName || branchPayload.zelleAccountName || '',
      },
      cash_usd: { enabled: true },
    });

    // Crear cuenta de colaborador con credenciales independientes para esta sucursal
    if (managerEmail) {
      try {
        await this.usersService.create(companyId, {
          name: managerName,
          email: managerEmail,
          phone: branchPayload.phone || branchPayload.whatsapp || '',
          role: 'MERCHANT_MANAGER',
          branch_id: newBranch.id,
          branch_name: newBranch.name,
          password: branchPayload.managerPassword || branchPayload.password || '123456',
          avatar_url: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150`,
        });
      } catch (err: any) {
        console.warn('[BranchesService] Advertencia creando credenciales de sucursal:', err.message);
      }
    }

    return this.findById(newBranch.id);
  }

  async approve(id: string, approvedBy?: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('branches')
      .update({
        status: 'active',
        approved_at: new Date().toISOString(),
        approved_by: approvedBy || null,
        rejection_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(`Error approving branch: ${error.message}`);
    }
    return data;
  }

  async reject(id: string, reason?: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('branches')
      .update({
        status: 'rejected',
        rejection_reason: reason || 'Información de ubicación o fiscal no válida.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(`Error rejecting branch: ${error.message}`);
    }
    return data;
  }

  async update(id: string, branchPayload: any) {
    const client = this.supabase.getClient();

    // 1. Guardar metadata local de la sucursal (marca, monedas, tasas, tiers)
    const metaToSave: Record<string, any> = {};
    if (branchPayload.tagline !== undefined) metaToSave.tagline = branchPayload.tagline;
    if (branchPayload.accentColor !== undefined || branchPayload.accent_color !== undefined) {
      metaToSave.accent_color = branchPayload.accentColor || branchPayload.accent_color;
    }
    if (branchPayload.logoUrl !== undefined || branchPayload.logo_url !== undefined) {
      metaToSave.logo_url = branchPayload.logoUrl || branchPayload.logo_url;
    }
    if (branchPayload.bannerUrl !== undefined || branchPayload.banner_url !== undefined) {
      metaToSave.banner_url = branchPayload.bannerUrl || branchPayload.banner_url;
    }
    if (branchPayload.exchangeRate !== undefined || branchPayload.exchange_rate !== undefined) {
      metaToSave.exchange_rate = Number(branchPayload.exchangeRate ?? branchPayload.exchange_rate);
    }
    if (branchPayload.baseCurrency !== undefined || branchPayload.base_currency !== undefined) {
      metaToSave.base_currency = branchPayload.baseCurrency || branchPayload.base_currency;
    }
    if (branchPayload.displayMode !== undefined || branchPayload.display_mode !== undefined) {
      metaToSave.display_mode = branchPayload.displayMode || branchPayload.display_mode;
    }
    if (branchPayload.currencySettings !== undefined || branchPayload.currency_settings !== undefined) {
      metaToSave.currency_settings = branchPayload.currencySettings || branchPayload.currency_settings;
    }
    if (branchPayload.deliveryTiers !== undefined || branchPayload.delivery_tiers !== undefined) {
      metaToSave.delivery_tiers = branchPayload.deliveryTiers || branchPayload.delivery_tiers;
    }

    if (Object.keys(metaToSave).length > 0) {
      this.saveBranchMetadata(id, metaToSave);
    }

    const updateData: any = { updated_at: new Date().toISOString() };

    if (branchPayload.name !== undefined) updateData.name = branchPayload.name.trim();
    if (branchPayload.address !== undefined) updateData.address = branchPayload.address.trim();
    if (branchPayload.phone !== undefined) updateData.phone = branchPayload.phone;
    if (branchPayload.whatsapp !== undefined || branchPayload.whatsapp_number !== undefined) {
      updateData.whatsapp_number = branchPayload.whatsapp || branchPayload.whatsapp_number;
    }
    if (branchPayload.latitude !== undefined) updateData.latitude = Number(branchPayload.latitude);
    if (branchPayload.longitude !== undefined) updateData.longitude = Number(branchPayload.longitude);
    if (branchPayload.deliveryRadiusKm !== undefined || branchPayload.delivery_radius_km !== undefined) {
      updateData.delivery_radius_km = Number(branchPayload.deliveryRadiusKm || branchPayload.delivery_radius_km);
    }
    if (branchPayload.baseDeliveryFee !== undefined || branchPayload.base_delivery_fee !== undefined) {
      updateData.base_delivery_fee = Number(branchPayload.baseDeliveryFee || branchPayload.base_delivery_fee);
    }
    if (branchPayload.minOrderAmount !== undefined || branchPayload.min_order_amount !== undefined) {
      updateData.min_order_amount = Number(branchPayload.minOrderAmount || branchPayload.min_order_amount);
    }
    if (branchPayload.deliveryTiers !== undefined || branchPayload.delivery_tiers !== undefined) {
      updateData.delivery_tiers = branchPayload.deliveryTiers || branchPayload.delivery_tiers;
    }
    if (metaToSave.accent_color !== undefined) updateData.accent_color = metaToSave.accent_color;
    if (metaToSave.logo_url !== undefined) updateData.logo_url = metaToSave.logo_url;
    if (metaToSave.banner_url !== undefined) updateData.banner_url = metaToSave.banner_url;
    if (metaToSave.tagline !== undefined) updateData.tagline = metaToSave.tagline;
    if (metaToSave.exchange_rate !== undefined) updateData.exchange_rate = metaToSave.exchange_rate;
    if (metaToSave.base_currency !== undefined) updateData.base_currency = metaToSave.base_currency;
    if (metaToSave.display_mode !== undefined) updateData.display_mode = metaToSave.display_mode;
    if (metaToSave.currency_settings !== undefined) updateData.currency_settings = metaToSave.currency_settings;

    if (branchPayload.openTime || branchPayload.closeTime) {
      updateData.business_hours = {
        open: branchPayload.openTime || '11:00',
        close: branchPayload.closeTime || '23:00',
        isOpenToday: true,
      };
    }

    const managerEmail = (branchPayload.managerEmail || branchPayload.email)?.trim().toLowerCase();
    if (managerEmail !== undefined) updateData.email = managerEmail;
    if (branchPayload.managerName !== undefined) updateData.manager_name = branchPayload.managerName.trim();

    let updatedBranch: any = null;
    const { data: updateRes, error } = await client
      .from('branches')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.warn(`[BranchesService] Fallback de actualización en branches (posibles columnas pendientes): ${error.message}`);
      const basicData: any = { updated_at: new Date().toISOString() };
      const basicCols = ['name', 'address', 'phone', 'whatsapp_number', 'latitude', 'longitude', 'delivery_radius_km', 'base_delivery_fee', 'min_order_amount', 'business_hours', 'email', 'manager_name'];
      for (const col of basicCols) {
        if (updateData[col] !== undefined) basicData[col] = updateData[col];
      }
      const { data: fallbackData, error: fbError } = await client
        .from('branches')
        .update(basicData)
        .eq('id', id)
        .select()
        .single();
      if (fbError) {
        throw new InternalServerErrorException(`Error updating branch: ${fbError.message}`);
      }
      updatedBranch = fallbackData;
    } else {
      updatedBranch = updateRes;
    }

    // Si viene actualización de credenciales de usuario para esta sede
    if (managerEmail || branchPayload.managerPassword) {
      try {
        const allUsers = await this.usersService.findAll(updatedBranch.company_id);
        const existingCollab = allUsers.find((u: any) => u.branch_id === id || u.email === managerEmail);
        if (existingCollab) {
          const collabUpdate: any = {};
          if (branchPayload.managerName) collabUpdate.name = branchPayload.managerName.trim();
          if (branchPayload.phone) collabUpdate.phone = branchPayload.phone;
          if (branchPayload.managerPassword) collabUpdate.password = branchPayload.managerPassword;
          await this.usersService.update(existingCollab.id, collabUpdate);
        } else if (managerEmail) {
          await this.usersService.create(updatedBranch.company_id, {
            name: branchPayload.managerName || `Encargado ${updatedBranch.name}`,
            email: managerEmail,
            phone: branchPayload.phone || '',
            role: 'MERCHANT_MANAGER',
            branch_id: id,
            branch_name: updatedBranch.name,
            password: branchPayload.managerPassword || '123456',
          });
        }
      } catch (err: any) {
        console.warn('[BranchesService] Error actualizando usuario de sede:', err.message);
      }
    }

    // Actualizar credenciales de pago si vienen incluidas
    const credentials = branchPayload.paymentCredentials || branchPayload.payment_credentials;
    if (credentials) {
      const pm = (credentials.pagoMovilBank || branchPayload.pagoMovilBank) ? {
        enabled: true,
        bank_name: credentials.pagoMovilBank || branchPayload.pagoMovilBank,
        phone: credentials.pagoMovilPhone || branchPayload.pagoMovilPhone,
        id_number: credentials.pagoMovilIdNumber || branchPayload.pagoMovilIdNumber,
        account_name: credentials.pagoMovilAccountName || branchPayload.pagoMovilAccountName,
      } : undefined;

      const zelle = (credentials.zelleEmail || branchPayload.zelleEmail) ? {
        enabled: true,
        email: credentials.zelleEmail || branchPayload.zelleEmail,
        account_name: credentials.zelleAccountName || branchPayload.zelleAccountName || '',
      } : undefined;

      const credUpdate: any = { updated_at: new Date().toISOString() };
      if (pm) credUpdate.pago_movil = pm;
      if (zelle) credUpdate.zelle = zelle;

      await client
        .from('branch_payment_credentials')
        .upsert({ branch_id: id, ...credUpdate });
    }

    // Si la sucursal editada es la Sede Principal, sincronizar con la tabla tenants
    if (updatedBranch.name && updatedBranch.name.includes('(Sede Principal)')) {
      const tenantUpdate: any = { updated_at: new Date().toISOString() };
      if (updateData.address !== undefined) tenantUpdate.address = updateData.address;
      if (updateData.latitude !== undefined) tenantUpdate.latitude = updateData.latitude;
      if (updateData.longitude !== undefined) tenantUpdate.longitude = updateData.longitude;
      if (updateData.delivery_radius_km !== undefined) tenantUpdate.delivery_radius_km = updateData.delivery_radius_km;
      if (updateData.base_delivery_fee !== undefined) tenantUpdate.base_delivery_fee = updateData.base_delivery_fee;
      if (updateData.phone !== undefined) tenantUpdate.phone = updateData.phone;
      if (updateData.whatsapp_number !== undefined) tenantUpdate.whatsapp_number = updateData.whatsapp_number;

      await client.from('tenants').update(tenantUpdate).eq('id', updatedBranch.company_id);
    }

    return this.findById(id);
  }

  async delete(id: string, userRole?: string, userBranchId?: string) {
    const client = this.supabase.getClient();

    // 1. Regla de Negocio: Permisos (Solo Dueño o SuperAdmin)
    if (userRole && !['SUPER_ADMIN', 'MERCHANT_OWNER'].includes(userRole)) {
      throw new ForbiddenException('Una sucursal no tiene permisos para eliminar sucursales. Esta acción solo puede realizarla la Sede Principal.');
    }
    if (userBranchId && userBranchId !== 'all' && userRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Una sucursal no tiene permisos para eliminar sucursales. Esta acción solo puede realizarla la Sede Principal.');
    }

    // 2. Obtener sucursal actual
    const { data: branch, error: findErr } = await client
      .from('branches')
      .select('*')
      .eq('id', id)
      .single();

    if (findErr || !branch) {
      throw new NotFoundException(`Sucursal con id '${id}' no encontrada`);
    }

    // 3. Proteger la Sede Principal (No se puede eliminar la Sede Principal del comercio)
    if (branch.is_main || branch.name?.toLowerCase().includes('principal') || branch.slug?.toLowerCase().includes('principal')) {
      throw new BadRequestException('No es posible eliminar la Sede Principal (Matriz) del comercio.');
    }

    // 4. Eliminar usuarios/colaboradores asignados a esta sucursal (y sus credenciales de acceso)
    try {
      const allUsers = await this.usersService.findAll(branch.company_id);
      const branchUsers = allUsers.filter((u: any) => u.branch_id === id);
      for (const u of branchUsers) {
        await this.usersService.delete(u.id);
      }
      // Asegurar borrado en base de datos central store_collaborators
      await client.from('store_collaborators').delete().eq('branch_id', id);
    } catch (e: any) {
      console.warn('[BranchesService] Advertencia eliminando usuarios de la sucursal:', e.message);
    }

    // 5. Eliminar credenciales de pago asociadas a esta sucursal
    try {
      await client.from('branch_payment_credentials').delete().eq('branch_id', id);
    } catch (_) {}

    // 6. Eliminar inventario y productos exclusivos asociados a esta sucursal
    try {
      await client.from('branch_inventory').delete().eq('branch_id', id);
    } catch (_) {}
    try {
      await client.from('products').delete().eq('branch_id', id);
    } catch (_) {}

    // 7. Desvincular órdenes históricas de esta sucursal (para conservar reportes de ventas)
    try {
      await client.from('orders').update({ branch_id: null }).eq('branch_id', id);
    } catch (_) {}

    // 8. Desvincular repartidores/motorizados asignados a esta sede
    try {
      await client.from('riders').update({ branch_id: null }).eq('branch_id', id);
    } catch (_) {}
    try {
      const ridersPath = path.resolve(process.cwd(), 'data', 'riders_storage.json');
      if (fs.existsSync(ridersPath)) {
        const ridersList = JSON.parse(fs.readFileSync(ridersPath, 'utf-8'));
        if (Array.isArray(ridersList)) {
          let modified = false;
          for (const rider of ridersList) {
            if (rider.branch_id === id) {
              rider.branch_id = null;
              modified = true;
            }
          }
          if (modified) {
            fs.writeFileSync(ridersPath, JSON.stringify(ridersList, null, 2), 'utf-8');
          }
        }
      }
    } catch (_) {}

    // 9. Eliminar la sucursal física
    const { error: delErr } = await client
      .from('branches')
      .delete()
      .eq('id', id);

    if (delErr) {
      throw new InternalServerErrorException(`Error eliminando la sucursal: ${delErr.message}`);
    }

    return {
      success: true,
      message: `Sucursal "${branch.name}" y todos sus datos asociados fueron eliminados correctamente.`
    };
  }

  async toggleStatus(id: string, isOpen?: boolean, status?: string, userRole?: string, userBranchId?: string) {
    const client = this.supabase.getClient();

    // 1. Obtener la sucursal actual
    const { data: branch, error: findErr } = await client
      .from('branches')
      .select('*')
      .eq('id', id)
      .single();

    if (findErr || !branch) {
      throw new NotFoundException(`Sucursal con id '${id}' no encontrada`);
    }

    // 2. Regla de Negocio de Permisos:
    // - SUPER_ADMIN o MERCHANT_OWNER pueden desactivar/activar cualquier sucursal del comercio.
    // - El encargado de una sucursal secundaria (ej: MERCHANT_MANAGER) PUEDE pausar/activar SU PROPIA sucursal (userBranchId === id).
    // - Una sucursal secundaria NO puede pausar o modificar otras sucursales ajenas.
    const isOwnerOrAdmin = ['SUPER_ADMIN', 'MERCHANT_OWNER'].includes(userRole || '') && (!userBranchId || userBranchId === 'all');
    const isSelfBranch = Boolean(userBranchId && userBranchId === id);

    if (!isOwnerOrAdmin && !isSelfBranch) {
      throw new ForbiddenException('No tienes permisos para modificar el estado de esta sucursal. Solo puedes pausar o reactivar tu propia sucursal asignada o ser la Sede Principal.');
    }

    // 3. Determinar el nuevo estado operativo
    const currentBh = branch.business_hours || {};
    const currentOpen = currentBh.isOpenToday ?? (branch.status === 'active');
    const newIsOpen = isOpen !== undefined ? isOpen : !currentOpen;
    const newStatus = status || (newIsOpen ? 'active' : 'inactive');

    const updatePayload: any = {
      status: branch.status === 'pending_approval' ? 'pending_approval' : newStatus,
      business_hours: {
        ...currentBh,
        open: currentBh.open || '11:00',
        close: currentBh.close || '23:00',
        isOpenToday: newIsOpen
      },
      updated_at: new Date().toISOString()
    };

    const { data: updated, error: updateErr } = await client
      .from('branches')
      .update(updatePayload)
      .eq('id', id)
      .select('*, branch_payment_credentials(*), tenants(id, name, slug)')
      .single();

    if (updateErr) {
      throw new InternalServerErrorException(`Error actualizando el estado de la sucursal: ${updateErr.message}`);
    }

    return {
      success: true,
      isOpen: newIsOpen,
      status: updated.status,
      branch: updated,
      message: newIsOpen 
        ? `Sucursal "${branch.name}" reactivada exitosamente. Ya está recibiendo pedidos.`
        : `Sucursal "${branch.name}" desactivada temporalmente (pausada). No recibirá nuevos pedidos hasta que sea reactivada.`
    };
  }

  async getSubscriptionPlans() {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('subscription_plans')
      .select('*')
      .order('monthly_fee_usd', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(`Error fetching subscription plans: ${error.message}`);
    }
    return data || [];
  }
}
