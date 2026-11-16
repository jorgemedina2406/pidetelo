import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseService } from '../supabase/supabase.service.js';

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  coupon_code?: string;
  badge_text?: string;
  button_text?: string;
  link_url?: string;
  image_url?: string;
  bg_gradient_start?: string;
  bg_gradient_end?: string;
  sort_order?: number;
  is_active: boolean;
  tenant_id?: string;
  source?: 'SUPER_ADMIN' | 'MERCHANT';
  created_at?: string;
  updated_at?: string;
}

@Injectable()
export class BannersService {
  private filePath = path.join(process.cwd(), 'data', 'banners.json');

  private defaultBanners: Banner[] = [
    {
      id: 'banner_flash_30',
      title: '30% OFF en tu primer pedido',
      subtitle: 'Usa el cupón FLASHNOW al pagar',
      coupon_code: 'FLASHNOW',
      badge_text: '⚡ ENTREGA FLASH 20 MIN',
      button_text: 'Pedir ahora',
      link_url: '/explorar',
      image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=80',
      bg_gradient_start: '#f97316',
      bg_gradient_end: '#ea580c',
      sort_order: 1,
      is_active: true,
      source: 'SUPER_ADMIN',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'banner_delivery_gratis',
      title: 'Envíos Gratis los Fines de Semana',
      subtitle: 'En compras superiores a $15 en tus marcas favoritas',
      coupon_code: 'FINDEGRATIS',
      badge_text: '🛵 DELIVERY GRATIS',
      button_text: 'Aprovechar',
      link_url: '/explorar',
      image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=80',
      bg_gradient_start: '#8b5cf6',
      bg_gradient_end: '#6d28d9',
      sort_order: 2,
      is_active: true,
      source: 'SUPER_ADMIN',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  ];

  constructor(private supabase: SupabaseService) {}

  private loadFromFile(): Banner[] {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (_) {}
    return this.defaultBanners;
  }

  private saveToFile(banners: Banner[]) {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(banners, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[BannersService] Error guardando banners en archivo local:', e);
    }
  }

  async findAll(onlyActive = true): Promise<Banner[]> {
    let allBanners: Banner[] = [];

    try {
      const client = this.supabase.getClient();
      let query = client.from('banners').select('*');
      if (onlyActive) {
        query = query.eq('is_active', true);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        allBanners = data;
      }
    } catch (_) {}

    if (allBanners.length === 0) {
      allBanners = this.loadFromFile();
      if (onlyActive) {
        allBanners = allBanners.filter(b => b.is_active);
      }
    }

    // Ordenamiento con prioridad absoluta a Super Admin:
    // 1. Banners del Super Admin primero
    // 2. Por sort_order ascendente
    // 3. Por fecha de creación más reciente
    allBanners.sort((a, b) => {
      const aIsSuper = a.source !== 'MERCHANT' && (!a.tenant_id || a.source === 'SUPER_ADMIN');
      const bIsSuper = b.source !== 'MERCHANT' && (!b.tenant_id || b.source === 'SUPER_ADMIN');

      if (aIsSuper && !bIsSuper) return -1;
      if (!aIsSuper && bIsSuper) return 1;

      const orderA = a.sort_order ?? 99;
      const orderB = b.sort_order ?? 99;
      if (orderA !== orderB) return orderA - orderB;

      return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
    });

    // Topear a máximo 7 banners en el carrusel de la App móvil para evitar saturación
    if (onlyActive && allBanners.length > 7) {
      return allBanners.slice(0, 7);
    }

    return allBanners;
  }

  async findById(id: string): Promise<Banner> {
    try {
      const client = this.supabase.getClient();
      const { data } = await client.from('banners').select('*').eq('id', id).single();
      if (data) return data;
    } catch (_) {}

    const list = this.loadFromFile();
    const found = list.find(b => b.id === id);
    if (!found) throw new NotFoundException(`Banner con ID '${id}' no encontrado`);
    return found;
  }

  async create(payload: Partial<Banner>): Promise<Banner> {
    const isMerchant = Boolean(payload.tenant_id);
    const source = isMerchant ? 'MERCHANT' : 'SUPER_ADMIN';

    // Regla de anti-saturación: máximo 1 banner activo simultáneamente por comercio
    if (isMerchant && payload.is_active !== false) {
      const current = await this.findAll(true);
      const existingActiveFromTenant = current.filter(b => b.tenant_id === payload.tenant_id && b.is_active);
      if (existingActiveFromTenant.length >= 1) {
        throw new BadRequestException(
          'Tu comercio ya tiene 1 banner VIP activo en la App Móvil. Pausa o reemplaza el banner existente para publicar uno nuevo y mantener un carrusel balanceado.'
        );
      }
    }

    const newBanner: Banner = {
      id: payload.id || `banner_${Date.now()}`,
      title: payload.title || 'Nueva Promoción',
      subtitle: payload.subtitle || '',
      coupon_code: payload.coupon_code || '',
      badge_text: payload.badge_text || (isMerchant ? 'PROMO VIP' : 'OFICIAL'),
      button_text: payload.button_text || 'Pedir ahora',
      link_url: payload.link_url || '/explorar',
      image_url: payload.image_url || '',
      bg_gradient_start: payload.bg_gradient_start || '#f97316',
      bg_gradient_end: payload.bg_gradient_end || '#ea580c',
      sort_order: payload.sort_order ?? (isMerchant ? 10 : 0),
      is_active: payload.is_active ?? true,
      tenant_id: payload.tenant_id || undefined,
      source: source,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const client = this.supabase.getClient();
      const { data, error } = await client.from('banners').insert(newBanner).select().single();
      if (!error && data) {
        const list = this.loadFromFile();
        list.push(data);
        this.saveToFile(list);
        return data;
      }
    } catch (_) {}

    const list = this.loadFromFile();
    list.push(newBanner);
    this.saveToFile(list);
    return newBanner;
  }

  async update(id: string, payload: Partial<Banner>): Promise<Banner> {
    const updateData = {
      ...payload,
      updated_at: new Date().toISOString(),
    };

    try {
      const client = this.supabase.getClient();
      const { data, error } = await client.from('banners').update(updateData).eq('id', id).select().single();
      if (!error && data) {
        const list = this.loadFromFile();
        const idx = list.findIndex(b => b.id === id);
        if (idx !== -1) {
          list[idx] = data;
          this.saveToFile(list);
        }
        return data;
      }
    } catch (_) {}

    const list = this.loadFromFile();
    const idx = list.findIndex(b => b.id === id);
    if (idx === -1) throw new NotFoundException(`Banner con ID '${id}' no encontrado`);

    list[idx] = { ...list[idx], ...updateData };
    this.saveToFile(list);
    return list[idx];
  }

  async delete(id: string): Promise<boolean> {
    try {
      const client = this.supabase.getClient();
      await client.from('banners').delete().eq('id', id);
    } catch (_) {}

    let list = this.loadFromFile();
    list = list.filter(b => b.id !== id);
    this.saveToFile(list);
    return true;
  }
}
