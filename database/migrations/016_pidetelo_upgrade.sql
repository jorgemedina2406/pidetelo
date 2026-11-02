-- =========================================================================
-- MIGRACIÓN 016: PIDETELO UPGRADE COMPLETO (ALL-IN-ONE & IDEMPOTENTE)
-- Banners, Categorías, Cupones Globales/Segmentados, Notificaciones, Stock y Roles
-- =========================================================================

-- 1. Actualizar tabla tenants para asegurar categorías, subcategorías y destacados
ALTER TABLE IF EXISTS tenants ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Restaurantes';
ALTER TABLE IF EXISTS tenants ADD COLUMN IF NOT EXISTS subcategories JSONB DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS tenants ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

-- 2. Asegurar tabla banners (Banners promocionales del Marketplace)
CREATE TABLE IF NOT EXISTS public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  coupon_code TEXT DEFAULT '',
  badge_text TEXT DEFAULT 'PROMOCIÓN FLASH',
  button_text TEXT DEFAULT 'Pedir ahora',
  link_url TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  bg_gradient_start TEXT DEFAULT '#f97316',
  bg_gradient_end TEXT DEFAULT '#ea580c',
  sort_order INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.banners ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'banners' AND policyname = 'Banners públicos para lectura'
  ) THEN
    CREATE POLICY "Banners públicos para lectura" ON public.banners FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'banners' AND policyname = 'Banners administrables por servicio'
  ) THEN
    CREATE POLICY "Banners administrables por servicio" ON public.banners FOR ALL USING (true);
  END IF;
END $$;

-- 3. Asegurar tabla business_categories (con columna sort_order)
CREATE TABLE IF NOT EXISTS public.business_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT DEFAULT '🍽️',
  subcategories JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar columnas si la tabla ya existía previamente
ALTER TABLE IF EXISTS public.business_categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 1;
ALTER TABLE IF EXISTS public.business_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE IF EXISTS public.business_categories ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'business_categories' AND policyname = 'Categorías públicas para lectura'
  ) THEN
    CREATE POLICY "Categorías públicas para lectura" ON public.business_categories FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'business_categories' AND policyname = 'Categorías administrables'
  ) THEN
    CREATE POLICY "Categorías administrables" ON public.business_categories FOR ALL USING (true);
  END IF;
END $$;

-- Seed o actualización de categorías iniciales del marketplace
INSERT INTO public.business_categories (name, slug, icon, subcategories, sort_order, is_active)
VALUES
  ('Restaurantes', 'restaurantes', '🍽️', '["Hamburguesas", "Sushi & Asiática", "Pastas & Italiana", "Pizzas", "Pollos & Brasas", "Carnes & Grill", "Comida Rápida", "Comida Mexicana", "Café & Bakery", "Desayunos"]'::jsonb, 1, true),
  ('Súper', 'super', '🛒', '["Víveres", "Lácteos & Huevos", "Frutas & Verduras", "Carnicería & Aves", "Limpieza", "Snacks & Bebidas"]'::jsonb, 2, true),
  ('Farmacias', 'farmacias', '💊', '["Medicamentos", "Cuidado Personal", "Bebés & Maternidad", "Primeros Auxilios", "Vitaminas"]'::jsonb, 3, true),
  ('Mascotas', 'mascotas', '🐾', '["Alimento Perros", "Alimento Gatos", "Snacks & Premios", "Higiene & Farmacia", "Accesorios"]'::jsonb, 4, true),
  ('Licores', 'licores', '🍷', '["Cervezas", "Vinos", "Rones", "Whiskies", "Snacks & Hielo"]'::jsonb, 5, true),
  ('Postres', 'postres', '🧁', '["Tortas & Pasteles", "Helados", "Donas & Churros", "Chocolatería", "Galletas"]'::jsonb, 6, true)
ON CONFLICT (slug) DO UPDATE
SET 
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  subcategories = EXCLUDED.subcategories,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- 4. Tabla coupons con soporte para Cupones Globales y Segmentación
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT DEFAULT '',
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
  min_order_amount NUMERIC(10, 2) DEFAULT 0,
  max_discount_amount NUMERIC(10, 2) DEFAULT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  usage_limit INTEGER DEFAULT NULL,
  used_count INTEGER DEFAULT 0,
  is_global BOOLEAN DEFAULT FALSE,
  target_condition TEXT DEFAULT 'all',
  notification_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar columnas si coupons ya existía
