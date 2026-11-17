import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
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

export interface PushTokenRecord {
  userId: string;
  role: 'customer' | 'rider' | 'merchant' | 'admin';
  token: string;
  platform?: 'android' | 'ios' | 'web';
  updatedAt: string;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private filePath = path.join(process.cwd(), 'data', 'notifications.json');
  private tokensFilePath = path.join(process.cwd(), 'data', 'push_tokens.json');
  private firebaseInitialized = false;

  constructor(private readonly supabase: SupabaseService) {
    this.ensureDataFile();
  }

  onModuleInit() {
    this.initFirebase();
  }

  private initFirebase() {
    try {
      if (getApps().length > 0) {
        this.firebaseInitialized = true;
        return;
      }

      const defaultCertPath = path.join(process.cwd(), 'firebase-service-account.json');
      const fallbackCertPath = path.join(process.cwd(), 'pidetelo-30079-firebase-adminsdk-fbsvc-2ea70c9b73.json');
      const certPath = fs.existsSync(defaultCertPath) ? defaultCertPath : (fs.existsSync(fallbackCertPath) ? fallbackCertPath : null);

      if (certPath) {
        const serviceAccount = JSON.parse(fs.readFileSync(certPath, 'utf-8'));
        initializeApp({
          credential: cert(serviceAccount)
        });
        this.firebaseInitialized = true;
        console.log(`[FirebaseMessaging] Inicializado exitosamente con proyecto: ${serviceAccount.project_id}`);
      } else {
        console.warn('[FirebaseMessaging] No se encontró archivo de credenciales de Firebase en backend/');
      }
    } catch (e: any) {
      console.error('[FirebaseMessaging] Error al inicializar Firebase Admin:', e.message);
    }
  }

