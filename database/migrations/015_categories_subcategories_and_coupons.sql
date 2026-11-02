-- Migration 015: Categorías Comerciales Dinámicas, Subcategorías y Cupones de Oferta
-- Permite al Super Admin crear nuevas categorías de comercio con sus subdivisiones/subcategorías.
-- Permite a los comercios seleccionar una categoría y una o más subdivisiones (ej: Hamburguesas, Sushi, Pastas en Restaurantes).
-- Permite a cada comercio crear y gestionar Cupones de Oferta (descuento porcentual o fijo, monto mínimo, fecha de expiración).

-- 1. Asegurar columnas category y subcategories en tabla tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'Restaurantes',
  ADD COLUMN IF NOT EXISTS subcategories jsonb DEFAULT '[]'::jsonb;

-- 2. Tabla de Categorías de Negocio de la Plataforma
CREATE TABLE IF NOT EXISTS public.business_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  icon text NOT NULL DEFAULT '🍽️',
  subcategories jsonb DEFAULT '[]'::jsonb,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS para business_categories
ALTER TABLE public.business_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categorías visibles para todos" ON public.business_categories FOR SELECT USING (true);
CREATE POLICY "Categorías administrables por servicio" ON public.business_categories FOR ALL USING (true);

-- Semilla inicial con las categorías principales y sus subdivisiones
INSERT INTO public.business_categories (name, slug, icon, subcategories, sort_order)
VALUES
  ('Restaurantes', 'restaurantes', '🍽️', '["Hamburguesas", "Sushi & Asiática", "Pastas & Italiana", "Pizzas", "Pollos & Brasas", "Carnes & Grill", "Comida Rápida", "Comida Mexicana", "Café & Bakery", "Desayunos", "Arepas & Empanadas"]'::jsonb, 1),
  ('Súper', 'super', '🛒', '["Víveres", "Lácteos & Huevos", "Frutas & Verduras", "Carnicería & Aves", "Limpieza", "Bebidas"]'::jsonb, 2),
  ('Farmacias', 'farmacias', '💊', '["Medicamentos", "Cuidado Personal", "Bebés & Maternidad", "Primeros Auxilios", "Vitaminas"]'::jsonb, 3),
  ('Mascotas', 'mascotas', '🐾', '["Alimento Perros", "Alimento Gatos", "Snacks & Premios", "Higiene & Farmacia", "Accesorios"]'::jsonb, 4),
  ('Licores', 'licores', '🍷', '["Cervezas", "Vinos", "Rones", "Whiskies", "Snacks & Hielo"]'::jsonb, 5),
  ('Postres', 'postres', '🧁', '["Tortas & Pasteles", "Helados", "Donas & Churros", "Chocolatería", "Galletas"]'::jsonb, 6)
ON CONFLICT (slug) DO UPDATE
SET 
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  subcategories = EXCLUDED.subcategories,
  sort_order = EXCLUDED.sort_order;

-- 3. Tabla de Cupones de Oferta por Comercio
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text DEFAULT '',
  discount_type text NOT NULL DEFAULT 'percentage', -- 'percentage' o 'fixed'
  discount_value numeric(10, 2) NOT NULL DEFAULT 10.00,
  min_order_amount numeric(10, 2) DEFAULT 0.00,
  max_discount numeric(10, 2) DEFAULT NULL,
  usage_limit integer DEFAULT NULL,
  times_used integer DEFAULT 0,
  is_active boolean DEFAULT true,
  expires_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_tenant_coupon_code UNIQUE (tenant_id, code)
);

-- RLS para coupons
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cupones visibles para consulta" ON public.coupons FOR SELECT USING (true);
CREATE POLICY "Cupones administrables por comercio" ON public.coupons FOR ALL USING (true);

COMMENT ON TABLE public.business_categories IS 'Categorías globales del marketplace gestionables por Super Admin';
COMMENT ON COLUMN public.tenants.subcategories IS 'Subdivisiones o especialidades seleccionadas por el comercio (ej: Hamburguesas, Sushi)';
COMMENT ON TABLE public.coupons IS 'Cupones de descuento y promociones creados por cada comercio';

