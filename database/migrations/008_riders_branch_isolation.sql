-- ==============================================================================
-- DELIVERY PLATFORM - MIGRACIÓN 008: AISLAMIENTO DE MOTORIZADOS POR SUCURSAL
-- Regla de Negocio: Los motorizados deben ser independientes por sucursal.
-- Los motorizados de la Sede Principal no deben aparecer en las demás sucursales.
-- ==============================================================================

-- 1. Añadir columna 'branch_id' a la tabla 'riders'
ALTER TABLE riders 
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_riders_branch_id ON riders(branch_id);

-- 2. Sincronizar 'branch_id' desde la tabla 'profiles' para motorizados que ya tienen sede asignada
UPDATE riders r
SET branch_id = p.branch_id
FROM profiles p
WHERE p.id = r.user_id 
  AND p.branch_id IS NOT NULL;

-- 3. Asignar los motorizados restantes sin sucursal (branch_id IS NULL)
-- a la Sede Principal (is_main = true) de su respectivo comercio.
UPDATE riders r
SET branch_id = b.id
FROM branches b
WHERE r.branch_id IS NULL
  AND b.company_id = r.tenant_id
  AND b.is_main = true;

-- 4. Fallback: para cualquier motorizado restante sin sede principal explícita,
-- asignar a la primera sucursal histórica del comercio
UPDATE riders r
SET branch_id = (
  SELECT b.id 
  FROM branches b 
  WHERE b.company_id = r.tenant_id 
  ORDER BY b.created_at ASC 
  LIMIT 1
)
WHERE r.branch_id IS NULL;

-- 5. Sincronizar branch_id en la tabla 'profiles' para usuarios con rol 'RIDER' que aún lo tengan nulo
UPDATE profiles p
SET branch_id = r.branch_id
FROM riders r
WHERE p.id = r.user_id 
  AND p.branch_id IS NULL 
  AND r.branch_id IS NOT NULL;
