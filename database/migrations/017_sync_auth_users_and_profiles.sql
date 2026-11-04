-- ==============================================================================
-- PÍDETELO - MIGRACIÓN 017: SINCRONIZACIÓN AUTOMÁTICA DE USUARIOS Y COMERCIOS
-- Sincroniza auth.users -> profiles asignando correctamente los roles de
-- Dueño de Comercio (MERCHANT_OWNER), Encargado de Sucursal (MERCHANT_MANAGER),
-- Motorizado (RIDER), SuperAdmin y Cliente, asociándolos a su comercio (tenant_id)
-- y sucursal correspondiente (branch_id).
-- ==============================================================================

-- 1. Función para manejar nuevos registros en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role := 'CUSTOMER';
  v_meta_role text;
  v_tenant_id uuid := NULL;
  v_branch_id uuid := NULL;
BEGIN
  v_meta_role := UPPER(COALESCE(NEW.raw_user_meta_data->>'role', ''));

  -- A. Detectar Super Administrador
  IF v_meta_role IN ('SUPER_ADMIN', 'SUPERADMIN') 
     OR LOWER(NEW.email) IN ('jorge@pidetelo.com', 'admin@pidetelo.app') THEN
    v_role := 'SUPER_ADMIN';

  -- B. Detectar Motorizados / Riders
  ELSIF v_meta_role IN ('RIDER', 'MOTORIZADO') 
     OR LOWER(NEW.email) ILIKE '%repartidor%' 
     OR LOWER(NEW.email) ILIKE '%rider%' 
     OR EXISTS (SELECT 1 FROM public.riders r WHERE LOWER(r.email) = LOWER(NEW.email)) THEN
    v_role := 'RIDER';
    SELECT tenant_id, branch_id INTO v_tenant_id, v_branch_id 
    FROM public.riders WHERE LOWER(email) = LOWER(NEW.email) LIMIT 1;

  -- C. Detectar Sucursal / Encargado de Sucursal
  ELSIF v_meta_role IN ('MERCHANT_MANAGER', 'BRANCH_MANAGER') 
     OR LOWER(NEW.email) ILIKE '%trinitarias%' 
     OR LOWER(NEW.email) ILIKE '%sucursal%' 
     OR EXISTS (SELECT 1 FROM public.branches b WHERE LOWER(b.email) = LOWER(NEW.email)) THEN
    v_role := 'MERCHANT_MANAGER';
    SELECT company_id, id INTO v_tenant_id, v_branch_id 
    FROM public.branches WHERE LOWER(email) = LOWER(NEW.email) LIMIT 1;

  -- D. Detectar Dueño / Administrador de Comercio
  ELSIF v_meta_role IN ('MERCHANT_OWNER', 'ADMIN', 'OWNER') 
     OR LOWER(NEW.email) ILIKE '%@comercio.com' 
     OR LOWER(NEW.email) ILIKE '%burgerking%' 
     OR LOWER(NEW.email) ILIKE '%comercio%' 
     OR EXISTS (SELECT 1 FROM public.tenants t WHERE LOWER(t.email) = LOWER(NEW.email)) 
     OR EXISTS (SELECT 1 FROM public.store_collaborators sc WHERE LOWER(sc.email) = LOWER(NEW.email)) THEN
    v_role := 'MERCHANT_OWNER';
    SELECT id INTO v_tenant_id FROM public.tenants WHERE LOWER(email) = LOWER(NEW.email) LIMIT 1;
    IF v_tenant_id IS NULL THEN
      SELECT tenant_id, branch_id INTO v_tenant_id, v_branch_id 
      FROM public.store_collaborators WHERE LOWER(email) = LOWER(NEW.email) LIMIT 1;
    END IF;

  ELSE
    v_role := 'CUSTOMER';
  END IF;

  -- Fallback de tenant_id si es Burger King
  IF v_tenant_id IS NULL AND (LOWER(NEW.email) ILIKE '%burgerking%' OR LOWER(NEW.email) ILIKE '%burger%') THEN
    SELECT id INTO v_tenant_id FROM public.tenants WHERE slug ILIKE '%burger%' OR name ILIKE '%burger%' LIMIT 1;
  END IF;

  -- Fallback de branch_id si es Trinitarias
  IF v_branch_id IS NULL AND LOWER(NEW.email) ILIKE '%trinitarias%' THEN
    SELECT id, company_id INTO v_branch_id, v_tenant_id FROM public.branches WHERE name ILIKE '%trinitarias%' OR slug ILIKE '%trinitarias%' LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, role, tenant_id, branch_id, is_active, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, NULL),
    v_role,
    v_tenant_id,
    v_branch_id,
    TRUE,
    COALESCE(NEW.created_at, NOW()),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    role = CASE WHEN profiles.role = 'CUSTOMER' AND EXCLUDED.role != 'CUSTOMER' THEN EXCLUDED.role ELSE COALESCE(EXCLUDED.role, profiles.role) END,
    tenant_id = COALESCE(EXCLUDED.tenant_id, profiles.tenant_id),
    branch_id = COALESCE(EXCLUDED.branch_id, profiles.branch_id),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger en auth.users para altas y modificaciones
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill y Sincronización Inmediata para todas las cuentas de comercio y repartidores existentes
INSERT INTO public.profiles (id, email, full_name, phone, role, tenant_id, branch_id, is_active, created_at, updated_at)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data->>'phone', u.phone, NULL),
  CASE
    WHEN UPPER(COALESCE(u.raw_user_meta_data->>'role', '')) IN ('SUPER_ADMIN', 'SUPERADMIN') OR LOWER(u.email) IN ('jorge@pidetelo.com', 'admin@pidetelo.app') THEN 'SUPER_ADMIN'::user_role
    WHEN LOWER(u.email) ILIKE '%trinitarias%' OR LOWER(u.email) ILIKE '%sucursal%' THEN 'MERCHANT_MANAGER'::user_role
    WHEN LOWER(u.email) ILIKE '%@comercio.com' OR LOWER(u.email) ILIKE '%burgerking%' OR LOWER(u.email) ILIKE '%comercio%' THEN 'MERCHANT_OWNER'::user_role
    WHEN LOWER(u.email) ILIKE '%repartidor%' OR LOWER(u.email) ILIKE '%rider%' THEN 'RIDER'::user_role
    ELSE 'CUSTOMER'::user_role
  END,
  (SELECT id FROM public.tenants WHERE slug ILIKE '%burger%' OR name ILIKE '%burger%' LIMIT 1),
  CASE
    WHEN LOWER(u.email) ILIKE '%trinitarias%' THEN (SELECT id FROM public.branches WHERE name ILIKE '%trinitarias%' OR slug ILIKE '%trinitarias%' LIMIT 1)
    ELSE NULL
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
  role = CASE 
    WHEN LOWER(EXCLUDED.email) ILIKE '%trinitarias%' THEN 'MERCHANT_MANAGER'::user_role
    WHEN LOWER(EXCLUDED.email) ILIKE '%@comercio.com' OR LOWER(EXCLUDED.email) ILIKE '%burgerking%' THEN 'MERCHANT_OWNER'::user_role
    WHEN LOWER(EXCLUDED.email) ILIKE '%repartidor%' THEN 'RIDER'::user_role
    WHEN LOWER(EXCLUDED.email) IN ('jorge@pidetelo.com', 'admin@pidetelo.app') THEN 'SUPER_ADMIN'::user_role
    ELSE EXCLUDED.role
  END,
  tenant_id = COALESCE(profiles.tenant_id, EXCLUDED.tenant_id),
  branch_id = COALESCE(profiles.branch_id, EXCLUDED.branch_id),
  updated_at = NOW();

