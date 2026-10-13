const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Dictionary = sequelize.define('Dictionary', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dimension: {
    type: DataTypes.ENUM('设备仪器', '业务运营', '组织人员', '质量合规'),
    allowNull: false,
    comment: '4大维度'
  },
  dict_group: {
    type: DataTypes.STRING(50), allowNull: false,
    comment: '字典组：brand/skill/area/category/unit/industry 等'
  },
  dict_key: { type: DataTypes.STRING(50), comment: '键（英文标识）' },
  dict_value: { type: DataTypes.STRING(100), allowNull: false, comment: '值（中文显示）' },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0, comment: '排序' },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active', comment: '状态' },
  extra: { type: DataTypes.STRING(200), comment: '扩展信息（如规格/说明）' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'sys_dictionaries',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['dimension', 'dict_group'] },
    { fields: ['dict_group'] }
  ]
});

module.exports = Dictionary;
