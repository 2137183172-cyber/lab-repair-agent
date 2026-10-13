const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const UploadFile = sequelize.define('UploadFile', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, comment: '上传人ID' },
  file_name: { type: DataTypes.STRING(200), comment: '原始文件名' },
  file_url: { type: DataTypes.STRING(500), allowNull: false, comment: '访问URL' },
  file_path: { type: DataTypes.STRING(500), comment: '实际存储路径' },
  file_size: { type: DataTypes.INTEGER, comment: '文件大小(字节)' },
  mime_type: { type: DataTypes.STRING(50), comment: 'MIME类型' },
  category: {
    type: DataTypes.ENUM('fault', 'repair_before', 'repair_after', 'device', 'certificate', 'signature', 'other'),
    defaultValue: 'other',
    comment: '照片分类'
  },
  entity_type: { type: DataTypes.STRING(30), comment: '关联实体: Order/Device/Calibration' },
  entity_id: { type: DataTypes.INTEGER, comment: '关联实体ID' },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'upload_files',
  timestamps: true,
  updatedAt: false,
  underscored: true,
  indexes: [
    { fields: ['entity_type', 'entity_id'] },
    { fields: ['category'] },
    { fields: ['user_id'] },
    { fields: ['created_at'] }
  ]
});

module.exports = UploadFile;
