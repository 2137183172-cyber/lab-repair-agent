const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, comment: '操作人ID' },
  user_name: { type: DataTypes.STRING(50), comment: '操作人姓名' },
  user_role: { type: DataTypes.STRING(20), comment: '操作人角色' },
  action: { type: DataTypes.STRING(50), allowNull: false, comment: 'create/update/delete/approve/sign/export' },
  entity_type: { type: DataTypes.STRING(50), allowNull: false, comment: 'Device/Order/Calibration/PM/User' },
  entity_id: { type: DataTypes.INTEGER, comment: '实体ID' },
  entity_name: { type: DataTypes.STRING(200), comment: '实体名称' },
  old_value: { type: DataTypes.JSON, comment: '变更前值' },
  new_value: { type: DataTypes.JSON, comment: '变更后值' },
  changed_fields: { type: DataTypes.JSON, comment: '变更字段列表' },
  ip_address: { type: DataTypes.STRING(50), comment: 'IP地址' },
  user_agent: { type: DataTypes.STRING(500), comment: '客户端信息' },
  detail: { type: DataTypes.TEXT, comment: '操作详情' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'audit_logs',
  timestamps: false, // created_at only, no updated_at
  underscored: true,
  indexes: [
    { fields: ['entity_type', 'entity_id'] },
    { fields: ['user_id'] },
    { fields: ['action'] },
    { fields: ['created_at'] }
  ]
});

const ESignature = sequelize.define('ESignature', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false, comment: '签名人ID' },
  user_name: { type: DataTypes.STRING(50), comment: '签名人姓名' },
  entity_type: { type: DataTypes.STRING(50), allowNull: false, comment: '关联实体类型' },
  entity_id: { type: DataTypes.INTEGER, allowNull: false, comment: '关联实体ID' },
  signature_type: { type: DataTypes.STRING(30), comment: 'approve/confirm/verify/reject' },
  signature_data: { type: DataTypes.TEXT, comment: '签名图片Base64或手写轨迹' },
  reason: { type: DataTypes.STRING(200), comment: '签名原因' },
  signed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'e_signatures',
  timestamps: false,
  underscored: true,
  indexes: [
    { fields: ['entity_type', 'entity_id'] },
    { fields: ['user_id'] }
  ]
});

module.exports = { AuditLog, ESignature };