  private ensureDataFile() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(this.filePath)) {
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
      if (!fs.existsSync(this.tokensFilePath)) {
        fs.writeFileSync(this.tokensFilePath, JSON.stringify([], null, 2), 'utf-8');
      }
    } catch (e) {
      console.warn('[NotificationsService] Error inicializando archivos de datos:', e);
    }
  }

  // --- GESTIÓN DE DISPOSITIVOS Y TOKENS FCM ---
  private readTokens(): PushTokenRecord[] {
    try {
      this.ensureDataFile();
      const content = fs.readFileSync(this.tokensFilePath, 'utf-8');
      const list = JSON.parse(content);
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  private writeTokens(tokens: PushTokenRecord[]) {
    try {
      this.ensureDataFile();
      fs.writeFileSync(this.tokensFilePath, JSON.stringify(tokens, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[NotificationsService] Error guardando push_tokens.json:', e);
    }
  }

  registerPushToken(payload: { userId: string; role?: string; token: string; platform?: string }) {
    if (!payload.token || !payload.userId) return { success: false, message: 'Token y userId requeridos' };

    const role = (payload.role?.toLowerCase() || 'customer') as any;
    const tokens = this.readTokens();

    // Eliminar si este token ya estaba asignado a otro registro o actualizar existente
    const filtered = tokens.filter(t => t.token !== payload.token);
    filtered.push({
      userId: payload.userId,
      role,
      token: payload.token,
      platform: (payload.platform?.toLowerCase() || 'android') as any,
      updatedAt: new Date().toISOString()
    });

    this.writeTokens(filtered);
    console.log(`[FirebaseMessaging] Token FCM registrado para ${role} '${payload.userId}' (${payload.platform || 'android'})`);
    return { success: true, message: 'Token FCM registrado con éxito' };
  }

  getTokensForUser(userId: string): string[] {
    const cleanId = (userId || '').trim().toLowerCase();
    return this.readTokens()
      .filter(t => t.userId.trim().toLowerCase() === cleanId)
      .map(t => t.token);
  }

  getTokensByRole(role: 'customer' | 'rider' | 'merchant' | 'admin'): string[] {
    return this.readTokens()
      .filter(t => t.role === role)
      .map(t => t.token);
  }

  // --- ENVÍO DE NOTIFICACIONES PUSH REMOTAS (FCM) ---
  async sendPushNotification(payload: {
    tokens: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
  }) {
    if (!this.firebaseInitialized || !payload.tokens || payload.tokens.length === 0) {
      return { success: false, sentCount: 0 };
    }

    const uniqueTokens = Array.from(new Set(payload.tokens));

    try {
      const response = await getMessaging().sendEachForMulticast({
        tokens: uniqueTokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        android: {
          priority: 'high',
          notification: {
            channelId: 'orders_channel_v2',
            sound: 'default',
            priority: 'max',
            defaultVibrateTimings: true,
            visibility: 'public',
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              contentAvailable: true,
            }
          }
        }
      });

      console.log(`[FirebaseMessaging] Push enviado: ${response.successCount} exitosos, ${response.failureCount} fallidos para '${payload.title}'`);

      // Limpiar tokens inválidos que Firebase reporte como no registrados
      if (response.failureCount > 0) {
        const invalidTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error) {
            const code = resp.error.code;
            if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
              invalidTokens.push(uniqueTokens[idx]);
            }
          }
        });
        if (invalidTokens.length > 0) {
          const currentTokens = this.readTokens();
          const cleanTokens = currentTokens.filter(t => !invalidTokens.includes(t.token));
          this.writeTokens(cleanTokens);
          console.log(`[FirebaseMessaging] Se purgaron ${invalidTokens.length} tokens FCM caducados.`);
        }
      }

      return {
        success: true,
        sentCount: response.successCount,
        failureCount: response.failureCount
      };
    } catch (e: any) {
      console.error('[FirebaseMessaging] Excepción enviando push multicast:', e.message);
      return { success: false, error: e.message };
    }
  }

  // --- NOTIFICACIONES ESPECÍFICAS DE FLUJO DE PEDIDOS ---
  async notifyOrderStatus(order: any, newStatus: string) {
    if (!order) return;
    const orderNumber = order.order_number || order.orderNumber || `#${(order.id || '').substring(0, 6)}`;
    const customerId = order.user_id || order.customer_id || order.customerId;

    let title = `📦 Pedido ${orderNumber}`;
    let body = `El estado de tu pedido ha cambiado a: ${newStatus}`;

    switch (newStatus) {
      case 'confirmed':
      case 'in_kitchen':
        title = `🍳 Pedido Confirmado ${orderNumber}`;
        body = 'El comercio ha confirmado tu orden y ya está en preparación.';
        break;
      case 'ready_for_pickup':
        title = `📦 Pedido Listo ${orderNumber}`;
        body = 'Tu pedido está empacado y listo para ser entregado al repartidor.';
        break;
      case 'dispatched':
      case 'on_the_way':
      case 'on_way':
        title = `🛵 ¡Tu pedido va en camino! ${orderNumber}`;
        body = 'El repartidor recogió tu pedido y va en dirección a tu ubicación.';
        break;
      case 'at_door':
        title = `🔔 ¡El repartidor está afuera! ${orderNumber}`;
        body = 'El repartidor ha llegado con tu entrega.';
        break;
      case 'delivered':
        title = `✅ ¡Pedido Entregado! ${orderNumber}`;
        body = 'Buen provecho. Gracias por pedir con Pídetelo.';
        break;
      case 'cancelled':
        title = `❌ Pedido Cancelado ${orderNumber}`;
        body = 'Tu pedido ha sido cancelado. Puedes revisar los detalles en la app.';
        break;
    }

    // 1. Guardar en bandeja de notificaciones interna
    await this.create({
      title,
      body,
      type: 'order_status',
      data: { orderId: order.id, orderNumber, status: newStatus }
    });

    // 2. Enviar Push Remoto a los dispositivos del cliente
    if (customerId) {
      const tokens = this.getTokensForUser(customerId);
      if (tokens.length > 0) {
        await this.sendPushNotification({
          tokens,
          title,
          body,
          data: {
            type: 'order_status',
            orderId: String(order.id || ''),
            status: String(newStatus),
            orderNumber: String(orderNumber)
          }
        });
      }
    }
  }

  async notifyRiderAssigned(order: any, riderId: string) {
    if (!order || !riderId) return;
    const orderNumber = order.order_number || order.orderNumber || `#${(order.id || '').substring(0, 6)}`;
    const customer = order.customer_name || 'Cliente Pídetelo';
    const address = order.delivery_address || 'Dirección de Entrega';

    // 1. Push urgente al REPARTIDOR
    const riderTokens = this.getTokensForUser(riderId);
    if (riderTokens.length > 0) {
      await this.sendPushNotification({
        tokens: riderTokens,
        title: `🛵 ¡Nuevo Pedido Asignado! ${orderNumber}`,
        body: `Cliente: ${customer} | Destino: ${address}`,
        data: {
          type: 'order_assigned',
          orderId: String(order.id || ''),
          orderNumber: String(orderNumber),
          customerName: String(customer),
          address: String(address)
        }
      });
    }

    // 2. Push informativo al CLIENTE
    const customerId = order.user_id || order.customer_id || order.customerId;
    if (customerId) {
      const customerTokens = this.getTokensForUser(customerId);
      if (customerTokens.length > 0) {
        await this.sendPushNotification({
          tokens: customerTokens,
          title: `🛵 Repartidor Asignado ${orderNumber}`,
          body: 'Se ha asignado un repartidor a tu orden. Pronto estará en camino.',
          data: {
            type: 'rider_assigned',
            orderId: String(order.id || ''),
            orderNumber: String(orderNumber)
          }
        });
      }
    }
  }

  // --- MÉTODOS EXISTENTES PARA BANDEJA DE ENTRADA ---
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
