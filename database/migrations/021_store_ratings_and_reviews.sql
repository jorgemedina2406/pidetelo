-- ==============================================================================
-- Migración 021: Sistema de Reseñas, Comentarios y Valoración con Estrellas Reales
-- ==============================================================================

-- 1. Asegurar columnas de rating real y total de reseñas en la tabla de comercios
ALTER TABLE IF EXISTS public.tenants 
ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 2) NOT NULL DEFAULT 5.00;

ALTER TABLE IF EXISTS public.tenants 
ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0;

-- 2. Tabla para almacenar las valoraciones y comentarios de los clientes
CREATE TABLE IF NOT EXISTS public.tenant_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Índices para consultas de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_tenant_reviews_tenant_id ON public.tenant_reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_reviews_created_at ON public.tenant_reviews(created_at DESC);

-- 4. Función de cálculo automático en tiempo real
CREATE OR REPLACE FUNCTION public.fn_sync_tenant_rating_summary()
RETURNS TRIGGER AS $$
DECLARE
  target_tenant_id UUID;
  new_avg NUMERIC(3, 2);
  new_count INTEGER;
BEGIN
  target_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);

  SELECT 
    COALESCE(ROUND(AVG(rating)::numeric, 2), 5.00),
    COALESCE(COUNT(*), 0)
  INTO new_avg, new_count
  FROM public.tenant_reviews
  WHERE tenant_id = target_tenant_id;

  UPDATE public.tenants
  SET 
    rating = new_avg,
    review_count = new_count,
    updated_at = now()
  WHERE id = target_tenant_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger reactivo ante nuevas reseñas, ediciones o eliminaciones
DROP TRIGGER IF EXISTS trg_sync_tenant_rating_summary ON public.tenant_reviews;
CREATE TRIGGER trg_sync_tenant_rating_summary
AFTER INSERT OR UPDATE OR DELETE ON public.tenant_reviews
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_tenant_rating_summary();

-- 6. Políticas de Seguridad RLS
ALTER TABLE public.tenant_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_reviews_read" ON public.tenant_reviews;
CREATE POLICY "tenant_reviews_read" ON public.tenant_reviews
  FOR SELECT TO authenticated, anon, service_role
  USING (true);

DROP POLICY IF EXISTS "tenant_reviews_insert" ON public.tenant_reviews;
CREATE POLICY "tenant_reviews_insert" ON public.tenant_reviews
  FOR INSERT TO authenticated, anon, service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_reviews_manage" ON public.tenant_reviews;
CREATE POLICY "tenant_reviews_manage" ON public.tenant_reviews
  FOR ALL TO authenticated, service_role
  USING (true)
  WITH CHECK (true);
