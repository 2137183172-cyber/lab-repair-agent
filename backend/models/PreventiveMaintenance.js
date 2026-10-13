const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PMPlan = sequelize.define('PMPlan', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  device_id: { type: DataTypes.INTEGER, comment: '设备ID(可为null表示模板)' },
  template_name: { type: DataTypes.STRING(100), comment: '模板名称(如: 离心机季度保养)' },
  instrument_type: { type: DataTypes.INTEGER, comment: '适用设备分类ID' },
  title: { type: DataTypes.STRING(200), allowNull: false, comment: '维护任务名称' },
  description: { type: DataTypes.TEXT, comment: '维护说明/SOP' },
  frequency_days: { type: DataTypes.INTEGER, comment: '周期(天): 30/90/180/365' },
  checklist: { type: DataTypes.JSON, comment: '检查清单 [{item, required}]' },
  estimated_hours: { type: DataTypes.DECIMAL(4, 1), comment: '预计工时' },
  parts_required: { type: DataTypes.JSON, comment: '所需配件 [{name,sku,qty}]' },
  is_template: { type: DataTypes.BOOLEAN, defaultValue: false, comment: '是否模板' },
  status: { type: DataTypes.ENUM('active', 'paused'), defaultValue: 'active' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'pm_plans',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['device_id'] },
    { fields: ['instrument_type'] }
  ]
});

const PMRecord = sequelize.define('PMRecord', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  plan_id: { type: DataTypes.INTEGER, comment: '关联PM计划ID' },
  device_id: { type: DataTypes.INTEGER, allowNull: false, comment: '设备ID' },
  title: { type: DataTypes.STRING(200), comment: '任务标题' },
  description: { type: DataTypes.TEXT, comment: '维护描述' },
  scheduled_at: { type: DataTypes.DATE, comment: '计划执行日期' },
  performed_at: { type: DataTypes.DATE, comment: '实际执行日期' },
  performed_by: { type: DataTypes.STRING(100), comment: '执行人' },
  checklist_result: { type: DataTypes.JSON, comment: '清单执行结果' },
  parts_used: { type: DataTypes.JSON, comment: '使用的配件' },
  hours_spent: { type: DataTypes.DECIMAL(4, 1), comment: '实际工时' },
  findings: { type: DataTypes.TEXT, comment: '发现的问题' },
  attachments: { type: DataTypes.JSON, comment: '附件' },
  status: {
    type: DataTypes.ENUM('scheduled', 'in_progress', 'completed', 'overdue', 'cancelled'),
    defaultValue: 'scheduled'
  },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'pm_records',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['device_id'] },
    { fields: ['status'] },
    { fields: ['scheduled_at'] }
  ]
});

module.exports = { PMPlan, PMRecord };
