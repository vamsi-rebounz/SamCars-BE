-- =============================
-- Fix NaN Values Migration
-- Updates NaN values in financial fields to NULL or 0
-- =============================

-- Fix NaN values in VEHICLES table financial fields
-- Set NaN values to NULL for better data integrity

-- Update bought_price: Set NaN to NULL
UPDATE VEHICLES 
SET bought_price = NULL 
WHERE bought_price IS NOT NULL 
  AND (bought_price::text = 'NaN' OR bought_price < 0);

-- Update repair_costs: Set NaN to NULL
UPDATE VEHICLES 
SET repair_costs = NULL 
WHERE repair_costs IS NOT NULL 
  AND (repair_costs::text = 'NaN' OR repair_costs < 0);

-- Update sold_price: Set NaN to NULL
UPDATE VEHICLES 
SET sold_price = NULL 
WHERE sold_price IS NOT NULL 
  AND (sold_price::text = 'NaN' OR sold_price < 0);

-- Update price: Set NaN to 0 (price should never be NULL)
UPDATE VEHICLES 
SET price = 0 
WHERE price IS NOT NULL 
  AND (price::text = 'NaN' OR price <= 0);

-- Fix NaN values in AUCTION_VEHICLES table if it exists
-- Update purchase_price: Set NaN to NULL
UPDATE AUCTION_VEHICLES 
SET purchase_price = NULL 
WHERE purchase_price IS NOT NULL 
  AND (purchase_price::text = 'NaN' OR purchase_price < 0);

-- Update list_price: Set NaN to NULL
UPDATE AUCTION_VEHICLES 
SET list_price = NULL 
WHERE list_price IS NOT NULL 
  AND (list_price::text = 'NaN' OR list_price < 0);

-- Update sold_price: Set NaN to NULL
UPDATE AUCTION_VEHICLES 
SET sold_price = NULL 
WHERE sold_price IS NOT NULL 
  AND (sold_price::text = 'NaN' OR sold_price < 0);

-- Fix NaN values in PAYMENTS table if amount field has NaN
UPDATE PAYMENTS 
SET amount = 0 
WHERE amount IS NOT NULL 
  AND (amount::text = 'NaN' OR amount < 0);

-- Add constraints to prevent future NaN values
-- Add check constraints to ensure positive values for financial fields

-- Add constraint for VEHICLES.price (should be positive)
ALTER TABLE VEHICLES 
ADD CONSTRAINT check_vehicles_price_positive 
CHECK (price > 0);

-- Add constraint for VEHICLES.bought_price (should be positive if not null)
ALTER TABLE VEHICLES 
ADD CONSTRAINT check_vehicles_bought_price_positive 
CHECK (bought_price IS NULL OR bought_price >= 0);

-- Add constraint for VEHICLES.repair_costs (should be positive if not null)
ALTER TABLE VEHICLES 
ADD CONSTRAINT check_vehicles_repair_costs_positive 
CHECK (repair_costs IS NULL OR repair_costs >= 0);

-- Add constraint for VEHICLES.sold_price (should be positive if not null)
ALTER TABLE VEHICLES 
ADD CONSTRAINT check_vehicles_sold_price_positive 
CHECK (sold_price IS NULL OR sold_price >= 0);

-- Add constraint for AUCTION_VEHICLES.purchase_price (should be positive if not null)
ALTER TABLE AUCTION_VEHICLES 
ADD CONSTRAINT check_auction_vehicles_purchase_price_positive 
CHECK (purchase_price IS NULL OR purchase_price >= 0);

-- Add constraint for AUCTION_VEHICLES.list_price (should be positive if not null)
ALTER TABLE AUCTION_VEHICLES 
ADD CONSTRAINT check_auction_vehicles_list_price_positive 
CHECK (list_price IS NULL OR list_price >= 0);

-- Add constraint for AUCTION_VEHICLES.sold_price (should be positive if not null)
ALTER TABLE AUCTION_VEHICLES 
ADD CONSTRAINT check_auction_vehicles_sold_price_positive 
CHECK (sold_price IS NULL OR sold_price >= 0);

-- Add constraint for PAYMENTS.amount (should be positive)
ALTER TABLE PAYMENTS 
ADD CONSTRAINT check_payments_amount_positive 
CHECK (amount > 0);

-- Create a function to validate financial data
CREATE OR REPLACE FUNCTION validate_financial_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate price
    IF NEW.price IS NOT NULL AND (NEW.price::text = 'NaN' OR NEW.price <= 0) THEN
        RAISE EXCEPTION 'Price must be a positive number';
    END IF;
    
    -- Validate bought_price
    IF NEW.bought_price IS NOT NULL AND (NEW.bought_price::text = 'NaN' OR NEW.bought_price < 0) THEN
        RAISE EXCEPTION 'Bought price must be a non-negative number';
    END IF;
    
    -- Validate repair_costs
    IF NEW.repair_costs IS NOT NULL AND (NEW.repair_costs::text = 'NaN' OR NEW.repair_costs < 0) THEN
        RAISE EXCEPTION 'Repair costs must be a non-negative number';
    END IF;
    
    -- Validate sold_price
    IF NEW.sold_price IS NOT NULL AND (NEW.sold_price::text = 'NaN' OR NEW.sold_price < 0) THEN
        RAISE EXCEPTION 'Sold price must be a non-negative number';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate financial data on insert/update
CREATE TRIGGER validate_vehicles_financial_data
    BEFORE INSERT OR UPDATE ON VEHICLES
    FOR EACH ROW
    EXECUTE FUNCTION validate_financial_data();

-- Create similar function for auction vehicles
CREATE OR REPLACE FUNCTION validate_auction_financial_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate purchase_price
    IF NEW.purchase_price IS NOT NULL AND (NEW.purchase_price::text = 'NaN' OR NEW.purchase_price < 0) THEN
        RAISE EXCEPTION 'Purchase price must be a non-negative number';
    END IF;
    
    -- Validate list_price
    IF NEW.list_price IS NOT NULL AND (NEW.list_price::text = 'NaN' OR NEW.list_price < 0) THEN
        RAISE EXCEPTION 'List price must be a non-negative number';
    END IF;
    
    -- Validate sold_price
    IF NEW.sold_price IS NOT NULL AND (NEW.sold_price::text = 'NaN' OR NEW.sold_price < 0) THEN
        RAISE EXCEPTION 'Sold price must be a non-negative number';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auction vehicles
CREATE TRIGGER validate_auction_vehicles_financial_data
    BEFORE INSERT OR UPDATE ON AUCTION_VEHICLES
    FOR EACH ROW
    EXECUTE FUNCTION validate_auction_financial_data();

-- Create function for payments validation
CREATE OR REPLACE FUNCTION validate_payment_amount()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate amount
    IF NEW.amount IS NOT NULL AND (NEW.amount::text = 'NaN' OR NEW.amount <= 0) THEN
        RAISE EXCEPTION 'Payment amount must be a positive number';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payments
CREATE TRIGGER validate_payments_amount
    BEFORE INSERT OR UPDATE ON PAYMENTS
    FOR EACH ROW
    EXECUTE FUNCTION validate_payment_amount();

-- Log the migration
INSERT INTO DASHBOARD_METRICS (metric_name, metric_value, metric_date, created_at)
VALUES ('NaN Values Fixed', 
        (SELECT COUNT(*) FROM VEHICLES WHERE bought_price IS NULL OR repair_costs IS NULL OR sold_price IS NULL),
        CURRENT_DATE,
        CURRENT_TIMESTAMP); 