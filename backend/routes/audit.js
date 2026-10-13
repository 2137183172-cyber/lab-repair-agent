const router = require('express').Router();
const { Op } = require('sequelize');
const { auth, requireRole } = require('../middleware/auth');
const { AuditLog, ESignature, User } = require('../models');
const { success, fail, parsePagination } = require('../utils/response');

// ====== 审计日志 ======

// GET /api/audit/logs?entity_type=&entity_id=&user_id=&action=&start=&end=
router.get('/logs', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { entity_type, entity_id, user_id, action, start, end, page = 1, pageSize = 50 } = req.query;
    const { offset, limit } = parsePagination(req.query);
    const where = {};
    if (entity_type) where.entity_type = entity_type;
    if (entity_id) where.entity_id = entity_id;
    if (user_id) where.user_id = user_id;
    if (action) where.action = action;
    if (start || end) {
      where.created_at = {};
      if (start) where.created_at[Op.gte] = new Date(start);
      if (end) where.created_at[Op.lte] = new Date(end);
    }
    const { count, rows } = await AuditLog.findAndCountAll({
      where, order: [['created_at', 'DESC']], offset, limit
    });
    res.json(success({ list: rows, total: count, page: parseInt(page), pageSize: parseInt(pageSize) }));
  } catch (err) { console.error('[Audit]', err); res.json(fail('获取失败')); }
});

// GET /api/audit/entity/:type/:id - Full audit trail for an entity
router.get('/entity/:type/:id', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const logs = await AuditLog.findAll({
      where: { entity_type: req.params.type, entity_id: req.params.id },
      order: [['created_at', 'DESC']]
    });
    res.json(success(logs));
  } catch (err) { res.json(fail('获取失败')); }
});

// ====== 电子签名 ======

// POST /api/audit/sign
router.post('/sign', auth, async (req, res) => {
  try {
    const { entity_type, entity_id, signature_type, signature_data, reason } = req.body;
    const sig = await ESignature.create({
      user_id: req.user.id, user_name: req.user.name || '',
      entity_type, entity_id, signature_type: signature_type || 'approve',
      signature_data: signature_data || '', reason: reason || '', signed_at: new Date()
    });
    await AuditLog.create({
      user_id: req.user.id, user_name: req.user.name || '', action: 'sign',
      entity_type, entity_id, entity_name: `${entity_type}#${entity_id}`,
      detail: `电子签名: ${signature_type}${reason ? ' - ' + reason : ''}`, created_at: new Date()
    });
    res.json(success(sig, '签名成功'));
  } catch (err) { console.error('[Sign]', err); res.json(fail('签名失败')); }
});

// GET /api/audit/signatures/:type/:id
router.get('/signatures/:type/:id', auth, async (req, res) => {
  try {
    const sigs = await ESignature.findAll({
      where: { entity_type: req.params.type, entity_id: req.params.id },
      order: [['signed_at', 'DESC']]
    });
    res.json(success(sigs));
  } catch (err) { res.json(fail('获取失败')); }
});

module.exports = router;
