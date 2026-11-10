import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import * as fs from 'fs';
import * as path from 'path';

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

  constructor(private readonly supabase: SupabaseService) {
    this.ensureLocalStorage();
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
