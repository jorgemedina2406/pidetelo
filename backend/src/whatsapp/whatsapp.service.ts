import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service.js';
import * as fs from 'fs';
import * as path from 'path';

export interface WhatsAppInstanceData {
  id: string;
  tenant_id: string;
  branch_id?: string;
  instance_name: string;
  phone_number?: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'qr_ready';
  qr_code?: string;
  greeting_message?: string;
  auto_reply_enabled: boolean;
  pause_duration_minutes: number;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly storageFilePath = path.join(process.cwd(), 'data', 'whatsapp_storage.json');
  private evolutionApiUrl: string;
  private evolutionApiKey: string;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    this.evolutionApiUrl = this.configService.get<string>('EVOLUTION_API_URL') || 'http://localhost:8080';
    this.evolutionApiKey = this.configService.get<string>('EVOLUTION_API_KEY') || 'pidetelo_secret_key';
    this.ensureStorageFile();
  }

  private ensureStorageFile() {
    try {
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(this.storageFilePath)) {
        fs.writeFileSync(this.storageFilePath, JSON.stringify({ instances: {}, conversations: {}, messages: [] }, null, 2));
      }
    } catch (_) {}
  }

  private getLocalStorage() {
    try {
      this.ensureStorageFile();
      return JSON.parse(fs.readFileSync(this.storageFilePath, 'utf-8'));
    } catch (_) {
      return { instances: {}, conversations: {}, messages: [] };
    }
  }

  private saveLocalStorage(data: any) {
    try {
      fs.writeFileSync(this.storageFilePath, JSON.stringify(data, null, 2));
    } catch (_) {}
  }

  // ==========================================
  // GESTIÓN DE INSTANCIAS & CÓDIGOS QR
  // ==========================================

  async getInstance(tenantId: string, branchId?: string): Promise<WhatsAppInstanceData> {
    const client = this.supabase.getClient();
    let query = client.from('whatsapp_instances').select('*').eq('tenant_id', tenantId);
    if (branchId) query = query.eq('branch_id', branchId);
    const { data, error } = await query.maybeSingle();

    if (data && !error) return data;

    // Fallback local o crear registro por defecto
    const local = this.getLocalStorage();
    const instanceKey = `${tenantId}_${branchId || 'main'}`;
    if (local.instances[instanceKey]) return local.instances[instanceKey];

    const newInst: WhatsAppInstanceData = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      branch_id: branchId,
      instance_name: `tenant_${tenantId.slice(0, 8)}_${branchId ? branchId.slice(0, 8) : 'main'}`,
      status: 'disconnected',
      auto_reply_enabled: true,
      pause_duration_minutes: 120,
      greeting_message: '¡Hola! 👋 Gracias por comunicarte con nosotros.',
    };

    try {
      await client.from('whatsapp_instances').insert(newInst);
    } catch (_) {
      local.instances[instanceKey] = newInst;
      this.saveLocalStorage(local);
    }
    return newInst;
  }

  async connectInstance(tenantId: string, branchId?: string): Promise<WhatsAppInstanceData> {
    const instance = await this.getInstance(tenantId, branchId);
    const instanceName = instance.instance_name;

    // 1. Intentar conectar con el Gateway Evolution API si está configurado
    let qrCodeBase64: string | null = null;
    let isConnected = false;

    try {
      const statusRes = await fetch(`${this.evolutionApiUrl}/instance/connectionState/${instanceName}`, {
        headers: { apikey: this.evolutionApiKey },
      });
      if (statusRes.ok) {
        const state = await statusRes.json();
        if (state?.instance?.state === 'open') {
          isConnected = true;
        }
      }
    } catch (_) {}

    if (!isConnected) {
      try {
        // Crear o solicitar QR a Evolution API
        const connectRes = await fetch(`${this.evolutionApiUrl}/instance/connect/${instanceName}`, {
          headers: { apikey: this.evolutionApiKey },
        });
        if (connectRes.ok) {
          const connectData = await connectRes.json();
          qrCodeBase64 = connectData.base64 || connectData.code || null;
        }
      } catch (_) {}
    }

    // Fallback: si el gateway no está activo aún en local, generar un QR demostrativo
    if (!qrCodeBase64 && !isConnected) {
      qrCodeBase64 = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=WAPP_PIDETELO_MULTI_TENANT_${instanceName}`;
    }

    const updated: WhatsAppInstanceData = {
      ...instance,
      status: isConnected ? 'connected' : 'qr_ready',
      qr_code: isConnected ? undefined : (qrCodeBase64 || undefined),
    };

    try {
      await this.supabase.getClient().from('whatsapp_instances').update({
        status: updated.status,
        qr_code: updated.qr_code,
        updated_at: new Date().toISOString(),
      }).eq('id', instance.id);
    } catch (_) {
      const local = this.getLocalStorage();
      const instanceKey = `${tenantId}_${branchId || 'main'}`;
      local.instances[instanceKey] = updated;
      this.saveLocalStorage(local);
    }

    return updated;
  }

  async disconnectInstance(tenantId: string, branchId?: string): Promise<WhatsAppInstanceData> {
    const instance = await this.getInstance(tenantId, branchId);

    try {
      await fetch(`${this.evolutionApiUrl}/instance/logout/${instance.instance_name}`, {
        method: 'DELETE',
        headers: { apikey: this.evolutionApiKey },
      });
    } catch (_) {}

    const updated: WhatsAppInstanceData = {
      ...instance,
      status: 'disconnected',
      qr_code: undefined,
      phone_number: undefined,
    };

    try {
      await this.supabase.getClient().from('whatsapp_instances').update({
        status: 'disconnected',
        qr_code: null,
        phone_number: null,
        updated_at: new Date().toISOString(),
      }).eq('id', instance.id);
    } catch (_) {
      const local = this.getLocalStorage();
      const instanceKey = `${tenantId}_${branchId || 'main'}`;
      local.instances[instanceKey] = updated;
      this.saveLocalStorage(local);
    }

    return updated;
  }

  async updateSettings(tenantId: string, settings: { greeting_message?: string; auto_reply_enabled?: boolean; pause_duration_minutes?: number }, branchId?: string) {
    const instance = await this.getInstance(tenantId, branchId);
    const updated = {
      ...instance,
      ...settings,
    };

    try {
      await this.supabase.getClient().from('whatsapp_instances').update({
        ...settings,
        updated_at: new Date().toISOString(),
      }).eq('id', instance.id);
    } catch (_) {
      const local = this.getLocalStorage();
      const instanceKey = `${tenantId}_${branchId || 'main'}`;
      local.instances[instanceKey] = updated;
      this.saveLocalStorage(local);
    }

    return updated;
  }

  // ==========================================
  // WEBHOOK & ASISTENTE INTELIGENTE (BOT)
  // ==========================================

  async handleWebhook(body: any) {
    const event = body.event || body.type;
    const instanceName = body.instance;

    // A. Actualización de estado de la conexión
    if (event === 'connection.update') {
      const state = body.data?.state;
      if (state === 'open') {
        const phone = body.data?.statusReason || body.data?.userJid?.split('@')[0] || '';
        await this.supabase.getClient().from('whatsapp_instances').update({
          status: 'connected',
          qr_code: null,
          phone_number: phone,
          updated_at: new Date().toISOString(),
        }).eq('instance_name', instanceName);
      } else if (state === 'close') {
        await this.supabase.getClient().from('whatsapp_instances').update({
          status: 'disconnected',
          updated_at: new Date().toISOString(),
        }).eq('instance_name', instanceName);
      }
      return { success: true };
    }

    // B. Recepción de mensajes (messages.upsert)
    if (event === 'messages.upsert' || event === 'messages.create') {
      const messageData = body.data;
      if (!messageData) return { success: true };

      const key = messageData.key || {};
      const fromMe = key.fromMe || false;
      const remoteJid = key.remoteJid || '';
      if (!remoteJid || remoteJid.includes('@g.us') || remoteJid === 'status@broadcast') {
        return { success: true }; // Ignorar grupos y estados de WhatsApp
      }

      const customerPhone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
      const rawText = messageData.message?.conversation ||
                      messageData.message?.extendedTextMessage?.text ||
                      messageData.message?.buttonsResponseMessage?.selectedButtonId ||
                      messageData.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
                      '';

      const pushName = messageData.pushName || `Cliente (+${customerPhone})`;

      // Buscar instancia asociada
      const { data: instance } = await this.supabase.getClient()
        .from('whatsapp_instances')
        .select('*, tenants(name, slug), branches(name, slug)')
        .eq('instance_name', instanceName)
        .maybeSingle();

      if (!instance) return { success: true };

      const tenantId = instance.tenant_id;
      const branchId = instance.branch_id;

      // Obtener o crear conversación
      let conversation = await this.getOrCreateConversation(tenantId, customerPhone, pushName, branchId);

      // Si el mensaje lo envió el propio operador desde su teléfono físico (fromMe: true)
      if (fromMe) {
        await this.saveMessage(conversation.id, tenantId, 'agent', rawText);
        // Pausar automáticamente el bot para que no interrumpa al operador
        const pauseMinutes = instance.pause_duration_minutes || 120;
        const pausedUntil = new Date(Date.now() + pauseMinutes * 60 * 1000).toISOString();
        await this.supabase.getClient().from('whatsapp_conversations').update({
          mode: 'human',
          paused_until: pausedUntil,
          last_message: rawText,
          last_message_at: new Date().toISOString(),
        }).eq('id', conversation.id);
        return { success: true };
      }

      // El mensaje viene del CLIENTE
      await this.saveMessage(conversation.id, tenantId, 'customer', rawText);

      // Verificar si el bot está activado globalmente en esta instancia
      if (!instance.auto_reply_enabled) {
        return { success: true };
      }

      // Verificar si la conversación está en pausa con un operador humano
      const now = new Date();
      const isPausedWithHuman = conversation.mode === 'human' && conversation.paused_until && new Date(conversation.paused_until) > now;

      if (isPausedWithHuman) {
        this.logger.log(`[WhatsAppBot] Conversación ${conversation.id} en modo HUMANO. Bot en pausa.`);
        return { success: true };
      }

      // Si el modo humano ya expiró, volver automáticamente a modo bot
      if (conversation.mode === 'human' && (!conversation.paused_until || new Date(conversation.paused_until) <= now)) {
        await this.supabase.getClient().from('whatsapp_conversations').update({
          mode: 'bot',
          paused_until: null,
        }).eq('id', conversation.id);
        conversation.mode = 'bot';
      }

      // Procesar respuesta del Bot según el texto del cliente
      await this.processBotResponse(instance, conversation, rawText, remoteJid);
    }

    return { success: true };
  }

  private async processBotResponse(instance: any, conversation: any, rawText: string, remoteJid: string) {
    const text = rawText.toLowerCase().trim();
    const tenantName = instance.tenants?.name || 'Nuestro Comercio';
    const tenantSlug = instance.tenants?.slug || 'menu';
    const branchSlug = instance.branches?.slug || '';
    const origin = this.configService.get<string>('FRONTEND_URL') || 'https://pidetelo.com';
    const storeLink = branchSlug ? `${origin}/t/${tenantSlug}?branch=${branchSlug}` : `${origin}/t/${tenantSlug}`;

    let reply = '';
    let shouldPauseHuman = false;

    // Opción 1: Pedir por la Web
    if (text === '1' || text.includes('web') || text.includes('menu') || text.includes('menú') || text.includes('pedir') || text.includes('catalogo')) {
      reply = `🍔 *Menú Oficial de ${tenantName}*\n\n` +
        `Accede a nuestro catálogo interactivo para armar tu pedido con fotos, precios en $ y Bs, y rastreo en vivo:\n\n` +
        `🌐 *Haz tu pedido aquí:*\n${storeLink}\n\n` +
        `Si necesitas comunicarte con una persona, responde *3*.`;
    }
    // Opción 2: Descargar App Móvil
    else if (text === '2' || text.includes('app') || text.includes('aplicacion') || text.includes('aplicación') || text.includes('descargar') || text.includes('apk') || text.includes('iphone')) {
      reply = `📲 *Descarga la App Móvil de Pídetelo*\n\n` +
        `Pide con 1 solo clic y rastrea al repartidor por GPS en tiempo real en tu mapa:\n\n` +
        `🤖 *Android:* ${origin}/descargar/android\n` +
        `🍏 *iOS (iPhone):* ${origin}/descargar/ios\n\n` +
        `¡También puedes pedir directamente en la web respondiendo *1*!`;
    }
    // Opción 3: Hablar con Operador Humano
    else if (text === '3' || text.includes('operador') || text.includes('persona') || text.includes('humano') || text.includes('asesor') || text.includes('atencion') || text.includes('ayuda')) {
      shouldPauseHuman = true;
      reply = `¡Listo! ⏳ Te estamos transfiriendo con un operador de *${tenantName}*.\n\n` +
        `Un momento por favor, te responderemos por este mismo chat en breve. 🙌`;
    }
    // Saludo inicial o mensaje no reconocido -> Menú de 3 Opciones
    else {
      reply = `¡Hola! 👋 Gracias por comunicarte con *${tenantName}*.\n\n` +
        `¿Cómo podemos ayudarte hoy? Responde con el número de tu opción:\n\n` +
        `1️⃣ *Pedir por la Web:* Menú digital sin esperas.\n` +
        `2️⃣ *Descargar la App Móvil:* Para Android y iPhone.\n` +
        `3️⃣ *Hablar con una persona:* Atención al cliente.\n\n` +
        `_Escribe 1, 2 o 3 para continuar._`;
    }

    // Enviar la respuesta vía WhatsApp
    await this.sendExternalMessage(instance.instance_name, remoteJid, reply);
    await this.saveMessage(conversation.id, instance.tenant_id, 'bot', reply);

    if (shouldPauseHuman) {
      const pauseMinutes = instance.pause_duration_minutes || 120;
      const pausedUntil = new Date(Date.now() + pauseMinutes * 60 * 1000).toISOString();
      await this.supabase.getClient().from('whatsapp_conversations').update({
        mode: 'human',
        paused_until: pausedUntil,
        last_message: reply,
        last_message_at: new Date().toISOString(),
      }).eq('id', conversation.id);
    }
  }

  // ==========================================
  // BANDEJA DE MENSAJERÍA EN VIVO (LIVE CHAT)
  // ==========================================

  async getConversations(tenantId: string) {
    const { data, error } = await this.supabase.getClient()
      .from('whatsapp_conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('last_message_at', { ascending: false });

    if (data && !error) return data;

    const local = this.getLocalStorage();
    return Object.values(local.conversations).filter((c: any) => c.tenant_id === tenantId);
  }

  async getMessages(conversationId: string) {
    // Resetear contador de no leídos
    await this.supabase.getClient()
      .from('whatsapp_conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId);

    const { data, error } = await this.supabase.getClient()
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (data && !error) return data;

    const local = this.getLocalStorage();
    return local.messages.filter((m: any) => m.conversation_id === conversationId);
  }

  async sendAgentMessage(conversationId: string, text: string) {
    const { data: conv } = await this.supabase.getClient()
      .from('whatsapp_conversations')
      .select('*, whatsapp_instances(*)')
      .eq('id', conversationId)
      .single();

    if (!conv) throw new InternalServerErrorException('Conversación no encontrada');

    const instanceName = conv.whatsapp_instances?.instance_name || `tenant_${conv.tenant_id.slice(0, 8)}_main`;
    const remoteJid = `${conv.customer_phone}@s.whatsapp.net`;

    // 1. Enviar mensaje por el Gateway
    await this.sendExternalMessage(instanceName, remoteJid, text);

    // 2. Guardar mensaje
    const msg = await this.saveMessage(conversationId, conv.tenant_id, 'agent', text);

    // 3. Pausar bot por 2 horas para que el operador atienda libremente
    const pausedUntil = new Date(Date.now() + 120 * 60 * 1000).toISOString();
    await this.supabase.getClient().from('whatsapp_conversations').update({
      mode: 'human',
      paused_until: pausedUntil,
      last_message: text,
      last_message_at: new Date().toISOString(),
    }).eq('id', conversationId);

    return msg;
  }

  async toggleConversationMode(conversationId: string, mode: 'bot' | 'human', minutes: number = 120) {
    const pausedUntil = mode === 'human' ? new Date(Date.now() + minutes * 60 * 1000).toISOString() : null;

    const { data, error } = await this.supabase.getClient()
      .from('whatsapp_conversations')
      .update({
        mode,
        paused_until: pausedUntil,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  // ==========================================
  // HELPERS INTERNOS
  // ==========================================

  private async getOrCreateConversation(tenantId: string, phone: string, name: string, branchId?: string) {
    const client = this.supabase.getClient();
    const { data: existing } = await client
      .from('whatsapp_conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_phone', phone)
      .maybeSingle();

    if (existing) {
      if (name && existing.customer_name !== name) {
        await client.from('whatsapp_conversations').update({ customer_name: name }).eq('id', existing.id);
      }
      return existing;
    }

    const newConv = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      branch_id: branchId || null,
      customer_phone: phone,
      customer_name: name,
      mode: 'bot',
      unread_count: 1,
      last_message_at: new Date().toISOString(),
    };

    const { data: created, error } = await client.from('whatsapp_conversations').insert(newConv).select().single();
    if (created && !error) return created;

    return newConv;
  }

  private async saveMessage(conversationId: string, tenantId: string, sender: 'customer' | 'bot' | 'agent', text: string) {
    const msg = {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      tenant_id: tenantId,
      sender,
      message_text: text,
      status: 'delivered',
      created_at: new Date().toISOString(),
    };

    try {
      await this.supabase.getClient().from('whatsapp_messages').insert(msg);
      await this.supabase.getClient().from('whatsapp_conversations').update({
        last_message: text,
        last_message_at: new Date().toISOString(),
        ...(sender === 'customer' ? { unread_count: 1 } : {}),
      }).eq('id', conversationId);
    } catch (_) {
      const local = this.getLocalStorage();
      local.messages.push(msg);
      this.saveLocalStorage(local);
    }

    return msg;
  }

  private async sendExternalMessage(instanceName: string, remoteJid: string, text: string) {
    try {
      const res = await fetch(`${this.evolutionApiUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.evolutionApiKey,
        },
        body: JSON.stringify({
          number: remoteJid,
          options: {
            delay: 1200,
            presence: 'composing',
          },
          textMessage: {
            text,
          },
        }),
      });
      if (!res.ok) {
        this.logger.warn(`[EvolutionApi] Mensaje no entregado a ${remoteJid}: HTTP ${res.status}`);
      }
    } catch (err: any) {
      this.logger.warn(`[EvolutionApi] Fallback de envío a ${remoteJid}: ${err.message}`);
    }
  }
}
