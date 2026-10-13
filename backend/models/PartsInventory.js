const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PartsInventory = sequelize.define('PartsInventory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false, comment: '配件名称' },
  sku: { type: DataTypes.STRING(50), comment: 'SKU编码' },
  category: { type: DataTypes.STRING(50), comment: '配件分类' },
  quantity: { type: DataTypes.INTEGER, defaultValue: 0, comment: '库存数量' },
  unit: { type: DataTypes.STRING(20), defaultValue: '个', comment: '单位' },
  unit_price: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, comment: '单价' },
  threshold: { type: DataTypes.INTEGER, defaultValue: 5, comment: '预警阈值' },
  location: { type: DataTypes.STRING(100), comment: '存放位置' },
  supplier: { type: DataTypes.STRING(100), comment: '供应商' },
  notes: { type: DataTypes.TEXT, comment: '备注' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'parts_inventory',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['sku'] },
    { fields: ['category'] }
  ]
});

module.exports = PartsInventory;
