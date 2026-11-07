-- ==============================================================================
-- Migración 020: WhatsApp Bot Multi-Tenant & Central de Mensajería en Vivo
-- ==============================================================================

-- 1. Tabla de Instancias de WhatsApp (1 por comercio o sucursal)
CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  instance_name TEXT NOT NULL UNIQUE,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected', -- 'disconnected', 'connecting', 'connected', 'qr_ready'
  qr_code TEXT,
  greeting_message TEXT DEFAULT '¡Hola! 👋 Gracias por comunicarte con nosotros.',
  auto_reply_enabled BOOLEAN NOT NULL DEFAULT true,
  pause_duration_minutes INTEGER NOT NULL DEFAULT 120, -- 2 horas por defecto al transferir con humano
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabla de Conversaciones con Clientes
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  mode TEXT NOT NULL DEFAULT 'bot', -- 'bot' (asistente automático activo) o 'human' (pausado para operador)
  paused_until TIMESTAMPTZ,
  last_message TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_whatsapp_tenant_customer UNIQUE (tenant_id, customer_phone)
);

-- 3. Tabla de Historial de Mensajes
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender TEXT NOT NULL DEFAULT 'customer', -- 'customer', 'bot', 'agent'
  message_text TEXT NOT NULL,
  media_url TEXT,
  status TEXT NOT NULL DEFAULT 'delivered', -- 'sent', 'delivered', 'read'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para alto rendimiento
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_tenant ON public.whatsapp_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_tenant_phone ON public.whatsapp_conversations(tenant_id, customer_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_last_message ON public.whatsapp_conversations(tenant_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conv ON public.whatsapp_messages(conversation_id, created_at ASC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad RLS
DROP POLICY IF EXISTS "whatsapp_instances_access" ON public.whatsapp_instances;
CREATE POLICY "whatsapp_instances_access" ON public.whatsapp_instances
  FOR ALL
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role::text IN ('SUPER_ADMIN', 'super_admin')
        OR profiles.tenant_id = whatsapp_instances.tenant_id
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.store_collaborators
      WHERE store_collaborators.user_id = auth.uid()
      AND store_collaborators.tenant_id = whatsapp_instances.tenant_id
    )
  );

DROP POLICY IF EXISTS "whatsapp_conversations_access" ON public.whatsapp_conversations;
CREATE POLICY "whatsapp_conversations_access" ON public.whatsapp_conversations
  FOR ALL
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role::text IN ('SUPER_ADMIN', 'super_admin')
        OR profiles.tenant_id = whatsapp_conversations.tenant_id
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.store_collaborators
      WHERE store_collaborators.user_id = auth.uid()
      AND store_collaborators.tenant_id = whatsapp_conversations.tenant_id
    )
  );

DROP POLICY IF EXISTS "whatsapp_messages_access" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_access" ON public.whatsapp_messages
  FOR ALL
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role::text IN ('SUPER_ADMIN', 'super_admin')
        OR profiles.tenant_id = whatsapp_messages.tenant_id
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.store_collaborators
      WHERE store_collaborators.user_id = auth.uid()
      AND store_collaborators.tenant_id = whatsapp_messages.tenant_id
    )
  );
