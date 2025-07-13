const buildWhereClauseForAuction = (queryParams) => {
    let whereParts = [];
    let values = [];
    let paramIndex = 1;
  
    if (queryParams.status) {
      whereParts.push(`av.status = $${paramIndex++}`);
      values.push(status);
    }
  
    if (queryParams.search) {
      const searchTerm = `%${search.toLowerCase()}%`;
      whereParts.push(`(
        LOWER(v.vin) LIKE $${paramIndex} OR
        LOWER(vm.name) LIKE $${paramIndex} OR
        LOWER(vmo.name) LIKE $${paramIndex}
      )`);
      values.push(searchTerm);
      paramIndex++;
    }
  
    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
  
    return { whereClause, values, paramIndex };
  }
module.exports = { buildWhereClauseForAuction }; 