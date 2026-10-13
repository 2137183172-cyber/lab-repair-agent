const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Settlement = sequelize.define('Settlement', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  settlement_no: { type: DataTypes.STRING(32), unique: true, allowNull: false, comment: 'Settlement number' },
  payment_id: { type: DataTypes.INTEGER, allowNull: false, comment: 'Payment id' },
  order_id: { type: DataTypes.INTEGER, allowNull: false, comment: 'Repair order id' },
  recipient_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Engineer settlements use engineer.id; platform settlements use null'
  },
  recipient_type: { type: DataTypes.ENUM('engineer', 'platform'), allowNull: false, comment: 'Recipient type' },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, comment: 'Settlement amount' },
  commission_rate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 15.00, comment: 'Platform commission rate' },
  commission_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, comment: 'Platform commission amount' },
  engineer_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, comment: 'Engineer amount' },
  status: {
    type: DataTypes.ENUM('pending', 'held', 'released', 'withdrawn', 'cancelled'),
    defaultValue: 'pending',
    comment: 'Settlement status'
  },
  settle_at: { type: DataTypes.DATE, comment: 'Estimated settlement date' },
  released_at: { type: DataTypes.DATE, comment: 'Actual release date' }
}, {
  tableName: 'settlements',
  comment: 'Settlement records',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['payment_id'] },
    { fields: ['recipient_id'] },
    { fields: ['status'] }
  ]
});

module.exports = Settlement;
