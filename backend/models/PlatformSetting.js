const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * 平台配置表 — 佣金率等全局配置
 */
const PlatformSetting = sequelize.define('PlatformSetting', {
  key: { type: DataTypes.STRING(64), primaryKey: true, comment: '配置键' },
  value: { type: DataTypes.TEXT, comment: '配置值' },
  description: { type: DataTypes.STRING(500), comment: '配置说明' }
}, {
  tableName: 'platform_settings',
  comment: '平台配置表',
  timestamps: true,
  underscored: true
});

module.exports = PlatformSetting;
