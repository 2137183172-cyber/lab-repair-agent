const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * 支付记录表 — 用户支付工单费用的记录
 */
const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  payment_no: { type: DataTypes.STRING(32), unique: true, allowNull: false, comment: '支付单号 PAY+年月日+6位流水' },
  order_id: { type: DataTypes.INTEGER, allowNull: false, comment: '关联工单ID' },
  quotation_id: { type: DataTypes.INTEGER, comment: '关联报价单ID（按中标报价付款）' },
  user_id: { type: DataTypes.INTEGER, allowNull: false, comment: '付款用户ID' },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, comment: '支付金额' },
  method: { type: DataTypes.ENUM('mock', 'wx_jsapi', 'alipay', 'balance', 'offline'), defaultValue: 'mock', comment: '支付方式' },
  status: { type: DataTypes.ENUM('pending', 'success', 'failed', 'refunding', 'refunded'), defaultValue: 'pending', comment: '支付状态' },
  wx_transaction_id: { type: DataTypes.STRING(64), comment: '微信支付交易号' },
  paid_at: { type: DataTypes.DATE, comment: '支付成功时间' },
  refund_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, comment: '已退款金额' },
  refund_reason: { type: DataTypes.STRING(500), comment: '退款原因' },
  refunded_at: { type: DataTypes.DATE, comment: '退款完成时间' }
}, {
  tableName: 'payments',
  comment: '支付记录表',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['payment_no'] },
    { fields: ['order_id'] },
    { fields: ['status'] }
  ]
});

module.exports = Payment;
