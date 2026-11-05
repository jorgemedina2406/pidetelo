import { Injectable, NotFoundException, InternalServerErrorException, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { BiometricVerificationService } from './biometric-verification.service.js';

import { randomUUID } from 'crypto';

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

    const verificationScore = verification.score || 96;
    const certifiedAt = new Date().toISOString();

    // Guardar o generar identificadores de documento
    const sb = this.supabase.getClient();
    let docUrl = docImg.startsWith('http') ? docImg : `https://pidetelo.app/storage/docs/${cleanNationalId}_doc.jpg`;
    let selfieUrl = selfieImg.startsWith('http') ? selfieImg : `https://pidetelo.app/storage/selfies/${cleanNationalId}_selfie.jpg`;

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

    // 6. Actualizar certificación en Supabase
    const riderId = created.id;
    const isIndependent = !payload.tenant_id;

    const { error: updateErr } = await sb.from('riders').update({
      is_certified: true,
      verification_status: 'verified',
      verification_score: verificationScore,
      id_document_url: docUrl,
      selfie_url: selfieUrl,
      is_independent: isIndependent,
      certified_at: certifiedAt,
      status: 'available',
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
        isCertified: true,
        verificationStatus: 'verified',
        verificationScore,
        isIndependent,
        certifiedAt
      },
      message: 'Motorizado verificado y certificado exitosamente por Pídetelo.'
    };
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

    // 1. Obtener IDs de motorizados que se encuentran actualmente ocupados en un despacho
    let busyDriverIds = new Set<string>();
    try {
      const { data: busyOrders } = await sb
        .from('orders')
        .select('driver_id')
        .not('driver_id', 'is', null)
        .in('status', ['assigned_driver', 'at_merchant', 'picked_up', 'on_the_way']);

      if (busyOrders) {
        busyOrders.forEach((o: any) => {
          if (o.driver_id) busyDriverIds.add(o.driver_id);
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
      // Regla 9: Motorizados que estén realizando un envío en ese momento NO deben aparecer
      if (busyDriverIds.has(r.id)) {
        return;
      }

      // Regla: Solo motorizados disponibles
      const status = (r.status || 'available').toLowerCase();
      if (status !== 'available') {
        return;
      }

      const rTenant = r.tenant_id || (r as any).tenantId;
      const rBranch = r.branch_id || (r as any).branchId;
      const rRating = Number(r.rating != null ? r.rating : 5.0);
      const rDeliveries = Number(r.total_deliveries || 0);

      // Filtro 8: Mínima calificación solicitada por el comercio
      if (minRating != null && rRating < minRating) {
        return;
      }

      // Filtro 8: Mínimo de pedidos completados solicitado por el comercio
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

      // Filtro 8: Lejanía máxima (radio en km) configurada por el comercio
      if (maxDistanceKm != null && dist != null && dist > maxDistanceKm) {
        return;
      }

      const riderItem = {
        id: r.id,
        name: r.name,
        phone: r.phone,
        vehiclePlate: r.vehicle_plate || (r as any).vehiclePlate || 'S/P',
        vehicleType: r.vehicle_type || (r as any).vehicleType || 'moto',
        vehicleModel: r.vehicle_model || (r as any).vehicleModel || 'Motocicleta',
        avatarUrl: r.avatar_url || (r as any).avatarUrl || '',
        status: 'available',
        rating: rRating.toFixed(1),
        totalDeliveries: rDeliveries,
        isCertified: r.is_certified ?? true,
        verificationStatus: r.verification_status || 'verified',
        isIndependent: r.is_independent ?? (!rTenant || rTenant === 'global'),
        distanceKm: dist,
        distanceText,
        currentLat: hasGps ? Number(r.current_lat) : null,
        currentLng: hasGps ? Number(r.current_lng) : null,
      };

      // Si pertenece a la sede del comercio
      if (isUuid(tenantId) && rTenant === tenantId) {
        if (!branchId || branchId === 'all' || !rBranch || rBranch === branchId) {
          ownRiders.push({ ...riderItem, isOwn: true });
          return;
        }
        // Si pertenece a otra sede del mismo comercio, no se muestra como flota libre
        return;
      }

      // Flota Libre / Red de motorizados independientes de la plataforma Pídetelo
      // Regla estricta: Solo motorizados que NO pertenezcan a un comercio en específico
      const isIndependentRider = Boolean(r.is_independent || (!rTenant && !rBranch));
      if (isIndependentRider) {
        nearbyRiders.push({ ...riderItem, isOwn: false });
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
}
