import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  senderType: 'merchant' | 'superadmin';
  senderName: string;
  message: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  tenantId: string;
  tenantName: string;
  branchName?: string;
  subject: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved';
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  messages: SupportTicketMessage[];
}

@Injectable({
  providedIn: 'root'
})
export class SupportService {
  private readonly supabase = inject(SupabaseService);
  private readonly STORAGE_KEY = 'pidetelo_support_tickets_v1';

  readonly tickets = signal<SupportTicket[]>([]);
  readonly activeTicket = signal<SupportTicket | null>(null);
  readonly isLoading = signal<boolean>(false);

  constructor() {
    this.loadTickets();
  }

  async loadTickets(tenantId?: string): Promise<SupportTicket[]> {
    this.isLoading.set(true);
    let loaded: SupportTicket[] = [];

    // 1. Intentar cargar desde Supabase
    try {
      const client = this.supabase.getClient();
      if (!client) throw new Error('No supabase client');
      let query = client.from('support_tickets').select('*, support_ticket_messages(*)');
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      query = query.order('updated_at', { ascending: false });

      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        loaded = data.map((t: any) => ({
          id: t.id,
          tenantId: t.tenant_id,
          tenantName: t.tenant_name || 'Comercio',
          branchName: t.branch_name,
          subject: t.subject,
          priority: t.priority || 'medium',
          status: (t.status === 'closed' ? 'resolved' : t.status) || 'open',
          lastMessageAt: t.last_message_at || t.created_at,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          messages: (t.support_ticket_messages || []).map((m: any) => ({
            id: m.id,
            ticketId: m.ticket_id,
            senderType: m.sender_type,
            senderName: m.sender_name,
            message: m.message,
            createdAt: m.created_at
          }))
        }));
      }
    } catch (e) {
      console.warn('[SupportService] Error conectando con Supabase:', e);
    }

    // 2. Fallback a LocalStorage si no hay datos en nube
    if (loaded.length === 0) {
      loaded = this.getLocalStorageTickets(tenantId);
    }

    // Si aún está vacío, inicializar con tickets muestra para demostración inmediata
    if (loaded.length === 0) {
      loaded = this.getDefaultMockTickets(tenantId);
      this.saveLocalStorageTickets(loaded);
    }

