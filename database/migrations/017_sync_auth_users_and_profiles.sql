-- ==============================================================================
-- PÍDETELO - MIGRACIÓN 017: SINCRONIZACIÓN AUTOMÁTICA DE USUARIOS REGISTRADOS
-- Sincroniza auth.users -> profiles para que todos los usuarios (clientes, riders,
-- dueños de comercio y superadmins) aparezcan unificados en el panel de control.
-- ==============================================================================

-- 1. Función para manejar nuevos registros en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role := 'CUSTOMER';
  v_meta_role text;
BEGIN
  v_meta_role := UPPER(COALESCE(NEW.raw_user_meta_data->>'role', ''));

  IF v_meta_role = 'SUPER_ADMIN' OR v_meta_role = 'SUPERADMIN' THEN
    v_role := 'SUPER_ADMIN';
  ELSIF v_meta_role = 'MERCHANT_OWNER' OR v_meta_role = 'ADMIN' THEN
    v_role := 'MERCHANT_OWNER';
  ELSIF v_meta_role = 'MERCHANT_MANAGER' OR v_meta_role = 'BRANCH_MANAGER' THEN
    v_role := 'MERCHANT_MANAGER';
  ELSIF v_meta_role = 'MERCHANT_KITCHEN' OR v_meta_role = 'KITCHEN' THEN
    v_role := 'MERCHANT_KITCHEN';
  ELSIF v_meta_role = 'MERCHANT_DISPATCH' OR v_meta_role = 'DISPATCH' THEN
    v_role := 'MERCHANT_DISPATCH';
  ELSIF v_meta_role = 'RIDER' OR v_meta_role = 'MOTORIZADO' THEN
    v_role := 'RIDER';
  ELSE
    v_role := 'CUSTOMER';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, role, is_active, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, NULL),
    v_role,
    TRUE,
    COALESCE(NEW.created_at, NOW()),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger en auth.users para altas y modificaciones
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill inmediato de todos los usuarios ya registrados en auth.users
INSERT INTO public.profiles (id, email, full_name, phone, role, is_active, created_at, updated_at)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data->>'phone', u.phone, NULL),
  CASE
    WHEN UPPER(COALESCE(u.raw_user_meta_data->>'role', '')) IN ('SUPER_ADMIN', 'SUPERADMIN') THEN 'SUPER_ADMIN'::user_role
    WHEN UPPER(COALESCE(u.raw_user_meta_data->>'role', '')) IN ('MERCHANT_OWNER', 'ADMIN') THEN 'MERCHANT_OWNER'::user_role
    WHEN UPPER(COALESCE(u.raw_user_meta_data->>'role', '')) IN ('MERCHANT_MANAGER', 'BRANCH_MANAGER') THEN 'MERCHANT_MANAGER'::user_role
    WHEN UPPER(COALESCE(u.raw_user_meta_data->>'role', '')) IN ('RIDER', 'MOTORIZADO') THEN 'RIDER'::user_role
    ELSE 'CUSTOMER'::user_role
  END,
  TRUE,
  COALESCE(u.created_at, NOW()),
  NOW()
FROM auth.users u
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
  phone = COALESCE(EXCLUDED.phone, profiles.phone),
  updated_at = NOW();
