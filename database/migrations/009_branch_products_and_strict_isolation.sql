-- ==============================================================================
-- DELIVERY PLATFORM - MIGRACIÓN 009: AISLAMIENTO ESTRICTO DE PRODUCTOS POR SUCURSAL
-- Regla de Negocio: Productos, motorizados, usuarios y comandas son 100% independientes
-- por sucursal. Una sucursal no puede ver ni modificar los de otra.
-- ==============================================================================

-- 1. Añadir columna 'branch_id' a la tabla 'products'
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_products_branch_id ON products(branch_id);

-- 2. Asignar los productos existentes sin sucursal (branch_id IS NULL)
-- a la Sede Principal (is_main = true) de su respectivo comercio.
UPDATE products p
SET branch_id = b.id
FROM branches b
WHERE p.branch_id IS NULL
  AND b.company_id = p.tenant_id
  AND b.is_main = true;

-- 3. Fallback: para cualquier producto restante sin sede principal explícita,
-- asignar a la primera sucursal histórica del comercio
UPDATE products p
SET branch_id = (
  SELECT b.id 
  FROM branches b 
  WHERE b.company_id = p.tenant_id 
  ORDER BY b.created_at ASC 
  LIMIT 1
)
WHERE p.branch_id IS NULL;
