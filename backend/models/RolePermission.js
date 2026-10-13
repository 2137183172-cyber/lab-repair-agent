const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const RolePermission = sequelize.define('RolePermission', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  role: { type: DataTypes.STRING(30), allowNull: false, comment: '角色名' },
  menu_path: { type: DataTypes.STRING(50), allowNull: false, comment: '/dashboard, /orders 等' },
  access: { type: DataTypes.ENUM('full', 'view', 'none'), defaultValue: 'none', comment: 'full/view/none' },
}, {
  tableName: 'role_permissions',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['role'] }, { fields: ['role', 'menu_path'], unique: true }]
});

module.exports = RolePermission;
