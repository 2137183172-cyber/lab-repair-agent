const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const OrderLog = sequelize.define('OrderLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  operator_id: {
    type: DataTypes.INTEGER,
    comment: '操作人ID'
  },
  operator_type: {
    type: DataTypes.ENUM('user', 'engineer', 'manager', 'system', 'admin'),
    comment: '操作人类型'
  },
  action: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '操作类型: created/accepted/started/completed/confirmed/cancelled/escalated'
  },
  detail: {
    type: DataTypes.STRING(500),
    comment: '操作详情'
  },
  visibility: {
    type: DataTypes.TINYINT,
    defaultValue: -1,
    comment: '可见级别: -1=未设置(自动推断) 0=所有人 1=工程师及以上 2=经理及以上 3=仅管理员'
  }
}, {
  tableName: 'order_logs',
  updatedAt: false,  // 日志不需要更新
  comment: '工单操作日志'
});

// 自动设置可见级别（如果未手动指定，通过-1判断）
const { LOG_VISIBILITY } = require('../config/logVisibility');
OrderLog.beforeCreate((log) => {
  if (log.visibility === -1 || log.visibility === undefined || log.visibility === null) {
    log.visibility = LOG_VISIBILITY[log.action] || 0;
  }
});

module.exports = OrderLog;
