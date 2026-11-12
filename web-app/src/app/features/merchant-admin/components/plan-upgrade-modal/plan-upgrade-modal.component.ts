import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SubscriptionPlan } from '../../../../core/models/branch.model';
import { IconComponent } from '../../../../shared/components/icon.component';

@Component({
  selector: 'app-plan-upgrade-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './plan-upgrade-modal.component.html'
})
export class PlanUpgradeModalComponent {
  @Input() isOpen = false;
  @Input() currentSubscriptionPlan: SubscriptionPlan | null = null;
  @Input() activeBranchesCount = 0;
  @Input() limitType: 'branches' | 'products' | 'users' | 'orders' | 'whatsapp' | 'excel' | 'banner' | 'generic' = 'generic';
  @Input() customTitle?: string;
  @Input() customMessage?: string;

  @Output() close = new EventEmitter<void>();
  @Output() selectPlan = new EventEmitter<string>();

  getModalBadge(): string {
    switch (this.limitType) {
      case 'branches': return 'Límite de Sucursales Alcanzado';
      case 'products': return 'Límite de Productos Alcanzado';
      case 'users': return 'Límite de Usuarios Alcanzado';
      case 'orders': return 'Límite Mensual de Pedidos Alcanzado';
      case 'whatsapp': return 'Función Exclusiva: Bot de WhatsApp';
      case 'excel': return 'Función Exclusiva: Reportes en Excel';
      case 'banner': return 'Función Exclusiva: Banners Destacados VIP';
      default: return 'Actualización de Plan Requerida';
    }
  }

  getModalTitle(): string {
    if (this.customTitle) return this.customTitle;
    switch (this.limitType) {
      case 'branches': return '¡Llegaste al límite de sucursales!';
      case 'products': return '¡Catálogo al tope de productos!';
      case 'users': return '¡Límite de colaboradores alcanzado!';
      case 'orders': return '¡Cupo mensual de pedidos completado!';
      case 'whatsapp': return '¡Activa el Bot de WhatsApp 24/7!';
      case 'excel': return '¡Descarga tus reportes avanzados en Excel!';
      case 'banner': return '¡Posiciona tu marca con Banners VIP!';
      default: return `Mejora tu ${this.currentSubscriptionPlan?.name || 'Plan'}`;
    }
  }

  getModalMessage(): string {
    if (this.customMessage) return this.customMessage;
    switch (this.limitType) {
      case 'branches':
        return `Tu ${this.currentSubscriptionPlan?.name || 'Plan Actual'} permite ${this.currentSubscriptionPlan?.maxBranches || 0} sucursales adicionales aparte de la sede principal. Actualiza a Franquicia para sucursales ilimitadas.`;
      case 'products':
        return `Tu ${this.currentSubscriptionPlan?.name || 'Plan Actual'} tiene un tope de ${this.currentSubscriptionPlan?.maxProducts || 20} productos. Sube de plan para publicar más ítems en tu menú.`;
      case 'users':
        return `Tu ${this.currentSubscriptionPlan?.name || 'Plan Actual'} incluye ${this.currentSubscriptionPlan?.maxAdditionalUsers || 1} usuario adicional. Amplía tu equipo con un plan superior.`;
      case 'orders':
        return `Has alcanzado los ${this.currentSubscriptionPlan?.maxMonthlyOrders || 20} pedidos mensuales de tu plan. Actualiza para continuar recibiendo compras sin pausas.`;
      case 'whatsapp':
        return 'El Bot Automático de WhatsApp y Live Chat con Inteligencia Artificial está disponible a partir del Plan Comercio Pro y Plan Franquicia.';
      case 'excel':
        return 'La exportación de reportes avanzados de comandas y ventas en formato Excel (.xlsx) está disponible en los planes Comercio Pro y Franquicia.';
      case 'banner':
        return 'Los banners destacados VIP en el home de la App Móvil son exclusivos para comercios en el Plan Franquicia.';
      default:
        return 'Elige uno de nuestros planes recomendados para desbloquear más capacidad, herramientas y ventas.';
    }
  }

  getWhatsAppUpgradeUrl(planCode: string): string {
    const text = encodeURIComponent(`Hola equipo Pídetelo, deseo solicitar la actualización de mi comercio al ${planCode === 'FRANQUICIA' ? 'Plan Franquicia ($80/mes)' : 'Plan Comercio Pro ($35/mes)'}.`);
    return `https://wa.me/584245065032?text=${text}`;
  }
}