ALTER TABLE IF EXISTS public.coupons ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS public.coupons ADD COLUMN IF NOT EXISTS target_condition TEXT DEFAULT 'all';
ALTER TABLE IF EXISTS public.coupons ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS public.coupons ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(10, 2) DEFAULT NULL;
ALTER TABLE IF EXISTS public.coupons ALTER COLUMN tenant_id DROP NOT NULL;

ALTER TABLE IF EXISTS public.coupons ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'coupons' AND policyname = 'Cupones visibles para todos'
  ) THEN
    CREATE POLICY "Cupones visibles para todos" ON public.coupons FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'coupons' AND policyname = 'Cupones administrables'
  ) THEN
    CREATE POLICY "Cupones administrables" ON public.coupons FOR ALL USING (true);
  END IF;
END $$;

-- 5. Tabla customer_notifications (App Móvil y Web)
CREATE TABLE IF NOT EXISTS public.customer_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  coupon_code TEXT,
  type TEXT DEFAULT 'coupon',
  target_condition TEXT DEFAULT 'all',
  is_global BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.customer_notifications ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE IF EXISTS public.customer_notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE IF EXISTS public.customer_notifications ADD COLUMN IF NOT EXISTS target_condition TEXT DEFAULT 'all';
ALTER TABLE IF EXISTS public.customer_notifications ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE;

ALTER TABLE IF EXISTS public.customer_notifications ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customer_notifications' AND policyname = 'Notificaciones lectura pública'
  ) THEN
    CREATE POLICY "Notificaciones lectura pública" ON public.customer_notifications FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customer_notifications' AND policyname = 'Notificaciones gestión total'
  ) THEN
    CREATE POLICY "Notificaciones gestión total" ON public.customer_notifications FOR ALL USING (true);
  END IF;
END $$;

-- 6. Control de Stock, Promociones y Destacados en Productos
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS is_on_sale BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC(10, 2) DEFAULT NULL;
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS discount_percentage INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS track_stock BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT NULL;
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS previous_stock INTEGER DEFAULT NULL;

-- 7. Historial de Auditoría de Stock
CREATE TABLE IF NOT EXISTS public.stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID,
  tenant_id UUID,
  previous_stock INTEGER,
  new_stock INTEGER,
  difference INTEGER,
  change_type TEXT NOT NULL,
  reference_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.stock_history ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stock_history' AND policyname = 'Auditoría stock visible'
  ) THEN
    CREATE POLICY "Auditoría stock visible" ON stock_history FOR ALL USING (true);
  END IF;
END $$;

-- 8. Roles y Permisos (RBAC)
CREATE TABLE IF NOT EXISTS public.rbac_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  permissions TEXT[] DEFAULT '{}',
  is_system BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.rbac_roles ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rbac_roles' AND policyname = 'Roles visibles'
  ) THEN
    CREATE POLICY "Roles visibles" ON public.rbac_roles FOR ALL USING (true);
  END IF;
END $$;

INSERT INTO public.rbac_roles (id, name, description, permissions)
VALUES
  ('superadmin', 'Super Administrador', 'Control total de la plataforma Pídetelo, comercios, roles y métricas globales', ARRAY['all', 'manage_tenants', 'manage_categories', 'manage_roles', 'view_metrics', 'manage_global_coupons', 'manage_users']),
  ('merchant_admin', 'Dueño / Administrador de Comercio', 'Control completo de su comercio, productos, sucursales, finanzas y cupones', ARRAY['manage_catalog', 'manage_branches', 'manage_coupons', 'send_notifications', 'manage_staff', 'view_store_metrics', 'manage_orders']),
  ('branch_manager', 'Gerente de Sucursal', 'Supervisión y control de pedidos, horarios y repartidores de su sede', ARRAY['manage_branch_orders', 'manage_branch_riders', 'view_branch_metrics', 'update_branch_schedule']),
  ('kitchen_operator', 'Operador de Cocina / Caja', 'Recepción de comandas, cambio de estado de preparación y despacho', ARRAY['view_kitchen_orders', 'update_order_status']),
  ('rider', 'Repartidor / Motorizado', 'Recepción de pedidos asignados, telemetría GPS y confirmación de entrega', ARRAY['view_assigned_orders', 'update_delivery_status', 'send_gps']),
  ('customer', 'Cliente', 'Navegación del catálogo, creación de órdenes y canje de cupones', ARRAY['create_orders', 'view_notifications', 'apply_coupons'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions;
