// controllers/dashboardController.js
const pool = require('../config/db');

class DashboardController {
  /**
   * Get comprehensive dashboard statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getDashboardStats(req, res) {
    try {
      console.log('Dashboard stats endpoint called');
      
      const client = await pool.connect();
      console.log('Database client connected');
      
      try {
        // Get date range from query params or use defaults
        const { start_date, end_date } = req.query;
        const dateFrom = start_date || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0];
        const dateTo = end_date || new Date().toISOString().split('T')[0];

        // Execute queries for improved metrics
        const vehicleStats = await DashboardController.getVehicleStats(client, dateFrom, dateTo);
        const financialStats = await DashboardController.getFinancialStats(client, dateFrom, dateTo);
        const inventoryStats = await DashboardController.getInventoryStats(client);
        const vehicleTypeDistribution = await DashboardController.getVehicleTypeDistribution(client);
        const salesChartData = await DashboardController.getSalesChartData(client, dateFrom, dateTo);

        const dashboardData = {
          summary: {
            // Financial Metrics
            total_revenue: financialStats.totalRevenue,
            revenue_this_month: financialStats.revenueThisMonth,
            total_profit: financialStats.totalProfit,
            profit_this_month: financialStats.profitThisMonth,
            profit_margin: financialStats.profitMargin,
            
            // Inventory Metrics
            total_vehicles: vehicleStats.totalVehicles,
            available_vehicles: vehicleStats.availableVehicles,
            total_inventory_value: inventoryStats.totalInventoryValue,
            average_days_on_lot: inventoryStats.averageDaysOnLot,
            
            // Payment Metrics
            total_payments: financialStats.totalPayments,
            pending_payments: financialStats.pendingPayments,
            outstanding_amount: financialStats.outstandingAmount,
            
            // Profit Breakdown
            auction_profit: financialStats.auctionProfit,
            auction_roi: financialStats.auctionROI,
            auction_vehicles_sold: financialStats.auctionVehiclesSold,
            individual_profit: financialStats.individualProfit,
            individual_roi: financialStats.individualROI,
            individual_vehicles_sold: financialStats.individualVehiclesSold,
            auction_investment: financialStats.auctionInvestment
          },
          vehicle_type_distribution: vehicleTypeDistribution,
          sales_chart: salesChartData,
          date_range: {
            from: dateFrom,
            to: dateTo
          }
        };

        console.log('Dashboard data prepared successfully');

        res.status(200).json({
          status: 'success',
          data: dashboardData
        });

      } finally {
        client.release();
        console.log('Database client released');
      }

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch dashboard statistics',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get vehicle statistics
   */
  static async getVehicleStats(client, dateFrom, dateTo) {
    const query = `
      SELECT 
        COUNT(*) as total_vehicles,
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available_vehicles,
        COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold_vehicles,
        COUNT(CASE WHEN status = 'reserved' THEN 1 END) as reserved_vehicles,
        COUNT(CASE WHEN status = 'under_maintenance' THEN 1 END) as maintenance_vehicles,
        COUNT(CASE WHEN status = 'under_inspection' THEN 1 END) as inspection_vehicles,
        COUNT(CASE WHEN created_at::date BETWEEN $1 AND $2 THEN 1 END) as new_vehicles_this_month
      FROM vehicles
    `;
    
    const result = await client.query(query, [dateFrom, dateTo]);
    const row = result.rows[0];
    
    return {
      totalVehicles: parseInt(row.total_vehicles),
      availableVehicles: parseInt(row.available_vehicles),
      soldVehicles: parseInt(row.sold_vehicles),
      reservedVehicles: parseInt(row.reserved_vehicles),
      maintenanceVehicles: parseInt(row.maintenance_vehicles),
      inspectionVehicles: parseInt(row.inspection_vehicles),
      newVehiclesThisMonth: parseInt(row.new_vehicles_this_month)
    };
  }

