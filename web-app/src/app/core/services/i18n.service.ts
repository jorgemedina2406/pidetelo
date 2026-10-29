import { Injectable, signal, computed } from '@angular/core';

export type AppLang = 'es' | 'en';

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private readonly STORAGE_KEY = 'deliveryhub_lang';
  readonly lang = signal<AppLang>('es');

  private readonly translations: Record<AppLang, Record<string, string>> = {
    es: {
      // General & Common
      'common.save': 'Guardar',
      'common.cancel': 'Cancelar',
      'common.search': 'Buscar...',
      'common.active': 'Activo',
      'common.status': 'Estado',
      'common.actions': 'Acciones',
      'common.all': 'Todos',
      'common.back': 'Volver',
      'common.filter': 'Filtrar',
      'common.close': 'Cerrar',
      'common.currency': '$',
      'common.online': 'En línea',
      'common.offline': 'Desconectado',

      // Auth
      'auth.portal': 'Portal de Acceso Centralizado',
      'auth.signIn': 'Iniciar Sesión',
      'auth.subheading': 'Selecciona tu perfil de acceso o ingresa con tu correo.',
      'auth.quickAccess': 'Acceso Rápido por Rol:',
      'auth.roleSuperAdmin': 'SuperAdmin',
      'auth.roleSuperAdminSub': 'Dueño Plataforma',
      'auth.roleMerchant': 'Comercio',
      'auth.roleMerchantSub': 'Panel Restaurante',
      'auth.roleRider': 'Motorizado',
      'auth.roleRiderSub': 'Repartidor',
      'auth.orEmail': 'O con correo corporativo',
      'auth.email': 'Correo Electrónico',
      'auth.password': 'Contraseña',
      'auth.forgotPassword': '¿Olvidaste tu contraseña?',
      'auth.submit': 'Ingresar al Sistema',
      'auth.heroTag': 'Logística & Despacho Inteligente',
      'auth.heroTitle': 'La solución moderna para tus entregas a domicilio.',
      'auth.heroSubtitle': 'Centraliza los pedidos de tu tienda web y WhatsApp, coordina a tus motorizados con rutas eficientes y ofrece a tus clientes una experiencia ágil y confiable.',
      'auth.statTime': '~25 min',
      'auth.statTimeLabel': 'Tiempo promedio',
      'auth.statGps': 'GPS Activo',
      'auth.statGpsLabel': 'Rastreo en vivo',
      'auth.statDirect': 'Venta Directa',
      'auth.statDirectLabel': 'Sin intermediarios',
      'auth.marketplaceLink': 'Ver Marketplace',
      'auth.whatsappDemo': 'Tienda WhatsApp Demo',
      'auth.securityFooter': 'Acceso protegido con cifrado SSL y tokens de autenticación segura.',

      // SuperAdmin
      'sa.brandSubtitle': 'SuperAdmin',
      'sa.merchants': 'Comercios Afiliados',
      'sa.merchantsDesc': 'Control de onboarding, catálogos y tarifas de comisión.',
      'sa.newMerchant': 'Dar de Alta Comercio',
      'sa.roles': 'Roles & Permisos (RBAC)',
      'sa.rolesDesc': 'Matriz granular de privilegios y seguridad multi-tenant.',
      'sa.metrics': 'Métricas & Comisiones',
      'sa.metricsDesc': 'Facturación consolidada, volumen y comisiones de red.',
      'sa.searchPlaceholder': 'Buscar por nombre o slug...',
      'sa.colMerchant': 'Comercio',
      'sa.colCategory': 'Categoría',
      'sa.colWhatsApp': 'WhatsApp / Menú',
      'sa.colCommission': 'Comisión Red',
      'sa.colDeliveryFee': 'Tarifa Envío Base',
      'sa.colStatus': 'Estado',
      'sa.colManage': 'Gestionar',
      'sa.activePlatform': 'Plataforma en Vivo',
      'sa.clientPortal': 'Ver Portal Clientes',
      'sa.envEnvironments': 'Acceso a Entornos:',
      'sa.roleMatrixTitle': 'Matriz de Roles y Privilegios',
      'sa.matrixDesc': 'Define qué acciones puede realizar cada perfil de la plataforma en tiempo real.',
      'sa.revTitle': 'Facturación Total Red',
      'sa.commTitle': 'Comisiones de Red (5%)',
      'sa.ordersTitle': 'Pedidos Despachados',

      // MerchantAdmin
      'ma.brandSubtitle': 'Panel Local',
      'ma.orders': 'Comandas en Vivo',
      'ma.ordersDesc': 'Órdenes recibidas por WhatsApp y App en tiempo real. Asigna repartidores al salir de cocina.',
      'ma.catalog': 'Catálogo & Extras',
      'ma.catalogDesc': 'Control de inventario, stock y grupos de modificadores (bebidas, salsas, extras).',
      'ma.riders': 'Flota de Repartidores',
      'ma.ridersDesc': 'Monitorea la disponibilidad y asigna repartidores a las entregas.',
      'ma.radar': 'Radar GPS en Vivo',
      'ma.radarDesc': 'Telemetría de la ruta y cálculo de entrega en tiempo real.',
      'ma.team': 'Equipo & Accesos',
      'ma.teamDesc': 'Administra usuarios de cocina, despacho y gerencia.',
      'ma.colNew': '1. Nuevos / WhatsApp',
      'ma.colKitchen': '2. En Preparación',
      'ma.colTransit': '3. En Camino (GPS Activo)',
      'ma.simulateOrder': 'Simular Pedido WhatsApp',
      'ma.viewStore': 'Ver Tienda',
      'ma.assignRider': 'Asignar motorizado flota...',
      'ma.dispatch': 'Despachar',
      'ma.sendToKitchen': 'Enviar a Cocina',
      'ma.stockControl': 'Control de Inventario',
      'ma.inStock': 'En Stock',
      'ma.outOfStock': 'Agotado',
      'ma.configModifiers': 'Configurar Extras',
      'ma.newProduct': 'Nuevo Producto',
      'ma.newRider': 'Registrar Repartidor',
      'ma.noTransit': 'Sin despachos en tránsito',
      'ma.kitchenDone': 'Cocina al día',
      'ma.noNewOrders': 'No hay pedidos nuevos',

      // Sidebar
      'sb.collapse': 'Colapsar',
      'sb.expand': 'Expandir',
      'sb.theme': 'Tema',
      'sb.lang': 'Idioma',
      'sb.logout': 'Cerrar Sesión',
      'sb.envLocal': 'Local',
      'sb.envRider': 'Rider',
      'sb.envSuper': 'SuperAdmin'
    },
    en: {
      // General & Common
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.search': 'Search...',
      'common.active': 'Active',
      'common.status': 'Status',
      'common.actions': 'Actions',
      'common.all': 'All',
      'common.back': 'Back',
      'common.filter': 'Filter',
      'common.close': 'Close',
      'common.currency': '$',
      'common.online': 'Online',
      'common.offline': 'Offline',

      // Auth
      'auth.portal': 'Centralized Access Portal',
      'auth.signIn': 'Sign In',
      'auth.subheading': 'Choose your demo profile or enter your business credentials.',
      'auth.quickAccess': 'Quick Access by Role:',
      'auth.roleSuperAdmin': 'SuperAdmin',
      'auth.roleSuperAdminSub': 'Platform Owner',
      'auth.roleMerchant': 'Merchant',
      'auth.roleMerchantSub': 'Store Admin',
      'auth.roleRider': 'Courier',
      'auth.roleRiderSub': 'Delivery Rider',
      'auth.orEmail': 'Or with corporate email',
      'auth.email': 'Email Address',
      'auth.password': 'Password',
      'auth.forgotPassword': 'Forgot password?',
      'auth.submit': 'Sign In to Platform',
      'auth.heroTag': 'Smart Dispatch & Logistics',
      'auth.heroTitle': 'The modern solution for food delivery.',
      'auth.heroSubtitle': 'Centralize your web store and WhatsApp orders, dispatch couriers with real-time routes, and deliver a frictionless ordering experience.',
      'auth.statTime': '~25 min',
      'auth.statTimeLabel': 'Average time',
      'auth.statGps': 'Live GPS',
      'auth.statGpsLabel': 'Real-time tracking',
      'auth.statDirect': 'Direct Sales',
      'auth.statDirectLabel': 'Zero middlemen',
      'auth.marketplaceLink': 'Explore Marketplace',
      'auth.whatsappDemo': 'WhatsApp Store Demo',
      'auth.securityFooter': 'Secure enterprise access with SSL encryption and token authorization.',

      // SuperAdmin
      'sa.brandSubtitle': 'SuperAdmin',
      'sa.merchants': 'Affiliated Stores',
      'sa.merchantsDesc': 'Control merchant onboarding, digital menus, and commission rates.',
      'sa.newMerchant': 'Register New Store',
      'sa.roles': 'Roles & Permissions (RBAC)',
      'sa.rolesDesc': 'Granular multi-tenant permission matrix and security policies.',
      'sa.metrics': 'Metrics & Commissions',
      'sa.metricsDesc': 'Consolidated platform revenue, volume, and commission metrics.',
      'sa.searchPlaceholder': 'Search by merchant name or slug...',
      'sa.colMerchant': 'Merchant',
      'sa.colCategory': 'Category',
      'sa.colWhatsApp': 'WhatsApp / Menu',
      'sa.colCommission': 'Platform Fee',
      'sa.colDeliveryFee': 'Base Delivery Fee',
      'sa.colStatus': 'Status',
      'sa.colManage': 'Manage',
      'sa.activePlatform': 'Live Platform',
      'sa.clientPortal': 'Customer Marketplace',
      'sa.envEnvironments': 'Switch Environments:',
      'sa.roleMatrixTitle': 'Roles & Privileges Matrix',
      'sa.matrixDesc': 'Define real-time capabilities and security scopes for every profile.',
      'sa.revTitle': 'Total Network Volume',
      'sa.commTitle': 'Platform Fees (5%)',
      'sa.ordersTitle': 'Delivered Orders',

      // MerchantAdmin
      'ma.brandSubtitle': 'Store Panel',
      'ma.orders': 'Live Kitchen Orders',
      'ma.ordersDesc': 'Real-time WhatsApp and web orders. Dispatch couriers right as food leaves the kitchen.',
      'ma.catalog': 'Catalog & Modifiers',
      'ma.catalogDesc': 'Manage inventory, stock availability, and customizable modifier groups (sides, drinks).',
      'ma.riders': 'Delivery Fleet',
      'ma.ridersDesc': 'Monitor courier status, vehicle license plates, and active assignments.',
      'ma.radar': 'Live GPS Radar',
      'ma.radarDesc': 'Real-time telemetry, routing progress, and estimated arrival.',
      'ma.team': 'Team & Access',
      'ma.teamDesc': 'Configure role-based access for kitchen, dispatch, and management staff.',
      'ma.colNew': '1. New / WhatsApp',
      'ma.colKitchen': '2. In Preparation',
      'ma.colTransit': '3. On the Way (Live GPS)',
      'ma.simulateOrder': 'Simulate WhatsApp Order',
      'ma.viewStore': 'View Online Store',
      'ma.assignRider': 'Assign delivery courier...',
      'ma.dispatch': 'Dispatch',
      'ma.sendToKitchen': 'Send to Kitchen',
      'ma.stockControl': 'Inventory Control',
      'ma.inStock': 'In Stock',
      'ma.outOfStock': 'Out of Stock',
      'ma.configModifiers': 'Edit Modifiers',
      'ma.newProduct': 'New Dish',
      'ma.newRider': 'Add Courier',
      'ma.noTransit': 'No deliveries in transit',
      'ma.kitchenDone': 'Kitchen is all caught up',
      'ma.noNewOrders': 'No new incoming orders',

      // Sidebar
      'sb.collapse': 'Collapse',
      'sb.expand': 'Expand',
      'sb.theme': 'Theme',
      'sb.lang': 'Language',
      'sb.logout': 'Sign Out',
      'sb.envLocal': 'Store',
      'sb.envRider': 'Rider',
      'sb.envSuper': 'SuperAdmin'
    }
  };

  constructor() {
    const saved = localStorage.getItem(this.STORAGE_KEY) as AppLang | null;
    if (saved === 'es' || saved === 'en') {
      this.lang.set(saved);
    }
  }

  setLang(l: AppLang): void {
    this.lang.set(l);
    localStorage.setItem(this.STORAGE_KEY, l);
    document.documentElement.lang = l;
  }

  toggleLang(): void {
    this.setLang(this.lang() === 'es' ? 'en' : 'es');
  }

  t(key: string): string {
    const active = this.lang();
    return this.translations[active]?.[key] ?? this.translations['es']?.[key] ?? key;
  }
}
