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
        // Simple test query first
        const testQuery = 'SELECT COUNT(*) as count FROM vehicles';
        const testResult = await client.query(testQuery);
        console.log('Test query result:', testResult.rows[0]);

        // Get date range from query params or use defaults
        const { start_date, end_date } = req.query;
        const dateFrom = start_date || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0];
        const dateTo = end_date || new Date().toISOString().split('T')[0];

        console.log('Fetching dashboard stats for date range:', dateFrom, 'to', dateTo);

        // Execute queries one by one to debug
        const vehicleStats = await DashboardController.getVehicleStats(client, dateFrom, dateTo);
        console.log('Vehicle stats:', vehicleStats);
        
        const userStats = await DashboardController.getUserStats(client, dateFrom, dateTo);
        console.log('User stats:', userStats);
        
        const paymentStats = await DashboardController.getPaymentStats(client, dateFrom, dateTo);
        console.log('Payment stats:', paymentStats);
        
        const auctionStats = await DashboardController.getAuctionStats(client, dateFrom, dateTo);
        console.log('Auction stats:', auctionStats);
        
        const appointmentStats = await DashboardController.getAppointmentStats(client, dateFrom, dateTo);
        console.log('Appointment stats:', appointmentStats);
        
        const recentActivity = await DashboardController.getRecentActivity(client);
        console.log('Recent activity count:', recentActivity.length);
        
        const inventoryBreakdown = await DashboardController.getInventoryBreakdown(client);
        console.log('Inventory breakdown count:', inventoryBreakdown.length);
        
        const salesChartData = await DashboardController.getSalesChartData(client, dateFrom, dateTo);
        console.log('Sales chart count:', salesChartData.length);
        
        const alerts = await DashboardController.getAlerts(client);
        console.log('Alerts count:', alerts.length);

        const dashboardData = {
          summary: {
            total_vehicles: vehicleStats.totalVehicles,
            available_vehicles: vehicleStats.availableVehicles,
            sold_vehicles: vehicleStats.soldVehicles,
            total_users: userStats.totalUsers,
            new_users_this_month: userStats.newUsersThisMonth,
            total_revenue: paymentStats.totalRevenue,
            revenue_this_month: paymentStats.revenueThisMonth,
            total_payments: paymentStats.totalPayments,
            pending_payments: paymentStats.pendingPayments,
            auction_investment: auctionStats.totalInvestment,
            auction_profit: auctionStats.totalProfit,
            vehicles_purchased: auctionStats.vehiclesPurchased,
            vehicles_sold: auctionStats.vehiclesSold,
            total_appointments: appointmentStats.totalAppointments,
            upcoming_appointments: appointmentStats.upcomingAppointments,
            test_drives: appointmentStats.testDrives,
            service_appointments: appointmentStats.serviceAppointments
          },
          inventory_breakdown: inventoryBreakdown,
          sales_chart: salesChartData,
          recent_activity: recentActivity,
          alerts: alerts,
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
        COUNT(CASE WHEN created_at::date BETWEEN $1 AND $2 THEN 1 END) as new_vehicles_this_month
      FROM vehicles
    `;
    
    const result = await client.query(query, [dateFrom, dateTo]);
    const row = result.rows[0];
    
    return {
      totalVehicles: parseInt(row.total_vehicles),
      availableVehicles: parseInt(row.available_vehicles),
      soldVehicles: parseInt(row.sold_vehicles),
      newVehiclesThisMonth: parseInt(row.new_vehicles_this_month)
    };
  }

  /**
   * Get user statistics
   */
  static async getUserStats(client, dateFrom, dateTo) {
    const query = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN created_at::date BETWEEN $1 AND $2 THEN 1 END) as new_users_this_month,
        COUNT(CASE WHEN role = 'customer' THEN 1 END) as total_customers,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as total_admins
      FROM users
    `;
    
    const result = await client.query(query, [dateFrom, dateTo]);
    const row = result.rows[0];
    
    return {
      totalUsers: parseInt(row.total_users),
      newUsersThisMonth: parseInt(row.new_users_this_month),
      totalCustomers: parseInt(row.total_customers),
      totalAdmins: parseInt(row.total_admins)
    };
  }

  /**
   * Get payment statistics
   */
  static async getPaymentStats(client, dateFrom, dateTo) {
    const query = `
      SELECT 
        COUNT(*) as total_payments,
        COALESCE(SUM(amount), 0) as total_revenue,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN created_at::date BETWEEN $1 AND $2 THEN 1 END) as payments_this_month,
        COALESCE(SUM(CASE WHEN created_at::date BETWEEN $1 AND $2 THEN amount ELSE 0 END), 0) as revenue_this_month
      FROM payments
    `;
    
    const result = await client.query(query, [dateFrom, dateTo]);
    const row = result.rows[0];
    
    return {
      totalPayments: parseInt(row.total_payments),
      totalRevenue: parseFloat(row.total_revenue),
      pendingPayments: parseInt(row.pending_payments),
      paymentsThisMonth: parseInt(row.payments_this_month),
      revenueThisMonth: parseFloat(row.revenue_this_month)
    };
  }

  /**
   * Get auction statistics
   */
  static async getAuctionStats(client, dateFrom, dateTo) {
    const query = `
      SELECT 
        COUNT(*) as total_purchases,
        COALESCE(SUM(total_investment), 0) as total_investment,
        COUNT(CASE WHEN status = 'sold' THEN 1 END) as vehicles_sold,
        COALESCE(SUM(CASE WHEN status = 'sold' THEN profit ELSE 0 END), 0) as total_profit,
        COUNT(CASE WHEN purchase_date BETWEEN $1 AND $2 THEN 1 END) as vehicles_purchased_this_month
      FROM auction_vehicles
    `;
    
    const result = await client.query(query, [dateFrom, dateTo]);
    const row = result.rows[0];
    
    return {
      totalPurchases: parseInt(row.total_purchases),
      totalInvestment: parseFloat(row.total_investment),
      vehiclesSold: parseInt(row.vehicles_sold),
      totalProfit: parseFloat(row.total_profit),
      vehiclesPurchased: parseInt(row.vehicles_purchased_this_month)
    };
  }

  /**
   * Get appointment statistics
   */
  static async getAppointmentStats(client, dateFrom, dateTo) {
    // Check if tables exist first
    const testDriveQuery = `
      SELECT 
        COUNT(*) as total_test_drives,
        COUNT(CASE WHEN appointment_date >= CURRENT_DATE THEN 1 END) as upcoming_test_drives
      FROM test_drive_appointments
      WHERE appointment_date BETWEEN $1 AND $2
    `;
    
    const serviceQuery = `
      SELECT 
        COUNT(*) as total_service_appointments,
        COUNT(CASE WHEN appointment_date >= CURRENT_DATE THEN 1 END) as upcoming_service_appointments
      FROM service_appointments
      WHERE appointment_date BETWEEN $1 AND $2
    `;
    
    try {
      const [testDriveResult, serviceResult] = await Promise.all([
        client.query(testDriveQuery, [dateFrom, dateTo]),
        client.query(serviceQuery, [dateFrom, dateTo])
      ]);
      
      const testDriveRow = testDriveResult.rows[0];
      const serviceRow = serviceResult.rows[0];
      
      return {
        totalAppointments: parseInt(testDriveRow.total_test_drives) + parseInt(serviceRow.total_service_appointments),
        upcomingAppointments: parseInt(testDriveRow.upcoming_test_drives) + parseInt(serviceRow.upcoming_service_appointments),
        testDrives: parseInt(testDriveRow.total_test_drives),
        serviceAppointments: parseInt(serviceRow.total_service_appointments)
      };
    } catch (error) {
      // If tables don't exist, return default values
      console.log('Appointment tables not found, using default values');
      return {
        totalAppointments: 0,
        upcomingAppointments: 0,
        testDrives: 0,
        serviceAppointments: 0
      };
    }
  }

  /**
   * Get recent activity
   */
  static async getRecentActivity(client) {
    const query = `
      (SELECT 
        'payment' as type,
        p.payment_id as id,
        CONCAT('Payment of $', p.amount, ' received') as description,
        p.created_at as timestamp,
        p.status::text
      FROM payments p
      ORDER BY p.created_at DESC
      LIMIT 5)
      UNION ALL
      (SELECT 
        'vehicle' as type,
        v.vehicle_id as id,
        CONCAT(v.year, ' ', vm.name, ' ', vmod.name, ' added to inventory') as description,
        v.created_at as timestamp,
        v.status::text
      FROM vehicles v
      JOIN vehicle_makes vm ON v.make_id = vm.make_id
      JOIN vehicle_models vmod ON v.model_id = vmod.model_id
      ORDER BY v.created_at DESC
      LIMIT 5)
      UNION ALL
      (SELECT 
        'auction' as type,
        av.auction_id as id,
        CONCAT('Auction purchase: $', av.purchase_price) as description,
        av.created_at as timestamp,
        av.status::text
      FROM auction_vehicles av
      ORDER BY av.created_at DESC
      LIMIT 5)
      ORDER BY timestamp DESC
      LIMIT 10
    `;
    
    const result = await client.query(query);
    return result.rows;
  }

  /**
   * Get inventory breakdown by category
   */
  static async getInventoryBreakdown(client) {
    const query = `
      SELECT 
        body_type as category,
        COUNT(*) as count,
        COALESCE(SUM(price), 0) as total_value
      FROM vehicles
      WHERE body_type IS NOT NULL
      GROUP BY body_type
      ORDER BY count DESC
    `;
    
    const result = await client.query(query);
    return result.rows;
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
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY week
    `;
    
    const result = await client.query(query, [dateFrom, dateTo]);
    return result.rows;
  }

  /**
   * Get active alerts
   */
  static async getAlerts(client) {
    const query = `
      SELECT 
        alert_id,
        type,
        priority,
        title,
        message,
        created_at
      FROM dashboard_alerts
      WHERE is_resolved = false
      ORDER BY 
        CASE priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        created_at DESC
      LIMIT 10
    `;
    
    try {
      const result = await client.query(query);
      return result.rows;
    } catch (error) {
      // If table doesn't exist, return empty array
      console.log('Dashboard alerts table not found, using empty array');
      return [];
    }
  }
}

module.exports = DashboardController; 