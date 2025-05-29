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

-- Create indexes
CREATE INDEX idx_test_drive_appointments_user ON TEST_DRIVE_APPOINTMENTS(user_id);
CREATE INDEX idx_test_drive_appointments_vehicle ON TEST_DRIVE_APPOINTMENTS(vehicle_id);
CREATE INDEX idx_test_drive_appointments_date ON TEST_DRIVE_APPOINTMENTS(appointment_date, appointment_time);
CREATE INDEX idx_service_appointments_user ON SERVICE_APPOINTMENTS(user_id);
CREATE INDEX idx_service_appointments_vehicle ON SERVICE_APPOINTMENTS(vehicle_id);
CREATE INDEX idx_service_appointments_date ON SERVICE_APPOINTMENTS(appointment_date, appointment_time);
CREATE INDEX idx_service_history_vehicle ON SERVICE_HISTORY(vehicle_id); 