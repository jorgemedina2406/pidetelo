-- Migration 027: Snapshot of exchange rate and VES/Bs values on order creation
-- This ensures that historical orders preserve the exact currency conversion rate,
-- subtotal in Bs, delivery fee in Bs, and total in Bs at the time the order was placed.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(12, 4) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS subtotal_bs numeric(14, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivery_fee_bs numeric(14, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_bs numeric(14, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS total_bs numeric(14, 2) DEFAULT NULL;

COMMENT ON COLUMN public.orders.exchange_rate IS 'Historical exchange rate (e.g. BCV Bs/USD) at the exact moment the order was created';
COMMENT ON COLUMN public.orders.currency IS 'Base currency of the numerical values (typically USD)';
COMMENT ON COLUMN public.orders.subtotal_bs IS 'Snapshot of subtotal converted to Bs at order creation';
COMMENT ON COLUMN public.orders.delivery_fee_bs IS 'Snapshot of delivery fee converted to Bs at order creation';
COMMENT ON COLUMN public.orders.discount_bs IS 'Snapshot of discount converted to Bs at order creation';
COMMENT ON COLUMN public.orders.total_bs IS 'Snapshot of total converted to Bs at order creation';
