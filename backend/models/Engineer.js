const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * 工程师表
 */
const Engineer = sequelize.define('Engineer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    comment: '关联用户ID'
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '工程师姓名'
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '联系电话'
  },
  email: {
    type: DataTypes.STRING(100),
    comment: '邮箱'
  },
  avatar: {
    type: DataTypes.STRING(500),
    comment: '头像'
  },
  employee_no: {
    type: DataTypes.STRING(50),
    comment: '工号'
  },
  type: {
    type: DataTypes.ENUM('self_employed', 'certified'),
    defaultValue: 'certified',
    comment: '自营 / 认证第三方'
  },
  skills: {
    type: DataTypes.JSON,
    comment: '技能标签数组，如 ["离心机","PCR仪","质谱仪"]'
  },
  service_area: {
    type: DataTypes.JSON,
    comment: '服务区域，如 ["北京","天津","河北"]'
  },
  certifications: {
    type: DataTypes.JSON,
    comment: '资质证书列表 [{name,url,expireDate}]'
  },
  status: {
    type: DataTypes.ENUM('online', 'offline', 'busy'),
    defaultValue: 'offline',
    comment: '实时状态：在线/离线/忙碌'
  },
  rating: {
    type: DataTypes.DECIMAL(2, 1),
    defaultValue: 5.0,
    comment: '综合评分'
  },
  rating_response: { type: DataTypes.DECIMAL(2, 1), defaultValue: 5.0, comment: '响应速度评分' },
  rating_skill: { type: DataTypes.DECIMAL(2, 1), defaultValue: 5.0, comment: '技术水平评分' },
  rating_attitude: { type: DataTypes.DECIMAL(2, 1), defaultValue: 5.0, comment: '服务态度评分' },
  rating_price: { type: DataTypes.DECIMAL(2, 1), defaultValue: 5.0, comment: '价格合理评分' },
  review_count: { type: DataTypes.INTEGER, defaultValue: 0, comment: '评价总数' },
  good_rate: { type: DataTypes.DECIMAL(4, 1), defaultValue: 100.0, comment: '好评率(%)' },
  total_orders: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '总接单数'
  },
  completed_orders: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '总完成数'
  },
  balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '账户余额（可提现）'
  },
  frozen_balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '冻结余额（待结算释放）'
  },
  total_earned: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '累计收入'
  },
  bank_name: {
    type: DataTypes.STRING(100),
    comment: '开户银行'
  },
  bank_account: {
    type: DataTypes.STRING(50),
    comment: '银行账号'
  },
  bank_holder: {
    type: DataTypes.STRING(50),
    comment: '开户人姓名'
  },
  alipay_account: {
    type: DataTypes.STRING(100),
    comment: '支付宝账号'
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 7),
    comment: '当前位置-纬度'
  },
  longitude: {
    type: DataTypes.DECIMAL(10, 7),
    comment: '当前位置-经度'
  },
  last_online_at: {
    type: DataTypes.DATE,
    comment: '最后在线时间'
  },
  subscription_plan: { type: DataTypes.STRING(20), defaultValue: 'free', comment: '订阅套餐 free/vip/svip' },
  subscription_expires_at: { type: DataTypes.DATE, comment: '订阅到期时间' },
  daily_view_count: { type: DataTypes.INTEGER, defaultValue: 0, comment: '今日查看需求广场次数' },
  daily_view_date: { type: DataTypes.DATEONLY, comment: '查看计数日期' }
}, {
  tableName: 'engineers',
  comment: '工程师表'
});

module.exports = Engineer;
