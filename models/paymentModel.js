const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Payment = sequelize.define('Payment', {
  payment_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  currency: { type: DataTypes.STRING(3), defaultValue: 'USD' },
  description: { type: DataTypes.STRING, allowNull: false },
  payment_method: { type: DataTypes.STRING(50), allowNull: false },
  transaction_id: { type: DataTypes.STRING(100) },
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
  receipt_url: { type: DataTypes.TEXT },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'payments',
  timestamps: false
});

module.exports = Payment;