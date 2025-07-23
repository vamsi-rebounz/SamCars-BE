// Helper function to build dynamic WHERE clauses

const buildWhereClauseForInventory = (queryParams) => {
    const conditions = [];
    const values = [];
    let paramIndex = 1;
  
    if (queryParams.search) {
      const searchTerm = `%${queryParams.search.toLowerCase()}%`;
      conditions.push(`(
        LOWER(vm.name) LIKE $${paramIndex} OR
        LOWER(vmod.name) LIKE $${paramIndex} OR
        LOWER(v.vin) LIKE $${paramIndex} OR
        v.year::text LIKE $${paramIndex}
      )`);
      values.push(searchTerm);
      paramIndex++;
    }
  
    if (queryParams.status && queryParams.status !== 'all') {
      conditions.push(`v.status = $${paramIndex}`);
      values.push(queryParams.status);
      paramIndex++;
    }
  
    if (queryParams.category && queryParams.category !== 'all') {
      if (['sedan', 'suv', 'truck', 'coupe', 'convertible', 'hatchback', 'minivan', 'van'].includes(queryParams.category)) {
        conditions.push(`v.body_type = $${paramIndex}`);
        values.push(queryParams.category);
        paramIndex++;
      } else if (queryParams.category === 'electric') {
        conditions.push(`v.fuel_type = 'electric'`);
      } else if (['luxury', 'compact'].includes(queryParams.category)) {
          conditions.push(`EXISTS (SELECT 1 FROM VEHICLE_TAG_MAPPING vtm JOIN VEHICLE_TAGS vt ON vtm.tag_id = vt.tag_id WHERE vtm.vehicle_id = v.vehicle_id AND vt.name = $${paramIndex})`);
          values.push(queryParams.category);
          paramIndex++;
      }
    }
  
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, values, paramIndex };
  };

module.exports = {  buildWhereClauseForInventory };