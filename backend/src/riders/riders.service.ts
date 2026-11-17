import { Injectable, NotFoundException, InternalServerErrorException, UnauthorizedException, ForbiddenException, BadRequestException, Optional, Inject, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { BiometricVerificationService } from './biometric-verification.service.js';
import { PlansService } from '../plans/plans.service.js';
import { TenantsService } from '../tenants/tenants.service.js';

import { randomUUID, randomBytes } from 'crypto';

import * as fs from 'fs';
import * as path from 'path';

export interface CreateRiderDto {
  tenant_id?: string;
  branch_id?: string;
  name: string;
  email?: string;
  password?: string;
  phone: string;
  vehicle_plate: string;
  vehicle_type?: string;
  national_id?: string;
}

@Injectable()
export class RidersService {
  private localRiders = new Map<string, any>();
  private storageFilePath = path.resolve(process.cwd(), 'data', 'riders_storage.json');

  constructor(
    private supabase: SupabaseService,
    private biometricVerification: BiometricVerificationService,
    @Optional() private plansService?: PlansService,
    @Optional() @Inject(forwardRef(() => TenantsService)) private tenantsService?: TenantsService,
  ) {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            this.localRiders.set(item.id, item);
          }
        }
      }
    } catch (err) {
      console.warn('[RidersService] Error leyendo almacenamiento de disco:', err);
    }
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const list = Array.from(this.localRiders.values());
      fs.writeFileSync(this.storageFilePath, JSON.stringify(list, null, 2), 'utf8');
    } catch (err) {
      console.warn('[RidersService] Error guardando almacenamiento en disco:', err);
    }
  }

  async login(emailOrUsername: string, passwordAttempt: string) {
    const cleanUser = (emailOrUsername || '').trim().toLowerCase();
    
    // 1. Buscar en riders locales
    for (const rider of this.localRiders.values()) {
      const emailMatches = rider.email && rider.email.toLowerCase() === cleanUser;
      const usernameMatches = rider.name && rider.name.toLowerCase().replace(/\s+/g, '.') === cleanUser;
      const plateMatches = rider.vehicle_plate && rider.vehicle_plate.toLowerCase() === cleanUser;
      const phoneMatches = rider.phone && rider.phone.replace(/\D/g, '') === cleanUser.replace(/\D/g, '');

      if (emailMatches || usernameMatches || plateMatches || phoneMatches) {
        if (rider.password && rider.password !== passwordAttempt) {
          throw new UnauthorizedException('Contraseña incorrecta');
        }
        return rider;
      }
    }

    // 2. Si no está en disco, buscar en Supabase por name, phone o plate
    try {
      const { data: dbRider } = await this.supabase
        .getClient()
        .from('riders')
        .select('*')
        .or(`name.ilike.%${cleanUser.split('@')[0]}%,phone.eq.${cleanUser},vehicle_plate.ilike.${cleanUser}`)
        .maybeSingle();

      if (dbRider) {
        const restoredRider = {
          id: dbRider.id,
          user_id: dbRider.user_id,
          tenant_id: dbRider.tenant_id,
          tenant_ids: dbRider.tenant_ids || [dbRider.tenant_id],
          vehicle_type: dbRider.vehicle_type || 'moto',
          vehicle_plate: dbRider.vehicle_plate,
          vehicle_model: dbRider.vehicle_model || '',
          name: dbRider.name || cleanUser,
          email: dbRider.email || (cleanUser.includes('@') ? cleanUser : `${cleanUser}@deliveryhub.io`),
          password: passwordAttempt,
          phone: dbRider.phone || '+584140000000',
          national_id: dbRider.national_id || '',
          avatar_url: dbRider.avatar_url || '',
          payment_accounts: dbRider.payment_accounts || [],
          wallet_balance: dbRider.wallet_balance !== undefined ? dbRider.wallet_balance : 0.00,
          status: dbRider.status || 'available',
          current_lat: dbRider.current_lat || 10.4820,
          current_lng: dbRider.current_lng || -66.8610,
          created_at: dbRider.created_at,
          updated_at: new Date().toISOString()
        };
        this.localRiders.set(restoredRider.id, restoredRider);
        this.saveToDisk();
        return restoredRider;
      }
    } catch (err) {
      console.warn('[RidersService] Fallback de búsqueda en Supabase:', err);
    }

    throw new UnauthorizedException('Repartidor no encontrado');
  }

  async create(dto: CreateRiderDto) {
    const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

    // 1. Resolve branch_id first
    let cleanBranchId = (dto.branch_id && isUuid(dto.branch_id))
      ? dto.branch_id
      : (((dto as any).branchId && isUuid((dto as any).branchId)) ? (dto as any).branchId : null);

    // 2. Resolve tenant_id and branch_id
    let resolvedTenantId: string | null = null;
    if (dto.tenant_id && isUuid(dto.tenant_id)) {
      resolvedTenantId = dto.tenant_id;
    } else if (dto.tenant_id && !isUuid(dto.tenant_id)) {
      try {
        const { data: t } = await this.supabase
          .getClient()
          .from('tenants')
          .select('id')
          .or(`slug.eq.${dto.tenant_id},name.ilike.%${dto.tenant_id}%`)
          .maybeSingle();
        if (t?.id && isUuid(t.id)) resolvedTenantId = t.id;
      } catch (_) {}
    }

    if (cleanBranchId && !resolvedTenantId) {
      try {
        const { data: b } = await this.supabase
          .getClient()
          .from('branches')
          .select('company_id')
          .eq('id', cleanBranchId)
          .maybeSingle();
        if (b?.company_id && isUuid(b.company_id)) {
          resolvedTenantId = b.company_id;
        }
      } catch (_) {}
    }

    // Validar límite de motorizados propios según el plan del comercio
    if (resolvedTenantId && this.plansService) {
      await this.plansService.checkLimit(resolvedTenantId, 'rider');
    }

    // Si no tiene branch_id válido, dejar cleanBranchId en null
    if (cleanBranchId && !isUuid(cleanBranchId)) {
      cleanBranchId = null;
    }

    const cleanPlate = ((dto as any).vehicle_plate || (dto as any).vehiclePlate || 'SIN-PLACA').toUpperCase().trim();
    const cleanType = ((dto as any).vehicle_type || (dto as any).vehicleType || 'moto').toLowerCase().trim();
    const cleanName = (dto.name || `Repartidor (${cleanPlate})`).trim();
    const cleanEmail = (dto.email || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@deliveryhub.io`).toLowerCase().trim();
    const cleanPassword = dto.password || 'Rider123!';
    const cleanPhone = dto.phone || '+584140000000';
    const cleanNationalId = (dto as any).national_id || (dto as any).nationalId || '';

    const sb = this.supabase.getClient();
    let authUserId: string | null = null;

    // 1. Crear o localizar usuario en Supabase Auth
    try {
      const adminAuth = (sb.auth as any)?.admin;
      if (adminAuth && typeof adminAuth.createUser === 'function') {
        const { data: adminData, error: adminErr } = await adminAuth.createUser({
          email: cleanEmail,
          password: cleanPassword,
          email_confirm: true,
          user_metadata: {
            full_name: cleanName,
            role: 'RIDER',
            tenant_id: resolvedTenantId,
            branch_id: cleanBranchId
          }
        });

        if (adminData?.user) {
          authUserId = adminData.user.id;
        } else if (adminErr && (adminErr.message?.toLowerCase().includes('already') || adminErr.status === 422)) {
          const { data: listData } = await adminAuth.listUsers({ page: 1, perPage: 1000 });
          const existingUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === cleanEmail);
          if (existingUser) {
            authUserId = existingUser.id;
          }
        }
      }
    } catch (e) {
      console.warn('[RidersService] Error creando usuario auth admin:', e);
    }

    if (!authUserId) {
      try {
        const { data: prof } = await sb.from('profiles').select('id').eq('email', cleanEmail).maybeSingle();
        if (prof?.id) authUserId = prof.id;
      } catch (_) {}
    }

    if (!authUserId) {
      try {
        const { data: rd } = await sb.from('riders').select('user_id').eq('email', cleanEmail).maybeSingle();
        if (rd?.user_id) authUserId = rd.user_id;
      } catch (_) {}
    }

    if (!authUserId) {
      try {
        const { data: suData } = await sb.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: {
              full_name: cleanName,
              role: 'RIDER',
              tenant_id: resolvedTenantId,
              branch_id: cleanBranchId
            }
          }
        });
        if (suData?.user) {
          authUserId = suData.user.id;
        }
      } catch (suErr) {
        console.warn('[RidersService] Error en signUp de Supabase Auth:', suErr);
      }
    }

    const finalUserId = authUserId || randomUUID();

    // 2. Crear / sincronizar registro en public.profiles
    try {
      const { error: pErr } = await sb.from('profiles').upsert({
        id: finalUserId,
        tenant_id: resolvedTenantId,
        branch_id: cleanBranchId,
        full_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        role: 'RIDER',
        is_active: true,
        updated_at: new Date().toISOString()
      });
      if (pErr) {
        console.error('[RidersService] Error sincronizando profiles:', pErr.message);
      } else {
        console.log('[RidersService] ✅ Perfil en public.profiles creado/actualizado:', finalUserId);
      }
    } catch (pErr) {
      console.error('[RidersService] Excepción sincronizando profiles:', pErr);
    }

    // 3. Crear o actualizar registro en public.riders
    let finalRiderRecord: any = null;

    try {
      // Buscar si ya existe en Supabase por email, user_id o placa
      const { data: existingRider } = await sb
        .from('riders')
        .select('*')
        .or(`email.eq.${cleanEmail},user_id.eq.${finalUserId},vehicle_plate.eq.${cleanPlate}`)
        .maybeSingle();

      if (existingRider) {
        const { data: updatedR, error: uErr } = await sb.from('riders').update({
          user_id: finalUserId,
          tenant_id: resolvedTenantId,
          branch_id: cleanBranchId,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          national_id: cleanNationalId,
          vehicle_plate: cleanPlate,
          vehicle_type: cleanType,
          status: 'available',
          is_independent: resolvedTenantId ? false : true,
          updated_at: new Date().toISOString()
        }).eq('id', existingRider.id).select().single();

        if (!uErr && updatedR) {
          finalRiderRecord = updatedR;
          console.log('[RidersService] ✅ Registro en public.riders actualizado:', existingRider.id);
        } else if (uErr) {
          console.warn('[RidersService] Error actualizando rider:', uErr.message);
        }
      }

      if (!finalRiderRecord) {
        const riderId = randomUUID();
        const { data: insertedR, error: iErr } = await sb.from('riders').insert({
          id: riderId,
          user_id: finalUserId,
          tenant_id: resolvedTenantId,
          branch_id: cleanBranchId,
          vehicle_type: cleanType,
          vehicle_plate: cleanPlate,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          national_id: cleanNationalId,
          status: 'available',
          is_independent: resolvedTenantId ? false : true,
          current_lat: null,
          current_lng: null
        }).select().single();

        if (!iErr && insertedR) {
          finalRiderRecord = insertedR;
          console.log('[RidersService] ✅ Registro en public.riders creado:', riderId);
        } else if (iErr) {
          console.error('[RidersService] Error insertando en public.riders:', iErr.message);
          throw new InternalServerErrorException(`Error insertando en la base de datos: ${iErr.message}`);
        }
      }
    } catch (e: any) {
      console.error('[RidersService] Excepción gestionando public.riders:', e.message);
      if (e instanceof InternalServerErrorException) throw e;
      throw new InternalServerErrorException(`Excepción en base de datos: ${e.message}`);
    }

    if (!finalRiderRecord) {
      throw new InternalServerErrorException('No se pudo crear el registro del motorizado en Supabase.');
    }

    return {
      ...finalRiderRecord,
      branchId: finalRiderRecord.branch_id
    };
  }

  async findAll(tenantId?: string, branchId?: string) {
    const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
    let resolvedTenantId = tenantId && isUuid(tenantId) ? tenantId : undefined;
    if (tenantId && !resolvedTenantId) {
      try {
        const { data: t } = await this.supabase
          .getClient()
          .from('tenants')
          .select('id')
          .or(`slug.eq.${tenantId},name.ilike.%${tenantId}%`)
          .maybeSingle();
        if (t?.id && isUuid(t.id)) resolvedTenantId = t.id;
      } catch (_) {}
    }

    let query = this.supabase
      .getClient()
      .from('riders')
      .select('*, profiles(full_name, phone, avatar_url, branch_id)')
      .order('created_at', { ascending: false });

    if (resolvedTenantId) {
      query = query.eq('tenant_id', resolvedTenantId);
    }
    if (branchId && branchId !== 'all' && isUuid(branchId)) {
      try {
        const { data: branch } = await this.supabase
          .getClient()
          .from('branches')
          .select('is_main, name')
          .eq('id', branchId)
          .maybeSingle();
        const isMain = branch?.is_main || branch?.name?.toLowerCase().includes('principal');
        if (isMain) {
          query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
        } else {
          query = query.eq('branch_id', branchId);
        }
      } catch (_) {
        query = query.eq('branch_id', branchId);
      }
    }

    const { data, error } = await query;
    let dbRiders = data || [];

    if (error) {
      // Fallback si profiles no está relacionado
      let fallbackQuery = this.supabase.getClient().from('riders').select('*').order('created_at', { ascending: false });
      if (resolvedTenantId) fallbackQuery = fallbackQuery.eq('tenant_id', resolvedTenantId);
      if (branchId && branchId !== 'all' && isUuid(branchId)) fallbackQuery = fallbackQuery.eq('branch_id', branchId);
      const fallbackResult = await fallbackQuery;
      dbRiders = fallbackResult.data || [];
    }

    const seenIds = new Set<string>();
    const mapped = dbRiders.map(r => {
      seenIds.add(r.id);
      const defaultName = r.vehicle_plate ? `Repartidor (${r.vehicle_plate})` : 'Repartidor';
      const defaultPhone = '+584140000000';
      const rBranchId = (r as any).branch_id || (r as any).profiles?.branch_id || undefined;

      return {
        ...r,
        branch_id: rBranchId,
        branchId: rBranchId,
        name: (r as any).name || (r as any).profiles?.full_name || defaultName,
        email: (r as any).email || '',
        phone: (r as any).phone || (r as any).profiles?.phone || defaultPhone,
        national_id: (r as any).national_id || '',
        vehicle_model: (r as any).vehicle_model || '',
        avatar_url: (r as any).avatar_url || (r as any).profiles?.avatar_url || '',
        payment_accounts: (r as any).payment_accounts || [],
        wallet_balance: (r as any).wallet_balance !== undefined ? (r as any).wallet_balance : 0.00
      };
    });

    // Filtrado estricto por sucursal en el retorno consolidado
    if (branchId && branchId !== 'all') {
      try {
        const { data: branch } = await this.supabase
          .getClient()
          .from('branches')
          .select('is_main, name')
          .eq('id', branchId)
          .maybeSingle();
        const isMain = branch?.is_main || branch?.name?.toLowerCase().includes('principal');
        return mapped.filter(r => {
          if (r.branch_id === branchId || r.branchId === branchId) return true;
          if (isMain && (!r.branch_id && !r.branchId)) return true;
          return false;
        });
      } catch (_) {
        return mapped.filter(r => r.branch_id === branchId || r.branchId === branchId);
      }
    }

    return mapped;
  }

  async delete(id: string, branchId?: string) {
    const cached = this.localRiders.get(id);
    if (cached && branchId && branchId !== 'all' && cached.branch_id && cached.branch_id !== branchId) {
      throw new ForbiddenException('No tienes permisos para eliminar un motorizado de otra sucursal.');
    }

    this.localRiders.delete(id);
    this.saveToDisk();

    try {
      await this.supabase.getClient().from('riders').delete().eq('id', id);
    } catch (e: any) {
      console.warn('[RidersService] Error eliminando rider de Supabase:', e.message);
    }

    return { success: true, message: `Motorizado '${id}' eliminado correctamente` };
  }

  async findById(id: string) {
    const cached = this.localRiders.get(id);

    try {
      const { data } = await this.supabase
        .getClient()
        .from('riders')
        .select('*, profiles(full_name, phone, avatar_url, branch_id)')
        .eq('id', id)
        .maybeSingle();

      if (data) {
        const branchId = (data as any).profiles?.branch_id || (data as any).branch_id || cached?.branch_id || undefined;
        return {
          ...data,
          branch_id: branchId,
          branchId: branchId,
          name: (data as any).name || (data as any).profiles?.full_name || cached?.name || `Repartidor (${data.vehicle_plate})`,
          email: (data as any).email || cached?.email || '',
          phone: (data as any).phone || (data as any).profiles?.phone || cached?.phone || '+584141112233',
          national_id: (data as any).national_id || cached?.national_id || '',
          vehicle_model: (data as any).vehicle_model || cached?.vehicle_model || '',
          avatar_url: (data as any).avatar_url || (data as any).profiles?.avatar_url || cached?.avatar_url || '',
          payment_accounts: (data as any).payment_accounts || cached?.payment_accounts || [],
          wallet_balance: (data as any).wallet_balance !== undefined ? (data as any).wallet_balance : (cached?.wallet_balance || 0.00)
        };
      }
    } catch (err) {
      console.warn(`[RidersService] Error consultando Supabase para id '${id}':`, err);
    }

    if (cached) {
      return cached;
    }

    throw new NotFoundException(`Rider '${id}' no encontrado`);
  }

  async updateLocation(riderId: string, lat: number, lng: number) {
    const cleanLat = Number(Number(lat).toFixed(6));
    const cleanLng = Number(Number(lng).toFixed(6));

    // 1. Actualizar caché local en memoria y persistir en disco
    const cached = this.localRiders.get(riderId);
    if (cached) {
      cached.current_lat = cleanLat;
      cached.current_lng = cleanLng;
      cached.last_ping_at = new Date().toISOString();
      cached.updated_at = new Date().toISOString();
      this.localRiders.set(riderId, cached);
      this.saveToDisk();
    }

    // 2. Actualizar Supabase si está disponible
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from('riders')
        .update({
          current_lat: cleanLat,
          current_lng: cleanLng,
          last_ping_at: new Date().toISOString(),
        })
        .eq('id', riderId)
        .select()
        .single();

      if (!error && data) {
        return data;
      }
    } catch (err) {
      console.warn('[RidersService] Supabase offline o error al actualizar ubicación:', err);
    }

    return cached || { id: riderId, current_lat: cleanLat, current_lng: cleanLng };
  }

  async saveTelemetry(telemetry: {
    rider_id: string;
    order_id?: string;
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
    speed_kmh?: number;
    speed?: number;
    heading?: number;
    battery_level?: number;
  }) {
    const cleanLat = Number(Number(telemetry.latitude ?? telemetry.lat ?? 0).toFixed(6));
    const cleanLng = Number(Number(telemetry.longitude ?? telemetry.lng ?? 0).toFixed(6));
    const cleanSpeed = Number(telemetry.speed_kmh ?? telemetry.speed ?? 0);

    // 1. Update rider current position
    if (telemetry.rider_id && !isNaN(cleanLat) && !isNaN(cleanLng)) {
      await this.updateLocation(telemetry.rider_id, cleanLat, cleanLng);
    }

    // 2. Insert into telemetry log
    try {
      const payload: any = {
        rider_id: telemetry.rider_id,
        order_id: telemetry.order_id || null,
        latitude: cleanLat,
        longitude: cleanLng,
        speed_kmh: cleanSpeed,
        battery_level: telemetry.battery_level ?? 95,
        recorded_at: new Date().toISOString(),
      };
      if (telemetry.heading !== undefined) {
        payload.heading = telemetry.heading;
      }

      const { data, error } = await this.supabase
        .getClient()
        .from('rider_telemetry')
        .insert(payload)
        .select()
        .single();

      if (!error && data) {
        return data;
      }
    } catch (err) {
      console.warn('[RidersService] Notice recording telemetry in Supabase:', err);
    }

    return {
      rider_id: telemetry.rider_id,
      order_id: telemetry.order_id,
      latitude: cleanLat,
      longitude: cleanLng,
      speed_kmh: cleanSpeed,
      recorded_at: new Date().toISOString(),
    };
  }

  async getOrderTelemetry(orderId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('rider_telemetry')
      .select('*')
      .eq('order_id', orderId)
      .order('recorded_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new InternalServerErrorException(`Error fetching telemetry: ${error.message}`);
    }
    return data;
  }

  async updateProfile(id: string, updates: any) {
    let rider = this.localRiders.get(id);
    if (!rider) {
      for (const r of this.localRiders.values()) {
        if (r.id === id || (updates.email && r.email && r.email.toLowerCase() === updates.email.toLowerCase())) {
          rider = r;
          break;
        }
      }
    }

    if (rider) {
      if (updates.name !== undefined) rider.name = updates.name;
      if (updates.fullName !== undefined) rider.name = updates.fullName;
      if (updates.email !== undefined) rider.email = updates.email;
      if (updates.phone !== undefined) rider.phone = updates.phone;
      if (updates.national_id !== undefined) rider.national_id = updates.national_id;
      if (updates.nationalId !== undefined) rider.national_id = updates.nationalId;
      if (updates.vehicle_plate !== undefined) rider.vehicle_plate = updates.vehicle_plate;
      if (updates.plateNumber !== undefined) rider.vehicle_plate = updates.plateNumber;
      if (updates.vehicle_type !== undefined) rider.vehicle_type = updates.vehicle_type;
      if (updates.vehicleType !== undefined) rider.vehicle_type = updates.vehicleType;
      if (updates.vehicle_model !== undefined) rider.vehicle_model = updates.vehicle_model;
      if (updates.vehicleModel !== undefined) rider.vehicle_model = updates.vehicleModel;
      if (updates.avatar_url !== undefined) rider.avatar_url = updates.avatar_url;
      if (updates.avatarUrl !== undefined) rider.avatar_url = updates.avatarUrl;
      if (updates.payment_accounts !== undefined) rider.payment_accounts = updates.payment_accounts;
      if (updates.paymentAccounts !== undefined) rider.payment_accounts = updates.paymentAccounts;
      if (updates.wallet_balance !== undefined) rider.wallet_balance = updates.wallet_balance;
      if (updates.walletBalance !== undefined) rider.wallet_balance = updates.walletBalance;
      if (updates.auto_accept_orders !== undefined) rider.auto_accept_orders = updates.auto_accept_orders;
      if (updates.autoAcceptOrders !== undefined) rider.auto_accept_orders = updates.autoAcceptOrders;
      if (updates.sound_notifications !== undefined) rider.sound_notifications = updates.sound_notifications;
      if (updates.soundNotifications !== undefined) rider.sound_notifications = updates.soundNotifications;
      rider.updated_at = new Date().toISOString();

      this.localRiders.set(rider.id, rider);
      this.saveToDisk();

      // Guardar directamente en la base de datos Supabase
      try {
        const fullPayload: any = {
          name: rider.name,
          email: rider.email,
          phone: rider.phone,
          national_id: rider.national_id,
          vehicle_plate: rider.vehicle_plate,
          vehicle_type: rider.vehicle_type,
          vehicle_model: rider.vehicle_model,
          avatar_url: rider.avatar_url,
          payment_accounts: rider.payment_accounts,
          wallet_balance: rider.wallet_balance !== undefined ? rider.wallet_balance : 0.00
        };

        const { error: fullError } = await this.supabase.getClient()
          .from('riders')
          .update(fullPayload)
          .eq('id', rider.id);

        if (fullError) {
          console.warn('[RidersService] Aviso actualizando columnas completas en Supabase (requiere ejecutar migración SQL):', fullError.message);
          // Fallback a columnas existentes previamente en Supabase
          await this.supabase.getClient().from('riders').update({
            name: rider.name,
            phone: rider.phone,
            vehicle_plate: rider.vehicle_plate,
            vehicle_type: rider.vehicle_type
          }).eq('id', rider.id);
        } else {
          console.log(`[RidersService] Perfil de '${rider.name}' guardado exitosamente en la base de datos Supabase`);
        }
      } catch (sbErr) {
        console.warn('[RidersService] Excepción de conexión con Supabase:', sbErr);
      }

      return rider;
    }
    throw new NotFoundException(`Rider '${id}' no encontrado`);
  }

  // ==============================================================================
  // VALIDACIÓN MANUAL / SUPER ADMIN DE DOCUMENTOS DE REPARTIDORES
  // ==============================================================================
  async verifyCertification(id: string, isApproved: boolean, notes?: string) {
    const sb = this.supabase.getClient();
    const verificationStatus = isApproved ? 'verified' : 'rejected';
    const isCertified = isApproved;
    const certifiedAt = isApproved ? new Date().toISOString() : null;

    // Actualizar en base de datos Supabase
    const { data, error } = await sb.from('riders').update({
      is_certified: isCertified,
      verification_status: verificationStatus,
      certified_at: certifiedAt,
      status: isApproved ? 'available' : 'offline',
      is_active: isApproved ? true : false,
    }).eq('id', id).select().maybeSingle();

    if (error) {
      console.error('[RidersService] Error actualizando verificación:', error.message);
      throw new InternalServerErrorException(`Error al actualizar estado en base de datos: ${error.message}`);
    }

    // Actualizar en memoria local si existe
    const local = this.localRiders.get(id);
    if (local) {
      local.is_certified = isCertified;
      local.verification_status = verificationStatus;
      local.certified_at = certifiedAt;
      if (isApproved) {
        local.status = 'available';
        local.is_active = true;
      }
      this.saveToDisk();
    }

    return {
      success: true,
      isCertified,
      verificationStatus,
      message: isApproved ? 'Motorizado verificado y certificado exitosamente.' : 'Documentación rechazada.',
      rider: data || local,
    };
  }

  // ==============================================================================
  // REGISTRO DE RIDERS CON CERTIFICACIÓN Y VALIDACIÓN AUTOMÁTICA DE IDENTIDAD
  // ==============================================================================
  async registerWithVerification(payload: {
    name: string;
    email: string;
    password?: string;
    phone: string;
    national_id: string;
    vehicle_type?: string;
    vehicle_model?: string;
    vehicle_plate: string;
    id_document_image?: string;
    selfie_image?: string;
    tenant_id?: string;
    branch_id?: string;
  }) {
    const cleanName = (payload.name || '').trim();
    const cleanEmail = (payload.email || '').toLowerCase().trim();
    const cleanPhone = (payload.phone || '').trim();
    const cleanNationalId = (payload.national_id || '').toUpperCase().trim();
    const cleanPlate = (payload.vehicle_plate || '').toUpperCase().trim();
    const cleanType = (payload.vehicle_type || 'moto').toLowerCase().trim();
    const cleanModel = (payload.vehicle_model || 'Motocicleta Estándar').trim();
    const cleanPassword = payload.password || 'Rider123!';

    if (!cleanName || !cleanEmail || !cleanPhone || !cleanNationalId || !cleanPlate) {
      throw new BadRequestException('Nombre, correo, teléfono, cédula y placa son obligatorios para la certificación.');
    }

    const docImg = payload.id_document_image || '';
    const selfieImg = payload.selfie_image || '';

    if (!docImg || !selfieImg) {
      throw new BadRequestException('Es indispensable adjuntar la foto del documento de identidad y la selfie frontal para la certificación de seguridad.');
    }

    // --- PROCESO AUTOMÁTICO DE VERIFICACIÓN DE IDENTIDAD BIOMÉTRICA Y DOCUMENTAL ---
    const verification = await this.biometricVerification.verifyIdentity(
      docImg,
      selfieImg,
      cleanName,
      cleanNationalId,
    );

    const isAiVerified = verification.isAiVerified === true;
    const verificationScore = verification.score || (isAiVerified ? 96 : 70);
    const verificationStatus = isAiVerified ? 'verified' : 'pending';
    const isCertified = isAiVerified;
    const certifiedAt = isAiVerified ? new Date().toISOString() : null;

    // Subir fotos reales a Supabase Storage (bucket merchant-assets/riders)
    const uploadedDocUrl = await this.uploadRiderAsset(docImg, `doc-${cleanNationalId}`);
    const uploadedSelfieUrl = await this.uploadRiderAsset(selfieImg, `selfie-${cleanNationalId}`);
    const finalDocUrl = uploadedDocUrl || (docImg.startsWith('http') ? docImg : null);
    const finalSelfieUrl = uploadedSelfieUrl || (selfieImg.startsWith('http') ? selfieImg : null);

    const sb = this.supabase.getClient();

    // 5. Registrar usando el flujo centralizado de creación de riders
    const created = await this.create({
      name: cleanName,
      email: cleanEmail,
      password: cleanPassword,
      phone: cleanPhone,
      national_id: cleanNationalId,
      vehicle_plate: cleanPlate,
      vehicle_type: cleanType,
      tenant_id: payload.tenant_id,
      branch_id: payload.branch_id
    } as any);

    // 6. Actualizar certificación y fotos en Supabase
    const riderId = created.id;
    const isIndependent = !payload.tenant_id;

    const { error: updateErr } = await sb.from('riders').update({
      is_certified: isCertified,
      verification_status: verificationStatus,
      verification_score: verificationScore,
      id_document_url: finalDocUrl,
      selfie_url: finalSelfieUrl,
      is_independent: isIndependent,
      certified_at: certifiedAt,
      status: isCertified ? 'available' : 'offline',
      rating: 5.0,
      total_deliveries: 0,
      vehicle_model: cleanModel
    }).eq('id', riderId);

    if (updateErr) {
      console.error('[RidersService] Error actualizando certificación en Supabase:', updateErr.message);
      throw new InternalServerErrorException(`No se pudo persistir la certificación en la base de datos: ${updateErr.message}`);
    }

    return {
      success: true,
      rider: {
        id: riderId,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        nationalId: cleanNationalId,
        vehiclePlate: cleanPlate,
        vehicleType: cleanType,
        vehicleModel: cleanModel,
        isCertified,
        verificationStatus,
        verificationScore,
        idDocumentUrl: finalDocUrl,
        selfieUrl: finalSelfieUrl,
        isIndependent,
        certifiedAt
      },
      message: isCertified
        ? 'Motorizado verificado y certificado exitosamente con Inteligencia Artificial.'
        : 'Documentos recibidos y almacenados con éxito en la nube. Tu cuenta se encuentra en revisión de seguridad antes de su activación final.'
    };
  }

  private async uploadRiderAsset(dataUri: string, prefix: string): Promise<string | null> {
    if (!dataUri) return null;
    if (dataUri.startsWith('http://') || dataUri.startsWith('https://')) {
      return dataUri;
    }
    try {
      const match = dataUri.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      let buffer: Buffer;
      let ext = 'jpg';
      let contentType = 'image/jpeg';

      if (match && match.length === 3) {
        contentType = match[1];
        if (contentType.includes('png')) ext = 'png';
        else if (contentType.includes('webp')) ext = 'webp';
        buffer = Buffer.from(match[2], 'base64');
      } else {
        buffer = Buffer.from(dataUri, 'base64');
      }

      const sb = this.supabase.getClient();
      const fileName = `riders/${prefix}-${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`;
      const bucketName = 'merchant-assets';

      const { error: uploadError } = await sb.storage
        .from(bucketName)
        .upload(fileName, buffer, {
          contentType,
          upsert: true,
        });

      if (!uploadError) {
        const { data: pubData } = sb.storage.from(bucketName).getPublicUrl(fileName);
        return pubData?.publicUrl || null;
      } else {
        console.warn(`[RidersService] Error subiendo ${prefix} a Supabase storage:`, uploadError.message);
      }
    } catch (err: any) {
      console.warn(`[RidersService] Error en uploadRiderAsset (${prefix}):`, err.message);
    }
    return null;
  }

  // ==============================================================================
  // CALIFICACIÓN DE MOTORIZADOS POR PARTE DEL CLIENTE (1 A 5 ESTRELLAS)
  // ==============================================================================
  async rateRider(riderId: string, rating: number, orderId?: string, comment?: string) {
    const sb = this.supabase.getClient();
    const cleanRating = Math.max(1, Math.min(5, Number(rating)));

    const { data: rider, error: rErr } = await sb
      .from('riders')
      .select('id, name, rating, total_deliveries')
      .eq('id', riderId)
      .maybeSingle();

    if (rErr || !rider) {
      throw new NotFoundException('Motorizado no encontrado para calificar.');
    }

    const currentTotal = Number(rider.total_deliveries || 0);
    const currentRating = Number(rider.rating || 5.0);
    const newTotal = currentTotal + 1;
    // Promedio ponderado acumulado
    const newRating = Number(((currentRating * currentTotal + cleanRating) / newTotal).toFixed(1));

    const { error: uErr } = await sb.from('riders').update({
      rating: newRating,
      total_deliveries: newTotal,
      updated_at: new Date().toISOString()
    }).eq('id', riderId);

    if (uErr) {
      throw new InternalServerErrorException(`Error guardando valoración: ${uErr.message}`);
    }

    if (orderId) {
      try {
        await sb.from('orders').update({
          rider_rating: cleanRating,
          rider_review: comment || null,
        }).eq('id', orderId);
      } catch (_) {}
    }

    return {
      success: true,
      riderId,
      newRating,
      totalDeliveries: newTotal,
      message: 'Valoración registrada exitosamente.'
    };
  }

  // ==============================================================================
  // POOL DE DESPACHO PARA COMERCIOS: FLOTA PROPIA + FLOTA LIBRE CERCANA CON FILTROS REALES
  // ==============================================================================
  async findDispatchPool(
    tenantId: string,
    branchId?: string,
    merchantLat?: number,
    merchantLng?: number,
    minRating?: number,
    maxDistanceKm?: number,
    minDeliveries?: number
  ) {
    const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
    const sb = this.supabase.getClient();

    let resolvedTenantId = tenantId && isUuid(tenantId) ? tenantId : undefined;
    if (tenantId && !resolvedTenantId) {
      try {
        const { data: t } = await sb
          .from('tenants')
          .select('id')
          .or(`slug.eq.${tenantId},name.ilike.%${tenantId}%`)
          .maybeSingle();
        if (t?.id && isUuid(t.id)) resolvedTenantId = t.id;
      } catch (_) {}
    }

    // 1. Obtener IDs y órdenes activas de motorizados que se encuentran actualmente ocupados en un despacho
    let busyDriverIds = new Set<string>();
    let busyDriverOrders = new Map<string, any>();
    try {
      const { data: busyOrders } = await sb
        .from('orders')
        .select('id, driver_id, tenant_id, branch_id, status, order_number')
        .not('driver_id', 'is', null)
        .in('status', ['assigned_driver', 'at_merchant', 'picked_up', 'on_the_way']);

      if (busyOrders) {
        busyOrders.forEach((o: any) => {
          if (o.driver_id) {
            busyDriverIds.add(o.driver_id);
            busyDriverOrders.set(o.driver_id, o);
          }
        });
      }
    } catch (e) {
      console.warn('[RidersService] Error consultando órdenes activas para exclusión de ocupados:', e);
    }

    // Coordenadas de referencia del comercio
    const refLat = merchantLat || 10.0400;
    const refLng = merchantLng || -69.2700;

    // Fórmula Haversine estricta para cálculo de distancia en KM
    const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371; // Radio de la Tierra en km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Number((R * c).toFixed(1));
    };

    // Obtener motorizados reales de Supabase
    const allRiders = await this.findAll();

    const ownRiders: any[] = [];
    const nearbyRiders: any[] = [];

    allRiders.forEach((r: any) => {
      const rTenant = r.tenant_id || (r as any).tenantId;
      const rBranch = r.branch_id || (r as any).branchId;
      const rRating = Number(r.rating != null ? r.rating : 5.0);
      const rDeliveries = Number(r.total_deliveries || 0);

      // Filtro: Mínima calificación solicitada por el comercio
      if (minRating != null && rRating < minRating) {
        return;
      }

      // Filtro: Mínimo de pedidos completados solicitado por el comercio
      if (minDeliveries != null && rDeliveries < minDeliveries) {
        return;
      }

      // Cálculo de distancia real basado en GPS reportado por el motorizado
      let dist: number | null = null;
      let distanceText = 'Sin GPS';

      const hasGps = r.current_lat !== undefined && r.current_lat !== null &&
                     r.current_lng !== undefined && r.current_lng !== null &&
                     !isNaN(Number(r.current_lat)) && !isNaN(Number(r.current_lng));

      if (hasGps) {
        dist = calculateDistanceKm(refLat, refLng, Number(r.current_lat), Number(r.current_lng));
        distanceText = dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist} km`;
      }

      // Filtro: Lejanía máxima (radio en km) configurada por el comercio
      if (maxDistanceKm != null && dist != null && dist > maxDistanceKm) {
        return;
      }

      const isBusy = busyDriverIds.has(r.id);
      const busyOrder = busyDriverOrders.get(r.id);
      const rawStatus = (r.status || 'available').toLowerCase();
      const effectiveStatus = isBusy ? 'delivering' : rawStatus;

      const riderItem = {
        id: r.id,
        name: r.name,
        phone: r.phone,
        tenant_id: rTenant,
        tenantId: rTenant,
        branch_id: rBranch,
        branchId: rBranch,
        vehiclePlate: r.vehicle_plate || (r as any).vehiclePlate || 'S/P',
        vehicleType: r.vehicle_type || (r as any).vehicleType || 'moto',
        vehicleModel: r.vehicle_model || (r as any).vehicleModel || 'Motocicleta',
        avatarUrl: r.avatar_url || (r as any).avatarUrl || '',
        status: effectiveStatus,
        rating: rRating.toFixed(1),
        totalDeliveries: rDeliveries,
        walletBalance: Number(r.wallet_balance !== undefined ? r.wallet_balance : ((r as any).walletBalance || 0)),
        isCertified: r.is_certified ?? true,
        verificationStatus: r.verification_status || 'verified',
        distanceKm: dist,
        distanceText,
        currentLat: hasGps ? Number(r.current_lat) : null,
        currentLng: hasGps ? Number(r.current_lng) : null,
        current_lat: hasGps ? Number(r.current_lat) : null,
        current_lng: hasGps ? Number(r.current_lng) : null,
        currentLocation: hasGps ? { lat: Number(r.current_lat), lng: Number(r.current_lng) } : null,
        currentOrderId: busyOrder?.id,
        activeOrderNumber: busyOrder?.order_number,
      };

      // Si pertenece a la sede del comercio actual (Flota Propia)
      const isMatchingTenant = (isUuid(tenantId) && rTenant === tenantId) || (!isUuid(tenantId) && rTenant === resolvedTenantId);
      if (isMatchingTenant) {
        if (!branchId || branchId === 'all' || !rBranch || rBranch === branchId) {
          ownRiders.push({ ...riderItem, isOwn: true, isIndependent: false });
          return;
        }
        // Si pertenece a otra sede del mismo comercio, no se muestra
        return;
      }

      // Si pertenece a cualquier otro comercio o sede ajena, NO es flota libre
      if (rTenant || rBranch) {
        return;
      }

      // Flota Libre / Red de motorizados independientes de la plataforma Pídetelo
      const isIndependentRider = !rTenant && !rBranch;
      if (isIndependentRider) {
        // Si está ocupado en una orden: incluirlo si está entregando un pedido de ESTE comercio
        if (isBusy) {
          const isOurOrder = busyOrder && ((isUuid(tenantId) && busyOrder.tenant_id === tenantId) || busyOrder.tenant_id === resolvedTenantId);
          if (isOurOrder) {
            nearbyRiders.push({ ...riderItem, isOwn: false, isIndependent: true });
          }
          return;
        }

        // Si está libre: solo mostrar si está disponible
        if (rawStatus === 'available') {
          nearbyRiders.push({ ...riderItem, isOwn: false, isIndependent: true });
        }
      }
    });

    // Ordenar los motorizados con GPS más cercanos primero
    const sortDistance = (a: any, b: any) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    };

    nearbyRiders.sort(sortDistance);
    ownRiders.sort(sortDistance);

    return {
      ownRiders,
      nearbyRiders
    };
  }

  // ==============================================================================
  // BILLETERA MULTI-COMERCIO: CONSULTA DE SALDOS Y POLÍTICAS POR COMERCIO
  // ==============================================================================
  async getMerchantBalances(riderId: string) {
    const sb = this.supabase.getClient();

    // 1. Obtener órdenes entregadas por este motorizado
    const { data: deliveredOrders, error: ordErr } = await sb
      .from('orders')
      .select('id, order_number, tenant_id, delivery_fee, tip, created_at, status')
      .eq('driver_id', riderId)
      .eq('status', 'delivered');

    if (ordErr) {
      console.warn('[RidersService] Error consultando órdenes para balance multi-comercio:', ordErr);
    }

    // 2. Obtener retiros del motorizado
    const { data: withdrawals, error: withErr } = await sb
      .from('rider_withdrawals')
      .select('*')
      .eq('rider_id', riderId);

    if (withErr) {
      console.warn('[RidersService] Error consultando retiros para balance multi-comercio:', withErr);
    }

    const ordersList = deliveredOrders || [];
    const withdrawalsList = withdrawals || [];

    // 3. Agrupar ganancias por tenant_id
    const tenantEarningsMap = new Map<string, { totalEarned: number; totalTips: number; count: number }>();
    for (const o of ordersList) {
      if (!o.tenant_id) continue;
      const cur = tenantEarningsMap.get(o.tenant_id) || { totalEarned: 0, totalTips: 0, count: 0 };
      const fee = Number(o.delivery_fee) || 0;
      const tip = Number(o.tip) || 0;
      cur.totalEarned += (fee + tip);
      cur.totalTips += tip;
      cur.count += 1;
      tenantEarningsMap.set(o.tenant_id, cur);
    }

    // Sumar retiros completados y pendientes por tenant
    const tenantWithdrawalsMap = new Map<string, { completed: number; pending: number }>();
    for (const w of withdrawalsList) {
      if (!w.tenant_id) continue;
      const cur = tenantWithdrawalsMap.get(w.tenant_id) || { completed: 0, pending: 0 };
      const amt = Number(w.amount) || 0;
      if (w.status === 'completed') {
        cur.completed += amt;
      } else if (w.status === 'pending') {
        cur.pending += amt;
      }
      tenantWithdrawalsMap.set(w.tenant_id, cur);
    }

    // Obtener datos de comercios involucrados (o comercio asignado si no tiene pedidos aún)
    const rider = await this.findById(riderId);
    const assignedTenantId = rider?.tenant_id || (rider as any)?.tenantId;

    const tenantIds = new Set<string>([...tenantEarningsMap.keys(), ...tenantWithdrawalsMap.keys()]);
    if (assignedTenantId) {
      tenantIds.add(assignedTenantId);
    }

    const result: any[] = [];
    const dayNames = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    for (const tId of tenantIds) {
      let tenantInfo: any = null;
      let policy: any = null;
      if (this.tenantsService) {
        try {
          tenantInfo = await this.tenantsService.findById(tId);
          policy = tenantInfo?.riderPayoutPolicy || tenantInfo?.rider_payout_policy;
        } catch (_) {}
      }

      if (!policy) {
        policy = {
          mode: 'WEEKLY',
          payoutDayOfWeek: 1,
          payoutHour: '20:00',
          minWithdrawalAmount: 5.0,
          paymentMethod: 'PAGO_MOVIL',
          emailNotifications: true,
        };
      }

      const earnings = tenantEarningsMap.get(tId) || { totalEarned: 0, totalTips: 0, count: 0 };
      const withs = tenantWithdrawalsMap.get(tId) || { completed: 0, pending: 0 };
      const availableBalance = Math.max(0, Number((earnings.totalEarned - withs.completed - withs.pending).toFixed(2)));

      let scheduleText = '';
      if (policy.mode === 'ON_DEMAND') {
        scheduleText = `Retiro a libre demanda (mínimo $${Number(policy.minWithdrawalAmount || 5).toFixed(2)})`;
      } else if (policy.mode === 'WEEKLY') {
        const dName = dayNames[policy.payoutDayOfWeek] || 'Lunes';
        scheduleText = `Liquidación semanal automática cada ${dName} (${policy.payoutHour || '20:00'})`;
      } else if (policy.mode === 'DAILY') {
        scheduleText = `Liquidación diaria automática al cierre (${policy.payoutHour || '22:00'})`;
      } else if (policy.mode === 'BIWEEKLY') {
        scheduleText = `Liquidación quincenal automática los días 15 y fin de mes`;
      }

      const canWithdrawOnDemand = policy.mode === 'ON_DEMAND' && availableBalance >= (policy.minWithdrawalAmount || 5.0);

      result.push({
        tenantId: tId,
        merchantName: tenantInfo?.name || 'Comercio Pídetelo',
        merchantSlug: tenantInfo?.slug || '',
        logoUrl: tenantInfo?.logo_url || tenantInfo?.logoUrl || '',
        phone: tenantInfo?.phone || '',
        totalEarned: Number(earnings.totalEarned.toFixed(2)),
        totalDeliveredOrders: earnings.count,
        completedWithdrawn: Number(withs.completed.toFixed(2)),
        pendingWithdrawn: Number(withs.pending.toFixed(2)),
        availableBalance,
        policy,
        canWithdrawOnDemand,
        scheduleText,
      });
    }

    return result;
  }

  // ==============================================================================
  // CREACIÓN DE SOLICITUD DE RETIRO DE MOTORIZADO A UN COMERCIO (SOLO EN ON_DEMAND)
  // ==============================================================================
  async createWithdrawal(riderId: string, dto: {
    tenantId: string;
    amount: number;
    paymentAccount?: any;
    notes?: string;
  }) {
    const sb = this.supabase.getClient();
    const rider = await this.findById(riderId);
    if (!rider) throw new NotFoundException('Repartidor no encontrado');

    const balances = await this.getMerchantBalances(riderId);
    const merchantBalance = balances.find(b => b.tenantId === dto.tenantId);
    if (!merchantBalance) {
      throw new BadRequestException('No posees saldo acumulado con este comercio');
    }

    if (merchantBalance.policy.mode !== 'ON_DEMAND') {
      throw new BadRequestException(`Este comercio opera bajo liquidación automática programada (${merchantBalance.scheduleText}). Los fondos se transfieren directamente a tu cuenta sin necesidad de solicitud.`);
    }

    if (dto.amount > merchantBalance.availableBalance) {
      throw new BadRequestException(`El monto solicitado ($${dto.amount}) excede tu saldo disponible ($${merchantBalance.availableBalance}) con este comercio.`);
    }

    if (dto.amount < (merchantBalance.policy.minWithdrawalAmount || 5.0)) {
      throw new BadRequestException(`El monto mínimo de retiro configurado por este comercio es de $${merchantBalance.policy.minWithdrawalAmount || 5.0}`);
    }

    const payload: any = {
      rider_id: riderId,
      rider_name: rider.name || 'Repartidor',
      rider_phone: rider.phone || '',
      tenant_id: dto.tenantId,
      merchant_name: merchantBalance.merchantName,
      amount: dto.amount,
      currency: 'USD',
      account_type: dto.paymentAccount?.type || 'pago_movil',
      payment_account: dto.paymentAccount || (rider.payment_accounts && rider.payment_accounts[0]) || {},
      status: 'pending',
      notes: dto.notes || '',
      requested_at: new Date().toISOString()
    };

    const { data, error } = await sb
      .from('rider_withdrawals')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('[RidersService] Error insertando rider_withdrawal:', error);
      throw new InternalServerErrorException('Error registrando solicitud de retiro');
    }

    return {
      success: true,
      message: '¡Solicitud de retiro enviada exitosamente al comercio!',
      withdrawal: data
    };
  }
}
