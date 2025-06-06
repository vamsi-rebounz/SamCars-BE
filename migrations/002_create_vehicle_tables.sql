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

-- Create indexes
CREATE INDEX idx_vehicles_make_model ON VEHICLES(make_id, model_id);
CREATE INDEX idx_vehicles_status ON VEHICLES(status);
CREATE INDEX idx_vehicles_price ON VEHICLES(price);
CREATE INDEX idx_vehicles_year ON VEHICLES(year);
CREATE INDEX idx_vehicle_images_primary ON VEHICLE_IMAGES(vehicle_id, is_primary) WHERE is_primary = TRUE; 