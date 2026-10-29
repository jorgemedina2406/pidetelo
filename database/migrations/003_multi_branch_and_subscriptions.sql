-- ==============================================================================
-- DELIVERY HUB - MIGRACIÓN 003: MULTI-SUCURSAL Y PLANES DE SUSCRIPCIÓN
-- ==============================================================================
-- Regla de Negocio: Cero comisiones por ventas. Pagos 100% directos a la sede.
-- Ingresos de plataforma basados en suscripciones mensuales fijas por sucursales.
-- ==============================================================================

-- 1. Asegurar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabla de Planes de Suscripción (Gestionada por Super Admin)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(32) UNIQUE NOT NULL, -- 'EMPRENDEDOR', 'COMERCIO', 'CORPORATIVO'
  name VARCHAR(64) NOT NULL,
  max_branches INT NOT NULL DEFAULT 1, -- 1, 3, o 999 (Ilimitado)
  monthly_fee_usd DECIMAL(10, 2) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed de Planes Iniciales
INSERT INTO subscription_plans (code, name, max_branches, monthly_fee_usd, description)
VALUES 
  ('EMPRENDEDOR', 'Plan Emprendedor', 1, 19.99, 'Ideal para un único local físico (1 sucursal)'),
  ('COMERCIO', 'Plan Comercio', 3, 49.99, 'Hasta 3 sucursales con despacho y cobro independiente'),
  ('CORPORATIVO', 'Plan Corporativo', 999, 99.99, 'Sucursales ilimitadas para franquicias y cadenas')
ON CONFLICT (code) DO NOTHING;

-- 3. Añadir suscripción a tabla 'tenants' (Empresa Matriz)
ALTER TABLE tenants 
  ADD COLUMN IF NOT EXISTS subscription_plan_id UUID REFERENCES subscription_plans(id),
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(24) DEFAULT 'active';

-- Asignar Plan Comercio por defecto al tenant demo 'Burger Lab'
UPDATE tenants 
SET subscription_plan_id = (SELECT id FROM subscription_plans WHERE code = 'COMERCIO')
WHERE slug = 'burger-lab' AND subscription_plan_id IS NULL;

-- 4. Tipo de estado para sucursales
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'branch_status') THEN
    CREATE TYPE branch_status AS ENUM ('pending_approval', 'active', 'inactive', 'rejected');
  END IF;
END $$;

-- 5. Tabla de Sucursales Físicas (Branches)
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  slug VARCHAR(64) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  whatsapp_number VARCHAR(32) NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  delivery_radius_km DECIMAL(4, 2) DEFAULT 8.0,
  base_delivery_fee DECIMAL(8, 2) DEFAULT 2.50,
  min_order_amount DECIMAL(8, 2) DEFAULT 5.00,
  business_hours JSONB DEFAULT '{"open": "11:00", "close": "23:00", "isOpenToday": true}'::jsonb,
  status branch_status DEFAULT 'pending_approval',
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_branches_company_id ON branches(company_id);
CREATE INDEX IF NOT EXISTS idx_branches_status ON branches(status);
CREATE INDEX IF NOT EXISTS idx_branches_coords ON branches(latitude, longitude);

-- 6. Tabla de Credenciales Financieras Directas por Sucursal
CREATE TABLE IF NOT EXISTS branch_payment_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID UNIQUE NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  pago_movil JSONB NOT NULL DEFAULT '{"enabled": true, "bank_code": "0102", "bank_name": "Banco de Venezuela", "phone": "04121234567", "id_number": "J-12345678-0", "account_name": "Burger Lab Sede"}'::jsonb,
  zelle JSONB NOT NULL DEFAULT '{"enabled": false, "email": "", "account_name": ""}'::jsonb,
  cash_usd JSONB NOT NULL DEFAULT '{"enabled": true}'::jsonb,
  decentralized_gateway JSONB DEFAULT '{"enabled": false, "provider": "binance_pay", "merchant_id": ""}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branch_payment_branch_id ON branch_payment_credentials(branch_id);

-- 7. Tabla de Inventario y Disponibilidad Aislada por Sucursal
CREATE TABLE IF NOT EXISTS branch_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  is_available BOOLEAN DEFAULT true,
  stock_quantity INT DEFAULT 100,
  price_override DECIMAL(10, 2),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_inventory_branch_id ON branch_inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_product_id ON branch_inventory(product_id);

