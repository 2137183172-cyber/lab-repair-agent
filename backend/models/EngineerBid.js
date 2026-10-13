const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * 工程师竞标记录表 — 关联工单/工程师/报价单
 */
const EngineerBid = sequelize.define('EngineerBid', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  order_id: { type: DataTypes.INTEGER, allowNull: false, comment: '关联工单ID' },
  engineer_id: { type: DataTypes.INTEGER, allowNull: false, comment: '竞标工程师ID' },
  quotation_id: { type: DataTypes.INTEGER, allowNull: false, comment: '关联报价单ID' },
  status: { type: DataTypes.ENUM('bidding', 'shortlisted', 'won', 'lost', 'withdrawn'), defaultValue: 'bidding', comment: '竞标状态' },
  submitted_at: { type: DataTypes.DATE, comment: '竞标提交时间' }
}, {
  tableName: 'engineer_bids',
  comment: '工程师竞标记录表',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['order_id'] },
    { fields: ['engineer_id'] },
    { unique: true, fields: ['order_id', 'engineer_id'] }
  ]
});

module.exports = EngineerBid;
