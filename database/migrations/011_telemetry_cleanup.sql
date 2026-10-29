-- Migración 011: Optimización y purga automática de telemetría de motorizados

-- 1. Índice para acelerar búsquedas de telemetría reciente por pedido
CREATE INDEX IF NOT EXISTS idx_rider_telemetry_order_recorded 
ON rider_telemetry(order_id, recorded_at DESC);

-- 2. Función para depurar telemetría histórica de más de 48 horas
CREATE OR REPLACE FUNCTION purge_old_telemetry(retention_hours INT DEFAULT 48)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM rider_telemetry
  WHERE recorded_at < (NOW() - (retention_hours || ' hours')::INTERVAL);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
