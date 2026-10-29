-- Migration 010: Add branding and currency configuration columns to tenants
-- Permite almacenar de forma persistente en Supabase la tasa de cambio, moneda base, modo de visualización y eslogan.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS tagline text DEFAULT '',
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(10, 2) DEFAULT 45.50,
  ADD COLUMN IF NOT EXISTS base_currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS display_mode text DEFAULT 'usd_and_bs',
  ADD COLUMN IF NOT EXISTS currency_settings jsonb DEFAULT '{"baseCurrency": "USD", "displayMode": "usd_and_bs", "exchangeRate": 45.50}'::jsonb;

-- Comentario explicativo
COMMENT ON COLUMN public.tenants.tagline IS 'Eslogan o lema comercial de la tienda';
COMMENT ON COLUMN public.tenants.exchange_rate IS 'Tasa de cambio del día (Bs / USD) configurada por el comercio';
COMMENT ON COLUMN public.tenants.base_currency IS 'Moneda base de registro (USD o VES)';
COMMENT ON COLUMN public.tenants.display_mode IS 'Modo de visualización de precios para el cliente: usd_and_bs, bs_and_usd, only_usd, only_bs';
COMMENT ON COLUMN public.tenants.currency_settings IS 'Objeto con la configuración monetaria completa del comercio';
