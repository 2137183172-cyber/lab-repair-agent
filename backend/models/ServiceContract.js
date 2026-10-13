const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ServiceContract = sequelize.define('ServiceContract', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false, comment: '客户ID' },
  contract_no: { type: DataTypes.STRING(50), comment: '合同编号' },
  title: { type: DataTypes.STRING(200), allowNull: false, comment: '合同名称' },
  type: {
    type: DataTypes.ENUM('warranty', 'maintenance', 'full_service', 'on_demand'),
    defaultValue: 'maintenance',
    comment: '合同类型：保修/维保/全包/按需'
  },
  scope: { type: DataTypes.TEXT, comment: '服务范围' },
  devices: { type: DataTypes.JSON, comment: '覆盖设备ID列表' },
  start_date: { type: DataTypes.DATEONLY, comment: '开始日期' },
  end_date: { type: DataTypes.DATEONLY, comment: '结束日期' },
  order_nos: { type: DataTypes.JSON, comment: '关联工单编号列表 ["ZC20260701001"]' },
  amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, comment: '合同金额' },
  status: {
    type: DataTypes.ENUM('active', 'expiring', 'expired', 'terminated'),
    defaultValue: 'active',
    comment: '状态'
  },
  contact_name: { type: DataTypes.STRING(50), comment: '联系人' },
  contact_phone: { type: DataTypes.STRING(20), comment: '联系电话' },
  signed_at: { type: DataTypes.DATEONLY, comment: '签订日期' },
  attachments: { type: DataTypes.JSON, comment: '附件 [{name,url}]' },
  notes: { type: DataTypes.TEXT, comment: '备注' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'service_contracts',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['status'] },
    { fields: ['end_date'] }
  ]
});

module.exports = ServiceContract;
