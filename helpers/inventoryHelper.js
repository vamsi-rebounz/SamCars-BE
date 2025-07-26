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
  
    // Only allow allowed status values
    const allowedStatuses = ['available', 'sold', 'under_maintenance', 'under_inspection', 'reserved'];
    if (queryParams.status && queryParams.status !== 'all' && allowedStatuses.includes(queryParams.status)) {
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

    if (queryParams.auction !== null && queryParams.auction !== undefined) {
      if (queryParams.auction === true) {
        // Show only auction vehicles
        conditions.push('(v.is_bought_in_auction = TRUE OR EXISTS (SELECT 1 FROM auction_vehicles av WHERE av.vehicle_id = v.vehicle_id))');
      } else if (queryParams.auction === false) {
        // Show only individual vehicles (not from auction)
        conditions.push('(v.is_bought_in_auction = FALSE OR v.is_bought_in_auction IS NULL)');
        conditions.push('NOT EXISTS (SELECT 1 FROM auction_vehicles av WHERE av.vehicle_id = v.vehicle_id)');
      }
    }

    // Price range filters
    if (queryParams.min_price !== undefined && queryParams.min_price !== null && queryParams.min_price !== '') {
      conditions.push(`v.price >= $${paramIndex}`);
      values.push(parseFloat(queryParams.min_price));
      paramIndex++;
    }

    if (queryParams.max_price !== undefined && queryParams.max_price !== null && queryParams.max_price !== '') {
      conditions.push(`v.price <= $${paramIndex}`);
      values.push(parseFloat(queryParams.max_price));
      paramIndex++;
    }

    // Purchase cost (bought_price) range filters
    if (queryParams.min_purchase_cost !== undefined && queryParams.min_purchase_cost !== null && queryParams.min_purchase_cost !== '') {
      conditions.push(`COALESCE(v.bought_price, 0) >= $${paramIndex}`);
      values.push(parseFloat(queryParams.min_purchase_cost));
      paramIndex++;
    }

    if (queryParams.max_purchase_cost !== undefined && queryParams.max_purchase_cost !== null && queryParams.max_purchase_cost !== '') {
      conditions.push(`COALESCE(v.bought_price, 0) <= $${paramIndex}`);
      values.push(parseFloat(queryParams.max_purchase_cost));
      paramIndex++;
    }

    // Additional costs (repair_costs) range filters
    if (queryParams.min_additional_costs !== undefined && queryParams.min_additional_costs !== null && queryParams.min_additional_costs !== '') {
      conditions.push(`COALESCE(v.repair_costs, 0) >= $${paramIndex}`);
      values.push(parseFloat(queryParams.min_additional_costs));
      paramIndex++;
    }

    if (queryParams.max_additional_costs !== undefined && queryParams.max_additional_costs !== null && queryParams.max_additional_costs !== '') {
      conditions.push(`COALESCE(v.repair_costs, 0) <= $${paramIndex}`);
      values.push(parseFloat(queryParams.max_additional_costs));
      paramIndex++;
    }

    // Sold price range filters
    if (queryParams.min_sold_price !== undefined && queryParams.min_sold_price !== null && queryParams.min_sold_price !== '') {
      conditions.push(`COALESCE(v.sold_price, 0) >= $${paramIndex}`);
      values.push(parseFloat(queryParams.min_sold_price));
      paramIndex++;
    }

    if (queryParams.max_sold_price !== undefined && queryParams.max_sold_price !== null && queryParams.max_sold_price !== '') {
      conditions.push(`COALESCE(v.sold_price, 0) <= $${paramIndex}`);
      values.push(parseFloat(queryParams.max_sold_price));
      paramIndex++;
    }

    // Profit range filters (calculated field)
    if (queryParams.min_profit !== undefined && queryParams.min_profit !== null && queryParams.min_profit !== '') {
      conditions.push(`(COALESCE(v.sold_price, 0) - COALESCE(v.bought_price, 0) - COALESCE(v.repair_costs, 0)) >= $${paramIndex}`);
      values.push(parseFloat(queryParams.min_profit));
      paramIndex++;
    }

    if (queryParams.max_profit !== undefined && queryParams.max_profit !== null && queryParams.max_profit !== '') {
      conditions.push(`(COALESCE(v.sold_price, 0) - COALESCE(v.bought_price, 0) - COALESCE(v.repair_costs, 0)) <= $${paramIndex}`);
      values.push(parseFloat(queryParams.max_profit));
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, values, paramIndex };
  };

module.exports = {  buildWhereClauseForInventory };