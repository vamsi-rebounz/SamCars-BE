// User Roles
const USER_ROLES = {
    CUSTOMER: 'customer',
    ADMIN: 'admin'
};

// Appointment Statuses
const APPOINTMENT_STATUSES = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
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
    UNDER_MAINTENANCE: 'under_maintenance',
    UNDER_INSPECTION: 'under_inspection',
    RESERVED: 'reserved'
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
    MANUAL: 'manual',
    AUTOMATIC: 'automatic',
    CVT: 'cvt',
    AMT: 'amt',
    DCT: 'dct',
    DSG: 'dsg',
    SEMI_AUTOMATIC: 'semi_automatic',
    IVT: 'ivt',
    HYDROSTATIC: 'hydrostatic',
    MMT: 'mmt',
    HYBIRD: 'hybird',
    TORQUE_CONVERTER: 'torque_converter',
    TIP_TRONIC: 'tip_tronic'
};

// Body Types
const BODY_TYPES = {
    SPORTS: 'sports',
    SEDAN: 'sedan',
    HATCHBACK: 'hatchback',
    SUV: 'suv',
    COUPE: 'coupe',
    CONVERTIBLE: 'convertible',
    VAN: 'van',
    MINIVAN: 'minivan',
    WAGON: 'wagon',
    PICKUP_TRUCK: 'pickup_truck',
    CARGO_VAN: 'cargo_van',
    BUS: 'bus'
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