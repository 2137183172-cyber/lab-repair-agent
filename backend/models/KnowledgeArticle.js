const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const KnowledgeArticle = sequelize.define('KnowledgeArticle', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(200), allowNull: false, comment: '标题' },
  content: { type: DataTypes.TEXT('long'), comment: '内容（富文本HTML）' },
  summary: { type: DataTypes.STRING(500), comment: '摘要' },
  category: { type: DataTypes.STRING(50), comment: '分类' },
  device_category_id: { type: DataTypes.INTEGER, comment: '关联设备分类' },
  tags: { type: DataTypes.JSON, comment: '标签' },
  cover_image: { type: DataTypes.STRING(500), comment: '封面图' },
  author_id: { type: DataTypes.INTEGER, comment: '作者ID' },
  view_count: { type: DataTypes.INTEGER, defaultValue: 0, comment: '阅读量' },
  status: {
    type: DataTypes.ENUM('draft', 'published'),
    defaultValue: 'draft',
    comment: '状态'
  },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'knowledge_articles',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['category'] },
    { fields: ['device_category_id'] },
    { fields: ['status'] }
  ]
});

module.exports = KnowledgeArticle;
