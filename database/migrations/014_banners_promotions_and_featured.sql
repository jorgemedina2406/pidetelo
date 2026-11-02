-- Migration 014: Banners, Promociones, Comercios Destacados y Productos en Oferta
-- Permite al Super Admin gestionar banners promocionales globales y destacar comercios.
-- Permite a los comercios marcar productos como destacados y en oferta con precios comparativos.

-- 1. Tabla de Banners Promocionales
CREATE TABLE IF NOT EXISTS public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text DEFAULT '',
  coupon_code text DEFAULT '',
  badge_text text DEFAULT 'PROMOCIÓN',
  button_text text DEFAULT 'Pedir ahora',
  link_url text DEFAULT '',
  image_url text DEFAULT '',
  bg_gradient_start text DEFAULT '#f97316',
  bg_gradient_end text DEFAULT '#ea580c',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS para Banners
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Banners públicos para lectura" ON public.banners FOR SELECT USING (true);
CREATE POLICY "Banners administrables por servicio" ON public.banners FOR ALL USING (true);

-- 2. Columna is_featured en Tenants para Comercios Destacados
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- 3. Columnas para Productos en Oferta y Destacados
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_popular boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_on_sale boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS compare_at_price numeric(10, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_percentage integer DEFAULT 0;

COMMENT ON TABLE public.banners IS 'Banners y promociones configurables por el Super Admin para la app móvil y web';
COMMENT ON COLUMN public.tenants.is_featured IS 'Indica si el comercio está destacado en la sección principal por el Super Admin';
COMMENT ON COLUMN public.products.is_on_sale IS 'Indica si el producto está en promoción/oferta especial';
COMMENT ON COLUMN public.products.compare_at_price IS 'Precio original tachado para mostrar descuento al cliente';

