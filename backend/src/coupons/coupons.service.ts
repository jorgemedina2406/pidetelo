import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

export interface Coupon {
  id: string;
  tenant_id: string;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_discount?: number | null;
  usage_limit?: number | null;
  times_used: number;
  is_active: boolean;
  is_global?: boolean;
  target_condition?: string; // 'all', 'new_customers', 'frequent', 'inactive_15d', 'high_ticket'
  notification_sent_at?: string | null;
  expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

@Injectable()
export class CouponsService {
  private filePath = path.join(process.cwd(), 'data', 'coupons.json');

  constructor(
    private readonly supabase: SupabaseService,
    private readonly notificationsService: NotificationsService
  ) {
    this.ensureDataFile();
  }

  private ensureDataFile() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(this.filePath)) {
        // Seed default initial global coupon
        const initialCoupons: Coupon[] = [
          {
            id: 'coupon_global_flashnow',
            tenant_id: 'global',
            code: 'FLASHNOW',
            description: '30% OFF en tu primer pedido con Pídetelo',
            discount_type: 'percentage',
            discount_value: 30,
            min_order_amount: 5.0,
            max_discount: 10.0,
            usage_limit: 1000,
            times_used: 12,
            is_active: true,
            is_global: true,
            target_condition: 'all',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ];
        fs.writeFileSync(this.filePath, JSON.stringify(initialCoupons, null, 2), 'utf-8');
      }
    } catch (e) {
      console.warn('[CouponsService] Error inicializando coupons.json:', e);
    }
  }

  private readLocal(): Coupon[] {
    try {
      this.ensureDataFile();
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const list = JSON.parse(content);
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  private writeLocal(data: Coupon[]) {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[CouponsService] Error guardando coupons.json:', e);
    }
  }

  async findAll(): Promise<Coupon[]> {
    try {
      const { data, error } = await this.supabase.getClient()
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map(r => this.mapRow(r));
      }
    } catch (_) {}

    return this.readLocal();
  }

  async findByTenant(tenantId: string): Promise<Coupon[]> {
    try {
      // Retorna los cupones propios de ese comercio Y los cupones globales (Super Admin)
      const { data, error } = await this.supabase.getClient()
        .from('coupons')
        .select('*')
        .or(`tenant_id.eq.${tenantId},is_global.eq.true,tenant_id.eq.global`)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map(r => this.mapRow(r));
      }
    } catch (_) {}

    return this.readLocal().filter(c => c.tenant_id === tenantId || c.is_global || c.tenant_id === 'global');
  }

  async create(payload: Partial<Coupon>): Promise<Coupon> {
    const isGlobal = Boolean(payload.is_global || payload.tenant_id === 'global');
    const tenantId = isGlobal ? 'global' : (payload.tenant_id || '');

    if (!tenantId && !isGlobal) {
      throw new BadRequestException('tenant_id es requerido para crear un cupón');
    }
    if (!payload.code) {
      throw new BadRequestException('El código del cupón es obligatorio');
    }

    const cleanCode = payload.code.trim().toUpperCase();
    const newCoupon: Coupon = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      code: cleanCode,
      description: payload.description || '',
      discount_type: payload.discount_type === 'fixed' ? 'fixed' : 'percentage',
      discount_value: Number(payload.discount_value) || 10,
      min_order_amount: Number(payload.min_order_amount) || 0,
      max_discount: payload.max_discount ? Number(payload.max_discount) : null,
      usage_limit: payload.usage_limit ? Number(payload.usage_limit) : null,
      times_used: 0,
      is_active: payload.is_active ?? true,
      is_global: isGlobal,
      target_condition: payload.target_condition || 'all',
      notification_sent_at: null,
      expires_at: payload.expires_at || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
      const supabaseTenantId = isUuid(newCoupon.tenant_id) ? newCoupon.tenant_id : null;

      const { data } = await this.supabase.getClient()
        .from('coupons')
        .insert({
          id: newCoupon.id,
          tenant_id: supabaseTenantId,
          code: newCoupon.code,
          description: newCoupon.description,
          discount_type: newCoupon.discount_type,
          discount_value: newCoupon.discount_value,
          min_order_amount: newCoupon.min_order_amount,
          max_discount: newCoupon.max_discount,
          usage_limit: newCoupon.usage_limit,
          times_used: 0,
          is_active: newCoupon.is_active,
          is_global: newCoupon.is_global,
          target_condition: newCoupon.target_condition,
          expires_at: newCoupon.expires_at,
          created_at: newCoupon.created_at,
          updated_at: newCoupon.updated_at
        })
        .select()
        .maybeSingle();

      if (data) {
        newCoupon.id = data.id;
      }
    } catch (e) {
      console.warn('[CouponsService] Supabase insert fallback to local:', e);
    }

    const list = this.readLocal();
    list.unshift(newCoupon);
    this.writeLocal(list);

    return newCoupon;
  }

  async update(id: string, payload: Partial<Coupon>): Promise<Coupon> {
    const list = this.readLocal();
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) {
      throw new NotFoundException(`Cupón con ID "${id}" no encontrado`);
    }

    const updated: Coupon = {
      ...list[idx],
      ...payload,
      updated_at: new Date().toISOString()
    };
    if (payload.code) {
      updated.code = payload.code.trim().toUpperCase();
    }

    try {
      await this.supabase.getClient()
        .from('coupons')
        .update({
          code: updated.code,
          description: updated.description,
          discount_type: updated.discount_type,
          discount_value: updated.discount_value,
          min_order_amount: updated.min_order_amount,
          max_discount: updated.max_discount,
          usage_limit: updated.usage_limit,
          is_active: updated.is_active,
          is_global: updated.is_global,
          target_condition: updated.target_condition,
          expires_at: updated.expires_at,
          updated_at: updated.updated_at
        })
        .eq('id', id);
    } catch (e) {
      console.warn('[CouponsService] Supabase update fallback to local:', e);
    }

    list[idx] = updated;
    this.writeLocal(list);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.supabase.getClient().from('coupons').delete().eq('id', id);
    } catch (_) {}

    const list = this.readLocal().filter(c => c.id !== id);
    this.writeLocal(list);
    return true;
  }

  async notifyCustomers(id: string, condition?: string, tenantName?: string, customMessage?: string): Promise<{ success: boolean; message: string }> {
    const list = this.readLocal();
    const coupon = list.find(c => c.id === id);
    if (!coupon) {
      throw new NotFoundException('Cupón no encontrado');
    }

    const targetCond = condition || coupon.target_condition || 'all';
    coupon.target_condition = targetCond;
    coupon.notification_sent_at = new Date().toISOString();
    this.writeLocal(list);

    // Guardar notificación para los clientes (Supabase y archivo local)
    const notifTitle = `🎟️ Cupón de Descuento: ${coupon.code}`;
    const descText = (customMessage && customMessage.trim().length > 0)
      ? customMessage.trim()
      : (coupon.discount_type === 'percentage' 
          ? `Aprovecha un ${coupon.discount_value}% OFF en ${tenantName || 'tu próximo pedido'}.`
          : `Disfruta de $${coupon.discount_value} OFF en ${tenantName || 'tu próximo pedido'}.`);

    try {
      await this.notificationsService.create({
        tenant_id: (coupon.tenant_id && coupon.tenant_id !== 'global') ? coupon.tenant_id : null,
        tenant_name: tenantName || 'Pídetelo',
        title: notifTitle,
        body: descText,
        type: 'coupon',
        data: {
          couponCode: coupon.code,
          tenantId: coupon.tenant_id,
          discountType: coupon.discount_type,
          discountValue: coupon.discount_value
        },
        target_condition: targetCond,
        is_global: coupon.is_global ?? false
      });
    } catch (e) {
      console.warn('[CouponsService] Error delegando notificación a NotificationsService:', e);
    }

    return {
      success: true,
      message: `Notificación enviada a los clientes que cumplen la condición: "${this.formatCondition(targetCond)}"`
    };
  }

  private formatCondition(cond: string): string {
    switch (cond) {
      case 'new_customers': return 'Clientes Nuevos (sin pedidos previos)';
      case 'frequent':
      case 'frequent_customers': return 'Clientes Frecuentes (+5 compras)';
      case 'inactive_15d':
      case 'inactive_customers': return 'Clientes Inactivos (+15 días sin comprar)';
      case 'high_ticket':
      case 'high_spenders': return 'Clientes VIP (Compras > $25)';
      default: return 'Todos los clientes en zona de cobertura';
    }
  }

  async validate(tenantId: string, code: string, orderAmount: number) {
    if (!code) {
      throw new BadRequestException('Por favor ingresa un código de cupón');
    }
    const cleanCode = code.trim().toUpperCase();
    const coupons = await this.findByTenant(tenantId);
    const coupon = coupons.find(c => c.code === cleanCode);

    if (!coupon) {
      return {
        isValid: false,
        message: `El cupón "${cleanCode}" no existe o no aplica para este comercio.`
      };
    }

    // Regla de Oro: Si el cupón fue creado por un comercio específico, SOLO es canjeable en ese comercio
    if (!coupon.is_global && coupon.tenant_id !== 'global' && coupon.tenant_id !== tenantId) {
      return {
        isValid: false,
        message: `Este cupón es exclusivo del comercio emisor y no puede canjearse aquí.`
      };
    }

    if (!coupon.is_active) {
      return {
        isValid: false,
        message: `El cupón "${cleanCode}" se encuentra pausado temporalmente.`
      };
    }

    if (coupon.expires_at) {
      const expiry = new Date(coupon.expires_at);
      if (expiry.getTime() < Date.now()) {
        return {
          isValid: false,
          message: `El cupón "${cleanCode}" venció el ${expiry.toLocaleDateString()}.`
        };
      }
    }

    if (coupon.min_order_amount > 0 && orderAmount < coupon.min_order_amount) {
      return {
        isValid: false,
        message: `El cupón requiere una compra mínima de $${coupon.min_order_amount.toFixed(2)}. Faltan $${(coupon.min_order_amount - orderAmount).toFixed(2)}.`
      };
    }

    let discountAmount = 0;
    if (coupon.discount_type === 'percentage') {
      discountAmount = orderAmount * (coupon.discount_value / 100);
      if (coupon.max_discount && discountAmount > coupon.max_discount) {
        discountAmount = coupon.max_discount;
      }
    } else {
      discountAmount = Math.min(coupon.discount_value, orderAmount);
    }

    const finalAmount = Math.max(0, orderAmount - discountAmount);

    return {
      isValid: true,
      message: `¡Cupón aplicado exitosamente! Descuento: -$${discountAmount.toFixed(2)}`,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
        discountAmount: Number(discountAmount.toFixed(2)),
        finalAmount: Number(finalAmount.toFixed(2))
      }
    };
  }

  private mapRow(r: any): Coupon {
    return {
      id: r.id,
      tenant_id: r.tenant_id || 'global',
      code: r.code,
      description: r.description || '',
      discount_type: r.discount_type || 'percentage',
      discount_value: Number(r.discount_value) || 0,
      min_order_amount: Number(r.min_order_amount) || 0,
      max_discount: r.max_discount ? Number(r.max_discount) : null,
      usage_limit: r.usage_limit ? Number(r.usage_limit) : null,
      times_used: Number(r.times_used) || 0,
      is_active: r.is_active ?? true,
      is_global: Boolean(r.is_global),
      target_condition: r.target_condition || 'all',
      notification_sent_at: r.notification_sent_at || null,
      expires_at: r.expires_at || null,
      created_at: r.created_at,
      updated_at: r.updated_at
    };
  }
}
