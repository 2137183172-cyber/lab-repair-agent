const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { Engineer, RepairOrder, RepairRecord, Device, User, OrderComment, OrderLog, Notification } = require('../models');
const { success, fail, parsePagination } = require('../utils/response');
const { Op } = require('sequelize');
const sequelize = require('../config/db');

// 通知辅助
async function sendNotification(userId, type, title, content, orderId) {
  try { await Notification.create({ user_id: userId, type, title, content, order_id: orderId }); } catch (e) { /* ignore */ }
}

/**
 * GET /api/engineer/profile
 */
router.get('/profile', auth, requireRole('engineer', 'manager', 'admin'), async (req, res) => {
  try {
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id } });
    if (!engineer) return res.json(fail('工程师信息不存在'));
    res.json(success(engineer));
  } catch (err) { res.json(fail('获取失败')); }
});

/**
 * PUT /api/engineer/status
 */
router.put('/status', auth, requireRole('engineer'), async (req, res) => {
  try {
    const { status, latitude, longitude } = req.body;
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id } });
    if (!engineer) return res.json(fail('工程师信息不存在'));
    engineer.status = status;
    if (latitude !== undefined) engineer.latitude = parseFloat(latitude);
    if (longitude !== undefined) engineer.longitude = parseFloat(longitude);
    if (status === 'online') engineer.last_online_at = new Date();
    await engineer.save();
    res.json(success(engineer, '状态更新成功'));
  } catch (err) { res.json(fail('更新失败')); }
});

/**
 * GET /api/engineer/order-pool
 */
router.get('/order-pool', auth, requireRole('engineer'), async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { count, rows } = await RepairOrder.findAndCountAll({
      where: { status: 'pending', engineer_id: null, is_public: false },
      include: [
        { model: Device, as: 'device', attributes: ['id', 'name', 'model', 'brand', 'lab_name', 'lab_room'] },
        { model: User, as: 'reporter', attributes: ['id', 'name', 'company'] }
      ],
      order: [['priority', 'DESC'], ['created_at', 'ASC']],
      offset, limit: pageSize
    });
    res.json(success({ list: rows, total: count, page, pageSize }));
  } catch (err) {
    console.error('[OrderPool]', err);
    res.json(fail('获取工单池失败'));
  }
});

/**
 * POST /api/engineer/accept/:orderId
 * 原子接单：使用 UPDATE WHERE status='pending' AND engineer_id IS NULL 防止竞态条件
 */
router.post('/accept/:orderId', auth, requireRole('engineer'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id }, transaction: t });
    if (!engineer) { await t.rollback(); return res.json(fail('工程师信息不存在')); }

    // 原子更新：同时检查 status=pending 且 engineer_id 为空
    const [affectedCount] = await RepairOrder.update(
      {
        engineer_id: engineer.id,
        status: 'accepted',
        accepted_at: new Date()
      },
      {
        where: { id: req.params.orderId, status: 'pending', engineer_id: null },
        transaction: t
      }
    );

    if (affectedCount === 0) {
      await t.rollback();
      const order = await RepairOrder.findByPk(req.params.orderId);
      if (!order) return res.json(fail('工单不存在'));
      if (order.engineer_id) return res.json(fail('该工单已被其他工程师接单'));
      return res.json(fail('该工单状态已变更，无法接单'));
    }

    const order = await RepairOrder.findByPk(req.params.orderId, { transaction: t });

    await Engineer.update({ status: 'busy' }, { where: { id: engineer.id }, transaction: t });

    await OrderLog.create({
      order_id: order.id, operator_id: engineer.id,
      operator_type: 'engineer', action: 'accepted', detail: '工程师接单'
    }, { transaction: t });
    await sendNotification(order.user_id, 'order_accepted', '工程师已接单', `工单 ${order.order_no} 已有工程师接单`, order.id);

    await t.commit();
    res.json(success(order, '接单成功'));
  } catch (err) {
    await t.rollback();
    console.error('[AcceptOrder]', err);
    res.json(fail('接单失败'));
  }
});

/**
 * GET /api/engineer/my-orders
 */
