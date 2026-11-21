import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Order, OrderStatus } from '../models/order.model';
import { Product } from '../models/product.model';
import { RiderWithdrawal } from '../models/rider-withdrawal.model';

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

  getClient(): SupabaseClient | null {
    return this.client;
  }

  // --- AUTHENTICATION ---
  async resetPasswordForEmail(email: string, redirectTo?: string) {
    if (!this.client) throw new Error('Supabase no está configurado');
    return this.client.auth.resetPasswordForEmail(email, { redirectTo });
  }

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
    const res = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role }
      }
    });

    if (res.data?.user) {
      try {
        await this.client.from('profiles').upsert({
          id: res.data.user.id,
          email: res.data.user.email,
          full_name: fullName,
          role: role || 'CUSTOMER',
          is_active: true,
          updated_at: new Date().toISOString()
        });
      } catch (_) {}
    }

    return res;
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

  async verifyOrderPayment(orderId: string, payload: { status: 'verified' | 'rejected' | 'pending'; reference?: string; originBank?: string; orderStatus?: OrderStatus; rejectionReason?: string }): Promise<boolean> {
    if (!this.client) return false;
    try {
      const { data: currentOrder, error: fetchError } = await this.client
        .from('orders')
        .select('notes')
        .eq('id', orderId)
        .maybeSingle();

      if (fetchError || !currentOrder) {
        console.warn('[SupabaseService] verifyOrderPayment aborted: no se pudieron leer las notas actuales para preservar PIN/tags:', fetchError);
        return false;
      }

      const existingNotes = (currentOrder.notes || '').toString();
      const cleanNotes = existingNotes.replace(/\[PAGO_[A-Z_]+(?::[^\]]*)?\]\s*/g, '').trim();
      const originBank = payload.originBank || existingNotes.match(/\[PAGO_ORIGEN:([^\]]+)\]/)?.[1];
      const originTag = originBank ? `[PAGO_ORIGEN:${originBank}]` : '';
      const cleanReason = String(payload.rejectionReason || '')
        .replace(/[\[\]|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 240);

      let notesToSave: string | null = null;
      if (payload.status === 'verified') {
        const auditTag = `[PAGO_VERIFICADO${payload.reference ? ':Ref ' + payload.reference : ''}${originBank ? ' (' + originBank + ')' : ''}]`;
        notesToSave = [auditTag, cleanNotes].filter(Boolean).join(' ').trim();
      } else if (payload.status === 'rejected') {
        const rejectTag = `[PAGO_RECHAZADO${payload.reference ? ':Ref ' + payload.reference : ''}]`;
        const reasonTag = cleanReason ? `[PAGO_MOTIVO:${cleanReason}]` : '';
        notesToSave = [rejectTag, reasonTag, cleanNotes].filter(Boolean).join(' ').trim();
      } else if (payload.status === 'pending') {
        notesToSave = [originTag, cleanNotes].filter(Boolean).join(' ').trim();
      }

      const updateData: any = {
        payment_status: payload.status,
        notes: notesToSave && notesToSave.length > 0 ? notesToSave : null,
        updated_at: new Date().toISOString()
      };
      if (payload.reference) updateData.payment_reference = payload.reference.trim();
      if (payload.orderStatus) updateData.status = payload.orderStatus;

      const { error } = await this.client
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) {
        console.error('[SupabaseService] verifyOrderPayment error:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[SupabaseService] verifyOrderPayment exception:', e);
      return false;
    }
  }

  async assignRider(orderId: string, riderId: string | null): Promise<boolean> {
    if (!this.client) return false;
    try {
      const { data: currentOrder, error: fetchError } = await this.client
        .from('orders')
        .select('notes')
        .eq('id', orderId)
        .maybeSingle();

      const payload: any = {
        driver_id: riderId,
        updated_at: new Date().toISOString()
      };

      if (!fetchError && currentOrder) {
        const cleanNotes = (currentOrder.notes || '')
          .toString()
          .replace(/\[RIDER_[A-Z_]+(?::[^\]]*)?\]\s*/g, '')
          .trim();
        payload.notes = cleanNotes.length > 0 ? cleanNotes : null;
      }

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
      const pgChannelId = `orders_pg:${tenantId}:${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const pgChannel = this.client
        .channel(pgChannelId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` },
          onChange
        )
        .subscribe();

      const bcChannel = this.client
        .channel(`orders:${tenantId}`)
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
              onChange({ eventType: 'UPDATE', new: eventPayload['payload'], source: 'broadcast' });
            }
          }
        )
        .subscribe();

      return {
        unsubscribe: () => {
          try {
            pgChannel?.unsubscribe();
          } catch (_) {}
          try {
            bcChannel?.unsubscribe();
          } catch (_) {}
        }
      };
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

  async getRiderWithdrawalsByTenant(tenantId: string): Promise<RiderWithdrawal[]> {
    if (!this.client) return [];
    try {
      const { data, error } = await this.client
        .from('rider_withdrawals')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('requested_at', { ascending: false });

      if (error) {
        console.warn('[SupabaseService] getRiderWithdrawalsByTenant error:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        riderId: row.rider_id,
        riderName: row.rider_name || 'Repartidor',
        riderPhone: row.rider_phone,
        tenantId: row.tenant_id,
        merchantName: row.merchant_name || 'Comercio',
        branchId: row.branch_id,
        amount: Number(row.amount) || 0,
        currency: row.currency || 'USD',
        amountBs: row.amount_bs ? Number(row.amount_bs) : undefined,
        accountType: row.account_type || 'pago_movil',
        paymentAccount: row.payment_account || {},
        status: row.status || 'pending',
        referenceCode: row.reference_code,
        rejectionReason: row.rejection_reason,
        notes: row.notes,
        requestedAt: row.requested_at,
        processedAt: row.processed_at
      }));
    } catch (e) {
      console.warn('[SupabaseService] Error loading rider withdrawals:', e);
      return [];
    }
  }

  async processRiderWithdrawal(
    withdrawalId: string,
    status: 'completed' | 'rejected',
    referenceCode?: string,
    rejectionReason?: string
  ): Promise<boolean> {
    if (!this.client) return false;
    try {
      const payload: any = {
        status,
        processed_at: new Date().toISOString()
      };
      if (referenceCode) payload.reference_code = referenceCode.trim();
      if (rejectionReason) payload.rejection_reason = rejectionReason.trim();

      const { error } = await this.client
        .from('rider_withdrawals')
        .update(payload)
        .eq('id', withdrawalId);

      if (error) {
        console.error('[SupabaseService] processRiderWithdrawal error:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[SupabaseService] Error processing rider withdrawal:', e);
      return false;
    }
  }

  subscribeToRiderWithdrawals(tenantId: string, onChange: (payload: any) => void) {
    if (!this.client) return null;
    try {
      const channelId = `withdrawals:${tenantId}:${Date.now()}`;
      return this.client
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rider_withdrawals', filter: `tenant_id=eq.${tenantId}` },
          payload => onChange(payload)
        )
        .subscribe();
    } catch (e) {
      console.warn('[SupabaseService] subscribeToRiderWithdrawals failed:', e);
      return null;
    }
  }
}
