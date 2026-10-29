-- ==============================================================================
-- DELIVERY PLATFORM - MULTI-TENANT POSTGRESQL / SUPABASE DATABASE SCHEMA
-- Features: Multi-tenant, Realtime GPS Telemetry, Kitchen Comandas, Product Modifiers, RLS
-- ==============================================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Enumerated Types (Idempotent: safe to run multiple times)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM (
      'SUPER_ADMIN',
      'MERCHANT_OWNER',
      'MERCHANT_KITCHEN',
      'MERCHANT_DISPATCH',
      'RIDER',
      'CUSTOMER'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM (
      'received',
      'in_kitchen',
      'on_the_way',
      'delivered',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_type') THEN
    CREATE TYPE fulfillment_type AS ENUM (
      'delivery',
      'pickup',
      'dine_in'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE payment_method AS ENUM (
      'cash_usd',
      'mobile_transfer',
      'zelle',
      'pos_on_delivery',
      'online_card'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_type') THEN
    CREATE TYPE vehicle_type AS ENUM (
      'moto',
      'bicicleta',
      'auto'
    );
  END IF;
END $$;

-- ==============================================================================
-- 3. TENANTS (COMERCIOS / RESTAURANTES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL,
  business_name VARCHAR(128),
  tax_id VARCHAR(32),
  phone VARCHAR(32) NOT NULL,
  whatsapp_number VARCHAR(32) NOT NULL,
  email VARCHAR(128),
  logo_url TEXT,
  banner_url TEXT,
  accent_color VARCHAR(16) DEFAULT '#f97316',
  address TEXT NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  delivery_radius_km DECIMAL(4, 2) DEFAULT 8.0,
  base_delivery_fee DECIMAL(8, 2) DEFAULT 2.50,
  min_order_amount DECIMAL(8, 2) DEFAULT 5.00,
  commission_percentage DECIMAL(4, 2) DEFAULT 10.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. USER PROFILES (EXTENDS SUPABASE auth.users OR STANDALONE)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  full_name VARCHAR(128) NOT NULL,
  email VARCHAR(128) UNIQUE NOT NULL,
  phone VARCHAR(32),
  role user_role DEFAULT 'CUSTOMER',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. RIDERS (MOTORIZADOS / REPARTIDORES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS riders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  tenant_ids JSONB DEFAULT '[]'::jsonb,
  name VARCHAR(128),
  email VARCHAR(128),
  phone VARCHAR(32),
  national_id VARCHAR(32),
  vehicle_type vehicle_type DEFAULT 'moto',
  vehicle_plate VARCHAR(32) NOT NULL,
  vehicle_model VARCHAR(128),
  avatar_url TEXT,
  payment_accounts JSONB DEFAULT '[]'::jsonb,
  wallet_balance DECIMAL(10, 2) DEFAULT 0.00,
  total_deliveries INT DEFAULT 0,
  rating DECIMAL(3, 2) DEFAULT 5.00,
  status VARCHAR(24) DEFAULT 'available', -- 'available', 'delivering', 'offline'
  current_lat DECIMAL(10, 7),
  current_lng DECIMAL(10, 7),
  last_ping_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de retiros de billetera de motorizados
CREATE TABLE IF NOT EXISTS rider_withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id UUID NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(8) DEFAULT 'USD',
  account_type VARCHAR(32) NOT NULL,
  payment_account JSONB NOT NULL,
  status VARCHAR(24) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
  reference_code VARCHAR(64),
  notes TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- ==============================================================================
-- 6. CATEGORIES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(64) NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 7. PRODUCTS (CATÁLOGO)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(8) DEFAULT 'USD',
  sku VARCHAR(64),
  barcode VARCHAR(64),
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent column additions for existing installations
ALTER TABLE products ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS currency VARCHAR(8) DEFAULT 'USD';
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(64);
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_products_branch_id ON products(branch_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products (tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (tenant_id, barcode);

-- ==============================================================================
-- 8. PRODUCT MODIFIER GROUPS (EXTRAS / PERSONALIZACIÓN)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS modifier_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title VARCHAR(128) NOT NULL,
  min_selections INT DEFAULT 0,
  max_selections INT DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent column additions for existing installations
ALTER TABLE modifier_groups ADD COLUMN IF NOT EXISTS min_selections INT DEFAULT 0;
ALTER TABLE modifier_groups ADD COLUMN IF NOT EXISTS max_selections INT DEFAULT 1;

CREATE TABLE IF NOT EXISTS modifier_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  price_delta DECIMAL(10, 2) DEFAULT 0.00,
  is_available BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 9. ORDERS (COMANDAS & PEDIDOS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  order_number VARCHAR(32) NOT NULL,
  source VARCHAR(32) DEFAULT 'whatsapp_link',
  status order_status DEFAULT 'received',
  fulfillment_type fulfillment_type DEFAULT 'delivery',
  payment_method payment_method DEFAULT 'mobile_transfer',
  payment_status VARCHAR(24) DEFAULT 'pending', -- 'pending', 'confirmed', 'rejected'
  payment_reference VARCHAR(64),
  customer_name VARCHAR(128) NOT NULL,
  customer_phone VARCHAR(32) NOT NULL,
  delivery_address TEXT,
  delivery_lat DECIMAL(10, 7),
  delivery_lng DECIMAL(10, 7),
  driver_id UUID REFERENCES riders(id) ON DELETE SET NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  delivery_fee DECIMAL(10, 2) DEFAULT 0.00,
  discount DECIMAL(10, 2) DEFAULT 0.00,
  total DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 10. ORDER ITEMS & MODIFIERS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(128) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  item_total DECIMAL(10, 2) NOT NULL,
  selected_modifiers JSONB DEFAULT '[]'::jsonb
);

-- ==============================================================================
-- 11. RIDER TELEMETRY (REALTIME GPS STREAM)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS rider_telemetry (
  id BIGSERIAL PRIMARY KEY,
  rider_id UUID NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  speed_kmh DECIMAL(5, 2) DEFAULT 0,
  heading DECIMAL(5, 2) DEFAULT 0,
  battery_level INT DEFAULT 100,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for instant telemetry querying
CREATE INDEX IF NOT EXISTS idx_telemetry_order_time ON rider_telemetry (order_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_rider_time ON rider_telemetry (rider_id, recorded_at DESC);

-- ==============================================================================
-- 12. REALTIME PUBLICATIONS (SUPABASE WEBSOCKETS)
-- ==============================================================================
-- Enables instant notification when kitchen updates status or rider location moves
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE rider_telemetry;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE riders;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

