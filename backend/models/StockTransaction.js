const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const StockTransaction = sequelize.define('StockTransaction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  part_id: { type: DataTypes.INTEGER, allowNull: false, comment: '配件ID' },
  type: { type: DataTypes.ENUM('in', 'out'), allowNull: false, comment: '入库/出库' },
  quantity: { type: DataTypes.INTEGER, allowNull: false, comment: '变动数量' },
  before_qty: { type: DataTypes.INTEGER, allowNull: false, comment: '变动前库存' },
  after_qty: { type: DataTypes.INTEGER, allowNull: false, comment: '变动后库存' },
  related_type: {
    type: DataTypes.ENUM('purchase', 'repair_order', 'return', 'scrap', 'adjustment'),
    allowNull: false, defaultValue: 'adjustment',
    comment: '来源/去向类型'
  },
  related_id: { type: DataTypes.INTEGER, allowNull: true, comment: '关联ID（采购单/工单）' },
  related_name: { type: DataTypes.STRING(200), allowNull: true, comment: '可读关联名（列表直接展示）' },
  operator: { type: DataTypes.STRING(50), allowNull: true, comment: '操作人' },
  notes: { type: DataTypes.STRING(500), allowNull: true, comment: '备注' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'stock_transactions',
  timestamps: true,
  updatedAt: false,
  underscored: true,
  indexes: [
    { fields: ['part_id'] },
    { fields: ['type'] },
    { fields: ['related_type', 'related_id'] },
    { fields: ['created_at'] }
  ]
});

module.exports = StockTransaction;
