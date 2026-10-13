const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * 设备表 - 实验室仪器设备档案
 */
const Device = sequelize.define('Device', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  company_id: {
    type: DataTypes.INTEGER,
    comment: '所属公司ID'
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '所属用户ID'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '设备名称'
  },
  model: {
    type: DataTypes.STRING(100),
    comment: '型号'
  },
  category_id: {
    type: DataTypes.INTEGER,
    comment: '设备分类ID'
  },
  brand: {
    type: DataTypes.STRING(100),
    comment: '品牌'
  },
  serial_no: {
    type: DataTypes.STRING(100),
    comment: '序列号/机身号'
  },
  asset_no: {
    type: DataTypes.STRING(100),
    comment: '资产编号'
  },
  lab_name: {
    type: DataTypes.STRING(100),
    comment: '所在实验室名称'
  },
  lab_room: {
    type: DataTypes.STRING(100),
    comment: '房间号'
  },
  location: {
    type: DataTypes.STRING(200),
    comment: '详细位置描述'
  },
  purchase_date: {
    type: DataTypes.DATEONLY,
    comment: '采购日期'
  },
  warranty_start: {
    type: DataTypes.DATEONLY,
    comment: '保修开始日期'
  },
  warranty_end: {
    type: DataTypes.DATEONLY,
    comment: '保修结束日期'
  },
  qr_code_url: {
    type: DataTypes.STRING(500),
    comment: '设备二维码图片URL'
  },
  status: {
    type: DataTypes.ENUM('normal', 'repairing', 'scrapped'),
    defaultValue: 'normal',
    comment: '设备状态'
  },
  images: {
    type: DataTypes.JSON,
    comment: '设备照片URL数组'
  },
  manual_url: {
    type: DataTypes.STRING(500),
    comment: '说明书/操作手册URL'
  },
  notes: {
    type: DataTypes.TEXT,
    comment: '备注'
  }
}, {
  tableName: 'devices',
  comment: '设备表'
});

module.exports = Device;
