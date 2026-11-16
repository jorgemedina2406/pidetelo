import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SubscriptionPlan } from '../../../../core/models/branch.model';
import { IconComponent } from '../../../../shared/components/icon.component';

@Component({
  selector: 'app-plan-upgrade-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './plan-upgrade-modal.component.html'
})
export class PlanUpgradeModalComponent {
  @Input() isOpen = false;
  @Input() currentSubscriptionPlan: SubscriptionPlan | null = null;
  @Input() activeBranchesCount = 0;
  @Input() limitType: 'branches' | 'products' | 'riders' | 'users' | 'orders' | 'whatsapp' | 'excel' | 'banner' | 'generic' = 'generic';
  @Input() customTitle?: string;
  @Input() customMessage?: string;

  @Output() close = new EventEmitter<void>();
  @Output() selectPlan = new EventEmitter<string>();

  // Calculadora de Add-ons para Franquicias y Cadenas
  calcExtraBranches = 1;
  calcHasMassCatalog = true;

  get calculatedChainMonthlyTotal(): number {
    const basePro = 80; // Primeras 5 tiendas
    const extraBranchesCost = Math.max(0, this.calcExtraBranches) * 12;
    const totalStores = 5 + Math.max(0, this.calcExtraBranches);
    const massCatalogCost = this.calcHasMassCatalog ? (totalStores * 5) : 0;
    return basePro + extraBranchesCost + massCatalogCost;
  }

  getModalBadge(): string {
    switch (this.limitType) {
      case 'branches': return 'Límite de Sucursales Alcanzado';
      case 'products': return 'Límite de Catálogo Alcanzado';
      case 'riders': return 'Límite de Motorizados Propios';
      case 'users': return 'Límite de Colaboradores Alcanzado';
      case 'orders': return 'Límite Mensual de Pedidos';
      case 'whatsapp': return 'Función Exclusiva: Bot de WhatsApp';
      case 'excel': return 'Función Exclusiva: Reportes en Excel';
      case 'banner': return 'Función Exclusiva: Banners Destacados VIP';
      default: return 'Escalabilidad & Mejora de Plan';
    }
  }

  getModalTitle(): string {
    if (this.customTitle) return this.customTitle;
    switch (this.limitType) {
      case 'branches': return '¡Llegaste al límite de sedes!';
      case 'products': return '¡Catálogo al tope de productos!';
      case 'riders': return '¡Límite de motorizados alcanzado!';
      case 'users': return '¡Límite de colaboradores alcanzado!';
      case 'orders': return '¡Cupo mensual de pedidos!';
      case 'whatsapp': return '¡Activa el Bot de WhatsApp 24/7!';
      case 'excel': return '¡Descarga reportes avanzados en Excel!';
      case 'banner': return '¡Posiciona tu marca con Banners VIP!';
      default: return `Mejora tu ${this.currentSubscriptionPlan?.name || 'Plan'}`;
    }
  }

  getModalMessage(): string {
    if (this.customMessage) return this.customMessage;
    switch (this.limitType) {
      case 'branches':
        return `Tu ${this.currentSubscriptionPlan?.name || 'Plan Actual'} incluye hasta ${(this.currentSubscriptionPlan?.maxBranches || 0) + 1} tienda(s) en total. Sube de plan o añade sucursales extras por solo $12/mes por sede.`;
      case 'products':
        return `Tu ${this.currentSubscriptionPlan?.name || 'Plan Actual'} tiene un tope de ${this.currentSubscriptionPlan?.maxProducts || 150} productos. Activa un plan superior o el módulo de Catálogo Masivo (+500 productos por $5/mes).`;
      case 'riders':
        return `Tu ${this.currentSubscriptionPlan?.name || 'Plan Actual'} permite registrar hasta ${this.currentSubscriptionPlan?.maxRiders || 3} motorizados propios. Sube de plan para incorporar más repartidores.`;
      case 'users':
        return `Tu ${this.currentSubscriptionPlan?.name || 'Plan Actual'} incluye ${this.currentSubscriptionPlan?.maxAdditionalUsers || 1} usuario adicional. Amplía tu equipo con un plan superior.`;
      case 'whatsapp':
        return 'El Bot Automático de WhatsApp 24/7 y Live Chat está habilitado para todos los planes.';
      case 'excel':
        return 'La exportación de reportes avanzados de comandas y ventas en Excel (.xlsx) está disponible en los planes Mediano y Pro.';
      case 'banner':
        return 'Los banners destacados VIP en el home de la App Móvil son exclusivos para comercios en el Plan Pro.';
      default:
        return 'Elige uno de nuestros planes recomendados o add-ons para desbloquear más capacidad, tiendas y ventas.';
    }
  }

  getWhatsAppUpgradeUrl(planCode: string): string {
    const text = encodeURIComponent(`Hola equipo Pídetelo, deseo solicitar la actualización de mi comercio al ${planCode === 'FRANQUICIA' ? 'Plan Pro ($80/mes)' : 'Plan Mediano ($50/mes)'}.`);
    return `https://wa.me/584245065032?text=${text}`;
  }

  getWhatsAppChainAddonUrl(): string {
    const totalStores = 5 + Math.max(0, this.calcExtraBranches);
    const text = encodeURIComponent(`Hola equipo Pídetelo, deseo solicitar una cotización para cadena de ${totalStores} sucursales (${this.calcExtraBranches} extras) con ${this.calcHasMassCatalog ? 'Catálogo Masivo habilitado' : 'catálogo estándar'}. Total estimado: $${this.calculatedChainMonthlyTotal}/mes.`);
    return `https://wa.me/584245065032?text=${text}`;
  }
}
