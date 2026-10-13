const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('order_new', 'order_accepted', 'order_completed', 'order_confirmed', 'order_cancelled', 'order_escalated', 'order_payment', 'system'),
    comment: '通知类型'
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  content: {
    type: DataTypes.STRING(500)
  },
  order_id: {
    type: DataTypes.INTEGER,
    comment: '关联工单ID'
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  read_at: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'notifications',
  updatedAt: false,
  comment: '消息通知表'
});

module.exports = Notification;