router.get('/my-orders', auth, requireRole('engineer'), async (req, res) => {
  try {
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id } });
    if (!engineer) return res.json(fail('工程师信息不存在'));
    const { status } = req.query;
    const { page, pageSize, offset } = parsePagination(req.query);
    const where = { engineer_id: engineer.id };
    if (status) where.status = status;

    const { count, rows } = await RepairOrder.findAndCountAll({
      where,
      include: [
        { model: Device, as: 'device', attributes: ['id', 'name', 'model', 'brand'] },
        { model: User, as: 'reporter', attributes: ['id', 'name', 'phone', 'company'] }
      ],
      order: [['created_at', 'DESC']],
      offset, limit: pageSize
    });
    res.json(success({ list: rows, total: count, page, pageSize }));
  } catch (err) { res.json(fail('获取失败')); }
});

/**
 * POST /api/engineer/start-diagnosis/:orderId
 * 工程师到达现场，开始诊断（新增：为报价流程做准备）
 */
router.post('/start-diagnosis/:orderId', auth, requireRole('engineer'), async (req, res) => {
  try {
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id } });
    if (!engineer) return res.json(fail('工程师信息不存在'));
    const order = await RepairOrder.findByPk(req.params.orderId);
    if (!order) return res.json(fail('工单不存在'));
    // C-B1: 验证当前工程师是否为该工单的指派工程师
    if (order.engineer_id !== engineer.id) return res.json(fail('无权操作该工单'));
    if (order.status !== 'accepted') return res.json(fail('当前状态不能开始诊断'));

    order.status = 'diagnosing';
    await order.save();

    await OrderLog.create({
      order_id: order.id, operator_id: req.user.id,
      operator_type: 'engineer', action: 'diagnosing', detail: '开始现场诊断'
    });
    res.json(success(order, '已开始诊断'));
  } catch (err) { res.json(fail('操作失败')); }
});

/**
 * POST /api/engineer/start-repair/:orderId
 * 开始维修（必须先完成支付，paid -> repairing）
 */
router.post('/start-repair/:orderId', auth, requireRole('engineer'), async (req, res) => {
  try {
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id } });
    if (!engineer) return res.json(fail('工程师信息不存在'));
    const order = await RepairOrder.findByPk(req.params.orderId);
    if (!order) return res.json(fail('工单不存在'));
    // C-B1: 验证当前工程师是否为该工单的指派工程师
    if (order.engineer_id !== engineer.id) return res.json(fail('无权操作该工单'));
    if (!['paid', 'repairing'].includes(order.status)) return res.json(fail('请先完成报价审批和支付，再开始维修'));

    order.status = 'repairing';
    order.platform_status = 'repairing';
    order.started_at = new Date();
    await order.save();

    await OrderLog.create({
      order_id: order.id, operator_id: req.user.id,
      operator_type: 'engineer', action: 'started', detail: '开始维修'
    });
    res.json(success(order, '已开始维修'));
  } catch (err) { res.json(fail('操作失败')); }
});

/**
 * POST /api/engineer/complete-repair/:orderId
 */
