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

-- Create indexes
CREATE INDEX idx_dashboard_alerts_priority ON DASHBOARD_ALERTS(priority, is_resolved);
CREATE INDEX idx_dashboard_alerts_type ON DASHBOARD_ALERTS(type, is_resolved); 