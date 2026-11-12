import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import * as fs from 'fs';
import * as path from 'path';
import nodemailer from 'nodemailer';

export interface SupportTicket {
  id: string;
  tenant_id: string;
  tenant_name: string;
  branch_name?: string;
  subject: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_type: 'merchant' | 'superadmin';
  sender_name: string;
  message: string;
  created_at: string;
}

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);
  private readonly storageFilePath = path.resolve(process.cwd(), 'data/support_data.json');
  private readonly leadsFilePath = path.resolve(process.cwd(), 'data/leads.json');

  constructor(private readonly supabase: SupabaseService) {
    this.ensureLocalStorage();
  }

  async saveLead(data: {
    name: string;
    email: string;
    phone: string;
    store: string;
    city?: string;
    message?: string;
  }) {
    const lead = {
      id: crypto.randomUUID(),
      ...data,
      created_at: new Date().toISOString()
    };

    try {
      let leads: any[] = [];
      if (fs.existsSync(this.leadsFilePath)) {
        leads = JSON.parse(fs.readFileSync(this.leadsFilePath, 'utf8'));
      }
      leads.unshift(lead);
      fs.writeFileSync(this.leadsFilePath, JSON.stringify(leads, null, 2), 'utf8');
      this.logger.log(`[Lead Saved] Comercio: ${data.store} (${data.email})`);
    } catch (err) {
      this.logger.warn(`Error guardando lead local: ${err}`);
    }

    try {
      await this.supabase.getClient().from('leads').insert(lead);
    } catch (_) {}

    // Intentar envío directo de correo electrónico si hay credenciales SMTP configuradas
    let emailSent = false;
    const smtpUser = process.env.SMTP_USER || 'pideteloadomicilio@gmail.com';
    const smtpPass = process.env.SMTP_PASS;

    if (smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: smtpUser,
            pass: smtpPass.replace(/\s+/g, '')
          }
        });

        const htmlContent = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 24px; color: #ffffff; text-align: center;">
              <h2 style="margin: 0; font-size: 22px; font-weight: 800;">🚀 Nueva Solicitud de Afiliación</h2>
              <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Pídetelo Express • Plataforma Delivery Venezuela</p>
            </div>
            <div style="padding: 24px; color: #1e293b;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; font-weight: bold; color: #64748b; width: 140px;">Comercio / Marca:</td>
                  <td style="padding: 10px 0; font-weight: 800; color: #0f172a; font-size: 15px;">${data.store}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; font-weight: bold; color: #64748b;">Contacto:</td>
                  <td style="padding: 10px 0; font-weight: 600; color: #0f172a;">${data.name}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; font-weight: bold; color: #64748b;">Correo Electrónico:</td>
                  <td style="padding: 10px 0;"><a href="mailto:${data.email}" style="color: #ea580c; text-decoration: none; font-weight: 600;">${data.email}</a></td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; font-weight: bold; color: #64748b;">Teléfono / WhatsApp:</td>
                  <td style="padding: 10px 0;"><a href="https://wa.me/${(data.phone || '').replace(/[^0-9]/g, '')}" style="color: #16a34a; text-decoration: none; font-weight: 700;">${data.phone}</a></td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; font-weight: bold; color: #64748b;">Ciudad / Ubicación:</td>
                  <td style="padding: 10px 0; color: #334155;">${data.city || 'No especificada'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #64748b; vertical-align: top;">Requerimiento:</td>
                  <td style="padding: 10px 0; color: #334155; line-height: 1.5;">${data.message || 'Solicitud de información / demo comercial'}</td>
                </tr>
              </table>
              <div style="margin-top: 24px; text-align: center;">
                <a href="https://wa.me/${(data.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hola ' + data.name + ', te contactamos de Pídetelo Express respecto a tu solicitud para afiliar ' + data.store)}"
                   style="display: inline-block; background: #16a34a; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 13px; padding: 12px 24px; rounded: 12px; border-radius: 8px;">
                  Abrir Chat de WhatsApp con el Comercio
                </a>
              </div>
            </div>
            <div style="background: #f8fafc; padding: 12px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
              Enviado automáticamente desde <a href="https://pidetelo.app" style="color: #ea580c; text-decoration: none;">pidetelo.app</a> • ${new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })}
            </div>
          </div>
        `;

        await transporter.sendMail({
          from: `"Pídetelo.app Afiliaciones" <${smtpUser}>`,
          to: 'pideteloadomicilio@gmail.com',
          replyTo: data.email,
          subject: `🚀 Nueva Solicitud de Afiliación: ${data.store} (${data.city || 'Venezuela'})`,
          html: htmlContent
        });

        emailSent = true;
        this.logger.log(`[Lead Email Sent] Correo enviado a pideteloadomicilio@gmail.com para ${data.store}`);
      } catch (mailErr) {
        this.logger.warn(`[Lead Email Error] Error al despachar correo vía SMTP: ${mailErr}`);
      }
    } else {
      this.logger.log('[Lead Email Notice] SMTP_PASS no configurado en backend/.env. Lead almacenado en base de datos local y Supabase.');
    }

    return { success: true, lead, emailSent };
  }

  async getLeads() {
    try {
      if (fs.existsSync(this.leadsFilePath)) {
        return JSON.parse(fs.readFileSync(this.leadsFilePath, 'utf8'));
      }
    } catch (_) {}
    return [];
  }

  private ensureLocalStorage() {
    try {
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(this.storageFilePath)) {
        fs.writeFileSync(this.storageFilePath, JSON.stringify({ tickets: {}, messages: [] }, null, 2), 'utf8');
      }
    } catch (e) {
      this.logger.error('Error ensuring support local storage:', e);
    }
  }

  private getLocalStorage(): { tickets: Record<string, SupportTicket>; messages: SupportMessage[] } {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (_) {}
    return { tickets: {}, messages: [] };
  }

  private saveLocalStorage(data: { tickets: Record<string, SupportTicket>; messages: SupportMessage[] }) {
    try {
      fs.writeFileSync(this.storageFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      this.logger.error('Error saving support local storage:', e);
    }
  }

  async getTickets(tenantId?: string) {
    try {
      let query = this.supabase.getClient()
        .from('support_tickets')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) return data;
    } catch (_) {}

    // Fallback to local storage
    const local = this.getLocalStorage();
    let tickets = Object.values(local.tickets);
    if (tenantId) {
      tickets = tickets.filter(t => t.tenant_id === tenantId);
    }
    return tickets.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
  }

  async getTicket(id: string) {
    try {
      const { data, error } = await this.supabase.getClient()
        .from('support_tickets')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) return data;
    } catch (_) {}

    const local = this.getLocalStorage();
    return local.tickets[id] || null;
  }

  async createTicket(payload: {
    tenant_id: string;
    tenant_name: string;
    branch_name?: string;
    subject: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    initial_message: string;
    sender_name: string;
  }) {
    const ticketId = crypto.randomUUID();
    const now = new Date().toISOString();

    const newTicket: SupportTicket = {
      id: ticketId,
      tenant_id: payload.tenant_id,
      tenant_name: payload.tenant_name,
      branch_name: payload.branch_name,
      subject: payload.subject,
      priority: payload.priority || 'medium',
      status: 'open',
      last_message_at: now,
      created_at: now,
      updated_at: now,
    };

    const initialMsg: SupportMessage = {
      id: crypto.randomUUID(),
      ticket_id: ticketId,
      sender_type: 'merchant',
      sender_name: payload.sender_name,
      message: payload.initial_message,
      created_at: now,
    };

    try {
      await this.supabase.getClient().from('support_tickets').insert(newTicket);
      await this.supabase.getClient().from('support_ticket_messages').insert(initialMsg);
    } catch (_) {}

    const local = this.getLocalStorage();
    local.tickets[ticketId] = newTicket;
    local.messages.push(initialMsg);
    this.saveLocalStorage(local);

    return { ticket: newTicket, message: initialMsg };
  }

  async getMessages(ticketId: string) {
    try {
      const { data, error } = await this.supabase.getClient()
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) return data;
    } catch (_) {}

    const local = this.getLocalStorage();
    return local.messages.filter(m => m.ticket_id === ticketId);
  }

  async addMessage(ticketId: string, payload: {
    sender_type: 'merchant' | 'superadmin';
    sender_name: string;
    message: string;
  }) {
    const msgId = crypto.randomUUID();
    const now = new Date().toISOString();

    const newMsg: SupportMessage = {
      id: msgId,
      ticket_id: ticketId,
      sender_type: payload.sender_type,
      sender_name: payload.sender_name,
      message: payload.message,
      created_at: now,
    };

    try {
      await this.supabase.getClient().from('support_ticket_messages').insert(newMsg);
      await this.supabase.getClient()
        .from('support_tickets')
        .update({ last_message_at: now, updated_at: now })
        .eq('id', ticketId);
    } catch (_) {}

    const local = this.getLocalStorage();
    local.messages.push(newMsg);
    if (local.tickets[ticketId]) {
      local.tickets[ticketId].last_message_at = now;
      local.tickets[ticketId].updated_at = now;
    }
    this.saveLocalStorage(local);

    return newMsg;
  }

  async updateTicketStatus(ticketId: string, status: 'open' | 'in_progress' | 'resolved' | 'closed') {
    const now = new Date().toISOString();
    try {
      await this.supabase.getClient()
        .from('support_tickets')
        .update({ status, updated_at: now })
        .eq('id', ticketId);
    } catch (_) {}

    const local = this.getLocalStorage();
    if (local.tickets[ticketId]) {
      local.tickets[ticketId].status = status;
      local.tickets[ticketId].updated_at = now;
      this.saveLocalStorage(local);
    }

    return { success: true, ticketId, status };
  }
}