    this.tickets.set(loaded);
    this.isLoading.set(false);
    return loaded;
  }

  async createTicket(payload: {
    tenantId: string;
    tenantName: string;
    branchName?: string;
    subject: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    initialMessage: string;
    senderName?: string;
  }): Promise<SupportTicket> {
    const now = new Date().toISOString();
    const newId = 'tkt_' + Math.random().toString(36).substring(2, 11);
    const msgId = 'msg_' + Math.random().toString(36).substring(2, 11);

    const firstMsg: SupportTicketMessage = {
      id: msgId,
      ticketId: newId,
      senderType: 'merchant',
      senderName: payload.senderName || payload.tenantName,
      message: payload.initialMessage,
      createdAt: now
    };

    const newTicket: SupportTicket = {
      id: newId,
      tenantId: payload.tenantId,
      tenantName: payload.tenantName,
      branchName: payload.branchName,
      subject: payload.subject,
      priority: payload.priority,
      status: 'open',
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
      messages: [firstMsg]
    };

    // 1. Guardar en Supabase
    try {
      const client = this.supabase.getClient();
      if (client) {
        await client.from('support_tickets').insert({
        id: newId,
        tenant_id: payload.tenantId,
        tenant_name: payload.tenantName,
        branch_name: payload.branchName,
        subject: payload.subject,
        priority: payload.priority,
        status: 'open',
        last_message_at: now,
        created_at: now,
        updated_at: now
      });

      await client.from('support_ticket_messages').insert({
        id: msgId,
        ticket_id: newId,
        sender_type: 'merchant',
        sender_name: payload.senderName || payload.tenantName,
        message: payload.initialMessage,
        created_at: now
        });
      }
    } catch (e) {
      console.warn('[SupportService] Supabase insert fallback:', e);
    }

    // 2. Guardar en memoria y LocalStorage
    this.tickets.update(list => [newTicket, ...list]);
    this.saveLocalStorageTickets(this.tickets());
    return newTicket;
  }

  async updateTicketStatus(ticketId: string, status: 'open' | 'in_progress' | 'resolved'): Promise<void> {
    const now = new Date().toISOString();

    this.tickets.update(list =>
      list.map(t => t.id === ticketId ? { ...t, status, updatedAt: now } : t)
    );

    if (this.activeTicket()?.id === ticketId) {
      this.activeTicket.update(t => t ? { ...t, status, updatedAt: now } : null);
    }

    this.saveLocalStorageTickets(this.tickets());

    try {
      const client = this.supabase.getClient();
      if (client) {
        await client.from('support_tickets').update({
        status,
        updated_at: now
        }).eq('id', ticketId);
      }
    } catch (_) {}
  }

  async sendMessage(
    ticketId: string,
    senderType: 'merchant' | 'superadmin',
    senderName: string,
    message: string
  ): Promise<SupportTicketMessage> {
    const now = new Date().toISOString();
    const msgId = 'msg_' + Math.random().toString(36).substring(2, 11);

    const newMsg: SupportTicketMessage = {
      id: msgId,
      ticketId,
      senderType,
      senderName,
      message,
      createdAt: now
    };

    this.tickets.update(list =>
      list.map(t => {
        if (t.id === ticketId) {
          const nextStatus = (senderType === 'superadmin' && t.status === 'open') ? 'in_progress' : t.status;
          return {
            ...t,
            status: nextStatus,
            lastMessageAt: now,
            updatedAt: now,
            messages: [...t.messages, newMsg]
          };
        }
        return t;
      })
    );

    if (this.activeTicket()?.id === ticketId) {
      this.activeTicket.update(t => {
        if (!t) return null;
        const nextStatus = (senderType === 'superadmin' && t.status === 'open') ? 'in_progress' : t.status;
        return {
          ...t,
          status: nextStatus,
          lastMessageAt: now,
          updatedAt: now,
          messages: [...t.messages, newMsg]
        };
      });
    }

    this.saveLocalStorageTickets(this.tickets());

    try {
      const client = this.supabase.getClient();
      if (client) {
        await client.from('support_ticket_messages').insert({
        id: msgId,
        ticket_id: ticketId,
        sender_type: senderType,
        sender_name: senderName,
        message,
        created_at: now
      });

        await client.from('support_tickets').update({
          last_message_at: now,
          updated_at: now
        }).eq('id', ticketId);
      }
    } catch (_) {}

    return newMsg;
  }

  private getLocalStorageTickets(tenantId?: string): SupportTicket[] {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return [];
      const parsed: SupportTicket[] = JSON.parse(raw);
      if (tenantId) {
        return parsed.filter(t => t.tenantId === tenantId);
      }
      return parsed;
    } catch (_) {
      return [];
    }
  }

  private saveLocalStorageTickets(tickets: SupportTicket[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tickets));
    } catch (_) {}
  }

  private getDefaultMockTickets(tenantId?: string): SupportTicket[] {
    const tId = tenantId || 't_mcdonalds_sample';
    return [
      {
        id: 'tkt_001',
        tenantId: tId,
        tenantName: 'McDonalds (Sede Principal)',
        branchName: 'Av. Los Leones',
        subject: 'Duda con la tasa de cambio BCV en comandas',
        priority: 'medium',
        status: 'open',
        lastMessageAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
        messages: [
          {
            id: 'm1',
            ticketId: 'tkt_001',
            senderType: 'merchant',
            senderName: 'Gerente McDonalds',
            message: 'Hola equipo Super Admin, ¿la tasa oficial de BCV se actualiza en automático a las 9 AM o debemos ajustarla manual si hay feriado bancario?',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
          }
        ]
      },
      {
        id: 'tkt_002',
        tenantId: tId,
        tenantName: 'McDonalds (Sede Principal)',
        branchName: 'Av. Los Leones',
        subject: 'Solicitud de activación de segundo radio de despacho',
        priority: 'high',
        status: 'in_progress',
        lastMessageAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        messages: [
          {
            id: 'm2',
            ticketId: 'tkt_002',
            senderType: 'merchant',
            senderName: 'Gerente McDonalds',
            message: 'Queremos ampliar la cobertura de 8 km a 12 km para llegar hasta Cabudare Centro.',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString()
          },
          {
            id: 'm3',
            ticketId: 'tkt_002',
            senderType: 'superadmin',
            senderName: 'Super Admin Soporte',
            message: 'Revisado. Ya estamos validando la asignación de riders certificados para cubrir esa distancia con tiempos óptimos.',
            createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString()
          }
        ]
      },
      {
        id: 'tkt_003',
        tenantId: tId,
        tenantName: 'McDonalds (Sede Principal)',
        branchName: 'Av. Los Leones',
        subject: 'Verificación de credenciales Pago Móvil',
        priority: 'low',
        status: 'resolved',
        lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        messages: [
          {
            id: 'm4',
            ticketId: 'tkt_003',
            senderType: 'merchant',
            senderName: 'Gerente McDonalds',
            message: 'Se actualizaron los datos bancarios del Banesco Pago Móvil.',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString()
          },
          {
            id: 'm5',
            ticketId: 'tkt_003',
            senderType: 'superadmin',
            senderName: 'Super Admin Soporte',
            message: 'Credenciales aprobadas y verificadas exitosamente. El checkout del cliente ya muestra los datos correctos.',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
          }
        ]
      }
    ];
  }
}
