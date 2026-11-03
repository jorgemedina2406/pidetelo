import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Order, OrderStatus } from '../models/order.model';
import { Product } from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private client: SupabaseClient | null = null;
  readonly isConfigured = signal<boolean>(false);
  readonly currentUser = signal<User | null>(null);

  constructor() {
    const isPlaceholder =
      !environment.supabaseUrl ||
      environment.supabaseUrl.includes('your-project-id') ||
      !environment.supabaseAnonKey ||
      environment.supabaseAnonKey.includes('dummy_anon_key');

    if (!isPlaceholder) {
      try {
        this.client = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
        this.isConfigured.set(true);

        this.client.auth.getUser().then(({ data }) => {
          this.currentUser.set(data.user);
        });

        this.client.auth.onAuthStateChange((_event, session) => {
          this.currentUser.set(session?.user ?? null);
        });
      } catch (err) {
        console.warn('[SupabaseService] Error initializing Supabase client:', err);
        this.isConfigured.set(false);
      }
    }
  }

  get rawClient(): SupabaseClient | null {
    return this.client;
  }

  // --- AUTHENTICATION ---
  async signInWithEmail(email: string, password: string) {
    if (!this.client) {
      throw new Error('Supabase no está configurado aún con credenciales reales.');
    }
    return this.client.auth.signInWithPassword({ email, password });
  }

  async signUpWithEmail(email: string, password: string, fullName: string, role = 'CUSTOMER') {
    if (!this.client) {
      throw new Error('Supabase no está configurado aún con credenciales reales.');
    }
    return this.client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role }
      }
    });
  }

  async signOut() {
    if (!this.client) return;
    return this.client.auth.signOut();
  }

  async getUserProfile(userId: string) {
    if (!this.client) return null;
    const { data, error } = await this.client
      .from('profiles')
      .select('*, tenants(name, slug)')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('[SupabaseService] Error obteniendo perfil de usuario:', error);
      return null;
    }
    return data;
  }

  // --- PRODUCTS ---
  async getProducts(tenantId: string): Promise<Product[]> {
    if (!this.client) return [];
    const { data, error } = await this.client
      .from('products')
      .select('*, modifier_groups(*, modifier_options(*))')
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[SupabaseService] getProducts error:', error);
      return [];
    }
    return data as any[];
  }

  // --- ORDERS ---
  async getOrders(tenantId: string): Promise<Order[]> {
    if (!this.client) return [];
    const { data, error } = await this.client
      .from('orders')
      .select('*, order_items(*)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SupabaseService] getOrders error:', error);
      return [];
    }
    return data as any[];
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<boolean> {
    if (!this.client) return false;
    const { error } = await this.client
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) {
      console.error('[SupabaseService] updateOrderStatus error:', error);
      return false;
    }
    return true;
  }

  async assignRider(orderId: string, riderId: string | null): Promise<boolean> {
    if (!this.client) return false;
    try {
      const { data: currentOrder } = await this.client
        .from('orders')
        .select('notes')
        .eq('id', orderId)
        .maybeSingle();

      let cleanNotes = (currentOrder?.notes || '').toString();
      cleanNotes = cleanNotes.replace(/\[RIDER_[A-Z_]+(?::[^\]]*)?\]\s*/g, '').trim();

      const payload: any = {
        driver_id: riderId,
        notes: cleanNotes.length > 0 ? cleanNotes : null,
        updated_at: new Date().toISOString()
      };

      const { error } = await this.client
        .from('orders')
        .update(payload)
        .eq('id', orderId);

      if (error) {
        console.error('[SupabaseService] assignRider error:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[SupabaseService] assignRider exception:', e);
      return false;
    }
  }

  // --- REALTIME SUBSCRIPTIONS ---
  subscribeToOrders(tenantId: string, onChange: (payload: any) => void) {
    if (!this.client) return null;

    try {
      const channelId = `orders:${tenantId}:${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return this.client
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` },
          onChange
        )
        .on(
          'broadcast',
          { event: 'order_rejected' },
          (eventPayload: any) => {
            if (eventPayload && eventPayload['payload']) {
              onChange({ eventType: 'REJECTED_BY_RIDER', order: eventPayload['payload'] });
            }
          }
        )
        .on(
          'broadcast',
          { event: 'order_status_updated' },
          (eventPayload: any) => {
            if (eventPayload && eventPayload['payload']) {
              onChange({ eventType: 'UPDATE', new: eventPayload['payload'] });
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('[SupabaseService] subscribeToOrders failed:', e);
      return null;
    }
  }

  async broadcastOrderRejected(tenantId: string, orderData: { id: string; orderNumber: string; riderName?: string }): Promise<void> {
    if (!this.client) return;
    try {
      const channel = this.client.channel(`orders:${tenantId}`);
      await channel.send({
        type: 'broadcast',
        event: 'order_rejected',
        payload: orderData
      });
    } catch (e) {
      console.warn('[SupabaseService] Broadcast order_rejected error:', e);
    }
  }

  subscribeToRiderTelemetry(orderId: string, onTelemetry: (telemetry: any) => void) {
    if (!this.client) return null;

    try {
      const channelId = `telemetry:${orderId}:${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return this.client
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'rider_telemetry', filter: `order_id=eq.${orderId}` },
          payload => onTelemetry(payload.new)
        )
        .on(
          'broadcast',
          { event: 'telemetry_update' },
          (eventPayload: any) => {
            if (eventPayload && eventPayload['payload']) {
              onTelemetry(eventPayload['payload']);
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('[SupabaseService] subscribeToRiderTelemetry failed:', e);
      return null;
    }
  }

  subscribeToRiders(onChange: (payload: any) => void) {
    if (!this.client) return null;

    try {
      const channelId = `riders:live:${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return this.client
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'riders' },
          payload => onChange(payload)
        )
        .subscribe();
    } catch (e) {
      console.warn('[SupabaseService] subscribeToRiders failed:', e);
      return null;
    }
  }
}
