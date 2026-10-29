export type UserRole = 
  | 'SUPER_ADMIN'          // Dueño de la plataforma SaaS
  | 'PLATFORM_SUPPORT'     // Equipo de soporte general
  | 'MERCHANT_OWNER'       // Dueño del restaurante/comercio
  | 'MERCHANT_MANAGER'     // Encargado de tienda / inventario
  | 'MERCHANT_KITCHEN'     // Pantalla de cocina
  | 'MERCHANT_DISPATCH'    // Despachador de pedidos
  | 'RIDER'                // Motorizado / Repartidor
  | 'CUSTOMER';            // Cliente final

export type Permission =
  | 'manage_tenants'       // Alta, baja y edición de comercios
  | 'manage_commissions'   // Configurar % de comisión de la red
  | 'manage_roles'         // Editar matriz de roles y permisos
  | 'manage_catalog'       // Crear platos, categorías, extras y stock
  | 'manage_inventory'     // Control de stock e ingredientes
  | 'manage_orders'        // Ver comandas y avanzar estados
  | 'assign_riders'        // Asignar motorizados a pedidos
  | 'manage_riders'        // Dar de alta repartidores
  | 'manage_store_users'   // Crear cajeros, administradores y cocineros
  | 'view_realtime_gps'    // Ver motorizado en mapa en vivo
  | 'accept_deliveries'    // Motorizado: Aceptar y marcar pedidos entregados
  | 'view_reports';        // Reportes de ventas y comisiones

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  tenantId?: string;       // Si pertenece a un comercio específico
  tenantName?: string;
  branchId?: string;       // ID de la sucursal asignada (o 'all' / undefined si es global)
  branchName?: string;     // Nombre de la sucursal asignada
  permissions: Permission[];
  avatarUrl?: string;
  isActive: boolean;
  vehiclePlate?: string;   // Si es motorizado
  vehicleType?: 'moto' | 'bicicleta' | 'auto';
  vehicleModel?: string;
  nationalId?: string;
  paymentAccounts?: any[];
}

export const ROLE_PERMISSIONS_PRESETS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    'manage_tenants',
    'manage_commissions',
    'manage_roles',
    'manage_catalog',
    'manage_inventory',
    'manage_orders',
    'assign_riders',
    'manage_riders',
    'manage_store_users',
    'view_realtime_gps',
    'view_reports'
  ],
  PLATFORM_SUPPORT: [
    'manage_tenants',
    'manage_orders',
    'view_realtime_gps',
    'view_reports'
  ],
  MERCHANT_OWNER: [
    'manage_catalog',
    'manage_inventory',
    'manage_orders',
    'assign_riders',
    'manage_riders',
    'manage_store_users',
    'view_realtime_gps',
    'view_reports'
  ],
  MERCHANT_MANAGER: [
    'manage_catalog',
    'manage_inventory',
    'manage_orders',
    'assign_riders',
    'manage_riders',
    'view_realtime_gps'
  ],
  MERCHANT_KITCHEN: [
    'manage_orders'
  ],
  MERCHANT_DISPATCH: [
    'manage_orders',
    'assign_riders',
    'view_realtime_gps'
  ],
  RIDER: [
    'accept_deliveries'
  ],
  CUSTOMER: []
};
