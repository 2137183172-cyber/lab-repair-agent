const router = require('express').Router();
const { Op } = require('sequelize');
const { auth, requireRole } = require('../middleware/auth');
const { PMPlan, PMRecord, Device, DeviceCategory, User } = require('../models');
const { success, fail, parsePagination } = require('../utils/response');

// ====== PM 模板 ======

// GET /api/pm/templates
router.get('/templates', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const plans = await PMPlan.findAll({ where: { is_template: true }, include: [{ model: DeviceCategory, as: 'instrument_category', attributes: ['id', 'name'] }], order: [['instrument_type', 'ASC']] });
    res.json(success(plans));
  } catch (err) { res.json(fail('获取失败')); }
});

// POST /api/pm/templates/create
router.post('/templates/create', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { template_name, instrument_type, title, description, frequency_days, checklist, estimated_hours, parts_required } = req.body;
    const plan = await PMPlan.create({ template_name, instrument_type, title, description, frequency_days, checklist: checklist || [], estimated_hours, parts_required, is_template: true, status: 'active' });
    res.json(success(plan, '模板创建成功'));
  } catch (err) { res.json(fail('创建失败')); }
});

// ====== PM 计划 & 记录 ======

// GET /api/pm/records?device_id=&status=
router.get('/records', auth, async (req, res) => {
  try {
    const { device_id, status, page = 1, pageSize = 20 } = req.query;
    const { offset, limit } = parsePagination(req.query);
    const where = {};
    if (device_id) where.device_id = device_id;
    if (status) where.status = status;
    const { count, rows } = await PMRecord.findAndCountAll({
      where, include: [{ model: Device, as: 'device', attributes: ['id', 'name', 'model'], include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'company'] }] }],
      order: [['scheduled_at', 'ASC']], offset, limit
    });
    const overdueCount = await PMRecord.count({ where: { status: 'overdue' } });
    res.json(success({ list: rows, total: count, overdue_count: overdueCount, page: parseInt(page), pageSize: parseInt(pageSize) }));
  } catch (err) { console.error('[PM]', err); res.json(fail('获取失败')); }
});

// POST /api/pm/records/create — 直接创建PM记录
router.post('/records/create', auth, async (req, res) => {
  try {
    const { device_id, title, description, scheduled_at, status } = req.body;
    if (!device_id || !title) return res.json(fail('设备和任务名称为必填'));
    const record = await PMRecord.create({ device_id, title, description: description || '', scheduled_at: scheduled_at || new Date(), status: status || 'scheduled' });
    res.json(success(record, '创建成功'));
  } catch (err) { res.json(fail('创建失败')); }
});

// POST /api/pm/generate - Generate PM tasks from templates for a device
router.post('/generate', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { device_id } = req.body;
    const device = await Device.findByPk(device_id, { include: [{ model: DeviceCategory, as: 'category' }] });
    if (!device) return res.json(fail('设备不存在'));
    const templates = await PMPlan.findAll({ where: { is_template: true, instrument_type: device.category_id, status: 'active' } });
    if (templates.length === 0) return res.json(fail('该设备类型没有PM模板'));
    const records = [];
    for (const t of templates) {
      const record = await PMRecord.create({
        plan_id: t.id, device_id: device.id, title: t.title, description: t.description,
        scheduled_at: new Date(Date.now() + (t.frequency_days || 90) * 24 * 3600 * 1000),
        status: 'scheduled'
      });
      records.push(record);
    }
    res.json(success({ generated: records.length }, `已生成 ${records.length} 条PM任务`));
  } catch (err) { console.error('[PM Generate]', err); res.json(fail('生成失败')); }
});

// PUT /api/pm/status/:id — 更新PM记录状态
router.put('/status/:id', auth, async (req, res) => {
  try {
    const record = await PMRecord.findByPk(req.params.id);
    if (!record) return res.json(fail('记录不存在'));
    if (req.body.status) record.status = req.body.status;
    if (req.body.performed_at) record.performed_at = req.body.performed_at;
    await record.save();
    res.json(success(record, '状态已更新'));
  } catch (err) { res.json(fail('更新失败')); }
});

// POST /api/pm/complete/:id
router.post('/complete/:id', auth, async (req, res) => {
  try {
    const record = await PMRecord.findByPk(req.params.id);
    if (!record) return res.json(fail('记录不存在'));
    const { checklist_result, parts_used, hours_spent, findings, attachments, performed_by } = req.body;
    record.status = 'completed';
    record.performed_at = new Date();
    record.performed_by = performed_by || '';
    record.checklist_result = checklist_result || [];
    record.parts_used = parts_used || [];
    record.hours_spent = hours_spent || 0;
    record.findings = findings || '';
    record.attachments = attachments || [];
    await record.save();
    // Generate next PM task
    const plan = await PMPlan.findByPk(record.plan_id);
    if (plan) {
      await PMRecord.create({
        plan_id: plan.id, device_id: record.device_id, title: plan.title, description: plan.description,
        scheduled_at: new Date(Date.now() + (plan.frequency_days || 90) * 24 * 3600 * 1000),
        status: 'scheduled'
      });
    }
    res.json(success(record, 'PM完成，已生成下次任务'));
  } catch (err) { console.error('[PM Complete]', err); res.json(fail('操作失败')); }
});

// PUT /api/pm/templates/:id
router.put('/templates/:id', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const plan = await PMPlan.findByPk(req.params.id);
    if (!plan) return res.json(fail('模板不存在'));
    const fields = ['template_name', 'instrument_type', 'title', 'description', 'frequency_days', 'estimated_hours', 'checklist', 'parts_required'];
    fields.forEach(f => { if (req.body[f] !== undefined) plan[f] = req.body[f]; });
    await plan.save();
    res.json(success(plan, '更新成功'));
  } catch (err) { res.json(fail('更新失败')); }
});

// DELETE /api/pm/templates/:id
router.delete('/templates/:id', auth, requireRole('manager', 'admin'), async (req, res) => {
  try { await PMPlan.destroy({ where: { id: req.params.id } }); res.json(success(null, '已删除')); }
  catch (err) { res.json(fail('删除失败')); }
});

module.exports = router;
