const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * 维修记录表
 */
const RepairRecord = sequelize.define('RepairRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '关联工单ID'
  },
  fault_cause: {
    type: DataTypes.TEXT,
    comment: '故障原因诊断'
  },
  solution: {
    type: DataTypes.TEXT,
    comment: '处理方案'
  },
  parts_used: {
    type: DataTypes.JSON,
    comment: '使用的配件 [{name, sku, qty, unit_price, subtotal}]'
  },
  labor_cost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '人工费'
  },
  parts_cost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '配件费'
  },
  total_cost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '总费用'
  },
  before_images: {
    type: DataTypes.JSON,
    comment: '维修前照片URL数组'
  },
  after_images: {
    type: DataTypes.JSON,
    comment: '维修后照片URL数组'
  },
  signature_url: {
    type: DataTypes.STRING(500),
    comment: '客户电子签名图片URL'
  },
  report_pdf_url: {
    type: DataTypes.STRING(500),
    comment: '维修报告PDF URL'
  },
  notes: {
    type: DataTypes.TEXT,
    comment: '维修备注'
  }
}, {
  tableName: 'repair_records',
  comment: '维修记录表'
});

module.exports = RepairRecord;
