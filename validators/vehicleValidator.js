const { URL } = require('url');

/**
 * Validates vehicle data before insertion
 * @param {object} data - The vehicle data to validate
 * @returns {string|null} Error message if validation fails, null if validation passes
 */
function validateVehicleData(data) {
    const {
        make,
        model,
        year,
        price,
        mileage,
        vin,
        transmission,
        body_type,
        condition,
        status,
        carfax_link,
        features,
    } = data;

    // Required fields
    if (!make) return 'Make is required';
    if (!model) return 'Model is required';
    if (!year) return 'Year is required';
    if (!price) return 'Price is required';
    if (!transmission) return 'Transmission is required';
    if (!body_type) return 'Body type is required';

    // Type validations
    if (typeof make !== 'string') return 'Make must be a string';
    if (typeof model !== 'string') return 'Model must be a string';
    if (typeof year !== 'number') return 'Year must be a number';
    if (typeof price !== 'number') return 'Price must be a number';
    
    // Value validations
    const currentYear = new Date().getFullYear();
    if (year > currentYear + 1) {
        return `Year must be less than current year i.e, ${currentYear + 1}`;
    }
    if (price <= 0) return 'Price must be greater than 0';
    
    // Optional field validations
    if (mileage !== null && mileage !== undefined) {
        if (typeof mileage !== 'number') return 'Mileage must be a number';
        if (mileage < 0) return 'Mileage cannot be negative';
    }

    // VIN validation
    if (vin) {
        if (typeof vin !== 'string') return 'VIN must be a string';
        if (vin.length !== 17) return 'VIN must be 17 characters long';
        if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
            return 'Invalid VIN format';
        }
    }

    // Validate status and condition against enum types
    const validTransmissions = ['automatic', 'manual', 'cvt', 'semi_automatic'];
    if (!validTransmissions.includes(transmission)) {
        return 'Invalid transmission type';
    }

    // Validate body type against enum types
    const validBodyTypes = ['sedan', 'suv', 'truck', 'coupe', 'convertible', 'hatchback', 'minivan', 'van'];
    if (!validBodyTypes.includes(body_type)) {
        return 'Invalid body type';
    }

    // Validate vehicle conditions against enum types
    const validConditions = ['new', 'used', 'certified_pre_owned', 'excellent', 'good', 'fair'];
    if (!validConditions.includes(condition)) {
        throw new Error('Invalid vehicle status');
    }

    // Valid vehicle statues against enum types
    const validStatuses = ['available', 'sold', 'pending', 'maintenance', 'auction'];
    if (!validStatuses.includes(status)) {
        throw new Error('Invalid vehicle condition');
    }

    // Validate Carfax link if provided
    if (carfax_link && !isSafeURL(carfax_link)) {
        throw new Error('Invalid Carfax link URL');
    }

    // Validate features if provided
    if(features) {
        if (!Array.isArray(features)) {
            return 'Features must be an array';
        }
        for (const feature of features) {
            if (typeof feature !== 'string' || feature.trim().length == 0) {
                return 'Each feature must be a non-empty string';
            }
        }
    }
    // All validations passed
    return null;
}


/**
 * Helper function to validate URL
 * @param {*} string 
 * @returns 
 */
function isSafeURL(input) {
    try {
        const url = new URL(input);

        // 1. Enforce safe protocols (used by Google, Meta, etc.)
        if (!['http:', 'https:'].includes(url.protocol)) return false;

        // 2. Reject local/internal IPs (protects against SSRF, common in big-tech infra)
        const internalIPs = ['localhost', '127.0.0.1', '::1'];
        if (internalIPs.includes(url.hostname)) return false;

        // 3. Reject dangerous characters and schemes
        const suspiciousPatterns = [
            /javascript:/i,
            /data:/i,
            /vbscript:/i,
            /[\x00-\x1F\x7F]/,       // Control characters
            /['"<>{}\\|^`]/,         // High-risk for XSS/command injection
            /%3Cscript/i,            // Encoded <script
        ];
        if (suspiciousPatterns.some(p => p.test(input))) return false;

        // 4. Optional: Domain allowlist, like what Meta does for redirect URLs
        const allowedDomains = [
            'carfax.com',
            'carfaxfordealers.com'
        ];
        const hostname = url.hostname.toLowerCase();
        if (!allowedDomains.some(domain =>
            hostname === domain || hostname.endsWith(`.${domain}`)
        )) return false;

        // 5. Optional: Restrict port access (avoid unapproved services)
        const blockedPorts = ['21', '23', '25', '3306', '6379']; // e.g., FTP, Telnet, MySQL, Redis
        if (blockedPorts.includes(url.port)) return false;

        return true;
    } catch (_) {
        return false;
    }
}


module.exports = {
    validateVehicleData
}; 