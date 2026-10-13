const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * 报价单表
 * 关联工单，工程师诊断后提交报价，客户/管理员审批后执行维修
 */
const Quotation = sequelize.define('Quotation', {
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
  quotation_no: {
    type: DataTypes.STRING(32),
    unique: true,
    allowNull: false,
    comment: '报价单号，格式: BJ + 年月日 + 4位流水号'
  },

  // ---- 诊断信息 ----
  diagnosis_summary: {
    type: DataTypes.TEXT,
    comment: '诊断摘要（故障原因判断，作为报价依据）'
  },
  diagnosis_images: {
    type: DataTypes.JSON,
    comment: '诊断现场照片URL数组'
  },

  // ---- 费用明细 ----
  items: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: '报价明细 [{name, spec, qty, unit_price, subtotal, type:"parts"|"labor"|"other"}]'
  },
  labor_cost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '人工费小计'
  },
  parts_cost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '配件费小计'
  },
  total_cost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '报价总金额'
  },

  // ---- 状态流转 ----
  status: {
    type: DataTypes.ENUM('draft', 'submitted', 'approved', 'rejected'),
    defaultValue: 'draft',
    comment: '报价单状态: draft=草稿, submitted=待审批, approved=已通过, rejected=已驳回'
  },
  submitted_at: {
    type: DataTypes.DATE,
    comment: '提交时间'
  },
  approved_at: {
    type: DataTypes.DATE,
    comment: '审批通过时间'
  },
  rejected_at: {
    type: DataTypes.DATE,
    comment: '驳回时间'
  },
  approved_by: {
    type: DataTypes.INTEGER,
    comment: '审批人 user_id'
  },
  reject_reason: {
    type: DataTypes.STRING(500),
    comment: '驳回原因'
  },

  // ---- 版本控制 ----
  revision: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '版本号（驳回后可重新报价，版本号+1）'
  },
  prev_quotation_id: {
    type: DataTypes.INTEGER,
    comment: '上一版报价单ID（被驳回后重新报价时关联）'
  },

  // ---- 其他信息 ----
  notes: {
    type: DataTypes.TEXT,
    comment: '报价备注（如"建议使用原厂配件以保证质量"）'
  },
  valid_until: {
    type: DataTypes.DATEONLY,
    comment: '报价有效期截止日'
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '创建报价的工程师 user_id'
  }
}, {
  tableName: 'quotations',
  comment: '维修报价单表',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['order_id'] },
    { fields: ['quotation_no'] },
    { fields: ['status'] }
  ]
});

module.exports = Quotation;
