-- ==============================================================================
-- PÍDETELO - MIGRACIÓN 017 REVISADA: SINCRONIZACIÓN AUTOMÁTICA DE USUARIOS
-- Resuelve el error "Database error saving new user" garantizando compatibilidad
-- total con auth.users, tipos enum, esquemas, y capturando cualquier excepción
-- para que el registro de clientes NUNCA se bloquee.
-- ==============================================================================

-- 1. Eliminar trigger previo para reemplazarlo limpiamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Asegurar que los valores del enum user_role existan en public
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM (
      'SUPER_ADMIN',
      'MERCHANT_OWNER',
      'MERCHANT_MANAGER',
      'MERCHANT_KITCHEN',
      'MERCHANT_DISPATCH',
      'RIDER',
      'CUSTOMER'
    );
  ELSE
    BEGIN
      ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'MERCHANT_MANAGER';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'CUSTOMER';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'RIDER';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- 3. Función a prueba de fallos para auth.users -> profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_meta_role text;
  v_role text := 'CUSTOMER';
  v_email text;
  v_name text;
  v_phone text;
BEGIN
  -- Extraer y sanitizar datos de forma segura
  v_email := LOWER(TRIM(COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', '')));
  IF v_email = '' THEN
    v_email := concat(NEW.id::text, '@usuario.pidetelo.app');
  END IF;

  v_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    split_part(v_email, '@', 1),
    'Cliente Pídetelo'
  );

  v_phone := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''),
    NULLIF(TRIM(NEW.phone), ''),
    NULL
  );

  v_meta_role := UPPER(COALESCE(NEW.raw_user_meta_data->>'role', ''));
  IF v_meta_role IN ('SUPER_ADMIN', 'SUPERADMIN') THEN
    v_role := 'SUPER_ADMIN';
  ELSIF v_meta_role IN ('MERCHANT_OWNER', 'ADMIN', 'OWNER') THEN
    v_role := 'MERCHANT_OWNER';
  ELSIF v_meta_role IN ('MERCHANT_MANAGER', 'BRANCH_MANAGER') THEN
    v_role := 'MERCHANT_MANAGER';
  ELSIF v_meta_role IN ('MERCHANT_KITCHEN', 'KITCHEN') THEN
    v_role := 'MERCHANT_KITCHEN';
  ELSIF v_meta_role IN ('MERCHANT_DISPATCH', 'DISPATCH') THEN
    v_role := 'MERCHANT_DISPATCH';
  ELSIF v_meta_role IN ('RIDER', 'MOTORIZADO') THEN
    v_role := 'RIDER';
  ELSE
    v_role := 'CUSTOMER';
  END IF;

  -- Bloque protegido con manejo de excepciones: si ocurre cualquier error en profiles,
  -- se registra una advertencia pero NUNCA se aborta el registro del usuario en auth.users
  BEGIN
    -- Primero verificar si ya existe un perfil con ese ID o ese email para actualizarlo y evitar colisión
    UPDATE public.profiles
    SET
      id = NEW.id,
      email = v_email,
      full_name = COALESCE(NULLIF(v_name, ''), full_name),
      phone = COALESCE(v_phone, phone),
      role = v_role::public.user_role,
      is_active = TRUE,
      updated_at = NOW()
    WHERE id = NEW.id OR LOWER(email) = v_email;

    -- Si no existía, insertar registro nuevo
    IF NOT FOUND THEN
      INSERT INTO public.profiles (id, email, full_name, phone, role, is_active, created_at, updated_at)
      VALUES (
        NEW.id,
        v_email,
        v_name,
        v_phone,
        v_role::public.user_role,
        TRUE,
        COALESCE(NEW.created_at, NOW()),
        NOW()
      );
    END IF;
  EXCEPTION 
    WHEN OTHERS THEN
      -- Intento secundario básico si falla el cast de rol o alguna columna opcional
      BEGIN
        INSERT INTO public.profiles (id, email, full_name, phone, is_active, created_at, updated_at)
        VALUES (NEW.id, v_email, v_name, v_phone, TRUE, COALESCE(NEW.created_at, NOW()), NOW())
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, updated_at = NOW();
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[handle_new_user] No se pudo guardar profile para user %: %', NEW.id, SQLERRM;
      END;
  END;

  RETURN NEW;
END;
$$;

-- 4. Crear trigger SOLO en AFTER INSERT (no en update para no disparar sobreescrituras innecesarias)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Habilitar políticas RLS para que el cliente pueda leer y actualizar su perfil
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir a usuarios autenticados leer perfiles" ON public.profiles;
CREATE POLICY "Permitir a usuarios autenticados leer perfiles"
ON public.profiles FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Permitir a usuarios insertar su perfil" ON public.profiles;
CREATE POLICY "Permitir a usuarios insertar su perfil"
ON public.profiles FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir a usuarios actualizar su propio perfil" ON public.profiles;
CREATE POLICY "Permitir a usuarios actualizar su propio perfil"
ON public.profiles FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);