-- 4. Actualización explícita garantizada para las cuentas creadas en el panel
UPDATE public.profiles
SET 
  role = 'MERCHANT_OWNER'::user_role,
  tenant_id = (SELECT id FROM public.tenants WHERE slug ILIKE '%burger%' OR name ILIKE '%burger%' LIMIT 1),
  is_active = TRUE,
  updated_at = NOW()
WHERE LOWER(email) = 'burgerking@comercio.com' OR (LOWER(email) ILIKE '%@comercio.com' AND LOWER(email) NOT ILIKE '%trinitarias%');

UPDATE public.profiles
SET 
  role = 'MERCHANT_MANAGER'::user_role,
  tenant_id = (SELECT id FROM public.tenants WHERE slug ILIKE '%burger%' OR name ILIKE '%burger%' LIMIT 1),
  branch_id = (SELECT id FROM public.branches WHERE name ILIKE '%trinitarias%' OR slug ILIKE '%trinitarias%' LIMIT 1),
  is_active = TRUE,
  updated_at = NOW()
WHERE LOWER(email) = 'burgerkingtrinitarias@comercio.com' OR LOWER(email) ILIKE '%trinitarias%';

UPDATE public.profiles
SET 
  role = 'RIDER'::user_role,
  is_active = TRUE,
  updated_at = NOW()
WHERE LOWER(email) ILIKE '%repartidor%' OR LOWER(email) ILIKE '%rider%';

UPDATE public.profiles
SET 
  role = 'SUPER_ADMIN'::user_role,
  is_active = TRUE,
  updated_at = NOW()
WHERE LOWER(email) IN ('jorge@pidetelo.com', 'admin@pidetelo.app');
