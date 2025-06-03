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
        body_type
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
    if (year < 1900 || year > currentYear + 1) {
        return `Year must be between 1900 and ${currentYear + 1}`;
    }
    if (price <= 0) return 'Price must be greater than 0';
    
    // Optional field validations
    if (mileage !== null && mileage !== undefined) {
        if (typeof mileage !== 'number') return 'Mileage must be a number';
        if (mileage < 0) return 'Mileage cannot be negative';
    }

    // VIN validation (if provided)
    if (vin) {
        if (typeof vin !== 'string') return 'VIN must be a string';
        if (vin.length !== 17) return 'VIN must be 17 characters long';
        if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
            return 'Invalid VIN format';
        }
    }

    // Enum validations
    const validTransmissions = ['automatic', 'manual', 'cvt', 'semi_automatic'];
    if (!validTransmissions.includes(transmission)) {
        return 'Invalid transmission type';
    }

    const validBodyTypes = ['sedan', 'suv', 'truck', 'coupe', 'convertible', 'hatchback', 'minivan', 'van'];
    if (!validBodyTypes.includes(body_type)) {
        return 'Invalid body type';
    }

    // All validations passed
    return null;
}

module.exports = {
    validateVehicleData
}; 