router.post('/complete-repair/:orderId', auth, requireRole('engineer'), async (req, res) => {
  try {
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id } });
    if (!engineer) return res.json(fail('工程师信息不存在'));
    const order = await RepairOrder.findByPk(req.params.orderId);
    if (!order) return res.json(fail('工单不存在'));
    // C-B1: 验证当前工程师是否为该工单的指派工程师
    if (order.engineer_id !== engineer.id) return res.json(fail('无权操作该工单'));
    if (order.status !== 'repairing') return res.json(fail('当前状态不能完成维修'));

    const { fault_cause, solution, parts_used, labor_cost, before_images, after_images, notes } = req.body;
    const partsCost = (parts_used || []).reduce((sum, p) => sum + (p.qty || 0) * (p.unit_price || 0), 0);
    const totalCost = (parseFloat(labor_cost) || 0) + partsCost;

    await RepairRecord.create({
      order_id: order.id,
      fault_cause: fault_cause || '',
      solution: solution || '',
      parts_used: parts_used || [],
      labor_cost: labor_cost || 0,
      parts_cost: partsCost,
      total_cost: totalCost,
      before_images: before_images || [],
      after_images: after_images || [],
      notes: notes || ''
    });

    order.status = 'pending_review';
    order.platform_status = 'engineer_completed';
    order.finished_at = new Date();
    await order.save();

    if (order.device_id) {
      await Device.update({ status: 'normal' }, { where: { id: order.device_id } });
    }

    await OrderLog.create({
      order_id: order.id, operator_id: req.user.id,
      operator_type: 'engineer', action: 'completed', detail: '维修完成，等待用户评价'
    });
    await sendNotification(order.user_id, 'order_completed', '维修已完成，请评价',
      `工单 ${order.order_no} 维修已完成，请前往评价`, order.id);

    await Engineer.update({ status: 'online' }, { where: { user_id: req.user.id } });

    res.json(success({ order, has_pending_payment: false }, '维修完成'));
  } catch (err) {
    console.error('[CompleteRepair]', err);
    res.json(fail('操作失败'));
  }
});

/**
 * GET /api/engineer/stats
 */
router.get('/stats', auth, requireRole('engineer'), async (req, res) => {
  try {
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id } });
    if (!engineer) return res.json(fail('工程师信息不存在'));

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const todayOrders = await RepairOrder.count({
      where: { engineer_id: engineer.id, created_at: { [Op.gte]: today } }
    });
    const monthOrders = await RepairOrder.count({
      where: { engineer_id: engineer.id, created_at: { [Op.gte]: monthStart } }
    });

    res.json(success({
      today_orders: todayOrders,
      month_orders: monthOrders,
      total_orders: engineer.total_orders,
      completed_orders: engineer.completed_orders,
      rating: engineer.rating,
      balance: engineer.balance
    }));
  } catch (err) {
    console.error('[EngineerStats]', err);
    res.json(fail('获取失败'));
  }
});

/**
 * GET /api/engineer/my-customers — 我的客户列表（服务过的公司）
 */
router.get('/my-customers', auth, requireRole('engineer'), async (req, res) => {
  try {
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id } });
    if (!engineer) return res.json(fail('工程师不存在'));
    const orders = await RepairOrder.findAll({
      where: { engineer_id: engineer.id },
      attributes: ['id'],
      include: [
        { model: User, as: 'reporter', attributes: ['id', 'name', 'company', 'phone'] },
        { model: Device, as: 'device', attributes: ['id', 'name', 'model'] }
      ],
      order: [['created_at', 'DESC']],
      limit: 100
    });
    // Deduplicate by company
    const companyMap = {};
    orders.forEach(o => {
      const key = o.reporter?.company || '未知';
      if (!companyMap[key]) companyMap[key] = { company: key, contacts: [], devices: [], order_count: 0 };
      companyMap[key].order_count++;
      if (o.reporter && !companyMap[key].contacts.find(c => c.id === o.reporter.id)) companyMap[key].contacts.push(o.reporter);
      if (o.device && !companyMap[key].devices.find(d => d.id === o.device.id)) companyMap[key].devices.push(o.device);
    });
    res.json(success(Object.values(companyMap)));
  } catch (err) { res.json(fail('获取失败')); }
});

/**
 * GET /api/engineer/my-devices — 我维修过的设备
 */
router.get('/my-devices', auth, requireRole('engineer'), async (req, res) => {
  try {
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id } });
    if (!engineer) return res.json(fail('工程师不存在'));
    const orders = await RepairOrder.findAll({
      where: { engineer_id: engineer.id },
      include: [{ model: Device, as: 'device' }],
      order: [['created_at', 'DESC']],
      limit: 50
    });
    const deviceMap = {};
    orders.forEach(o => {
      if (o.device && !deviceMap[o.device.id]) {
        deviceMap[o.device.id] = { ...o.device.toJSON(), last_order: o.order_no, last_date: o.created_at };
      }
    });
    res.json(success(Object.values(deviceMap)));
  } catch (err) { res.json(fail('获取失败')); }
});

module.exports = router;
