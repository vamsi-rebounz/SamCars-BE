// constants/enums.js

// User Roles
const USER_ROLES = [
    'customer',
    'admin',
    'sales',
    'technician',
    'manager'
];

// Appointment Statuses
const APPOINTMENT_STATUSES = [
    'pending',
    'confirmed',
    'completed',
    'cancelled',
    'rescheduled'
];

// Payment Statuses
const PAYMENT_STATUSES = [
    'pending',
    'completed',
    'failed',
    'refunded'
];

// Vehicle Statuses
const VEHICLE_STATUSES = [
    'available',
    'sold',
    'pending',
    'maintenance',
    'auction'
];

// Vehicle Conditions
const VEHICLE_CONDITIONS = [
    'new',
    'used',
    'certified_pre_owned',
    'excellent',
    'good',
    'fair'
];

// Service Categories
const SERVICE_CATEGORIES = [
    'maintenance',
    'repair',
    'inspection',
    'detailing',
    'tire_service'
];

// Contact Methods
const CONTACT_METHODS = [
    'email',
    'phone',
    'sms',
    'whatsapp'
];

// Fuel Types
const FUEL_TYPES = [
    'gasoline',
    'diesel',
    'electric',
    'hybrid',
    'plug_in_hybrid'
];

// Transmission Types
const TRANSMISSION_TYPES = [
    'automatic',
    'manual',
    'cvt',
    'semi_automatic'
];

// Body Types
const BODY_TYPES = [
    'sedan',
    'suv',
    'truck',
    'coupe',
    'convertible',
    'hatchback',
    'minivan',
    'van'
];

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