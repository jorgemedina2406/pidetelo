-- Migration 013: Add branding, currency, and custom configuration columns to branches
-- Permite almacenar de forma persistente e independiente por cada sucursal:
-- la tasa de cambio, moneda base, modo de visualización, eslogan, colores, logos y escalas de delivery.

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS tagline text DEFAULT '',
  ADD COLUMN IF NOT EXISTS accent_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS logo_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS banner_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(10, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS base_currency text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS display_mode text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS currency_settings jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivery_tiers jsonb DEFAULT NULL;

COMMENT ON COLUMN public.branches.tagline IS 'Eslogan comercial específico de la sucursal';
COMMENT ON COLUMN public.branches.accent_color IS 'Color de acento de marca personalizado para la sucursal';
COMMENT ON COLUMN public.branches.logo_url IS 'Logo específico de la sucursal';
COMMENT ON COLUMN public.branches.banner_url IS 'Banner o portada específica de la sucursal';
COMMENT ON COLUMN public.branches.exchange_rate IS 'Tasa de cambio personalizada para la sucursal';
COMMENT ON COLUMN public.branches.base_currency IS 'Moneda base de registro de la sucursal (USD o VES)';
COMMENT ON COLUMN public.branches.display_mode IS 'Modo de visualización de precios para los clientes de esta sucursal';
COMMENT ON COLUMN public.branches.currency_settings IS 'Configuración monetaria completa de la sucursal';
COMMENT ON COLUMN public.branches.delivery_tiers IS 'Escalas de kilometraje y tarifas de envío específicas de la sucursal';
