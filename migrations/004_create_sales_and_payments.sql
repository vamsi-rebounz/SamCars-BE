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

-- Create indexes
CREATE INDEX idx_vehicle_sales_vehicle ON VEHICLE_SALES(vehicle_id);
CREATE INDEX idx_vehicle_sales_buyer ON VEHICLE_SALES(buyer_id);
CREATE INDEX idx_vehicle_sales_date ON VEHICLE_SALES(sale_date);
CREATE INDEX idx_auction_vehicles_status ON AUCTION_VEHICLES(status);
CREATE INDEX idx_payments_user ON PAYMENTS(user_id);
CREATE INDEX idx_payments_status ON PAYMENTS(status);
CREATE INDEX idx_payments_created ON PAYMENTS(created_at);
CREATE INDEX idx_documents_user ON DOCUMENTS(user_id);
CREATE INDEX idx_documents_vehicle ON DOCUMENTS(vehicle_id); 