const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const MaintenanceRecord = sequelize.define('MaintenanceRecord', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  device_id: { type: DataTypes.INTEGER, allowNull: false, comment: '设备ID' },
  type: {
    type: DataTypes.ENUM('maintenance', 'inspection', 'calibration', 'repair', '保养', '巡检'),
    defaultValue: 'maintenance',
    comment: '记录类型：保养/巡检/校准/维修'
  },
  title: { type: DataTypes.STRING(200), allowNull: false, comment: '标题' },
  description: { type: DataTypes.TEXT, comment: '详细描述' },
  performed_by: { type: DataTypes.STRING(100), comment: '执行人' },
  performed_at: { type: DataTypes.DATE, comment: '执行时间' },
  next_due_at: { type: DataTypes.DATE, comment: '下次到期时间' },
  cost: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, comment: '费用' },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'overdue'),
    defaultValue: 'completed',
    comment: '状态'
  },
  attachments: { type: DataTypes.JSON, comment: '附件URL数组' },
  notes: { type: DataTypes.TEXT, comment: '备注' }
}, {
  tableName: 'maintenance_records',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['device_id'] },
    { fields: ['type'] },
    { fields: ['performed_at'] },
    { fields: ['next_due_at'] }
  ]
});

module.exports = MaintenanceRecord;
