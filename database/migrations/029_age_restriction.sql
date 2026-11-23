-- 029_age_restriction.sql
-- Agrega soporte nativo para restricción de mayoría de edad (+18) en comercios (licorerías/bodegones) y productos individuales.
-- Nota: El backend también mantiene respaldo automático en archivos metadata y etiquetas [AGE_18_PLUS] en orders.notes.

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS is_age_restricted BOOLEAN DEFAULT FALSE;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_age_restricted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tenants.is_age_restricted IS 'Indica si el comercio vende productos restringidos para mayores de 18 años (ej. licores, bodegones).';
COMMENT ON COLUMN products.is_age_restricted IS 'Indica si el producto individual requiere verificación de mayoría de edad (+18).';
