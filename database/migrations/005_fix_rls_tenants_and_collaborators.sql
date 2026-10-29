-- ==============================================================================
-- DELIVERY PLATFORM - MIGRACIÓN 005: POLÍTICAS RLS PARA TENANTS Y COLABORADORES
-- Resuelve: "new row violates row-level security policy for table 'tenants'"
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.
-- ==============================================================================

-- 1. TABLA TENANTS (Comercios)
-- Permitir lectura general (tanto activos para clientes como pausados para SuperAdmin)
DROP POLICY IF EXISTS "Permitir lectura publica de comercios activos" ON tenants;
DROP POLICY IF EXISTS "Permitir consultar comercios" ON tenants;
DROP POLICY IF EXISTS "Permitir insertar comercios" ON tenants;
DROP POLICY IF EXISTS "Permitir actualizar comercios" ON tenants;
DROP POLICY IF EXISTS "Permitir eliminar comercios" ON tenants;

CREATE POLICY "Permitir consultar comercios"
ON tenants FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Permitir insertar comercios"
ON tenants FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Permitir actualizar comercios"
ON tenants FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Permitir eliminar comercios"
ON tenants FOR DELETE
TO anon, authenticated
USING (true);


-- 2. TABLA STORE_COLLABORATORS (Usuarios y Dueños de Comercios)
ALTER TABLE store_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir consultar colaboradores" ON store_collaborators;
DROP POLICY IF EXISTS "Permitir insertar colaboradores" ON store_collaborators;
DROP POLICY IF EXISTS "Permitir actualizar colaboradores" ON store_collaborators;
DROP POLICY IF EXISTS "Permitir eliminar colaboradores" ON store_collaborators;

CREATE POLICY "Permitir consultar colaboradores"
ON store_collaborators FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Permitir insertar colaboradores"
ON store_collaborators FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Permitir actualizar colaboradores"
ON store_collaborators FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Permitir eliminar colaboradores"
ON store_collaborators FOR DELETE
TO anon, authenticated
USING (true);


-- 3. TABLA BRANCHES (Sucursales Físicas)
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir consultar sucursales" ON branches;
DROP POLICY IF EXISTS "Permitir insertar sucursales" ON branches;
DROP POLICY IF EXISTS "Permitir actualizar sucursales" ON branches;

CREATE POLICY "Permitir consultar sucursales"
ON branches FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Permitir insertar sucursales"
ON branches FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Permitir actualizar sucursales"
ON branches FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);


-- 4. TABLA BRANCH_PAYMENT_CREDENTIALS
ALTER TABLE branch_payment_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir consultar credenciales pago" ON branch_payment_credentials;
DROP POLICY IF EXISTS "Permitir insertar credenciales pago" ON branch_payment_credentials;
DROP POLICY IF EXISTS "Permitir actualizar credenciales pago" ON branch_payment_credentials;

CREATE POLICY "Permitir consultar credenciales pago"
ON branch_payment_credentials FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Permitir insertar credenciales pago"
ON branch_payment_credentials FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Permitir actualizar credenciales pago"
ON branch_payment_credentials FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);
