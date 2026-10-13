const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Company = sequelize.define('Company', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false, comment: '公司名称' },
  short_name: { type: DataTypes.STRING(50), comment: '简称' },
  code: { type: DataTypes.STRING(20), unique: true, comment: '公司编码' },
  industry: { type: DataTypes.STRING(50), comment: '行业：pharma/biotech/cro/ivd/academic' },
  contact_name: { type: DataTypes.STRING(50), comment: '联系人' },
  contact_phone: { type: DataTypes.STRING(20), comment: '联系电话' },
  contact_email: { type: DataTypes.STRING(100), comment: '联系邮箱' },
  address: { type: DataTypes.STRING(300), comment: '地址' },
  logo: { type: DataTypes.STRING(500), comment: 'Logo URL' },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
  subscription_type: { type: DataTypes.ENUM('free', 'basic', 'pro', 'enterprise'), defaultValue: 'free', comment: '订阅类型' },
  subscription_expires_at: { type: DataTypes.DATE, comment: '订阅到期日' },
  max_devices: { type: DataTypes.INTEGER, defaultValue: 50, comment: '设备数量上限' },
  max_users: { type: DataTypes.INTEGER, defaultValue: 10, comment: '用户数量上限' },
  notes: { type: DataTypes.TEXT, comment: '备注' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'companies',
  timestamps: true,
  underscored: true,
});

module.exports = Company;
