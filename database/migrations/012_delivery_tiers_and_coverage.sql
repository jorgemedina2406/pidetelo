-- Migración 012: Tarifas de Delivery por Kilometraje y Validación de Cobertura
-- Permite configurar rangos personalizados de distancia (ej: 0-2km $1.50, 2-5km $3.00) por comercio y sucursal.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS delivery_tiers JSONB DEFAULT '[
    {"id": "tier_1", "minKm": 0, "maxKm": 2, "price": 1.50},
    {"id": "tier_2", "minKm": 2, "maxKm": 5, "price": 3.00},
    {"id": "tier_3", "minKm": 5, "maxKm": 8, "price": 4.50}
  ]'::jsonb;

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS delivery_tiers JSONB DEFAULT '[
    {"id": "tier_1", "minKm": 0, "maxKm": 2, "price": 1.50},
    {"id": "tier_2", "minKm": 2, "maxKm": 5, "price": 3.00},
    {"id": "tier_3", "minKm": 5, "maxKm": 8, "price": 4.50}
  ]'::jsonb;

COMMENT ON COLUMN public.tenants.delivery_tiers IS 'Rangos de cobro por kilometraje configurados por el comercio [{minKm, maxKm, price}]';
COMMENT ON COLUMN public.branches.delivery_tiers IS 'Rangos de cobro por kilometraje específicos por sucursal [{minKm, maxKm, price}]';

