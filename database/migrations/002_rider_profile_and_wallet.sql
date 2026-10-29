-- ==============================================================================
-- DELIVERY HUB - MIGRACIÓN 002: PERFIL COMPLETO Y BILLETERA DE REPARTIDORES (SEGURO)
-- ==============================================================================
-- Ejecuta este script en el SQL Editor de Supabase.
-- Corrige el error 42710 (riders ya pertenecía a supabase_realtime).
-- ==============================================================================

-- 1. Asegurar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Añadir columnas a la tabla 'riders'
ALTER TABLE riders 
  ADD COLUMN IF NOT EXISTS name VARCHAR(128),
  ADD COLUMN IF NOT EXISTS email VARCHAR(128),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(32),
  ADD COLUMN IF NOT EXISTS national_id VARCHAR(32),
  ADD COLUMN IF NOT EXISTS vehicle_model VARCHAR(128),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_accounts JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_deliveries INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating DECIMAL(3, 2) DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS tenant_ids JSONB DEFAULT '[]'::jsonb;

-- 3. Crear índices para optimizar búsquedas por email, teléfono y cédula
CREATE INDEX IF NOT EXISTS idx_riders_email ON riders(email);
CREATE INDEX IF NOT EXISTS idx_riders_phone ON riders(phone);
CREATE INDEX IF NOT EXISTS idx_riders_national_id ON riders(national_id);

-- 4. Crear tabla de retiros de billetera de motorizados
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

CREATE INDEX IF NOT EXISTS idx_rider_withdrawals_rider_id ON rider_withdrawals(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_withdrawals_status ON rider_withdrawals(status);

-- 5. Añadir rider_withdrawals a realtime de forma segura
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE rider_withdrawals;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;
