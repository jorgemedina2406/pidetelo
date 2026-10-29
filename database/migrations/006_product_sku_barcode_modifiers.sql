-- ==============================================================================
-- MIGRATION 006: PRODUCT SKU, BARCODE AND MODIFIER GROUPS ENHANCEMENTS
-- Adds optional SKU and Barcode columns to products table and creates indexes
-- ==============================================================================

-- 1. Add SKU, barcode and currency columns to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(64);
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(64);
ALTER TABLE products ADD COLUMN IF NOT EXISTS currency VARCHAR(8) DEFAULT 'USD';

-- 2. Create indexes for fast lookup and barcode scanner queries
CREATE INDEX IF NOT EXISTS idx_products_sku ON products (tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (tenant_id, barcode);

-- 3. Ensure modifier_groups has min_selections and max_selections with proper defaults
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_groups' AND column_name = 'min_selections'
  ) THEN
    ALTER TABLE modifier_groups ADD COLUMN min_selections INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modifier_groups' AND column_name = 'max_selections'
  ) THEN
    ALTER TABLE modifier_groups ADD COLUMN max_selections INT DEFAULT 1;
  END IF;
END $$;
