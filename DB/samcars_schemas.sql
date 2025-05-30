-- Create enum types (unchanged)
CREATE TYPE user_role AS ENUM ('customer', 'admin', 'sales', 'technician', 'manager');
CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'rescheduled');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE vehicle_status AS ENUM ('available', 'sold', 'pending', 'maintenance', 'auction');
CREATE TYPE vehicle_condition AS ENUM ('new', 'used', 'certified_pre_owned', 'excellent', 'good', 'fair');
CREATE TYPE service_category AS ENUM ('maintenance', 'repair', 'inspection', 'detailing', 'tire_service');
CREATE TYPE contact_method AS ENUM ('email', 'phone', 'sms', 'whatsapp');
CREATE TYPE fuel_type AS ENUM ('gasoline', 'diesel', 'electric', 'hybrid', 'plug_in_hybrid');
CREATE TYPE transmission_type AS ENUM ('automatic', 'manual', 'cvt', 'semi_automatic');
CREATE TYPE body_type AS ENUM ('sedan', 'suv', 'truck', 'coupe', 'convertible', 'hatchback', 'minivan', 'van');

-- Create tables

-- Users and Authentication
CREATE TABLE USERS (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'customer',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone VARCHAR(20),
    driver_license VARCHAR(50),
    date_of_birth DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMPTZ
);

