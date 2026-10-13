const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * 维修工单表
 */
const RepairOrder = sequelize.define('RepairOrder', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_no: {
    type: DataTypes.STRING(32),
    unique: true,
    allowNull: false,
    comment: '工单编号，格式: ZC + 年月日 + 4位流水号'
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '报修用户ID'
  },
  company_id: {
    type: DataTypes.INTEGER,
    comment: '所属公司ID'
  },
  device_id: {
    type: DataTypes.INTEGER,
    comment: '设备ID（可为空，支持无设备报修）'
  },
  engineer_id: {
    type: DataTypes.INTEGER,
    comment: '指派工程师ID'
  },
  status: {
    type: DataTypes.ENUM(
      'pending',       // 待接单
      'accepted',      // 已接单
      'diagnosing',    // 诊断中
      'quoted',        // 已报价（待审批）
      'paid',          // 已支付（待维修）
      'repairing',     // 维修中
      'completed',     // 维修完成
      'pending_review',// 待评价
      'confirmed',     // 已评价
      'cancelled'      // 已取消
    ),
    defaultValue: 'pending',
    comment: '工单状态'
  },
  fault_desc: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '故障描述'
  },
  fault_images: {
    type: DataTypes.JSON,
    comment: '故障图片URL数组'
  },
  fault_video: {
    type: DataTypes.STRING(500),
    comment: '故障视频URL'
  },
  priority: {
    type: DataTypes.ENUM('normal', 'urgent', 'critical'),
    defaultValue: 'normal',
    comment: '紧急程度'
  },
  contact_name: {
    type: DataTypes.STRING(50),
    comment: '联系人姓名'
  },
  contact_phone: {
    type: DataTypes.STRING(20),
    comment: '联系人电话'
  },
  address: {
    type: DataTypes.STRING(300),
    comment: '服务地址'
  },
  scheduled_at: {
    type: DataTypes.DATE,
    comment: '预约上门时间'
  },
  accepted_at: {
    type: DataTypes.DATE,
    comment: '接单时间'
  },
  started_at: {
    type: DataTypes.DATE,
    comment: '开始维修时间'
  },
  finished_at: {
    type: DataTypes.DATE,
    comment: '维修完成时间'
  },
  confirmed_at: {
    type: DataTypes.DATE,
    comment: '验收时间'
  },
  cancelled_at: {
    type: DataTypes.DATE,
    comment: '取消时间'
  },
  cancel_reason: {
    type: DataTypes.STRING(200),
    comment: '取消原因'
  },
  deadline_at: {
    type: DataTypes.DATE,
    comment: '截止时间（超时升级用）'
  },
  is_escalated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否已升级'
  },
  is_public: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否公开发布到需求广场'
  },
  selected_quotation_id: {
    type: DataTypes.INTEGER,
    comment: '中标的报价单ID（用户选标）'
  },
  manager_id: {
    type: DataTypes.INTEGER,
    comment: 'Internal manager/broker user id'
  },
  platform_status: {
    type: DataTypes.STRING(40),
    defaultValue: 'pending_review',
    comment: 'Internal platform workflow status'
  },
  pricing_mode: {
    type: DataTypes.ENUM('direct', 'engineer_estimate', 'multi_bid'),
    defaultValue: 'direct',
    comment: 'Internal pricing mode'
  },
  customer_price: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: 'Price charged to customer'
  },
  engineer_price: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: 'Settlement price for engineer'
  },
  platform_margin: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: 'Customer price minus engineer price'
  },
  internal_notes: {
    type: DataTypes.TEXT,
    comment: 'Internal manager notes'
  },
  payment_status: {
    type: DataTypes.ENUM('unpaid', 'held', 'released', 'refunding', 'refunded'),
    defaultValue: 'unpaid',
    comment: '支付状态'
  }
}, {
  tableName: 'repair_orders',
  comment: '维修工单表'
});

module.exports = RepairOrder;
