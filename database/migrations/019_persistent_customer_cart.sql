-- ==============================================================================
-- PÍDETELO - MIGRACIÓN 019: CARRITO PERSISTENTE EN BASE DE DATOS
-- Permite que los clientes guarden su carrito de compras en la nube (PostgreSQL/Supabase).
-- Así, si cierran sesión o cambian de dispositivo, su carrito permanece intacto en BD.
-- ==============================================================================

-- 1. Crear tabla para carritos activos de clientes
CREATE TABLE IF NOT EXISTS public.customer_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  user_phone TEXT,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  store_name TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  items_count INT NOT NULL DEFAULT 0,
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  exchange_rate NUMERIC(10, 2),
  delivery_fee NUMERIC(10, 2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_customer_cart UNIQUE (user_id)
);

-- 2. Índices de búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_customer_carts_user_id ON public.customer_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_carts_tenant_id ON public.customer_carts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_carts_branch_id ON public.customer_carts(branch_id);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.customer_carts ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Seguridad (RLS)
DROP POLICY IF EXISTS "Los clientes pueden ver su propio carrito" ON public.customer_carts;
CREATE POLICY "Los clientes pueden ver su propio carrito"
  ON public.customer_carts
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los clientes pueden insertar o actualizar su propio carrito" ON public.customer_carts;
CREATE POLICY "Los clientes pueden insertar o actualizar su propio carrito"
  ON public.customer_carts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Permitir a SuperAdmin y Service Role acceso total
DROP POLICY IF EXISTS "SuperAdmin y Service Role acceso total a carritos" ON public.customer_carts;
CREATE POLICY "SuperAdmin y Service Role acceso total a carritos"
  ON public.customer_carts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE platform_users.user_id = auth.uid()
      AND platform_users.role = 'SUPER_ADMIN'
    )
    OR auth.role() = 'service_role'
  );

-- 5. Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.handle_customer_cart_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_customer_carts_updated_at ON public.customer_carts;
CREATE TRIGGER tr_customer_carts_updated_at
  BEFORE UPDATE ON public.customer_carts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_customer_cart_updated_at();

