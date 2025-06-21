// User Roles
const USER_ROLES = {
    CUSTOMER: 'customer',
    ADMIN: 'admin',
    SALES: 'sales',
    TECHNICIAN: 'technician',
    MANAGER: 'manager'
};

// Appointment Statuses
const APPOINTMENT_STATUSES = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    RESCHEDULED: 'rescheduled'
};

// Payment Statuses
const PAYMENT_STATUSES = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded'
};

// Vehicle Statuses
const VEHICLE_STATUSES = {
    AVAILABLE: 'available',
    SOLD: 'sold',
    PENDING: 'pending',
    MAINTENANCE: 'maintenance',
    AUCTION: 'auction'
};

// Vehicle Conditions
const VEHICLE_CONDITIONS = {
    NEW: 'new',
    USED: 'used',
    CERTIFIED_PRE_OWNED: 'certified_pre_owned',
    EXCELLENT: 'excellent',
    GOOD: 'good',
    FAIR: 'fair'
};

// Service Categories
const SERVICE_CATEGORIES = {
    MAINTENANCE: 'maintenance',
    REPAIR: 'repair',
    INSPECTION: 'inspection',
    DETAILING: 'detailing',
    TIRE_SERVICE: 'tire_service'
};

// Contact Methods
const CONTACT_METHODS = {
    EMAIL: 'email',
    PHONE: 'phone',
    SMS: 'sms',
    WHATSAPP: 'whatsapp'
};

// Fuel Types
const FUEL_TYPES = {
    GASOLINE: 'gasoline',
    DIESEL: 'diesel',
    ELECTRIC: 'electric',
    HYBRID: 'hybrid',
    PLUG_IN_HYBRID: 'plug_in_hybrid'
};

// Transmission Types
const TRANSMISSION_TYPES = {
    AUTOMATIC: 'automatic',
    MANUAL: 'manual',
    CVT: 'cvt',
    SEMI_AUTOMATIC: 'semi_automatic'
};

// Body Types
const BODY_TYPES = {
    SEDAN: 'sedan',
    SUV: 'suv',
    TRUCK: 'truck',
    COUPE: 'coupe',
    CONVERTIBLE: 'convertible',
    HATCHBACK: 'hatchback',
    MINIVAN: 'minivan',
    VAN: 'van',
    WAGON: 'wagon'
};

module.exports = {
    USER_ROLES,
    APPOINTMENT_STATUSES,
    PAYMENT_STATUSES,
    VEHICLE_STATUSES,
    VEHICLE_CONDITIONS,
    SERVICE_CATEGORIES,
    CONTACT_METHODS,
    FUEL_TYPES,
    TRANSMISSION_TYPES,
    BODY_TYPES
};