-- 8. Enlazar Órdenes a Sucursal
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON orders(branch_id);

-- 9. Añadir branches a publicación Realtime de Supabase
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE branches;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE branch_inventory;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 10. Seed de Sucursales Iniciales para Demostración Inmediata (Burger Lab)
DO $$
DECLARE
  v_burger_lab_id UUID := 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
  v_branch_la_mata UUID := 'c1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c01';
  v_branch_centro UUID := 'c1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c02';
  v_branch_placer UUID := 'c1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c03';
BEGIN
  -- Verificar si existe Burger Lab
  IF EXISTS (SELECT 1 FROM tenants WHERE id = v_burger_lab_id) THEN

    -- Sucursal 1: La Mata (Activa)
    INSERT INTO branches (id, company_id, name, slug, phone, whatsapp_number, address, latitude, longitude, delivery_radius_km, base_delivery_fee, status)
    VALUES (
      v_branch_la_mata,
      v_burger_lab_id,
      'Sede La Mata',
      'sede-la-mata',
      '+584121234567',
      '584121234567',
      'Av. Intercomunal Barquisimeto-Cabudare, Sector La Mata',
      10.026743,
      -69.257153,
      8.0,
      2.50,
      'active'
    ) ON CONFLICT (company_id, slug) DO NOTHING;

    INSERT INTO branch_payment_credentials (branch_id, pago_movil, zelle, cash_usd)
    VALUES (
      v_branch_la_mata,
      '{"enabled": true, "bank_code": "0102", "bank_name": "Banco de Venezuela", "phone": "04121234567", "id_number": "J-50123456-1", "account_name": "Burger Lab La Mata"}'::jsonb,
      '{"enabled": true, "email": "pagos.lamata@burgerlab.com", "account_name": "Burger Lab La Mata LLC"}'::jsonb,
      '{"enabled": true}'::jsonb
    ) ON CONFLICT (branch_id) DO NOTHING;

    -- Sucursal 2: Cabudare Centro (Activa)
    INSERT INTO branches (id, company_id, name, slug, phone, whatsapp_number, address, latitude, longitude, delivery_radius_km, base_delivery_fee, status)
    VALUES (
      v_branch_centro,
      v_burger_lab_id,
      'Sede Cabudare Centro',
      'sede-cabudare-centro',
      '+584129876543',
      '584129876543',
      'Av. Libertador c/c Calle 9, Centro Comercial Cabudare Centro, PB',
      10.038500,
      -69.259200,
      7.0,
      2.00,
      'active'
    ) ON CONFLICT (company_id, slug) DO NOTHING;

    INSERT INTO branch_payment_credentials (branch_id, pago_movil, zelle, cash_usd)
    VALUES (
      v_branch_centro,
      '{"enabled": true, "bank_code": "0134", "bank_name": "Banesco", "phone": "04129876543", "id_number": "J-50123456-2", "account_name": "Burger Lab Centro"}'::jsonb,
      '{"enabled": true, "email": "pagos.centro@burgerlab.com", "account_name": "Burger Lab Centro LLC"}'::jsonb,
      '{"enabled": true}'::jsonb
    ) ON CONFLICT (branch_id) DO NOTHING;

    -- Sucursal 3: El Placer (Pendiente por Aprobación para probar Super Admin)
    INSERT INTO branches (id, company_id, name, slug, phone, whatsapp_number, address, latitude, longitude, delivery_radius_km, base_delivery_fee, status)
    VALUES (
      v_branch_placer,
      v_burger_lab_id,
      'Sede El Placer (Nueva)',
      'sede-el-placer',
      '+584125556677',
      '584125556677',
      'Urb. El Placer, Manzana B, Cabudare',
      10.034574,
      -69.237544,
      6.0,
      2.00,
      'pending_approval'
    ) ON CONFLICT (company_id, slug) DO NOTHING;

    INSERT INTO branch_payment_credentials (branch_id, pago_movil, zelle, cash_usd)
    VALUES (
      v_branch_placer,
      '{"enabled": true, "bank_code": "0108", "bank_name": "Banco Provincial", "phone": "04125556677", "id_number": "J-50123456-3", "account_name": "Burger Lab El Placer"}'::jsonb,
      '{"enabled": false, "email": "", "account_name": ""}'::jsonb,
      '{"enabled": true}'::jsonb
    ) ON CONFLICT (branch_id) DO NOTHING;

  END IF;
END $$;
