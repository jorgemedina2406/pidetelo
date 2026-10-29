-- ==============================================================================
-- DELIVERY PLATFORM - MIGRACIÓN 007: CREDENCIALES INDEPENDIENTES POR SUCURSAL
-- Regla de Negocio: Cada sucursal cuenta con sus propias credenciales de acceso (email/password).
-- La Sede Principal es la única que lleva el conteo de sucursales y la que puede crear sucursales.
-- Una sucursal secundaria tiene acceso aislado y NO puede crear sucursales.
-- ==============================================================================

-- 1. Añadir columnas de credenciales y rol principal a la tabla 'branches'
ALTER TABLE branches 
  ADD COLUMN IF NOT EXISTS is_main BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email VARCHAR(128),
  ADD COLUMN IF NOT EXISTS manager_name VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_branches_email ON branches(email);
CREATE INDEX IF NOT EXISTS idx_branches_is_main ON branches(is_main);

-- 2. Asegurar columna password_hash en store_collaborators
ALTER TABLE store_collaborators
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 3. Identificar y marcar la Sede Principal histórica para cada comercio registrado
-- (La primera sucursal creada o la que contenga 'principal' en el nombre)
UPDATE branches b1
SET is_main = true
WHERE b1.id IN (
  SELECT DISTINCT ON (company_id) id
  FROM branches
  ORDER BY company_id, 
           CASE WHEN name ILIKE '%principal%' OR slug ILIKE '%principal%' THEN 0 ELSE 1 END,
           created_at ASC
);