CREATE TABLE USER_SESSIONS (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES USERS(user_id) ON DELETE CASCADE,
    token VARCHAR(512) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Vehicles
CREATE TABLE VEHICLE_MAKES (
    make_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE VEHICLE_MODELS (
    model_id SERIAL PRIMARY KEY,
    make_id INTEGER NOT NULL REFERENCES VEHICLE_MAKES(make_id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (make_id, name)
);

CREATE TABLE VEHICLES (
    vehicle_id SERIAL PRIMARY KEY,
    vin VARCHAR(17) UNIQUE,
    make_id INTEGER NOT NULL REFERENCES VEHICLE_MAKES(make_id),
    model_id INTEGER NOT NULL REFERENCES VEHICLE_MODELS(model_id),
    year INTEGER NOT NULL CHECK (year BETWEEN 1900 AND EXTRACT(YEAR FROM CURRENT_DATE) + 1),
    price DECIMAL(10, 2) NOT NULL CHECK (price > 0),
    mileage INTEGER CHECK (mileage >= 0),
    exterior_color VARCHAR(50),
    interior_color VARCHAR(50),
    transmission transmission_type,
    fuel_type fuel_type,
    engine VARCHAR(100),
    body_type body_type,
    condition vehicle_condition,
    status vehicle_status NOT NULL DEFAULT 'available',
    description TEXT,
    stock_number VARCHAR(50) UNIQUE,
    location VARCHAR(100),
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE VEHICLE_FEATURES (
    feature_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE VEHICLE_FEATURE_MAPPING (
    vehicle_id INTEGER NOT NULL REFERENCES VEHICLES(vehicle_id) ON DELETE CASCADE,
    feature_id INTEGER NOT NULL REFERENCES VEHICLE_FEATURES(feature_id) ON DELETE CASCADE,
    PRIMARY KEY (vehicle_id, feature_id)
);

CREATE TABLE VEHICLE_IMAGES (
    image_id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES VEHICLES(vehicle_id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE VEHICLE_TAGS (
    tag_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE VEHICLE_TAG_MAPPING (
    vehicle_id INTEGER NOT NULL REFERENCES VEHICLES(vehicle_id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES VEHICLE_TAGS(tag_id) ON DELETE CASCADE,
    PRIMARY KEY (vehicle_id, tag_id)
);

CREATE TABLE DEALER_INVENTORY (
    inventory_id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES VEHICLES(vehicle_id) ON DELETE CASCADE,
    date_added DATE NOT NULL DEFAULT CURRENT_DATE,
    cost_price DECIMAL(10, 2) NOT NULL,
    list_price DECIMAL(10, 2) NOT NULL,
    sold_price DECIMAL(10, 2),
    sold_date DATE,
    profit DECIMAL(10, 2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Wishlist
CREATE TABLE USER_WISHLIST (
    wishlist_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES USERS(user_id) ON DELETE CASCADE,
    vehicle_id INTEGER NOT NULL REFERENCES VEHICLES(vehicle_id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE (user_id, vehicle_id)
);

-- Test Drives and Service Appointments
CREATE TABLE TEST_DRIVE_APPOINTMENTS (
    appointment_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES USERS(user_id) ON DELETE CASCADE,
    vehicle_id INTEGER NOT NULL REFERENCES VEHICLES(vehicle_id) ON DELETE RESTRICT,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status appointment_status NOT NULL DEFAULT 'confirmed',
    confirmation_number VARCHAR(20) UNIQUE,
    sales_rep_id INTEGER REFERENCES USERS(user_id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (appointment_date >= CURRENT_DATE)
);

CREATE TABLE TEST_DRIVE_RESCHEDULES (
    reschedule_id SERIAL PRIMARY KEY,
    appointment_id INTEGER NOT NULL REFERENCES TEST_DRIVE_APPOINTMENTS(appointment_id) ON DELETE CASCADE,
    original_date DATE NOT NULL,
    original_time TIME NOT NULL,
    new_date DATE NOT NULL,
    new_time TIME NOT NULL,
    reason TEXT,
    requested_by INTEGER REFERENCES USERS(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (new_date >= CURRENT_DATE)
);

CREATE TABLE TEST_DRIVE_CANCELLATIONS (
    cancellation_id SERIAL PRIMARY KEY,
    appointment_id INTEGER NOT NULL REFERENCES TEST_DRIVE_APPOINTMENTS(appointment_id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    cancelled_by INTEGER REFERENCES USERS(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE SERVICES (
    service_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category service_category NOT NULL,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    image_url TEXT,
    warranty_months INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE SERVICE_APPOINTMENTS (
    appointment_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES USERS(user_id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES SERVICES(service_id) ON DELETE RESTRICT,
    vehicle_id INTEGER NOT NULL REFERENCES VEHICLES(vehicle_id) ON DELETE RESTRICT,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status appointment_status NOT NULL DEFAULT 'confirmed',
    confirmation_number VARCHAR(20) UNIQUE,
    technician_id INTEGER REFERENCES USERS(user_id) ON DELETE SET NULL,
    current_mileage INTEGER,
    special_requests TEXT,
    estimated_completion TIMESTAMPTZ,
    total_cost DECIMAL(10, 2),
    payment_status payment_status DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (appointment_date >= CURRENT_DATE)
);

CREATE TABLE SERVICE_APPOINTMENT_RESCHEDULES (
    reschedule_id SERIAL PRIMARY KEY,
    appointment_id INTEGER NOT NULL REFERENCES SERVICE_APPOINTMENTS(appointment_id) ON DELETE CASCADE,
    original_date DATE NOT NULL,
    original_time TIME NOT NULL,
    new_date DATE NOT NULL,
    new_time TIME NOT NULL,
    reason TEXT,
    requested_by INTEGER REFERENCES USERS(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (new_date >= CURRENT_DATE)
);

CREATE TABLE SERVICE_APPOINTMENT_CANCELLATIONS (
    cancellation_id SERIAL PRIMARY KEY,
    appointment_id INTEGER NOT NULL REFERENCES SERVICE_APPOINTMENTS(appointment_id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    refund_requested BOOLEAN NOT NULL DEFAULT FALSE,
    refund_amount DECIMAL(10, 2),
    refund_status payment_status,
    cancelled_by INTEGER REFERENCES USERS(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE SERVICE_HISTORY (
    history_id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES VEHICLES(vehicle_id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES SERVICES(service_id) ON DELETE SET NULL,
    service_name VARCHAR(100) NOT NULL,
    service_date DATE NOT NULL,
    mileage INTEGER,
    cost DECIMAL(10, 2),
    notes TEXT,
    performed_by INTEGER REFERENCES USERS(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Vehicle Sales and Auctions
CREATE TABLE VEHICLE_SALES (
    sale_id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES VEHICLES(vehicle_id) ON DELETE RESTRICT,
    seller_id INTEGER NOT NULL REFERENCES USERS(user_id) ON DELETE RESTRICT,
    buyer_id INTEGER NOT NULL REFERENCES USERS(user_id) ON DELETE RESTRICT,
    sale_price DECIMAL(10, 2) NOT NULL CHECK (sale_price > 0),
    sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
    asking_price DECIMAL(10, 2) NOT NULL CHECK (asking_price > 0),
    best_time_to_contact contact_method,
    preferred_contact_method contact_method,
    vehicle_description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE AUCTION_VEHICLES (
    auction_id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES VEHICLES(vehicle_id) ON DELETE RESTRICT,
    purchase_date DATE NOT NULL,
    purchase_price DECIMAL(10, 2) NOT NULL CHECK (purchase_price > 0),
    additional_costs DECIMAL(10, 2) DEFAULT 0 CHECK (additional_costs >= 0),
    total_investment DECIMAL(10, 2) GENERATED ALWAYS AS (purchase_price + additional_costs) STORED,
    list_price DECIMAL(10, 2) CHECK (list_price > 0),
    sold_price DECIMAL(10, 2) CHECK (sold_price > 0),
    profit DECIMAL(10, 2) GENERATED ALWAYS AS (CASE WHEN sold_price IS NULL THEN NULL ELSE sold_price - (purchase_price + additional_costs) END) STORED,
    status vehicle_status NOT NULL DEFAULT 'auction',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Payments and Documents
CREATE TABLE PAYMENTS (
    payment_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES USERS(user_id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    description TEXT NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(100),
    status payment_status NOT NULL DEFAULT 'pending',
    receipt_url TEXT,
    related_appointment_id INTEGER,
    related_appointment_type VARCHAR(20), -- 'test_drive' or 'service'
    vehicle_id INTEGER REFERENCES VEHICLES(vehicle_id) ON DELETE SET NULL,
    service_id INTEGER REFERENCES SERVICES(service_id) ON DELETE SET NULL,
    card_last_four VARCHAR(4),
    refund_amount DECIMAL(10, 2) DEFAULT 0 CHECK (refund_amount >= 0),
    refund_status payment_status,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (related_appointment_id IS NULL AND related_appointment_type IS NULL) OR
        (related_appointment_id IS NOT NULL AND related_appointment_type IS NOT NULL)
    )
);

CREATE TABLE DOCUMENTS (
    document_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES USERS(user_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    file_type VARCHAR(20) NOT NULL,
    file_size INTEGER NOT NULL CHECK (file_size > 0),
    download_url TEXT NOT NULL,
    view_url TEXT NOT NULL,
    vehicle_id INTEGER REFERENCES VEHICLES(vehicle_id) ON DELETE SET NULL,
    service_id INTEGER REFERENCES SERVICES(service_id) ON DELETE SET NULL,
    appointment_id INTEGER,
    appointment_type VARCHAR(20), -- 'test_drive' or 'service'
    is_signed BOOLEAN NOT NULL DEFAULT FALSE,
    signature_date TIMESTAMPTZ,
    created_by INTEGER REFERENCES USERS(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard and Analytics
CREATE TABLE DASHBOARD_METRICS (
    metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
    cars_sold INTEGER NOT NULL DEFAULT 0,
    new_customers INTEGER NOT NULL DEFAULT 0,
    appointments_scheduled INTEGER NOT NULL DEFAULT 0,
    test_drives INTEGER NOT NULL DEFAULT 0,
    service_appointments INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (metric_date)
);

CREATE TABLE INVENTORY_METRICS (
    metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category VARCHAR(20) NOT NULL,
    available_count INTEGER NOT NULL DEFAULT 0,
    sold_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (metric_date, category)
);

CREATE TABLE SALES_CHART_DATA (
    period_date DATE NOT NULL,
    period_type VARCHAR(10) NOT NULL, -- 'daily', 'weekly', 'monthly'
    sales_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    units_sold INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (period_date, period_type)
);

CREATE TABLE DASHBOARD_ALERTS (
    alert_id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL, -- 'inventory', 'task', 'appointment'
    priority VARCHAR(10) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    title VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by INTEGER REFERENCES USERS(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes (updated to use CAPITAL_CASE table names)
CREATE INDEX idx_user_sessions_user_id ON USER_SESSIONS(user_id);
CREATE INDEX idx_user_sessions_token ON USER_SESSIONS(token);

CREATE INDEX idx_vehicles_make_model ON VEHICLES(make_id, model_id);
CREATE INDEX idx_vehicles_status ON VEHICLES(status);
CREATE INDEX idx_vehicles_price ON VEHICLES(price);
CREATE INDEX idx_vehicles_year ON VEHICLES(year);
CREATE INDEX idx_vehicle_images_primary ON VEHICLE_IMAGES(vehicle_id, is_primary) WHERE is_primary = TRUE;

CREATE INDEX idx_user_wishlist_user ON USER_WISHLIST(user_id);
CREATE INDEX idx_user_wishlist_vehicle ON USER_WISHLIST(vehicle_id);

CREATE INDEX idx_test_drive_appointments_user ON TEST_DRIVE_APPOINTMENTS(user_id);
CREATE INDEX idx_test_drive_appointments_vehicle ON TEST_DRIVE_APPOINTMENTS(vehicle_id);
CREATE INDEX idx_test_drive_appointments_date ON TEST_DRIVE_APPOINTMENTS(appointment_date, appointment_time);
CREATE INDEX idx_service_appointments_user ON SERVICE_APPOINTMENTS(user_id);
CREATE INDEX idx_service_appointments_vehicle ON SERVICE_APPOINTMENTS(vehicle_id);
CREATE INDEX idx_service_appointments_date ON SERVICE_APPOINTMENTS(appointment_date, appointment_time);
CREATE INDEX idx_service_history_vehicle ON SERVICE_HISTORY(vehicle_id);

CREATE INDEX idx_vehicle_sales_vehicle ON VEHICLE_SALES(vehicle_id);
CREATE INDEX idx_vehicle_sales_buyer ON VEHICLE_SALES(buyer_id);
CREATE INDEX idx_vehicle_sales_date ON VEHICLE_SALES(sale_date);
CREATE INDEX idx_auction_vehicles_status ON AUCTION_VEHICLES(status);

CREATE INDEX idx_payments_user ON PAYMENTS(user_id);
CREATE INDEX idx_payments_status ON PAYMENTS(status);
CREATE INDEX idx_payments_created ON PAYMENTS(created_at);
CREATE INDEX idx_documents_user ON DOCUMENTS(user_id);
CREATE INDEX idx_documents_vehicle ON DOCUMENTS(vehicle_id);

CREATE INDEX idx_dashboard_alerts_priority ON DASHBOARD_ALERTS(priority, is_resolved);
CREATE INDEX idx_dashboard_alerts_type ON DASHBOARD_ALERTS(type, is_resolved);