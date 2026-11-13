-- ==============================================================================
-- DELIVERY HUB - MIGRACIÓN 025: RETIROS DE RIDERS POR COMERCIO (MULTI-TENANT)
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.rider_withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id UUID NOT NULL,
  rider_name VARCHAR(128),
  rider_phone VARCHAR(32),
  tenant_id UUID,
  merchant_name VARCHAR(128),
  branch_id UUID,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(8) DEFAULT 'USD',
  amount_bs DECIMAL(12, 2),
  account_type VARCHAR(32) DEFAULT 'pago_movil',
  payment_account JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(24) DEFAULT 'pending', -- 'pending', 'approved', 'completed', 'rejected'
  reference_code VARCHAR(64),
  rejection_reason TEXT,
  notes TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Asegurar columnas si la tabla ya existía
ALTER TABLE public.rider_withdrawals
  ADD COLUMN IF NOT EXISTS rider_name VARCHAR(128),
  ADD COLUMN IF NOT EXISTS rider_phone VARCHAR(32),
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS merchant_name VARCHAR(128),
  ADD COLUMN IF NOT EXISTS branch_id UUID,
  ADD COLUMN IF NOT EXISTS amount_bs DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_rider_withdrawals_tenant_id ON public.rider_withdrawals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rider_withdrawals_rider_id ON public.rider_withdrawals(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_withdrawals_status ON public.rider_withdrawals(status);

-- Realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE rider_withdrawals;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;
