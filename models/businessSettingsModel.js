const db = require('../config/db');

class BusinessSettingsModel {
    static transformDbToApi(dbData) {
        if (!dbData) return null;
        
        return {
            businessName: dbData.business_name,
            streetAddress: dbData.street_address,
            city: dbData.city,
            state: dbData.state,
            zipCode: dbData.zip_code,
            phone: dbData.phone,
            email: dbData.email,
            businessHours: dbData.business_hours,
            socialMedia: dbData.social_media,
            updatedBy: dbData.updated_by,
            createdAt: dbData.created_at,
            updatedAt: dbData.updated_at
        };
    }

    static async get() {
        const query = 'SELECT * FROM business_settings LIMIT 1';
        const result = await db.query(query);
        return this.transformDbToApi(result.rows[0]);
    }

    static async update(settings, userId) {
        const query = `
            UPDATE business_settings
            SET business_name = COALESCE($1, business_name),
                street_address = COALESCE($2, street_address),
                city = COALESCE($3, city),
                state = COALESCE($4, state),
                zip_code = COALESCE($5, zip_code),
                phone = COALESCE($6, phone),
                email = COALESCE($7, email),
                business_hours = COALESCE($8::jsonb, business_hours),
                social_media = COALESCE($9::jsonb, social_media),
                updated_by = $10,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;

        const values = [
            settings.businessName,
            settings.streetAddress,
            settings.city,
            settings.state,
            settings.zipCode,
            settings.phone,
            settings.email,
            settings.businessHours ? JSON.stringify(settings.businessHours) : null,
            settings.socialMedia ? JSON.stringify(settings.socialMedia) : null,
            userId
        ];

        const result = await db.query(query, values);
        return this.transformDbToApi(result.rows[0]);
    }
}

module.exports = BusinessSettingsModel; 