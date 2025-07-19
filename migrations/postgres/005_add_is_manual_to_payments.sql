-- Add is_manual column to payments table
ALTER TABLE PAYMENTS 
ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE;

-- Add index for is_manual column
CREATE INDEX IF NOT EXISTS idx_payments_is_manual ON PAYMENTS(is_manual); 