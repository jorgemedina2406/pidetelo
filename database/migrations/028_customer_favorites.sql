-- ==============================================================================
-- PÍDETELO - MIGRACIÓN 028: FAVORITOS DE CLIENTES EN BASE DE DATOS
-- Permite guardar los comercios favoritos de cada cliente de forma persistente
-- en PostgreSQL/Supabase, sincronizado entre la App Móvil y la App Web.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.customer_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  tenant_slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_customer_favorites_user_tenant UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_favorites_user_id ON public.customer_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_favorites_tenant_id ON public.customer_favorites(tenant_id);

ALTER TABLE public.customer_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Los clientes pueden ver sus favoritos" ON public.customer_favorites;
CREATE POLICY "Los clientes pueden ver sus favoritos"
  ON public.customer_favorites
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los clientes pueden agregar favoritos" ON public.customer_favorites;
CREATE POLICY "Los clientes pueden agregar favoritos"
  ON public.customer_favorites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own favorites" ON public.customer_favorites;
CREATE POLICY "Users can update own favorites"
  ON public.customer_favorites
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los clientes pueden eliminar favoritos" ON public.customer_favorites;
CREATE POLICY "Los clientes pueden eliminar favoritos"
  ON public.customer_favorites
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service Role acceso total a favoritos" ON public.customer_favorites;
CREATE POLICY "Service Role acceso total a favoritos"
  ON public.customer_favorites
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
