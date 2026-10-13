const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * 提现申请表 — 工程师提现
 */
const Withdrawal = sequelize.define('Withdrawal', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  withdrawal_no: { type: DataTypes.STRING(32), unique: true, allowNull: false, comment: '提现单号 WD+年月日+6位流水' },
  engineer_id: { type: DataTypes.INTEGER, allowNull: false, comment: '工程师ID' },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, comment: '提现金额' },
  fee: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, comment: '提现手续费' },
  actual_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, comment: '实际到账金额' },
  method: { type: DataTypes.ENUM('bank', 'alipay', 'manual'), defaultValue: 'manual', comment: '提现方式' },
  account_info: { type: DataTypes.JSON, comment: '收款账户信息 {bank_name, bank_account, bank_holder, alipay_account}' },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected', 'completed', 'failed'), defaultValue: 'pending', comment: '提现状态' },
  remark: { type: DataTypes.STRING(500), comment: '申请/审批备注' },
  approved_by: { type: DataTypes.INTEGER, comment: '审批人 user_id' },
  approved_at: { type: DataTypes.DATE, comment: '审批时间' },
  completed_at: { type: DataTypes.DATE, comment: '打款完成时间' }
}, {
  tableName: 'withdrawals',
  comment: '提现申请表',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['engineer_id'] },
    { fields: ['status'] }
  ]
});

module.exports = Withdrawal;
