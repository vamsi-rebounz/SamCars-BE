const pool = require('../config/db');

const ServiceModel = {
    /**
     * Creates a new service in the database.
     * @param {object} serviceData - Object containing service details
     * @param {string} serviceData.name - Service name
     * @param {string} serviceData.description - Service description
     * @param {string} serviceData.category - Service category (must be one of the enum values)
     * @param {number} serviceData.price - Service price
     * @param {number} serviceData.duration_minutes - Service duration in minutes
     * @param {string} [serviceData.image_url] - Optional URL for service image
     * @param {number} [serviceData.warranty_months] - Optional warranty duration in months
     * @returns {Promise<object>} Created service object
     */
    async createService(serviceData) {
        const {
            name,
            description,
            category,
            price,
            duration_minutes,
            image_url = null,
            warranty_months = 0
        } = serviceData;

        try {
            const query = `
                INSERT INTO services (
                    name,
                    description,
                    category,
                    price,
                    duration_minutes,
                    image_url,
                    warranty_months
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING 
                    service_id,
                    name,
                    description,
                    category,
                    price,
                    duration_minutes,
                    image_url,
                    warranty_months,
                    created_at,
                    updated_at`;

            const values = [
                name,
                description,
                category,
                price,
                duration_minutes,
                image_url,
                warranty_months
            ];

            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('Error in createService:', error);
            if (error.code === '22P02') {
                throw new Error('Invalid service category. Must be one of: maintenance, repair, inspection, detailing, tire_service');
            }
            throw new Error('Could not create service.');
        }
    }
};

module.exports = ServiceModel; 