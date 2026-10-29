-- ==============================================================================
-- DELIVERY HUB - MIGRACIÓN 004: USUARIOS DEL COMERCIO Y ENCARGADOS DE SUCURSAL
-- ==============================================================================

-- 1. Añadir 'MERCHANT_MANAGER' al enum user_role si aún no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'MERCHANT_MANAGER' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'MERCHANT_MANAGER';
  END IF;
END $$;

-- 2. Añadir 'branch_id' a la tabla 'profiles'
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_branch_id ON profiles(branch_id);

-- 3. Tabla específica de Colaboradores del Comercio (Store Collaborators)
-- Permite dar de alta al equipo (Encargados de Sede, Cocina, Despacho, Gerentes)
-- sin depender exclusivamente de Supabase Auth
CREATE TABLE IF NOT EXISTS store_collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  name VARCHAR(128) NOT NULL,
  email VARCHAR(128) NOT NULL,
  phone VARCHAR(32),
  role VARCHAR(32) NOT NULL DEFAULT 'MERCHANT_MANAGER',
  password_hash TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS idx_store_collaborators_tenant ON store_collaborators(tenant_id);
CREATE INDEX IF NOT EXISTS idx_store_collaborators_branch ON store_collaborators(branch_id);

-- 4. Publicación en Realtime de Supabase
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE store_collaborators;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 5. Seed de Colaboradores Iniciales para Burger Lab
DO $$
DECLARE
  v_tenant_id UUID := 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
  v_branch_la_mata UUID := 'c1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c01';
  v_branch_centro UUID := 'c1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c02';
BEGIN
  IF EXISTS (SELECT 1 FROM tenants WHERE id = v_tenant_id) THEN

    -- Roberto Da Silva (Propietario / Acceso Global)
    INSERT INTO store_collaborators (id, tenant_id, branch_id, name, email, phone, role, is_active)
    VALUES (
      'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c01',
      v_tenant_id,
      NULL,
      'Roberto Da Silva',
      'roberto@burgerlab.com',
      '+584129998877',
      'MERCHANT_OWNER',
      true
    ) ON CONFLICT (tenant_id, email) DO UPDATE
      SET role = EXCLUDED.role, branch_id = EXCLUDED.branch_id;

    -- Carlos Mendoza (Encargado de Sucursal - Sede La Mata)
    INSERT INTO store_collaborators (id, tenant_id, branch_id, name, email, phone, role, is_active)
    VALUES (
      'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c02',
      v_tenant_id,
      v_branch_la_mata,
      'Carlos Mendoza',
      'gerente.lamata@burgerlab.com',
      '+584123344556',
      'MERCHANT_MANAGER',
      true
    ) ON CONFLICT (tenant_id, email) DO UPDATE
      SET role = EXCLUDED.role, branch_id = EXCLUDED.branch_id;

    -- Jesús Alvarado (Cocinero Jefe - Sede La Mata)
    INSERT INTO store_collaborators (id, tenant_id, branch_id, name, email, phone, role, is_active)
    VALUES (
      'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c03',
      v_tenant_id,
      v_branch_la_mata,
      'Jesús Alvarado',
      'cocina@burgerlab.com',
      '+584147778899',
      'MERCHANT_KITCHEN',
      true
    ) ON CONFLICT (tenant_id, email) DO UPDATE
      SET role = EXCLUDED.role, branch_id = EXCLUDED.branch_id;

    -- Mariana Flores (Despachadora - Sede Cabudare Centro)
    INSERT INTO store_collaborators (id, tenant_id, branch_id, name, email, phone, role, is_active)
    VALUES (
      'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c04',
      v_tenant_id,
      v_branch_centro,
      'Mariana Flores',
      'despacho@burgerlab.com',
      '+584168889911',
      'MERCHANT_DISPATCH',
      true
    ) ON CONFLICT (tenant_id, email) DO UPDATE
      SET role = EXCLUDED.role, branch_id = EXCLUDED.branch_id;

  END IF;
END $$;
