-- ==============================================================================
-- DELIVERY PLATFORM - ROW LEVEL SECURITY (RLS) POLICIES
-- Ejecuta este script en el SQL Editor de Supabase para permitir:
-- 1. Clientes pueden ver comercios activos y productos disponibles (Marketplace)
-- 2. Clientes pueden crear pedidos desde el checkout web
-- 3. Lectura de telemetría GPS para el rastreo del pedido
-- ==============================================================================

-- 1. Habilitar RLS en las tablas
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- 2. TENANTS: Consulta, creación y edición de comercios
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

-- 2.1 CATEGORIES: Lectura pública de categorías
CREATE POLICY "Permitir lectura publica de categorias"
ON categories FOR SELECT
TO anon, authenticated
USING (true);

-- 3. PRODUCTS: Lectura pública de productos disponibles
CREATE POLICY "Permitir lectura publica de productos disponibles"
ON products FOR SELECT
TO anon, authenticated
USING (is_available = true);

-- 4. MODIFIER GROUPS & OPTIONS: Lectura pública
CREATE POLICY "Permitir lectura publica de grupos de extras"
ON modifier_groups FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Permitir lectura publica de opciones extras"
ON modifier_options FOR SELECT
TO anon, authenticated
USING (is_available = true);

-- 5. ORDERS: Clientes pueden crear pedidos y consultar su pedido por número de orden
CREATE POLICY "Permitir a clientes crear pedidos"
ON orders FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Permitir consultar pedidos"
ON orders FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Permitir actualizar estado de pedidos"
ON orders FOR UPDATE
TO anon, authenticated
USING (true);

-- 6. ORDER ITEMS: Permitir crear y leer items del pedido
CREATE POLICY "Permitir insertar items de pedidos"
ON order_items FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Permitir consultar items de pedidos"
ON order_items FOR SELECT
TO anon, authenticated
USING (true);

-- 7. RIDER TELEMETRY: Permitir lectura pública de ubicación GPS para rastreo
CREATE POLICY "Permitir consultar telemetria de repartidores"
ON rider_telemetry FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Permitir insertar telemetria GPS"
ON rider_telemetry FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 8. RIDERS: Permitir crear, consultar y actualizar motorizados
ALTER TABLE riders ADD COLUMN IF NOT EXISTS name VARCHAR(128);
ALTER TABLE riders ADD COLUMN IF NOT EXISTS phone VARCHAR(32);

CREATE POLICY "Permitir consultar motorizados"
ON riders FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Permitir insertar motorizados"
ON riders FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Permitir actualizar motorizados"
ON riders FOR UPDATE
TO anon, authenticated
USING (true);

