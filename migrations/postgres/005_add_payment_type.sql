-- Add type column to payments table
ALTER TABLE PAYMENTS 
ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'service';

-- Update existing payments to have appropriate types based on description and vehicle_id
UPDATE PAYMENTS 
SET type = CASE 
    WHEN description ILIKE '%hold%' THEN 'vehicle_hold'
    WHEN vehicle_id IS NOT NULL AND description NOT ILIKE '%hold%' THEN 'vehicle_purchase'
    WHEN description ILIKE '%service%' THEN 'service'
    ELSE 'service'
END
WHERE type = 'service';

-- Add index for payment type
CREATE INDEX IF NOT EXISTS idx_payments_type ON PAYMENTS(type); 