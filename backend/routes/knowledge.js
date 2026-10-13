const router = require('express').Router();
const { Op } = require('sequelize');
const { auth, requireRole } = require('../middleware/auth');
const { KnowledgeArticle, DeviceCategory } = require('../models');
const { success, fail, parsePagination } = require('../utils/response');

/**
 * GET /api/knowledge/list
 * 知识库文章列表（小程序端，仅已发布）
 */
router.get('/list', auth, async (req, res) => {
  try {
    const { keyword, category, device_category_id, page = 1, pageSize = 20 } = req.query;
    const { offset, limit } = parsePagination(req.query);
    const where = { status: 'published' };
    if (category) where.category = category;
    if (device_category_id) where.device_category_id = device_category_id;
    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { summary: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const { count, rows } = await KnowledgeArticle.findAndCountAll({
      where,
      attributes: ['id', 'title', 'summary', 'category', 'tags', 'cover_image', 'view_count', 'created_at'],
      order: [['view_count', 'DESC'], ['created_at', 'DESC']],
      offset, limit
    });

    res.json(success({ list: rows, total: count, page: parseInt(page), pageSize: parseInt(pageSize) }));
  } catch (err) {
    console.error('[Knowledge List]', err);
    res.json(fail('获取失败'));
  }
});

/**
 * GET /api/knowledge/categories
 * 知识库分类列表
 */
router.get('/categories', async (req, res) => {
  try {
    const cats = await KnowledgeArticle.findAll({
      attributes: ['category'],
      where: { status: 'published' },
      group: ['category'],
      raw: true
    });
    // Also include device categories
    const devCats = await DeviceCategory.findAll({
      where: { parent_id: 0 },
      attributes: ['id', 'name'],
      order: [['sort_order', 'ASC']]
    });
    res.json(success({
      knowledge_categories: cats.map(c => c.category).filter(Boolean),
      device_categories: devCats
    }));
  } catch (err) {
    res.json(fail('获取失败'));
  }
});

/**
 * GET /api/knowledge/detail/:id
 * 文章详情（小程序端）
 */
router.get('/detail/:id', auth, async (req, res) => {
  try {
    const article = await KnowledgeArticle.findByPk(req.params.id);
    if (!article || article.status !== 'published') return res.json(fail('文章不存在'));
    article.view_count += 1;
    await article.save();
    res.json(success(article));
  } catch (err) {
    res.json(fail('获取失败'));
  }
});

// ====== 管理端 ======

/**
 * GET /api/knowledge/admin/list
 * 管理端文章列表（含草稿）
 */
router.get('/admin/list', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { keyword, category, status, page = 1, pageSize = 20 } = req.query;
    const { offset, limit } = parsePagination(req.query);
    const where = {};
    if (category) where.category = category;
    if (status) where.status = status;
    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { summary: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const { count, rows } = await KnowledgeArticle.findAndCountAll({
      where, order: [['updated_at', 'DESC']], offset, limit
    });

    res.json(success({ list: rows, total: count, page: parseInt(page), pageSize: parseInt(pageSize) }));
  } catch (err) {
    console.error('[Knowledge Admin]', err);
    res.json(fail('获取失败'));
  }
});

/**
 * POST /api/knowledge/admin/create
 * 创建文章
 */
router.post('/admin/create', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { title, content, summary, category, device_category_id, tags, cover_image, status } = req.body;
    const article = await KnowledgeArticle.create({
      title, content: content || '', summary: summary || '',
      category: category || '', device_category_id: device_category_id || null,
      tags: tags || [], cover_image: cover_image || '', author_id: req.user.id,
      status: status || 'draft'
    });
    res.json(success(article, '创建成功'));
  } catch (err) {
    console.error('[Knowledge Create]', err);
    res.json(fail('创建失败'));
  }
});

/**
 * PUT /api/knowledge/admin/update/:id
 */
router.put('/admin/update/:id', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const article = await KnowledgeArticle.findByPk(req.params.id);
    if (!article) return res.json(fail('文章不存在'));
    const fields = ['title', 'content', 'summary', 'category', 'device_category_id', 'tags', 'cover_image', 'status'];
    fields.forEach(f => { if (req.body[f] !== undefined) article[f] = req.body[f]; });
    await article.save();
    res.json(success(article, '更新成功'));
  } catch (err) {
    res.json(fail('更新失败'));
  }
});

/**
 * DELETE /api/knowledge/admin/delete/:id
 */
router.delete('/admin/delete/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await KnowledgeArticle.destroy({ where: { id: req.params.id } });
    res.json(success(null, '已删除'));
  } catch (err) {
    res.json(fail('删除失败'));
  }
});

module.exports = router;
