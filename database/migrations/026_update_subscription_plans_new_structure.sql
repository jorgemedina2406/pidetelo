-- ==============================================================================
-- DELIVERY HUB - MIGRACIÓN 026: NUEVA ESTRUCTURA DE PLANES Y LÍMITES
-- ==============================================================================
-- 1. PLAN BÁSICO (EMPRENDEDOR - $20/mes o $16/mes anual):
--    - Sucursales: 0 adicionales (1 tienda incluida)
--    - Productos: Hasta 50 productos en catálogo
--    - Motorizados: Hasta 3 motorizados propios
--    - Pedidos mensuales: Ilimitados (-1)
--    - Usuarios adicionales: 1 usuario adicional (+ dueño)
--    - Bot automático de WhatsApp: SÍ (incluido)
--    - Reportes avanzados en Excel: NO
--    - Banners VIP en app móvil: NO
--
-- 2. PLAN MEDIANO (COMERCIO_PRO - $50/mes o $40/mes anual):
--    - Sucursales: Hasta 2 adicionales (3 tiendas incluidas: 1 principal + 2 sucursales)
--    - Productos: Hasta 150 productos por tienda
--    - Motorizados: Hasta 6 motorizados propios
--    - Pedidos mensuales: Ilimitados (-1)
--    - Usuarios adicionales: Hasta 3 usuarios adicionales (+ dueño)
--    - Bot automático de WhatsApp: SÍ (incluido)
--    - Reportes avanzados en Excel: SÍ
--    - Banners VIP en app móvil: NO
--
-- 3. PLAN PRO (FRANQUICIA - $80/mes o $64/mes anual):
--    - Sucursales: Hasta 4 adicionales (5 tiendas incluidas: 1 principal + 4 sucursales)
--    - Add-on sucursal adicional: +$12/mes a partir de la 6ta sede
--    - Productos: Hasta 500 productos por tienda (Add-on catálogo masivo +$5/mes para >500)
--    - Motorizados: Hasta 10 motorizados propios
--    - Pedidos mensuales: Ilimitados (-1)
--    - Usuarios adicionales: Hasta 10 usuarios adicionales (+ dueño)
--    - Bot automático de WhatsApp: SÍ (con IA avanzada)
--    - Reportes avanzados en Excel: SÍ
--    - Banners VIP en app móvil: SÍ (prioridad y tope anti-saturación)
-- ==============================================================================

-- 1. Actualizar Plan Básico (EMPRENDEDOR)
UPDATE subscription_plans
SET 
  name = 'Plan Básico',
  price_monthly = 20.00,
  price_annual = 16.00,
  monthly_fee_usd = 20.00,
  max_branches = 0,
  max_products = 50,
  max_monthly_orders = -1,
  max_additional_users = 1,
  has_whatsapp_bot = true,
  has_excel_reports = false,
  has_featured_banners = false,
  description = 'Para restaurantes únicos, dark kitchens o comercios que inician con su sede principal.',
  features = '[
    "1 tienda / sede incluida (sede principal)",
    "Hasta 50 productos en catálogo",
    "Hasta 3 motorizados propios registrados",
    "Bot automático de WhatsApp 24/7 y Live Chat",
    "Pedidos mensuales ilimitados",
    "1 usuario de equipo adicional (+ dueño)",
    "Tienda web y menú digital QR para mesas",
    "Acceso a la App Móvil de Clientes",
    "Acceso a la App de Repartidores con GPS",
    "0% comisión sobre ventas (pagos 100% directos)",
    "Tracking de entregas en tiempo real",
    "Soporte estándar"
  ]'::jsonb,
  is_active = true,
  updated_at = NOW()
WHERE code = 'EMPRENDEDOR';

-- 2. Actualizar Plan Mediano (COMERCIO_PRO)
UPDATE subscription_plans
SET 
  name = 'Plan Mediano',
  price_monthly = 50.00,
  price_annual = 40.00,
  monthly_fee_usd = 50.00,
  max_branches = 2,
  max_products = 150,
  max_monthly_orders = -1,
  max_additional_users = 3,
  has_whatsapp_bot = true,
  has_excel_reports = true,
  has_featured_banners = false,
  description = 'Para comercios consolidados que buscan expansión a 3 tiendas y automatización con bot.',
  features = '[
    "Hasta 3 tiendas (1 principal + 2 sucursales a $16.67/sede)",
    "Hasta 150 productos por tienda",
    "Hasta 6 motorizados propios registrados",
    "Pedidos mensuales ilimitados",
    "Hasta 3 usuarios de equipo adicionales",
    "Bot automático de WhatsApp 24/7 y Live Chat",
    "Reportes avanzados en Excel (.xlsx)",
    "Pantalla interactiva de Cocina / KDS",
    "Soporte prioritario"
  ]'::jsonb,
  is_active = true,
  updated_at = NOW()
WHERE code = 'COMERCIO_PRO';

-- 3. Actualizar Plan Pro (FRANQUICIA)
UPDATE subscription_plans
SET 
  name = 'Plan Pro',
  price_monthly = 80.00,
  price_annual = 64.00,
  monthly_fee_usd = 80.00,
  max_branches = 4,
  max_products = 500,
  max_monthly_orders = -1,
  max_additional_users = 10,
  has_whatsapp_bot = true,
  has_excel_reports = true,
  has_featured_banners = true,
  description = 'Para cadenas y marcas líderes: hasta 5 tiendas base y escalabilidad ilimitada con add-ons.',
  features = '[
    "Hasta 5 tiendas base (1 principal + 4 sucursales a $16.00/sede)",
    "Hasta 500 productos por tienda",
    "Hasta 10 motorizados propios registrados",
    "Pedidos mensuales ilimitados",
    "Hasta 10 usuarios de equipo adicionales",
    "Banners destacados VIP en la App Móvil",
    "Bot WhatsApp con IA y Live Chat Multi-operador",
    "Auditoría de inicios de sesión y BI empresarial",
    "Add-on de sucursales extra por solo +$12/mes a partir de la 6ta",
    "Módulo de catálogo masivo disponible (+500 productos)",
    "Soporte VIP 24/7 con ejecutivo asignado"
  ]'::jsonb,
  is_active = true,
  updated_at = NOW()
WHERE code = 'FRANQUICIA';

-- 4. Desactivar planes legacy
UPDATE subscription_plans
SET is_active = false, updated_at = NOW()
WHERE code IN ('COMERCIO', 'CORPORATIVO');
