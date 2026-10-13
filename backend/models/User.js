const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * 用户表 - 实验室用户（报修方）
 */
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  openid: {
    type: DataTypes.STRING(64),
    unique: true,
    allowNull: false,
    comment: '微信openid'
  },
  unionid: {
    type: DataTypes.STRING(64),
    comment: '微信unionid（多端统一）'
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '用户姓名'
  },
  phone: {
    type: DataTypes.STRING(20),
    comment: '手机号'
  },
  company: {
    type: DataTypes.STRING(100),
    comment: '所属单位/公司'
  },
  department: {
    type: DataTypes.STRING(100),
    comment: '部门/实验室'
  },
  avatar: {
    type: DataTypes.STRING(500),
    comment: '头像URL'
  },
  role: {
    type: DataTypes.ENUM('user', 'engineer', 'manager', 'admin', 'quality', 'engineer_lead', 'viewer'),
    defaultValue: 'user',
    comment: '角色'
  },
  status: {
    type: DataTypes.ENUM('active', 'disabled', 'pending'),
    defaultValue: 'active',
    comment: '账户状态'
  },
  company_id: {
    type: DataTypes.INTEGER,
    comment: '所属公司ID（多租户）'
  },
  password_hash: {
    type: DataTypes.STRING(255),
    comment: '密码哈希（管理员登录用，bcryptjs加密）'
  },
  last_login_at: {
    type: DataTypes.DATE,
    comment: '最后登录时间'
  }
}, {
  tableName: 'users',
  comment: '用户表'
});

module.exports = User;
