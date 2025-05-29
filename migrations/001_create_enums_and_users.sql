-- Create enum types
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

-- Create indexes
CREATE INDEX idx_users_email ON USERS(email);
CREATE INDEX idx_user_sessions_user_id ON USER_SESSIONS(user_id);
CREATE INDEX idx_user_sessions_token ON USER_SESSIONS(token); 