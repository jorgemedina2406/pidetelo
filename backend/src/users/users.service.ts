import { Injectable, NotFoundException, InternalServerErrorException, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export class CreateStoreUserDto {
  name!: string;
  email!: string;
  phone?: string;
  role!: string;
  branch_id?: string | null;
  branch_name?: string;
  password?: string;
  avatar_url?: string;
}

@Injectable()
export class UsersService {
  private localUsers = new Map<string, any>();
  private storageFilePath = path.resolve(process.cwd(), 'data', 'users_storage.json');

  constructor(private supabase: SupabaseService) {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          this.localUsers.clear();
          for (const u of list) {
            if (u && u.id) {
              this.localUsers.set(u.id, u);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[UsersService] Error leyendo users_storage.json:', err);
    }
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const array = Array.from(this.localUsers.values());
      fs.writeFileSync(this.storageFilePath, JSON.stringify(array, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[UsersService] Error guardando users_storage.json:', err);
    }
  }

  async findAll(tenantId?: string, branchId?: string) {
    try {
      const client = this.supabase.getClient();
      let query = client
        .from('store_collaborators')
        .select('*, branches(id, name, address)')
        .order('created_at', { ascending: true });

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      if (branchId && branchId !== 'all') {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (!error && data) {
        return data.map(item => ({
          id: item.id,
          tenant_id: item.tenant_id,
          branch_id: item.branch_id,
          branch_name: item.branches?.name || (item.branch_id ? 'Sucursal' : 'Todas las Sedes (Acceso Global)'),
          name: item.name,
          email: item.email,
          phone: item.phone,
          role: item.role,
          avatar_url: item.avatar_url,
          is_active: item.is_active,
          created_at: item.created_at,
          updated_at: item.updated_at
        }));
      }
    } catch (e) {
      console.warn('[UsersService] Error consultando store_collaborators de Supabase:', e);
    }

    return [];
  }

  async findById(id: string) {
    const user = this.localUsers.get(id);
    if (!user) {
      throw new NotFoundException(`Usuario con id '${id}' no encontrado`);
    }
    return user;
  }

  async findAllPlatformUsers() {
    const usersMap = new Map<string, any>();
    const client = this.supabase.getClient();

    const normalizeRole = (role: string | undefined | null): string => {
      if (!role) return 'CUSTOMER';
      const r = role.toUpperCase().trim();
      if (r === 'SUPERADMIN' || r === 'SUPER_ADMIN') return 'SUPER_ADMIN';
      if (r === 'MERCHANT_ADMIN' || r === 'ADMIN' || r === 'MERCHANT_OWNER' || r === 'OWNER') return 'MERCHANT_OWNER';
      if (r === 'BRANCH_MANAGER' || r === 'MANAGER' || r === 'MERCHANT_MANAGER') return 'MERCHANT_MANAGER';
      if (r === 'KITCHEN' || r === 'MERCHANT_KITCHEN' || r === 'COCINA') return 'MERCHANT_KITCHEN';
      if (r === 'DISPATCH' || r === 'MERCHANT_DISPATCH' || r === 'DESPACHO') return 'MERCHANT_DISPATCH';
      if (r === 'RIDER' || r === 'MOTORIZADO' || r === 'REPARTIDOR') return 'RIDER';
      if (r === 'CUSTOMER' || r === 'CLIENTE') return 'CUSTOMER';
      return r;
    };

    const getRoleLabel = (role: string): string => {
      switch (role) {
        case 'SUPER_ADMIN': return 'Super Administrador';
        case 'MERCHANT_OWNER': return 'Dueño de Comercio';
        case 'MERCHANT_MANAGER': return 'Encargado de Sucursal';
        case 'MERCHANT_KITCHEN': return 'Cocina / Caja';
        case 'MERCHANT_DISPATCH': return 'Despacho';
        case 'RIDER': return 'Motorizado / Repartidor';
        case 'CUSTOMER': return 'Cliente';
        default: return role;
      }
    };

    // 1. Usuarios registrados en Supabase Auth (Clientes App Móvil, Web, etc.)
    try {
      const { data: authData } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (authData?.users && authData.users.length > 0) {
        authData.users.forEach(u => {
          const rawRole = u.user_metadata?.role || (u.email?.includes('admin@pidetelo') ? 'SUPER_ADMIN' : 'CUSTOMER');
          const role = normalizeRole(rawRole);
          const name = u.user_metadata?.full_name || u.user_metadata?.name || (u.email ? u.email.split('@')[0] : 'Usuario Pídetelo');
          const phone = u.user_metadata?.phone || u.phone || 'N/A';
          const email = u.email || 'N/A';
          const emailKey = email.toLowerCase().trim();

          usersMap.set(emailKey, {
            id: u.id,
            name,
            email,
            phone,
            role,
            roleLabel: getRoleLabel(role),
            tenantName: role === 'CUSTOMER' ? 'Cliente Final' : (role === 'RIDER' ? 'Flota Global' : (role === 'SUPER_ADMIN' ? 'Pídetelo HQ' : 'Comercio')),
            branchName: role === 'CUSTOMER' ? 'App Móvil / Web' : 'Sede Principal',
            isActive: !u.banned_until,
            createdAt: u.created_at || new Date().toISOString()
          });
        });
      }
    } catch (_) {}

    // 2. Tabla Profiles (Extensión de perfiles en Supabase)
    try {
      const { data: profiles } = await client
        .from('profiles')
        .select('*, tenants(name), branches(name)')
        .order('created_at', { ascending: false });

      if (profiles && profiles.length > 0) {
        profiles.forEach((p: any) => {
          const email = (p.email || '').toLowerCase().trim();
          const emailKey = email || p.id;
          const role = normalizeRole(p.role || 'CUSTOMER');
          const existing = usersMap.get(emailKey);
          const tName = Array.isArray(p.tenants) ? p.tenants[0]?.name : p.tenants?.name;
          const bName = Array.isArray(p.branches) ? p.branches[0]?.name : p.branches?.name;

          usersMap.set(emailKey, {
            id: p.id || existing?.id,
            name: p.full_name || p.name || existing?.name || (email ? email.split('@')[0] : 'Usuario Pídetelo'),
            email: p.email || existing?.email || 'N/A',
            phone: p.phone || existing?.phone || 'N/A',
            role: role !== 'CUSTOMER' ? role : (existing?.role || 'CUSTOMER'),
            roleLabel: getRoleLabel(role !== 'CUSTOMER' ? role : (existing?.role || 'CUSTOMER')),
            tenantName: tName || existing?.tenantName || (role === 'CUSTOMER' ? 'Cliente Final' : (role === 'RIDER' ? 'Flota Global' : 'Comercio')),
            branchName: bName || existing?.branchName || (role === 'CUSTOMER' ? 'App Móvil / Web' : 'Sede Principal'),
            isActive: p.is_active ?? existing?.isActive ?? true,
            createdAt: p.created_at || existing?.createdAt || new Date().toISOString()
          });
        });
      }
    } catch (_) {}

    // 3. Dueños y Colaboradores de Comercio (store_collaborators)
    try {
      const { data: collaborators } = await client
        .from('store_collaborators')
        .select('*, tenants(name), branches(name)')
        .order('created_at', { ascending: false });

      if (collaborators && collaborators.length > 0) {
        collaborators.forEach((c: any) => {
          const email = (c.email || '').toLowerCase().trim();
          const emailKey = email || c.id;
          const role = normalizeRole(c.role || 'MERCHANT_OWNER');
          const existing = usersMap.get(emailKey);
          const tName = Array.isArray(c.tenants) ? c.tenants[0]?.name : c.tenants?.name;
          const bName = Array.isArray(c.branches) ? c.branches[0]?.name : c.branches?.name;

          usersMap.set(emailKey, {
            id: c.id || existing?.id,
            name: c.name || existing?.name,
            email: c.email || existing?.email,
            phone: c.phone || existing?.phone || 'N/A',
            role,
            roleLabel: getRoleLabel(role),
            tenantName: tName || existing?.tenantName || 'Comercio',
            branchName: bName || existing?.branchName || 'Todas las Sedes',
            isActive: c.is_active ?? true,
            createdAt: c.created_at || existing?.createdAt || new Date().toISOString()
          });
        });
      }
    } catch (_) {}

    // 4. Motorizados / Riders
    try {
      const { data: riders } = await client
        .from('riders')
        .select('id, name, email, phone, is_active, vehicle_type, vehicle_plate, plate_number, created_at, tenants(name), branches(name)')
        .order('created_at', { ascending: false });

      if (riders && riders.length > 0) {
        riders.forEach((r: any) => {
          const email = (r.email || '').toLowerCase().trim();
          const emailKey = email || r.id;
          const existing = usersMap.get(emailKey);
          const vehicle = r.vehicle_type ? `${r.vehicle_type} (${r.plate_number || r.vehicle_plate || 'S/P'})` : 'Flota Motorizados';
          const tName = Array.isArray(r.tenants) ? r.tenants[0]?.name : r.tenants?.name;

          usersMap.set(emailKey, {
            id: r.id || existing?.id,
            name: r.name || existing?.name,
            email: r.email || existing?.email,
            phone: r.phone || existing?.phone || 'N/A',
            role: 'RIDER',
            roleLabel: 'Motorizado / Repartidor',
            tenantName: tName || 'Flota Global Pídetelo',
            branchName: vehicle,
            isActive: r.is_active ?? true,
            createdAt: r.created_at || existing?.createdAt || new Date().toISOString()
          });
        });
      }
    } catch (_) {}

    const allUsers = Array.from(usersMap.values());
    allUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return allUsers;
  }

  async create(tenantId: string, payload: CreateStoreUserDto) {
    const name = payload.name?.trim();
    const email = payload.email?.toLowerCase().trim();
    if (!name || !email) {
      throw new InternalServerErrorException('Nombre y correo electrónico son obligatorios');
    }

    // 1. Verificar si el correo pertenece al Super Administrador de la plataforma
    if (email === 'jorge@pidetelo.com') {
      throw new ConflictException(
        `El correo '${email}' pertenece a la cuenta de Super Administrador de la plataforma y no puede ser usado para usuarios de comercio.`
      );
    }

    // 2. Verificar si el correo ya existe en cualquier comercio (local storage)
    for (const existing of this.localUsers.values()) {
      if (existing.email?.toLowerCase() === email) {
        const isSameTenant = existing.tenant_id === tenantId;
        const locationDesc = isSameTenant ? 'este comercio' : 'otro comercio de la plataforma';
        throw new ConflictException(
          `El correo '${email}' ya se encuentra registrado en el sistema (${locationDesc} con el rol ${existing.role || 'colaborador'}). Por favor utiliza un correo diferente.`
        );
      }
    }

    // 3. Verificar si el correo ya está registrado en la flota de repartidores/motorizados
    try {
      const ridersPath = path.resolve(process.cwd(), 'data', 'riders_storage.json');
      if (fs.existsSync(ridersPath)) {
        const ridersList = JSON.parse(fs.readFileSync(ridersPath, 'utf-8'));
        if (Array.isArray(ridersList)) {
          const riderMatch = ridersList.find(r => r.email?.toLowerCase() === email);
          if (riderMatch) {
            throw new ConflictException(
              `El correo '${email}' ya se encuentra registrado en la plataforma como repartidor/motorizado (${riderMatch.name}). Por favor utiliza un correo diferente.`
            );
          }
        }
      }
    } catch (e) {
      if (e instanceof ConflictException) throw e;
    }

    // 4. Verificar en Supabase (store_collaborators y profiles)
    try {
      const { data: dbCollab } = await this.supabase.getClient()
        .from('store_collaborators')
        .select('id, name, email, role, tenant_id')
        .eq('email', email)
        .maybeSingle();

      if (dbCollab) {
        const isSameTenant = dbCollab.tenant_id === tenantId;
        throw new ConflictException(
          `El correo '${email}' ya está registrado en la base de datos (${isSameTenant ? 'en este comercio' : 'en otro comercio'} con el rol ${dbCollab.role}).`
        );
      }

      const { data: dbProfile } = await this.supabase.getClient()
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('email', email)
        .maybeSingle();

      if (dbProfile) {
        throw new ConflictException(
          `El correo '${email}' ya está registrado en la base de datos central como ${dbProfile.role || 'usuario del sistema'}.`
        );
      }
    } catch (e) {
      if (e instanceof ConflictException) throw e;
    }

    // Registrar cuenta en Supabase Auth (auth.users)
    let authUserId: string | null = null;
    try {
      const adminAuth = (this.supabase.getClient().auth as any)?.admin;
      if (adminAuth && typeof adminAuth.createUser === 'function') {
        const { data: adminData } = await adminAuth.createUser({
          email: email,
          password: payload.password || '123456',
          email_confirm: true,
          user_metadata: {
            full_name: name,
            role: payload.role || 'MERCHANT_MANAGER',
            tenant_id: tenantId
          }
        });
        if (adminData?.user) authUserId = adminData.user.id;
      }
    } catch (_) {}

    if (!authUserId) {
      try {
        const { data: suData } = await this.supabase.getClient().auth.signUp({
          email: email,
          password: payload.password || '123456',
          options: {
            data: {
              full_name: name,
              role: payload.role || 'MERCHANT_MANAGER',
              tenant_id: tenantId
            }
          }
        });
        if (suData?.user) authUserId = suData.user.id;
      } catch (e) {
        console.warn('[UsersService] Error registrando en Supabase Auth:', e);
      }
    }

    const id = authUserId || randomUUID();
    let branchId = payload.branch_id && payload.branch_id !== 'all' ? payload.branch_id : null;
    let branchName = payload.branch_name || (branchId ? 'Sucursal Asignada' : 'Sede Principal');

    if (!branchId && tenantId) {
      try {
        const { data: mainB } = await this.supabase.getClient().from('branches').select('id, name').eq('company_id', tenantId).eq('is_main', true).maybeSingle();
        if (mainB?.id) {
          branchId = mainB.id;
          branchName = mainB.name;
        }
      } catch (_) {}
    } else if (branchId) {
      try {
        const { data: bData } = await this.supabase.getClient().from('branches').select('name').eq('id', branchId).single();
        if (bData?.name) branchName = bData.name;
      } catch (_) {}
    }

    const newUser = {
      id,
      tenant_id: tenantId,
      branch_id: branchId,
      branch_name: branchName,
      name,
      email,
      phone: payload.phone?.trim() || '',
      role: payload.role || 'MERCHANT_MANAGER',
      password: payload.password || '123456',
      avatar_url: payload.avatar_url || `https://images.unsplash.com/photo-${Math.floor(Math.random() * 50) + 1500000000000}?w=150&auto=format&fit=crop&q=80`,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.localUsers.set(id, newUser);
    this.saveToDisk();

    // Replicar a profiles si existe authUserId
    if (authUserId) {
      try {
        await this.supabase.getClient().from('profiles').upsert({
          id: authUserId,
          tenant_id: tenantId,
          full_name: name,
          email: email,
          phone: newUser.phone,
          role: newUser.role,
          is_active: true,
          updated_at: new Date().toISOString()
        });
      } catch (pErr) {
        console.warn('[UsersService] Error replicando a profiles:', pErr);
      }
    }

    // Replicar a store_collaborators
    try {
      await this.supabase.getClient().from('store_collaborators').upsert({
        id: newUser.id,
        tenant_id: newUser.tenant_id,
        branch_id: newUser.branch_id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        password_hash: newUser.password,
        avatar_url: newUser.avatar_url,
        is_active: newUser.is_active
      });
    } catch (_) {}

    return newUser;
  }

  async update(id: string, payload: Partial<CreateStoreUserDto & { is_active?: boolean }>) {
    const user = this.localUsers.get(id);
    if (!user) {
      throw new NotFoundException(`Usuario con id '${id}' no encontrado`);
    }

    if (payload.name !== undefined) user.name = payload.name.trim();
    if (payload.phone !== undefined) user.phone = payload.phone.trim();
    if (payload.role !== undefined) user.role = payload.role;
    if (payload.is_active !== undefined) user.is_active = payload.is_active;
    if (payload.password !== undefined && payload.password.trim()) {
      user.password = payload.password.trim();
    }

    if (payload.branch_id !== undefined) {
      const bId = payload.branch_id && payload.branch_id !== 'all' ? payload.branch_id : null;
      user.branch_id = bId;
      if (bId) {
        try {
          const { data: bData } = await this.supabase.getClient().from('branches').select('name').eq('id', bId).single();
          user.branch_name = bData?.name || payload.branch_name || 'Sucursal Asignada';
        } catch (_) {
          user.branch_name = payload.branch_name || 'Sucursal Asignada';
        }
      } else {
        user.branch_name = 'Todas las Sedes (Acceso Global)';
      }
    }

    user.updated_at = new Date().toISOString();
    this.localUsers.set(id, user);
    this.saveToDisk();

    // Replicar a Supabase
    try {
      const updateData: any = {
        name: user.name,
        phone: user.phone,
        role: user.role,
        branch_id: user.branch_id,
        is_active: user.is_active,
        updated_at: user.updated_at
      };
      if (payload.password !== undefined && payload.password.trim()) {
        updateData.password_hash = payload.password.trim();
      }
      await this.supabase.getClient().from('store_collaborators').update(updateData).eq('id', id);
    } catch (_) {}

    return user;
  }

  async delete(id: string) {
    const user = this.localUsers.get(id);
    if (!user) {
      throw new NotFoundException(`Usuario con id '${id}' no encontrado`);
    }

    this.localUsers.delete(id);
    this.saveToDisk();

    try {
      await this.supabase.getClient().from('store_collaborators').delete().eq('id', id);
    } catch (_) {}

    return { success: true, message: 'Usuario eliminado correctamente' };
  }

  async login(email: string, password?: string) {
    const cleanEmail = email?.toLowerCase().trim();
    if (!cleanEmail) {
      throw new NotFoundException('Correo requerido');
    }

    let user: any = null;

    // 0. Super Administrador oficial (acceso inmediato desde local storage sin esperar a la base de datos externa)
    if (cleanEmail === 'jorge@pidetelo.com') {
      user = Array.from(this.localUsers.values()).find(
        u => u.email?.toLowerCase() === cleanEmail
      );
    }

    const withTimeout = <T>(promise: PromiseLike<T>, ms = 2000): Promise<T> => {
      return Promise.race([
        Promise.resolve(promise),
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Supabase query timeout')), ms))
      ]);
    };

    // 1. Consultar base de datos central (store_collaborators)
    if (!user) {
      try {
        const { data } = await withTimeout(
          this.supabase.getClient()
            .from('store_collaborators')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle()
        );

        if (data) {
          user = {
            id: data.id,
            tenant_id: data.tenant_id,
            tenant_name: '',
            branch_id: data.branch_id,
            branch_name: data.branch_id ? 'Sucursal Asignada' : 'Todas las Sedes (Acceso Global)',
            name: data.name,
            email: data.email,
            phone: data.phone,
            role: data.role,
            avatar_url: data.avatar_url,
            is_active: data.is_active,
            password: data.password_hash
          };
        }
      } catch (_) {}
    }

    // 2. Si no está en store_collaborators, consultar tenants directamente (dueño del comercio)
    if (!user) {
      try {
        const { data: tData } = await withTimeout(
          this.supabase.getClient()
            .from('tenants')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle()
        );

        if (tData) {
          user = {
            id: tData.id,
            tenant_id: tData.id,
            tenant_name: tData.name,
            branch_id: null,
            branch_name: 'Todas las Sedes (Acceso Global)',
            name: tData.name,
            email: tData.email,
            phone: tData.phone || tData.whatsapp_number,
            role: 'MERCHANT_OWNER',
            avatar_url: tData.logo_url,
            is_active: tData.is_active !== false,
            password: '123456'
          };
        }
      } catch (_) {}
    }

    // 3. Consultar profiles (donde se encuentran SUPER_ADMIN, etc.)
    if (!user) {
      try {
        const { data: pData } = await withTimeout(
          this.supabase.getClient()
            .from('profiles')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle()
        );

        if (pData) {
          user = {
            id: pData.id,
            tenant_id: pData.tenant_id,
            tenant_name: '',
            branch_id: pData.branch_id || null,
            branch_name: 'Acceso Global',
            name: pData.full_name,
            email: pData.email,
            phone: pData.phone,
            role: pData.role,
            avatar_url: pData.avatar_url,
            is_active: pData.is_active !== false,
            password: '123456'
          };
        }
      } catch (_) {}
    }

    // 4. Respaldo en memoria local (usuarios guardados localmente)
    if (!user) {
      user = Array.from(this.localUsers.values()).find(
        u => u.email?.toLowerCase() === cleanEmail
      );
    }

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.is_active === false) {
      throw new UnauthorizedException('Esta cuenta de colaborador ha sido desactivada por el comercio.');
    }

    const expectedPass = user.password || user.password_hash || '123456';
    if (!password || expectedPass !== password) {
      throw new UnauthorizedException('Contraseña incorrecta');
    }

    return user;
  }

  async registerCustomer(payload: { email: string; password: string; name: string; phone?: string }) {
    const cleanEmail = (payload.email || '').toLowerCase().trim();
    const cleanName = (payload.name || '').trim() || (cleanEmail ? cleanEmail.split('@')[0] : 'Cliente');
    const cleanPhone = (payload.phone || '').trim();

    if (!cleanEmail || !payload.password) {
      throw new BadRequestException('Email y contraseña son obligatorios');
    }

    const client = this.supabase.getClient();
    const { data, error } = await client.auth.admin.createUser({
      email: cleanEmail,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        phone: cleanPhone,
        role: 'CUSTOMER'
      }
    });

    if (error) {
      if (error.message?.toLowerCase().includes('already')) {
        throw new BadRequestException('Este correo electrónico ya se encuentra registrado');
      }
      throw new BadRequestException(error.message);
    }

    return {
      success: true,
      user: data.user
    };
  }
}