  /**
   * Get comprehensive financial statistics
   */
  static async getFinancialStats(client, dateFrom, dateTo) {
    // Get payment statistics
    const paymentQuery = `
      SELECT 
        COUNT(*) as total_payments,
        COALESCE(SUM(amount), 0) as total_revenue,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as outstanding_amount,
        COUNT(CASE WHEN created_at::date BETWEEN $1 AND $2 THEN 1 END) as payments_this_month,
        COALESCE(SUM(CASE WHEN created_at::date BETWEEN $1 AND $2 THEN amount ELSE 0 END), 0) as revenue_this_month
      FROM payments
      WHERE status = 'completed'
    `;
    
    // Get auction statistics
    const auctionQuery = `
      SELECT 
        COALESCE(SUM(total_investment), 0) as total_investment,
        COALESCE(SUM(CASE WHEN status = 'sold' THEN profit ELSE 0 END), 0) as auction_profit,
        COALESCE(SUM(CASE WHEN status = 'sold' THEN sold_price ELSE 0 END), 0) as auction_sales,
        COUNT(CASE WHEN status = 'sold' THEN 1 END) as auction_vehicles_sold
      FROM auction_vehicles
    `;
    
    // Get individual vehicle profit statistics
    const individualVehicleQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN is_bought_in_auction = FALSE AND status = 'sold' THEN sold_price - bought_price - COALESCE(repair_costs, 0) ELSE 0 END), 0) as individual_profit,
        COALESCE(SUM(CASE WHEN is_bought_in_auction = FALSE AND status = 'sold' THEN sold_price ELSE 0 END), 0) as individual_sales,
        COUNT(CASE WHEN is_bought_in_auction = FALSE AND status = 'sold' THEN 1 END) as individual_vehicles_sold
      FROM vehicles
    `;
    
    const [paymentResult, auctionResult, individualResult] = await Promise.all([
      client.query(paymentQuery, [dateFrom, dateTo]),
      client.query(auctionQuery),
      client.query(individualVehicleQuery)
    ]);
    
    const paymentRow = paymentResult.rows[0];
    const auctionRow = auctionResult.rows[0];
    const individualRow = individualResult.rows[0];
    
    const auctionProfit = parseFloat(auctionRow.auction_profit);
    const individualProfit = parseFloat(individualRow.individual_profit);
    const totalProfit = auctionProfit + individualProfit;
    
    // FIXED: Remove double counting - only use payments table for revenue
    // Vehicle sales are already recorded in the payments table
    const totalRevenue = parseFloat(paymentRow.total_revenue);
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    
    const auctionROI = parseFloat(auctionRow.total_investment) > 0 ? 
      (auctionProfit / parseFloat(auctionRow.total_investment)) * 100 : 0;
    
    // FIXED: Use payments table for individual sales to avoid double counting
    // Calculate individual sales from payments table for vehicles not bought in auction
    const individualSalesQuery = `
      SELECT COALESCE(SUM(amount), 0) as individual_sales_from_payments
      FROM payments p
      JOIN vehicles v ON p.vehicle_id = v.vehicle_id
      WHERE p.status = 'completed' 
        AND v.is_bought_in_auction = FALSE
        AND v.status = 'sold'
    `;
    const individualSalesResult = await client.query(individualSalesQuery);
    const individualSalesFromPayments = parseFloat(individualSalesResult.rows[0].individual_sales_from_payments);
    
    const individualROI = individualSalesFromPayments > 0 ? 
      (individualProfit / individualSalesFromPayments) * 100 : 0;
    
    const totalVehiclesSold = parseInt(auctionRow.auction_vehicles_sold) + parseInt(individualRow.individual_vehicles_sold);
    
          return {
        totalPayments: parseInt(paymentRow.total_payments),
        totalRevenue: totalRevenue,
        revenueThisMonth: parseFloat(paymentRow.revenue_this_month),
        totalProfit: totalProfit,
        profitThisMonth: totalProfit, // Simplified for now
        profitMargin: Math.round(profitMargin * 100) / 100,
        pendingPayments: parseInt(paymentRow.pending_payments),
        outstandingAmount: parseFloat(paymentRow.outstanding_amount),
        auctionInvestment: parseFloat(auctionRow.total_investment),
        auctionProfit: auctionProfit,
        auctionROI: Math.round(auctionROI * 100) / 100,
        individualProfit: individualProfit,
        individualROI: Math.round(individualROI * 100) / 100,
        auctionVehiclesSold: parseInt(auctionRow.auction_vehicles_sold),
        individualVehiclesSold: parseInt(individualRow.individual_vehicles_sold)
      };
  }



  /**
   * Get inventory statistics
   */
  static async getInventoryStats(client) {
    const query = `
      SELECT 
        COALESCE(SUM(price), 0) as total_inventory_value,
        COALESCE(AVG(price), 0) as average_vehicle_price,
        COUNT(*) as total_vehicles,
        COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/86400), 0) as average_days_on_lot
      FROM vehicles
      WHERE status = 'available'
    `;
    
    const result = await client.query(query);
    const row = result.rows[0];
    
    return {
      totalInventoryValue: parseFloat(row.total_inventory_value),
      averageVehiclePrice: parseFloat(row.average_vehicle_price),
      totalVehicles: parseInt(row.total_vehicles),
      averageDaysOnLot: Math.round(parseFloat(row.average_days_on_lot))
    };
  }

  /**
   * Get vehicle type distribution
   */
  static async getVehicleTypeDistribution(client) {
    const query = `
      SELECT 
        body_type,
        COUNT(*) as count
      FROM vehicles
      WHERE body_type IS NOT NULL
      GROUP BY body_type
      ORDER BY count DESC
    `;
    
    const result = await client.query(query);
    return result.rows.map(row => ({
      type: row.body_type,
      count: parseInt(row.count)
    }));
  }



  /**
   * Get sales chart data
   */
  static async getSalesChartData(client, dateFrom, dateTo) {
    const query = `
      SELECT 
        DATE_TRUNC('week', created_at) as week,
        COUNT(*) as sales_count,
        COALESCE(SUM(amount), 0) as sales_amount
      FROM payments
      WHERE created_at BETWEEN $1 AND $2 AND status = 'completed'
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY week
    `;
    
    const result = await client.query(query, [dateFrom, dateTo]);
    return result.rows;
  }
}

module.exports = DashboardController; 