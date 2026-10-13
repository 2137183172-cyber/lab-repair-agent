const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * 设备分类表
 */
const DeviceCategory = sequelize.define('DeviceCategory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '分类名称'
  },
  parent_id: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '父级分类ID，0表示顶级'
  },
  icon: {
    type: DataTypes.STRING(500),
    comment: '分类图标URL'
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '排序'
  }
}, {
  tableName: 'device_categories',
  comment: '设备分类表'
});

module.exports = DeviceCategory;
