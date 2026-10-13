const router = require('express').Router();
const { Op } = require('sequelize');
const { auth, requireRole } = require('../middleware/auth');
const { Calibration, Device, User, AuditLog } = require('../models');
const { success, fail, parsePagination } = require('../utils/response');

// Helper: auto-lock device if calibration overdue
async function checkDeviceLock(deviceId) {
  const overdue = await Calibration.findOne({
    where: { device_id: deviceId, result: { [Op.ne]: 'pass' }, next_due_at: { [Op.lt]: new Date() } }
  });
  if (overdue) {
    await Device.update({ status: 'scrapped' }, { where: { id: deviceId } });
  }
}

// GET /api/calibration/list?device_id=&status=
router.get('/list', auth, async (req, res) => {
  try {
    const { device_id, status, page = 1, pageSize = 20 } = req.query;
    const { offset, limit } = parsePagination(req.query);
    const where = {};
    if (device_id) where.device_id = device_id;
    const now = new Date();
    if (status === 'overdue') where.next_due_at = { [Op.lt]: now };
    else if (status === 'upcoming') where.next_due_at = { [Op.between]: [now, new Date(now.getTime() + 30 * 24 * 3600 * 1000)] };
    else if (status === 'ok') where.next_due_at = { [Op.gt]: new Date(now.getTime() + 30 * 24 * 3600 * 1000) };

    const { count, rows } = await Calibration.findAndCountAll({
      where, include: [{ model: Device, as: 'device', attributes: ['id', 'name', 'model', 'status', 'company_id'], include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'company'] }] }],
      order: [['next_due_at', 'ASC']], offset, limit
    });
    const overdueCount = await Calibration.count({ where: { next_due_at: { [Op.lt]: new Date() } } });
    res.json(success({ list: rows, total: count, overdue_count: overdueCount, page: parseInt(page), pageSize: parseInt(pageSize) }));
  } catch (err) { console.error('[Calibration]', err); res.json(fail('获取失败')); }
});

// POST /api/calibration/create
router.post('/create', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { device_id, plan_name, calibration_type, standard, cycle_days, last_calibrated_at, cert_no, cert_url, calibrated_by, calibration_points, result, notes } = req.body;
    const days = cycle_days || 365;
    const lastCal = last_calibrated_at ? new Date(last_calibrated_at) : new Date();
    const nextDue = new Date(lastCal.getTime() + days * 24 * 3600 * 1000);
    const cal = await Calibration.create({ device_id, plan_name, calibration_type: calibration_type || 'external', standard, cycle_days: days, last_calibrated_at: lastCal, next_due_at: nextDue, cert_no, cert_url, calibrated_by, calibration_points, result: result || 'pass', notes, created_by: req.user.id });
    await AuditLog.create({ user_id: req.user.id, user_name: req.user.name || '', action: 'create', entity_type: 'Calibration', entity_id: cal.id, entity_name: plan_name || '', detail: `创建校准记录: ${plan_name}`, created_at: new Date() });
    res.json(success(cal, '创建成功'));
  } catch (err) { console.error('[Cal Create]', err); res.json(fail('创建失败')); }
});

// PUT /api/calibration/update/:id
router.put('/update/:id', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const cal = await Calibration.findByPk(req.params.id);
    if (!cal) return res.json(fail('记录不存在'));
    const fields = ['plan_name', 'calibration_type', 'standard', 'cycle_days', 'last_calibrated_at', 'cert_no', 'cert_url', 'calibrated_by', 'calibration_points', 'result', 'notes'];
    fields.forEach(f => { if (req.body[f] !== undefined) cal[f] = req.body[f]; });
    // Recalculate next due
    if (req.body.last_calibrated_at || req.body.cycle_days) {
      const lastCal = cal.last_calibrated_at ? new Date(cal.last_calibrated_at) : new Date();
      cal.next_due_at = new Date(lastCal.getTime() + cal.cycle_days * 24 * 3600 * 1000);
    }
    await cal.save();
    await AuditLog.create({ user_id: req.user.id, action: 'update', entity_type: 'Calibration', entity_id: cal.id, detail: '更新校准记录', created_at: new Date() });
    res.json(success(cal, '更新成功'));
  } catch (err) { res.json(fail('更新失败')); }
});

router.delete('/delete/:id', auth, requireRole('manager', 'admin'), async (req, res) => {
  try { await Calibration.destroy({ where: { id: req.params.id } }); res.json(success(null, '已删除')); }
  catch (err) { res.json(fail('删除失败')); }
});

module.exports = router;
