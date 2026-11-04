-- ==============================================================================
-- PÍDETELO - MIGRACIÓN 018: CERTIFICACIÓN AUTOMÁTICA DE RIDERS Y FLOTA LIBRE
-- Permite el registro de motorizados desde la APP con certificación de identidad
-- (foto de documento y selfie con validación biométrica/documental).
-- Permite que los motorizados sean independientes (Flota Global) o asignados a comercios.
-- ==============================================================================

-- 1. Añadir columnas de verificación y certificación a la tabla 'riders'
ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS is_certified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(32) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_score INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS id_document_url TEXT,
  ADD COLUMN IF NOT EXISTS selfie_url TEXT,
  ADD COLUMN IF NOT EXISTS is_independent BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS certified_at TIMESTAMPTZ;

-- 2. Añadir índices de rendimiento para búsqueda de motorizados disponibles
CREATE INDEX IF NOT EXISTS idx_riders_verification_status ON public.riders(verification_status);
CREATE INDEX IF NOT EXISTS idx_riders_is_independent ON public.riders(is_independent);
CREATE INDEX IF NOT EXISTS idx_riders_status ON public.riders(status);

-- 3. Certificar y marcar activos a los motorizados existentes
UPDATE public.riders
SET 
  is_certified = true,
  verification_status = 'verified',
  verification_score = 100,
  certified_at = COALESCE(certified_at, NOW())
WHERE verification_status IS NULL OR verification_status = 'pending';
