const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const OrderComment = sequelize.define('OrderComment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  rating: {
    type: DataTypes.TINYINT,
    allowNull: false,
    comment: '评分 1-5'
  },
  content: {
    type: DataTypes.TEXT,
    comment: '评价内容'
  },
  tags: {
    type: DataTypes.JSON,
    comment: '评价标签，如["响应快","技术好","服务热情"]'
  },
  response_speed: { type: DataTypes.TINYINT, comment: '响应速度 1-5' },
  skill_level: { type: DataTypes.TINYINT, comment: '技术水平 1-5' },
  attitude: { type: DataTypes.TINYINT, comment: '服务态度 1-5' },
  price_fairness: { type: DataTypes.TINYINT, comment: '价格合理 1-5' }
}, {
  tableName: 'order_comments',
  comment: '工单评价表'
});

module.exports = OrderComment;
