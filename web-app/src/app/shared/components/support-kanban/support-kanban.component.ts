import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupportService, SupportTicket } from '../../../core/services/support.service';
import { IconComponent } from '../icon.component';

@Component({
  selector: 'app-support-kanban',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './support-kanban.component.html',
  styles: [`
    .kanban-column {
      min-height: 480px;
    }
    .ticket-card {
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: grab;
    }
    .ticket-card:active {
      cursor: grabbing;
    }
    .ticket-card:hover {
      transform: translateY(-2px);
    }
    .drag-over {
      border: 2px dashed #f97316 !important;
      background-color: rgba(249, 115, 22, 0.05) !important;
    }
  `]
})
export class SupportKanbanComponent implements OnInit {
  readonly support = inject(SupportService);

  @Input() mode: 'superadmin' | 'merchant' = 'superadmin';
  @Input() currentTenantId?: string;
  @Input() currentTenantName: string = 'Mi Comercio';
  @Input() currentUserName: string = 'Administrador';

  readonly searchQuery = signal<string>('');
  readonly selectedPriority = signal<string>('all');
  readonly selectedTicket = signal<SupportTicket | null>(null);
  readonly isNewTicketModalOpen = signal<boolean>(false);
  readonly dragOverColumn = signal<string | null>(null);

  // New ticket form
  newSubject = '';
  newPriority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
  newInitialMessage = '';
  newBranchName = '';

  // Chat message input
  chatReply = '';
  draggedTicket: SupportTicket | null = null;

  ngOnInit(): void {
    this.support.loadTickets(this.mode === 'merchant' ? this.currentTenantId : undefined);
  }

  readonly filteredTickets = computed(() => {
    const list = this.support.tickets();
    const query = this.searchQuery().toLowerCase().trim();
    const prio = this.selectedPriority();

    return list.filter(t => {
      if (this.mode === 'merchant' && this.currentTenantId && t.tenantId !== this.currentTenantId) {
        return false;
      }
      if (prio !== 'all' && t.priority !== prio) {
        return false;
      }
      if (query) {
        const inSubject = t.subject.toLowerCase().includes(query);
        const inTenant = t.tenantName.toLowerCase().includes(query);
        const inMsg = t.messages.some(m => m.message.toLowerCase().includes(query));
        return inSubject || inTenant || inMsg;
      }
      return true;
    });
  });

  readonly pendingTickets = computed(() =>
    this.filteredTickets().filter(t => t.status === 'open')
  );

  readonly inProgressTickets = computed(() =>
    this.filteredTickets().filter(t => t.status === 'in_progress')
  );

  readonly resolvedTickets = computed(() =>
    this.filteredTickets().filter(t => t.status === 'resolved')
  );

  // Drag and drop handlers
  onDragStart(ticket: SupportTicket, event: DragEvent): void {
    this.draggedTicket = ticket;
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', ticket.id);
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragOver(event: DragEvent, column: string): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOverColumn.set(column);
  }

  onDragLeave(column: string): void {
    if (this.dragOverColumn() === column) {
      this.dragOverColumn.set(null);
    }
  }

  onDrop(status: 'open' | 'in_progress' | 'resolved', event: DragEvent): void {
    event.preventDefault();
    this.dragOverColumn.set(null);
    if (this.draggedTicket && this.draggedTicket.status !== status) {
      this.support.updateTicketStatus(this.draggedTicket.id, status);
      if (this.selectedTicket()?.id === this.draggedTicket.id) {
        this.selectedTicket.update(t => t ? { ...t, status } : null);
      }
    }
    this.draggedTicket = null;
  }

  openTicketChat(ticket: SupportTicket): void {
    this.selectedTicket.set(ticket);
  }

  closeTicketChat(): void {
    this.selectedTicket.set(null);
    this.chatReply = '';
  }

  async sendReply(): Promise<void> {
    const text = this.chatReply.trim();
    const t = this.selectedTicket();
    if (!text || !t) return;

    const senderType = this.mode === 'superadmin' ? 'superadmin' : 'merchant';
    const senderName = this.mode === 'superadmin' ? 'Super Admin Soporte' : this.currentUserName;

    this.chatReply = '';
    const newMsg = await this.support.sendMessage(t.id, senderType, senderName, text);
    
    // Auto-update selectedTicket view
    this.selectedTicket.update(curr => {
      if (!curr) return null;
      return {
        ...curr,
        messages: [...curr.messages, newMsg]
      };
    });
  }

  changeStatus(status: 'open' | 'in_progress' | 'resolved'): void {
    const t = this.selectedTicket();
    if (!t) return;
    this.support.updateTicketStatus(t.id, status);
    this.selectedTicket.update(curr => curr ? { ...curr, status } : null);
  }

  async submitNewTicket(): Promise<void> {
    if (!this.newSubject.trim() || !this.newInitialMessage.trim()) return;

    await this.support.createTicket({
      tenantId: this.currentTenantId || 't_merchant_default',
      tenantName: this.currentTenantName,
      branchName: this.newBranchName.trim() || undefined,
      subject: this.newSubject.trim(),
      priority: this.newPriority,
      initialMessage: this.newInitialMessage.trim(),
      senderName: this.currentUserName
    });

    this.newSubject = '';
    this.newInitialMessage = '';
    this.newBranchName = '';
    this.newPriority = 'medium';
    this.isNewTicketModalOpen.set(false);
  }

  getPriorityBadge(priority: string): { label: string; class: string } {
    switch (priority) {
      case 'urgent':
        return { label: 'Urgente 🔥', class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30' };
      case 'high':
        return { label: 'Alta ⚡', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' };
      case 'low':
        return { label: 'Baja', class: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30' };
      default:
        return { label: 'Media', class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' };
    }
  }

  getStatusBadge(status: string): { label: string; class: string } {
    switch (status) {
      case 'open':
        return { label: 'Pendiente', class: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' };
      case 'in_progress':
        return { label: 'En Proceso', class: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' };
      case 'resolved':
        return { label: 'Solucionado', class: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' };
      default:
        return { label: status, class: 'bg-slate-100 text-slate-800' };
    }
  }

  formatTimeAgo(dateStr: string): string {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / (1000 * 60));
      if (mins < 1) return 'Hace un momento';
      if (mins < 60) return `Hace ${mins} min`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `Hace ${hours} h`;
      const days = Math.floor(hours / 24);
      return `Hace ${days} d`;
    } catch (_) {
      return dateStr;
    }
  }
}
