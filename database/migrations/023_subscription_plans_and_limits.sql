-- ==============================================================================
-- DELIVERY HUB - MIGRACIÓN 023: MODELO DE PLANES Y LÍMITES POR COMERCIO
-- ==============================================================================
-- Beneficios y límites estrictos por plan de suscripción:
-- 1. PLAN EMPRENDEDOR ($9/mes o $7/mes anual):
--    - Sucursales: 0 adicionales (solo sede principal)
--    - Productos: Hasta 20 productos
--    - Pedidos mensuales: Hasta 20 pedidos al mes
--    - Usuarios adicionales: 1 usuario adicional (+ dueño)
--    - Bot automático de WhatsApp: NO
--    - Reportes avanzados en Excel: NO
--    - Banners destacados en app móvil: NO
--
-- 2. PLAN COMERCIO PRO ($29/mes o $23/mes anual):
--    - Sucursales: Hasta 2 sucursales adicionales (aparte de la sede principal)
--    - Productos: Hasta 100 productos
--    - Pedidos mensuales: Hasta 50 pedidos al mes
--    - Usuarios adicionales: Hasta 3 usuarios adicionales (+ dueño)
--    - Bot automático de WhatsApp: SÍ
--    - Reportes avanzados en Excel: SÍ
--    - Banners destacados en app móvil: NO
--
-- 3. PLAN FRANQUICIA ($79/mes o $63/mes anual):
--    - Sucursales: ILIMITADAS (-1)
--    - Productos: ILIMITADOS (-1)
--    - Pedidos mensuales: ILIMITADOS (-1)
--    - Usuarios adicionales: ILIMITADOS (-1)
--    - Bot automático de WhatsApp: SÍ
--    - Reportes avanzados en Excel: SÍ
--    - Banners destacados en app móvil: SÍ
-- ==============================================================================

-- 1. Actualizar tabla subscription_plans con las columnas de beneficios y cuotas
ALTER TABLE subscription_plans 
  ADD COLUMN IF NOT EXISTS price_monthly DECIMAL(10, 2) DEFAULT 9.00,
  ADD COLUMN IF NOT EXISTS price_annual DECIMAL(10, 2) DEFAULT 7.00,
  ADD COLUMN IF NOT EXISTS has_whatsapp_bot BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_excel_reports BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_featured_banners BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_additional_users INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_monthly_orders INT NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS max_products INT NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;

-- 2. Asegurar que tenants tenga la columna subscription_plan_id y plan_code
ALTER TABLE tenants 
  ADD COLUMN IF NOT EXISTS plan_code VARCHAR(32) DEFAULT 'EMPRENDEDOR';

-- 3. Insertar o actualizar los 3 planes oficiales con sus precios y reglas exactas
INSERT INTO subscription_plans (
  code, 
  name, 
  max_branches, 
  price_monthly, 
  price_annual, 
  monthly_fee_usd, 
  has_whatsapp_bot, 
  has_excel_reports, 
  has_featured_banners, 
  max_additional_users, 
  max_monthly_orders, 
  max_products, 
  description,
  features,
  is_active
)
VALUES 
  (
    'EMPRENDEDOR', 
    'Plan Emprendedor', 
    0, 
    9.00, 
    7.00, 
    9.00, 
    false, 
    false, 
    false, 
    1, 
    20, 
    20, 
    'Para negocios y marcas que inician con su sede principal.',
    '[
      "0 sucursales adicionales (solo sede principal)",
      "Hasta 20 productos en catálogo",
      "Hasta 20 pedidos al mes",
      "1 usuario de equipo adicional",
      "Tienda web y menú digital con código QR",
      "Acceso a la App Móvil de Clientes",
      "Acceso a la App de Repartidores con GPS",
      "Pagos 100% directos (0% comisión sobre ventas)",
      "Tracking de pedidos en tiempo real",
      "Soporte estándar"
    ]'::jsonb,
    true
  ),
  (
    'COMERCIO_PRO', 
    'Plan Comercio Pro', 
    2, 
    29.00, 
    23.00, 
    29.00, 
    true, 
    true, 
    false, 
    3, 
    50, 
    100, 
    'Para comercios establecidos que buscan automatización y expansión local.',
    '[
      "Todo lo incluido en el Plan Emprendedor",
      "Hasta 2 sucursales adicionales (3 sedes en total)",
      "Hasta 100 productos en catálogo",
      "Hasta 50 pedidos al mes",
      "Hasta 3 usuarios de equipo adicionales",
      "Bot automático de WhatsApp y Live Chat 24/7",
      "Reportes avanzados en Excel (.xlsx)",
      "Soporte prioritario"
    ]'::jsonb,
    true
  ),
  (
    'FRANQUICIA', 
    'Plan Franquicia', 
    -1, 
    79.00, 
    63.00, 
    79.00, 
    true, 
    true, 
    true, 
    -1, 
    -1, 
    -1, 
    'Para cadenas gastronómicas, franquicias y marcas líderes de alto volumen.',
    '[
      "Todo lo incluido en el Plan Comercio Pro",
      "Sucursales físicas ilimitadas",
      "Productos en catálogo ilimitados",
      "Pedidos al mes ilimitados",
      "Cuentas de usuarios de equipo ilimitadas",
      "Banners destacados VIP en la App Móvil",
      "Bot automático de WhatsApp ilimitado con IA",
      "Auditoría de inicios de sesión y BI empresarial",
      "Soporte VIP 24/7 con ejecutivo asignado"
    ]'::jsonb,
    true
  )
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  max_branches = EXCLUDED.max_branches,
  price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual,
  monthly_fee_usd = EXCLUDED.monthly_fee_usd,
  has_whatsapp_bot = EXCLUDED.has_whatsapp_bot,
  has_excel_reports = EXCLUDED.has_excel_reports,
  has_featured_banners = EXCLUDED.has_featured_banners,
  max_additional_users = EXCLUDED.max_additional_users,
  max_monthly_orders = EXCLUDED.max_monthly_orders,
  max_products = EXCLUDED.max_products,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  is_active = true,
  updated_at = NOW();

-- 4. Normalizar códigos antiguos si existían
UPDATE tenants 
SET subscription_plan_id = (SELECT id FROM subscription_plans WHERE code = 'COMERCIO_PRO')
WHERE subscription_plan_id IN (SELECT id FROM subscription_plans WHERE code = 'COMERCIO');

UPDATE tenants 
SET subscription_plan_id = (SELECT id FROM subscription_plans WHERE code = 'FRANQUICIA')
WHERE subscription_plan_id IN (SELECT id FROM subscription_plans WHERE code = 'CORPORATIVO');

-- 5. Asignar Plan Comercio Pro a Burger Lab por defecto y Plan Emprendedor a cualquier tenant sin plan
UPDATE tenants 
SET 
  subscription_plan_id = (SELECT id FROM subscription_plans WHERE code = 'COMERCIO_PRO'),
  plan_code = 'COMERCIO_PRO'
WHERE slug = 'burger-lab' OR subscription_plan_id IS NULL;

-- Sincronizar columna plan_code en tenants
UPDATE tenants t
SET plan_code = sp.code
FROM subscription_plans sp
WHERE t.subscription_plan_id = sp.id;
