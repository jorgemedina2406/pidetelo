import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service.js';

export interface CustomerNotification {
  id: string;
  tenant_id?: string | null;
  tenant_name?: string;
  title: string;
  body: string;
  type: 'coupon' | 'promo' | 'order_status' | 'system';
  data?: any;
  target_condition: string; // 'all', 'new_customers', 'frequent', 'inactive_15d', 'high_ticket'
  is_global: boolean;
  created_at: string;
}

@Injectable()
export class NotificationsService {
  private filePath = path.join(process.cwd(), 'data', 'notifications.json');

  constructor(private readonly supabase: SupabaseService) {
    this.ensureDataFile();
  }

  private ensureDataFile() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(this.filePath)) {
        // Seed with initial welcome notification
        const initial: CustomerNotification[] = [
          {
            id: 'notif_welcome',
            title: '🎉 ¡Bienvenido a Pídetelo!',
            body: 'Explora los mejores restaurantes, súper, farmacias y comercios de tu ciudad.',
            type: 'system',
            target_condition: 'all',
            is_global: true,
            created_at: new Date().toISOString()
          }
        ];
        fs.writeFileSync(this.filePath, JSON.stringify(initial, null, 2), 'utf-8');
      }
    } catch (e) {
      console.warn('[NotificationsService] Error inicializando notifications.json:', e);
    }
  }

  private readLocal(): CustomerNotification[] {
    try {
      this.ensureDataFile();
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const list = JSON.parse(content);
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  private writeLocal(data: CustomerNotification[]) {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[NotificationsService] Error guardando notifications.json:', e);
    }
  }

  async findAll(customerCondition = 'all', tenantId?: string): Promise<CustomerNotification[]> {
    try {
      let query = this.supabase.getClient()
        .from('customer_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data.map(r => ({
          id: r.id,
          tenant_id: r.tenant_id,
          title: r.title,
          body: r.body || r.message || '',
          message: r.body || r.message || '',
          type: r.type || 'coupon',
          coupon_code: r.coupon_code || r.data?.couponCode || '',
          couponCode: r.coupon_code || r.data?.couponCode || '',
          data: r.data || {},
          target_condition: r.target_condition || 'all',
          is_global: Boolean(r.is_global),
          created_at: r.created_at
        }));
      }
    } catch (_) {}

    const local = this.readLocal();
    return local
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(r => ({
        ...r,
        message: r.body || (r as any).message || '',
        coupon_code: (r as any).coupon_code || r.data?.couponCode || '',
        couponCode: (r as any).coupon_code || r.data?.couponCode || ''
      }));
  }

  async create(payload: Partial<CustomerNotification>): Promise<CustomerNotification> {
    const notif: CustomerNotification = {
      id: crypto.randomUUID(),
      tenant_id: payload.tenant_id || null,
      tenant_name: payload.tenant_name || '',
      title: payload.title || 'Nueva Notificación',
      body: payload.body || '',
      type: payload.type || 'coupon',
      data: payload.data || {},
      target_condition: payload.target_condition || 'all',
      is_global: Boolean(payload.is_global),
      created_at: new Date().toISOString()
    };

    try {
      await this.supabase.getClient()
        .from('customer_notifications')
        .insert({
          id: notif.id,
          tenant_id: notif.tenant_id && notif.tenant_id !== 'global' ? notif.tenant_id : null,
          title: notif.title,
          body: notif.body,
          type: notif.type,
          data: notif.data,
          target_condition: notif.target_condition,
          is_global: notif.is_global,
          created_at: notif.created_at
        });
    } catch (_) {}

    const list = this.readLocal();
    list.unshift(notif);
    this.writeLocal(list);

    return notif;
  }
}

