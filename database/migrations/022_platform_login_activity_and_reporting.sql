-- ==============================================================================
-- Migración 022: Registro de Inicios de Sesión y Reportes Analíticos de Plataforma
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.platform_login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_name TEXT NOT NULL,
  user_email TEXT,
  user_phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer', -- 'customer', 'merchant_owner', 'branch_manager', 'cashier', 'rider', 'superadmin'
  platform TEXT NOT NULL DEFAULT 'web_store', -- 'mobile_app_flutter', 'web_store', 'merchant_admin', 'super_admin'
  device_info TEXT,
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'success', -- 'success', 'failed'
  login_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para búsquedas rápidas y filtrado por fecha
CREATE INDEX IF NOT EXISTS idx_login_logs_login_at ON public.platform_login_logs(login_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_logs_role ON public.platform_login_logs(role);
CREATE INDEX IF NOT EXISTS idx_login_logs_platform ON public.platform_login_logs(platform);
CREATE INDEX IF NOT EXISTS idx_login_logs_user_email ON public.platform_login_logs(user_email);

-- Políticas RLS
ALTER TABLE public.platform_login_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "login_logs_read" ON public.platform_login_logs;
CREATE POLICY "login_logs_read" ON public.platform_login_logs
  FOR SELECT TO authenticated, anon, service_role
  USING (true);

DROP POLICY IF EXISTS "login_logs_insert" ON public.platform_login_logs;
CREATE POLICY "login_logs_insert" ON public.platform_login_logs
  FOR INSERT TO authenticated, anon, service_role
  WITH CHECK (true);
