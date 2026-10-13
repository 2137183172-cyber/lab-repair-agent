const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Calibration = sequelize.define('Calibration', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  device_id: { type: DataTypes.INTEGER, allowNull: false, comment: '设备ID' },
  plan_name: { type: DataTypes.STRING(200), comment: '校准计划名称' },
  calibration_type: {
    type: DataTypes.ENUM('internal', 'external', 'self_check'),
    defaultValue: 'external',
    comment: '内部/外部/自检'
  },
  standard: { type: DataTypes.STRING(200), comment: '校准依据标准' },
  cycle_days: { type: DataTypes.INTEGER, comment: '校准周期(天): 90/180/365' },
  last_calibrated_at: { type: DataTypes.DATE, comment: '上次校准日期' },
  next_due_at: { type: DataTypes.DATE, comment: '下次到期日' },
  cert_no: { type: DataTypes.STRING(100), comment: '证书编号' },
  cert_url: { type: DataTypes.STRING(500), comment: '证书PDF链接' },
  calibrated_by: { type: DataTypes.STRING(100), comment: '校准机构/执行人' },
  calibration_points: { type: DataTypes.JSON, comment: '校准点数据 [{param, expected, actual, pass}]' },
  result: {
    type: DataTypes.ENUM('pass', 'conditional_pass', 'fail'),
    comment: '校准结果：合格/有条件合格/不合格'
  },
  notes: { type: DataTypes.TEXT, comment: '备注' },
  created_by: { type: DataTypes.INTEGER, comment: '创建人ID' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'calibrations',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['device_id'] },
    { fields: ['next_due_at'] },
    { fields: ['result'] }
  ]
});

module.exports = Calibration;
