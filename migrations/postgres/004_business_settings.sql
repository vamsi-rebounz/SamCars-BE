-- Create business settings table
CREATE TABLE BUSINESS_SETTINGS (
    setting_id SERIAL PRIMARY KEY,
    business_name VARCHAR(100) NOT NULL DEFAULT 'Saam Cars LLC',
    street_address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    business_hours JSONB NOT NULL DEFAULT '{
        "monday": {"open": "9:00 AM", "close": "7:00 PM"},
        "tuesday": {"open": "9:00 AM", "close": "7:00 PM"},
        "wednesday": {"open": "9:00 AM", "close": "7:00 PM"},
        "thursday": {"open": "9:00 AM", "close": "7:00 PM"},
        "friday": {"open": "9:00 AM", "close": "7:00 PM"},
        "saturday": {"open": "10:00 AM", "close": "5:00 PM"},
        "sunday": {"open": null, "close": null}
    }',
    social_media JSONB NOT NULL DEFAULT '{
        "facebook": "",
        "twitter": "",
        "instagram": "",
        "linkedin": ""
    }',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES USERS(user_id) ON DELETE SET NULL
);

-- Insert default values
INSERT INTO BUSINESS_SETTINGS (
    business_name, 
    street_address, 
    city, 
    state, 
    zip_code, 
    phone, 
    email
) VALUES (
    'Saam Cars LLC',
    '123 Auto Drive',
    'Cartown',
    'CT',
    '12345',
    '(555) 123-4567',
    'info@saamcars.com'
);

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_business_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for timestamp update
CREATE TRIGGER update_business_settings_timestamp
    BEFORE UPDATE ON BUSINESS_SETTINGS
    FOR EACH ROW
    EXECUTE FUNCTION update_business_settings_timestamp(); 