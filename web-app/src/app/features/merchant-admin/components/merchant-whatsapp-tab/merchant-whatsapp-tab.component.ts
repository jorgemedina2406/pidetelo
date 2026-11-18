import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../shared/components/icon.component';

@Component({
  selector: 'app-merchant-whatsapp-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './merchant-whatsapp-tab.component.html'
})
export class MerchantWhatsappTabComponent {
  @Input() whatsappSubTab: 'chat' | 'settings' = 'chat';
  @Input() whatsappInstance: any = null;
  @Input() whatsappConversations: any[] = [];
  @Input() filteredWhatsAppConversations: any[] = [];
  @Input() selectedWhatsAppConversation: any = null;
  @Input() whatsappMessages: any[] = [];
  @Input() whatsappSearchQuery: string = '';
  @Input() whatsappNewMessageText: string = '';
  @Input() isLoadingWhatsApp: boolean = false;
  @Input() isConnectingWhatsApp: boolean = false;
  @Input() isSendingWhatsApp: boolean = false;
  @Input() whatsappSettings: { greetingMessage: string; autoReplyEnabled: boolean; pauseDurationMinutes: number } = {
    greetingMessage: '¡Hola! Bienvenido a nuestro canal oficial de atención. ¿En qué podemos ayudarte hoy?',
    autoReplyEnabled: true,
    pauseDurationMinutes: 120
  };
  @Input() currentSubscriptionPlan: any = null;

  @Output() subTabChange = new EventEmitter<'chat' | 'settings'>();
  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() newMessageTextChange = new EventEmitter<string>();
  @Output() selectConversation = new EventEmitter<any>();
  @Output() toggleBotMode = new EventEmitter<'bot' | 'human'>();
  @Output() deleteConversation = new EventEmitter<string>();
  @Output() sendMessage = new EventEmitter<void>();
  @Output() refreshConversations = new EventEmitter<void>();
  @Output() resumeAllBots = new EventEmitter<void>();
  @Output() clearAllConversations = new EventEmitter<void>();
  @Output() connect = new EventEmitter<void>();
  @Output() disconnect = new EventEmitter<void>();
  @Output() saveSettings = new EventEmitter<void>();
  @Output() openUpgradePlan = new EventEmitter<'branches' | 'products' | 'users' | 'orders' | 'whatsapp' | 'excel' | 'banner' | 'generic'>();

  getFormattedQrCode(): string | null {
    const inst = this.whatsappInstance;
    if (!inst) return null;
    if (inst.qr_code && typeof inst.qr_code === 'string') {
      if (inst.qr_code.startsWith('data:image')) return inst.qr_code;
      return `data:image/png;base64,${inst.qr_code}`;
    }
    return null;
  }
}
