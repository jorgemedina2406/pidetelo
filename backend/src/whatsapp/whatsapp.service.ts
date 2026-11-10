import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service.js';
import { PlansService } from '../plans/plans.service.js';
import * as fs from 'fs';
import * as path from 'path';
import makeWASocketPkg, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';

const makeWASocket = (makeWASocketPkg as any).default || makeWASocketPkg;

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
export class WhatsAppService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly storageFilePath = path.join(process.cwd(), 'data', 'whatsapp_storage.json');
  private readonly sessionsDir = path.join(process.cwd(), 'data', 'whatsapp_sessions');
  private readonly activeSockets = new Map<string, any>();
  private readonly connectingInstances = new Set<string>();
  private readonly botSentMessageIds = new Set<string>();
  private readonly processedMessageIds = new Set<string>();
  private readonly recentBotTexts = new Set<string>();
  private readonly lidToPhoneMap = new Map<string, string>();

  private evolutionApiUrl: string;
  private evolutionApiKey: string;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
    private readonly plansService: PlansService,
  ) {
    this.evolutionApiUrl = this.configService.get<string>('EVOLUTION_API_URL') || 'http://localhost:8080';
    this.evolutionApiKey = this.configService.get<string>('EVOLUTION_API_KEY') || 'pidetelo_secret_key';
    this.ensureStorageFile();
  }

  async onModuleInit() {
    this.ensureStorageFile();
    setTimeout(() => {
      this.restoreExistingSessions().catch((err) => {
        this.logger.error('Error restaurando sesiones previas de WhatsApp:', err);
      });
    }, 2000);
  }

  private ensureStorageFile() {
    try {
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(this.storageFilePath)) {
        fs.writeFileSync(this.storageFilePath, JSON.stringify({ instances: {}, conversations: {}, messages: [] }, null, 2));
      }
      if (!fs.existsSync(this.sessionsDir)) {
        fs.mkdirSync(this.sessionsDir, { recursive: true });
      }
    } catch (_) { }
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
    } catch (_) { }
  }

  private async restoreExistingSessions() {
    try {
      if (!fs.existsSync(this.sessionsDir)) return;
      const sessionFolders = fs.readdirSync(this.sessionsDir);
      for (const folder of sessionFolders) {
        const credsPath = path.join(this.sessionsDir, folder, 'creds.json');
        if (fs.existsSync(credsPath)) {
          this.logger.log(`Restaurando sesión existente de WhatsApp para: ${folder}`);
          const { data: inst } = await this.supabase.getClient()
            .from('whatsapp_instances')
            .select('*')
            .eq('instance_name', folder)
            .maybeSingle();

          if (inst) {
            this.startBaileysSocket(inst).catch((err) => {
              this.logger.error(`Error autoreconectando ${folder}:`, err);
            });
          }
        }
      }
    } catch (err) {
      this.logger.warn('Error escaneando carpeta de sesiones:', err);
    }
  }

  // ==========================================
  // GESTIÓN DE INSTANCIAS & CONEXIÓN
  // ==========================================

  async getInstance(tenantId: string, branchId?: string): Promise<WhatsAppInstanceData> {
    const cleanBranchId = branchId || null;
    let query = this.supabase.getClient()
      .from('whatsapp_instances')
      .select('*')
      .eq('tenant_id', tenantId);

    if (cleanBranchId) {
      query = query.eq('branch_id', cleanBranchId);
    } else {
      query = query.is('branch_id', null);
    }

    const { data: existing, error } = await query.maybeSingle();
    if (existing && !error) {
      return existing;
    }

    const instanceName = `tenant_${tenantId.slice(0, 8)}_${cleanBranchId ? cleanBranchId.slice(0, 8) : 'main'}`;
    const newInstance: WhatsAppInstanceData = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      branch_id: cleanBranchId || undefined,
      instance_name: instanceName,
      status: 'disconnected',
      auto_reply_enabled: true,
      pause_duration_minutes: 120,
      greeting_message: '¡Hola! 👋 Gracias por comunicarte con nosotros.',
    };

    const { data: created, error: insertErr } = await this.supabase.getClient()
      .from('whatsapp_instances')
      .insert(newInstance)
      .select()
      .single();

    if (created && !insertErr) {
      return created;
    }

    const local = this.getLocalStorage();
    const key = `${tenantId}_${cleanBranchId || 'main'}`;
    if (!local.instances[key]) {
      local.instances[key] = newInstance;
      this.saveLocalStorage(local);
    }
    return local.instances[key];
  }

  async connectInstance(tenantId: string, branchId?: string): Promise<WhatsAppInstanceData> {
    // Validar si el plan de suscripción incluye Bot de WhatsApp
    await this.plansService.checkLimit(tenantId, 'whatsapp');

    const instance = await this.getInstance(tenantId, branchId);
    const instanceName = instance.instance_name;

    const activeSock = this.getSocketForInstance(instanceName, tenantId);
    if (activeSock?.user) {
      const phoneNumber = activeSock.user.id?.split(':')[0] || activeSock.user.id?.split('@')[0];
      const updated: WhatsAppInstanceData = {
        ...instance,
        status: 'connected',
        phone_number: phoneNumber,
        qr_code: undefined,
      };
      await this.updateInstanceStatus(instance.id, updated);
      return updated;
    }

    if (!this.connectingInstances.has(instanceName)) {
      this.startBaileysSocket(instance).catch((err) => {
        this.logger.error(`Error iniciando socket Baileys para ${instanceName}:`, err);
      });
    }

    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const fresh = await this.getInstance(tenantId, branchId);
      if (fresh.qr_code || fresh.status === 'connected') {
        return fresh;
      }
    }

    return await this.getInstance(tenantId, branchId);
  }

  private getSocketForInstance(instanceName: string, tenantId?: string): any {
    if (this.activeSockets.has(instanceName)) {
      return this.activeSockets.get(instanceName);
    }
    for (const [key, sock] of this.activeSockets.entries()) {
      if (key.includes(instanceName)) return sock;
      if (tenantId && key.includes(tenantId.slice(0, 8))) return sock;
    }
    return null;
  }

  private async startBaileysSocket(instance: WhatsAppInstanceData) {
    const instanceName = instance.instance_name;
    if (this.connectingInstances.has(instanceName)) return;

    this.connectingInstances.add(instanceName);
    const sessionDir = path.join(this.sessionsDir, instanceName);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    this.logger.log(`[Baileys] Inicializando cliente nativo WhatsApp para ${instanceName}...`);

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
      const { version } = await fetchLatestBaileysVersion();

      const baileysLogger = pino({ level: 'silent' });

      const sock = makeWASocket({
        version,
        auth: state,
        logger: baileysLogger,
        printQRInTerminal: false,
        browser: ['PideloFacil Delivery', 'Chrome', '124.0.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
      });

      this.activeSockets.set(instanceName, sock);

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrBase64 = await QRCode.toDataURL(qr, {
              margin: 2,
              width: 320,
              color: { dark: '#111827', light: '#ffffff' },
            });

            await this.updateInstanceStatus(instance.id, {
              status: 'qr_ready',
              qr_code: qrBase64,
            });
            this.logger.log(`[Baileys] Código QR generado exitosamente para ${instanceName}`);
          } catch (qrErr) {
            this.logger.error(`[Baileys] Error generando DataURL de QR para ${instanceName}:`, qrErr);
          }
        }

        if (connection === 'open') {
          this.connectingInstances.delete(instanceName);
          const rawId = sock.user?.id || '';
          const phone = rawId.split(':')[0] || rawId.split('@')[0] || '';

          await this.updateInstanceStatus(instance.id, {
            status: 'connected',
            phone_number: phone,
            qr_code: undefined,
          });
          this.logger.log(`[Baileys] ¡Conexión establecida exitosamente para ${instanceName}! Teléfono: +${phone}`);
        }

        if (connection === 'close') {
          this.connectingInstances.delete(instanceName);
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.logger.warn(`[Baileys] Conexión cerrada para ${instanceName}. Código: ${statusCode}. Reconectar: ${shouldReconnect}`);

          if (!shouldReconnect) {
            this.activeSockets.delete(instanceName);
            try {
              if (fs.existsSync(sessionDir)) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
              }
            } catch (_) { }

            await this.updateInstanceStatus(instance.id, {
              status: 'disconnected',
              phone_number: undefined,
              qr_code: undefined,
            });
          } else {
            setTimeout(() => {
              this.startBaileysSocket(instance).catch(() => { });
            }, 3500);
          }
        }
      });

      // Escuchar mensajes entrantes (evitando duplicados con processedMessageIds)
      sock.ev.on('messages.upsert', async (m: any) => {
        for (const msg of m.messages || []) {
          const msgId = msg.key?.id;
          if (msgId) {
            if (this.processedMessageIds.has(msgId)) {
              continue; // Ignorar duplicados de Baileys notify/append
            }
            this.processedMessageIds.add(msgId);
            if (this.processedMessageIds.size > 2000) {
              const first = this.processedMessageIds.values().next().value;
              if (first) this.processedMessageIds.delete(first);
            }
          }

          if (msg.key?.fromMe) {
            // Si el mensaje fue enviado por nuestro bot / backend, ignorar eco para evitar bucles o auto-pausas
            if (msgId && (this.botSentMessageIds.has(msgId) || msgId.startsWith('BOT_'))) {
              this.botSentMessageIds.delete(msgId);
              continue;
            }
            const rawText = this.extractMessageText(msg);
            if (rawText && this.recentBotTexts.has(rawText.trim())) {
              continue;
            }
            if (msg.message) {
              await this.handleMerchantPhoneMessage(instance, sock, msg);
            }
          } else if (!msg.key?.fromMe && msg.message) {
            await this.handleBaileysIncomingMessage(instance, sock, msg);
          }
        }
      });

    } catch (err: any) {
      this.connectingInstances.delete(instanceName);
      this.logger.error(`Error en startBaileysSocket para ${instanceName}:`, err);
    }
  }

  private async updateInstanceStatus(id: string, partial: Partial<WhatsAppInstanceData>) {
    try {
      await this.supabase.getClient().from('whatsapp_instances').update({
        ...partial,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
    } catch (_) {
      const local = this.getLocalStorage();
      for (const k of Object.keys(local.instances)) {
        if (local.instances[k].id === id) {
          local.instances[k] = { ...local.instances[k], ...partial };
        }
      }
      this.saveLocalStorage(local);
    }
  }

  async disconnectInstance(tenantId: string, branchId?: string): Promise<WhatsAppInstanceData> {
    const instance = await this.getInstance(tenantId, branchId);
    const instanceName = instance.instance_name;

    const sock = this.activeSockets.get(instanceName);
    if (sock) {
      try {
        await sock.logout();
      } catch (_) { }
      this.activeSockets.delete(instanceName);
    }

    const sessionPath = path.join(this.sessionsDir, instanceName);
    try {
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
    } catch (_) { }

    const updated: WhatsAppInstanceData = {
      ...instance,
      status: 'disconnected',
      qr_code: undefined,
      phone_number: undefined,
    };

    await this.updateInstanceStatus(instance.id, updated);
    return updated;
  }

  async updateSettings(tenantId: string, settings: { greeting_message?: string; auto_reply_enabled?: boolean; pause_duration_minutes?: number }, branchId?: string) {
    if (settings.auto_reply_enabled) {
      await this.plansService.checkLimit(tenantId, 'whatsapp');
    }
    const instance = await this.getInstance(tenantId, branchId);
    const updated = {
      ...instance,
      ...settings,
    };

    await this.updateInstanceStatus(instance.id, updated);
    return updated;
  }

  // ==========================================
  // RESOLUCIÓN DE IDENTIDAD & TELÉFONO REAL
  // ==========================================

  private extractMessageText(msg: any): string {
    const m =
      msg.message?.ephemeralMessage?.message ||
      msg.message?.viewOnceMessage?.message ||
      msg.message?.viewOnceMessageV2?.message ||
      msg.message?.documentWithCaptionMessage?.message ||
      msg.message;

    return (
      m?.conversation ||
      m?.extendedTextMessage?.text ||
      m?.buttonsResponseMessage?.selectedButtonId ||
      m?.listResponseMessage?.singleSelectReply?.selectedRowId ||
      m?.templateButtonReplyMessage?.selectedId ||
      m?.imageMessage?.caption ||
      m?.videoMessage?.caption ||
      ''
    ).trim();
  }

  /**
   * Resuelve el número de teléfono real del cliente (incluso si WhatsApp envía un @lid en modo Multi-Device)
   */
  private async resolveRealCustomerPhone(sock: any, instanceName: string, remoteJid: string, msg?: any): Promise<string> {
    if (!remoteJid) return '';

    // 1. Si no es un @lid, es directamente el número de teléfono
    if (!remoteJid.endsWith('@lid')) {
      return remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');
    }

    const lidUser = remoteJid.split('@')[0];

    // 2. Si el mensaje trae participantPn o senderPn nativo de Baileys
    const pnFromMsg = msg?.key?.participantPn || msg?.senderPn || msg?.key?.remoteJidAlt;
    if (pnFromMsg) {
      const clean = pnFromMsg.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');
      if (clean && clean.length >= 7 && clean.length <= 15) {
        this.lidToPhoneMap.set(lidUser, clean);
        return clean;
      }
    }

    // 3. Consultar la caché en memoria de nuestro servicio
    if (this.lidToPhoneMap.has(lidUser)) {
      return this.lidToPhoneMap.get(lidUser)!;
    }

    // 4. Consultar el repositorio signalRepository.lidMapping de Baileys
    try {
      if (sock?.signalRepository?.lidMapping?.getPNForLID) {
        const pn = await sock.signalRepository.lidMapping.getPNForLID(remoteJid);
        if (pn) {
          const clean = pn.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');
          if (clean && clean.length >= 7 && clean.length <= 15) {
            this.lidToPhoneMap.set(lidUser, clean);
            return clean;
          }
        }
      }
    } catch (_) { }

    // 5. Leer directamente el mapeo guardado en disco por Baileys: lid-mapping-{lidUser}_reverse.json
    try {
      const sessionDir = path.join(this.sessionsDir, instanceName);
      const reverseFile = path.join(sessionDir, `lid-mapping-${lidUser}_reverse.json`);
      if (fs.existsSync(reverseFile)) {
        const raw = fs.readFileSync(reverseFile, 'utf8').trim();
        const clean = raw.replace(/"/g, '').replace(/\D/g, '');
        if (clean && clean.length >= 7 && clean.length <= 15) {
          this.lidToPhoneMap.set(lidUser, clean);
          return clean;
        }
      }
    } catch (_) { }

    // Fallback: Si no se pudo resolver el número real, retornar el lidUser
    return lidUser.replace(/\D/g, '');
  }

  // ==========================================
  // RECEPCIÓN DE MENSAJES & BOT AUTOMATIZADO
  // ==========================================

  async handleWebhook(body: any) {
    const event = body.event || body.type;
    const instanceName = body.instance;

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
      }
      return { success: true };
    }

    if (event === 'messages.upsert' || event === 'messages.create') {
      const messageData = body.data;
      if (!messageData) return { success: true };
      const remoteJid = messageData.key?.remoteJid || '';
      if (!remoteJid || remoteJid.includes('@g.us')) return { success: true };

      const { data: instance } = await this.supabase.getClient()
        .from('whatsapp_instances')
        .select('*')
        .eq('instance_name', instanceName)
        .maybeSingle();

      if (instance) {
        const sock = this.getSocketForInstance(instanceName, instance.tenant_id);
        if (!messageData.key?.fromMe) {
          await this.handleBaileysIncomingMessage(instance, sock, messageData);
        } else {
          await this.handleMerchantPhoneMessage(instance, sock, messageData);
        }
      }
    }
    return { success: true };
  }

  private async handleBaileysIncomingMessage(instance: WhatsAppInstanceData, sock: any, msg: any) {
    const fromJid = msg.key?.remoteJid || '';
    if (!fromJid || fromJid.endsWith('@g.us') || fromJid === 'status@broadcast') {
      return;
    }

    // Resolver el número de teléfono real del cliente (incluso si WhatsApp envió @lid)
    const customerPhone = await this.resolveRealCustomerPhone(sock, instance.instance_name, fromJid, msg);
    if (!customerPhone) return;

    const pushName = msg.pushName || `Cliente (+${customerPhone})`;
    const rawText = this.extractMessageText(msg);

    const tenantId = instance.tenant_id;
    const branchId = instance.branch_id;

    let conversation = await this.getOrCreateConversation(tenantId, customerPhone, pushName, branchId);
    await this.saveMessage(conversation.id, tenantId, 'customer', rawText);

    const { data: tenant } = await this.supabase.getClient()
      .from('tenants')
      .select('name, slug')
      .eq('id', tenantId)
      .maybeSingle();

    const tenantSlug = tenant?.slug || 'tienda';
    const tenantName = tenant?.name || 'Nuestro Comercio';

    const cleanedText = rawText.trim().toLowerCase();
    this.logger.log(`[Baileys] Mensaje recibido de ${customerPhone} (${fromJid}): "${rawText}" (limpio: "${cleanedText}")`);

    // ==========================================
    // EVALUACIÓN DE OPCIONES
    // ==========================================

    // OPCIÓN 3: HABLAR CON UN OPERADOR
    if (
      cleanedText === '3' ||
      cleanedText.includes('operador') ||
      cleanedText.includes('humano') ||
      cleanedText.includes('persona') ||
      cleanedText.includes('asesor') ||
      cleanedText.includes('ayuda')
    ) {
      const pauseMinutes = instance.pause_duration_minutes || 120;
      const pausedUntil = new Date(Date.now() + pauseMinutes * 60 * 1000).toISOString();

      await this.updateConversationMode(conversation.id, 'human', pausedUntil);
      conversation.mode = 'human';
      conversation.paused_until = pausedUntil;

      const reply = `👤 *¡Entendido! Te hemos transferido con un operador humano.*\n\nUn integrante de nuestro equipo te atenderá por este mismo chat en breve. He pausado mis respuestas automáticas para que puedan conversar sin interrupciones.\n\n_(Si deseas volver al menú automático en cualquier momento, responde con la palabra *MENU* o *BOT*)_`;
      await this.sendExternalMessage(instance.instance_name, customerPhone, reply, tenantId);
      await this.saveMessage(conversation.id, tenantId, 'bot', reply);
      return;
    }

    // REACTIVACIÓN EXPLÍCITA DEL BOT
    if (cleanedText === 'menu' || cleanedText === 'bot' || cleanedText === 'inicio' || cleanedText === '#') {
      await this.updateConversationMode(conversation.id, 'bot', null);
      conversation.mode = 'bot';
      conversation.paused_until = null;
    }

    // SI ESTÁ EN MODO HUMANO ACTIVO (Pausado para operador)
    if (conversation.mode === 'human' && conversation.paused_until) {
      const now = new Date();
      const pausedUntilDate = new Date(conversation.paused_until);
      if (now < pausedUntilDate) {
        this.logger.log(`[Baileys] Bot en silencio para ${customerPhone} porque está en atención humana hasta ${conversation.paused_until}`);
        return; // Guardar silencio, está atendiendo el operador
      } else {
        await this.updateConversationMode(conversation.id, 'bot', null);
        conversation.mode = 'bot';
      }
    }

    // OPCIÓN 1: PEDIDO WEB
    if (cleanedText === '1' || cleanedText.includes('web') || cleanedText.includes('catalogo') || cleanedText.includes('menú') || cleanedText.includes('menu') || cleanedText.includes('tienda') || cleanedText.includes('pedir')) {
      const webUrl = `https://pidetelo.com/t/${tenantSlug}${branchId ? `?branch=${branchId}` : ''}`;
      const reply = `🛒 *¡Excelente elección!*\n\nPuedes ver todo nuestro menú y hacer tu pedido directamente en línea con entrega a domicilio o retiro aquí:\n👉 ${webUrl}\n\n_Si deseas hablar con una persona, responde *3*._`;
      await this.sendExternalMessage(instance.instance_name, customerPhone, reply, tenantId);
      await this.saveMessage(conversation.id, tenantId, 'bot', reply);
      return;
    }

    // OPCIÓN 2: DESCARGAR APP MÓVIL
    if (cleanedText === '2' || cleanedText.includes('app') || cleanedText.includes('descargar') || cleanedText.includes('aplicacion') || cleanedText.includes('apk') || cleanedText.includes('ipa')) {
      const reply = `📱 *¡Descarga la App Móvil de ${tenantName}!* 🚀\n\nDisfruta de promociones exclusivas, cupones de descuento y seguimiento en vivo por GPS de tu motorizado:\n\n🤖 *Android (APK Directo):*\nhttps://pidetelo.com/descargas/app-cliente.apk\n\n🍏 *iOS (iPhone):*\nhttps://pidetelo.com/descargas/app-cliente.ipa\n\n_O haz tu pedido directo en la web respondiendo *1*._`;
      await this.sendExternalMessage(instance.instance_name, customerPhone, reply, tenantId);
      await this.saveMessage(conversation.id, tenantId, 'bot', reply);
      return;
    }

    // MENÚ PRINCIPAL POR DEFECTO
    const greeting = instance.greeting_message || `¡Hola! 👋 Gracias por comunicarte con *${tenantName}*.`;
    const webUrl = `https://pidetelo.com/t/${tenantSlug}${branchId ? `?branch=${branchId}` : ''}`;

    const defaultMenu = `${greeting}\n\n*Por favor, responde con el número de la opción que prefieras:*\n\n1️⃣ 🌐 *Pedir por la Tienda Web*\n👉 ${webUrl}\n\n2️⃣ 📱 *Descargar la App Móvil*\n👉 Promociones, cupones y GPS en vivo.\n\n3️⃣ 👤 *Hablar con un Operador*\n👉 Un miembro de nuestro equipo te responderá aquí directamente.`;

    await this.sendExternalMessage(instance.instance_name, customerPhone, defaultMenu, tenantId);
    await this.saveMessage(conversation.id, tenantId, 'bot', defaultMenu);
  }

  private async handleMerchantPhoneMessage(instance: WhatsAppInstanceData, sock: any, msg: any) {
    const toJid = msg.key?.remoteJid || '';
    if (!toJid || toJid.endsWith('@g.us') || toJid === 'status@broadcast') return;

    const customerPhone = await this.resolveRealCustomerPhone(sock, instance.instance_name, toJid, msg);
    if (!customerPhone) return;

    const rawText = this.extractMessageText(msg);
    if (!rawText) return;

    // Si coincide con texto enviado recientemente por el bot, ignorar eco
    if (this.recentBotTexts.has(rawText.trim())) return;

    const tenantId = instance.tenant_id;
    const branchId = instance.branch_id;

    const conv = await this.getOrCreateConversation(tenantId, customerPhone, `Cliente (+${customerPhone})`, branchId);
    await this.saveMessage(conv.id, tenantId, 'agent', rawText);

    // Pausar el bot para este cliente porque el operador le escribió manualmente desde su teléfono
    const pauseMinutes = instance.pause_duration_minutes || 120;
    const pausedUntil = new Date(Date.now() + pauseMinutes * 60 * 1000).toISOString();
    await this.updateConversationMode(conv.id, 'human', pausedUntil);
  }

  // ==========================================
  // OPERACIONES DE CHAT EN VIVO (PANEL COMERCIO)
  // ==========================================

  async getConversations(tenantId: string, branchId?: string) {
    let query = this.supabase.getClient()
      .from('whatsapp_conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('last_message_at', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (data && !error) return data;

    const local = this.getLocalStorage();
    return Object.values(local.conversations || {}).filter((c: any) => c.tenant_id === tenantId);
  }

  async getMessages(conversationId: string) {
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
    let conv: any = null;
    const { data } = await this.supabase.getClient()
      .from('whatsapp_conversations')
      .select('*')
      .eq('id', conversationId)
      .maybeSingle();

    if (data) {
      conv = data;
    } else {
      const local = this.getLocalStorage();
      conv = local.conversations[conversationId] || Object.values(local.conversations).find((c: any) => c.id === conversationId);
    }

    if (!conv) {
      throw new InternalServerErrorException('Conversación no encontrada');
    }

    const instance = await this.getInstance(conv.tenant_id, conv.branch_id);
    const instanceName = instance.instance_name;

    // 1. Enviar mensaje por Baileys / Gateway al teléfono real del cliente
    await this.sendExternalMessage(instanceName, conv.customer_phone, text, conv.tenant_id);

    // 2. Guardar mensaje como enviado por el agente humano
    const msg = await this.saveMessage(conversationId, conv.tenant_id, 'agent', text);

    // 3. Pausar bot por el tiempo configurado para que el operador atienda libremente
    const pauseMinutes = instance.pause_duration_minutes || 120;
    const pausedUntil = new Date(Date.now() + pauseMinutes * 60 * 1000).toISOString();
    await this.updateConversationMode(conversationId, 'human', pausedUntil);

    return msg;
  }

  async resumeAllBots(tenantId: string) {
    try {
      await this.supabase.getClient()
        .from('whatsapp_conversations')
        .update({
          mode: 'bot',
          paused_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId);
    } catch (_) {
      const local = this.getLocalStorage();
      for (const k of Object.keys(local.conversations)) {
        if (local.conversations[k].tenant_id === tenantId) {
          local.conversations[k].mode = 'bot';
          local.conversations[k].paused_until = null;
        }
      }
      this.saveLocalStorage(local);
    }
    return { success: true, message: 'Bot activado para todas las conversaciones' };
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

    if (error) {
      await this.updateConversationMode(conversationId, mode, pausedUntil);
      return { id: conversationId, mode, paused_until: pausedUntil };
    }
    return data;
  }

  // ==========================================
  // HELPERS INTERNOS
  // ==========================================

  private async updateConversationMode(conversationId: string, mode: 'bot' | 'human', pausedUntil: string | null) {
    try {
      await this.supabase.getClient().from('whatsapp_conversations').update({
        mode,
        paused_until: pausedUntil,
        updated_at: new Date().toISOString(),
      }).eq('id', conversationId);
    } catch (_) {
      const local = this.getLocalStorage();
      if (local.conversations[conversationId]) {
        local.conversations[conversationId].mode = mode;
        local.conversations[conversationId].paused_until = pausedUntil;
        this.saveLocalStorage(local);
      }
    }
  }

  private async getOrCreateConversation(tenantId: string, phone: string, name: string, branchId?: string) {
    const client = this.supabase.getClient();
    const cleanPhone = phone.replace(/\D/g, '');
    const { data: existing } = await client
      .from('whatsapp_conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_phone', cleanPhone)
      .maybeSingle();

    if (existing) {
      if (name && existing.customer_name !== name && !existing.customer_name?.startsWith('Cliente (+')) {
        await client.from('whatsapp_conversations').update({ customer_name: name }).eq('id', existing.id);
      }
      return existing;
    }

    const newConv = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      branch_id: branchId || null,
      customer_phone: cleanPhone,
      customer_name: name,
      mode: 'bot',
      unread_count: 1,
      last_message_at: new Date().toISOString(),
    };

    const { data: created, error } = await client.from('whatsapp_conversations').insert(newConv).select().single();
    if (created && !error) return created;

    const local = this.getLocalStorage();
    local.conversations[newConv.id] = newConv;
    this.saveLocalStorage(local);

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

  private async sendExternalMessage(instanceName: string, targetJidOrPhone: string, text: string, tenantId?: string) {
    let cleanDigits = targetJidOrPhone.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');

    // Si nos pasaron un JID con @lid o un identificador de longitud anormal, resolver al teléfono real
    if (targetJidOrPhone.includes('@lid') || (cleanDigits.length > 14 && this.lidToPhoneMap.has(cleanDigits))) {
      const sock = this.getSocketForInstance(instanceName, tenantId);
      cleanDigits = await this.resolveRealCustomerPhone(sock, instanceName, targetJidOrPhone.includes('@lid') ? targetJidOrPhone : `${cleanDigits}@lid`);
    }

    // El destino en WhatsApp siempre debe ser {telefono_real}@s.whatsapp.net
    const targetJid = `${cleanDigits}@s.whatsapp.net`;

    // 1. Enviar directamente mediante el socket Baileys activo
    const sock = this.getSocketForInstance(instanceName, tenantId);
    if (sock) {
      try {
        const customMsgId = 'BOT_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9).toUpperCase();
        this.botSentMessageIds.add(customMsgId);
        this.recentBotTexts.add(text.trim());
        setTimeout(() => this.recentBotTexts.delete(text.trim()), 60000);

        this.logger.log(`[Baileys] Enviando mensaje a ${targetJid} (ID: ${customMsgId}): "${text.slice(0, 40)}..."`);
        const sent = await sock.sendMessage(targetJid, { text }, { messageId: customMsgId });
        if (sent?.key?.id) {
          this.botSentMessageIds.add(sent.key.id);
        }
        this.logger.log(`[Baileys] ¡Mensaje enviado exitosamente a ${targetJid}!`);
        return;
      } catch (err: any) {
        this.logger.warn(`[Baileys] Error enviando socket a ${targetJid}: ${err.message}`);
      }
    } else {
      this.logger.warn(`[Baileys] No se encontró socket activo para ${instanceName} / ${tenantId}`);
    }

    // 2. Fallback a Evolution API si estuviera activo
    try {
      await fetch(`${this.evolutionApiUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.evolutionApiKey,
        },
        body: JSON.stringify({
          number: targetJid,
          options: { delay: 1200, presence: 'composing' },
          textMessage: { text },
        }),
      });
    } catch (_) { }
  }
}
