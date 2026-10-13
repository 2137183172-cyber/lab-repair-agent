const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { RepairOrder, RepairRecord, Device, DeviceCategory, Engineer, User, OrderComment, OrderLog, Notification, Quotation } = require('../models');
const { success, fail, parsePagination, generateOrderNo } = require('../utils/response');
const { Op } = require('sequelize');
const sequelize = require('../config/db');

// ==============  用户报修 ==============

/**
 * POST /api/order/create
 * 创建报修工单
 * Body: { device_id, fault_desc, fault_images, priority, contact_name, contact_phone, address, scheduled_at }
 */
router.post('/create', auth, async (req, res) => {
  try {
    const { device_id, fault_desc, fault_images, fault_video, priority, contact_name, contact_phone, address, scheduled_at, is_public, engineer_id } = req.body;
    if (!fault_desc || !fault_desc.trim()) {
      return res.json(fail('请填写故障描述'));
    }

    const user = await User.findByPk(req.user.id);
    const orderNo = await generateUniqueOrderNo();

    // 如果指定了工程师，验证工程师是否存在且可接单
    let assignedEngineerId = null;
    let initialStatus = 'pending';
    if (engineer_id && !is_public) {
      const engineer = await Engineer.findByPk(engineer_id);
      if (!engineer) return res.json(fail('指定工程师不存在'));
      if (engineer.status === 'offline') return res.json(fail('该工程师当前离线，请选择其他工程师'));
      assignedEngineerId = engineer.id;
      initialStatus = 'accepted';
      // 工程师状态改为忙碌
      await Engineer.update({ status: 'busy' }, { where: { id: engineer.id } });
    }

    const order = await RepairOrder.create({
      order_no: orderNo,
      user_id: req.user.id,
      device_id: device_id || null,
      engineer_id: assignedEngineerId,
      fault_desc,
      fault_images: fault_images || [],
      fault_video: fault_video || '',
      priority: priority || 'normal',
      contact_name: contact_name || user.name,
      contact_phone: contact_phone || user.phone,
      address: address || '',
      scheduled_at: scheduled_at ? new Date(scheduled_at) : null,
      is_public: engineer_id ? false : (is_public === true || is_public === 'true' || is_public === 1 ? true : false),
      status: initialStatus,
      deadline_at: new Date(Date.now() + 30 * 60 * 1000)  // 30分钟超时
    });

    // 如果关联设备，更新设备状态
    if (device_id) {
      await Device.update({ status: 'repairing' }, { where: { id: device_id } });
    }

    // 记录日志
    const logDetail = assignedEngineerId
      ? `提交报修并指定工程师 ID:${assignedEngineerId}`
      : '提交报修';
    await OrderLog.create({
      order_id: order.id, operator_id: req.user.id,
      operator_type: 'user', action: 'created', detail: logDetail
    });

    // 如果指定了工程师，额外记录指派日志
    if (assignedEngineerId) {
      await OrderLog.create({
        order_id: order.id, operator_id: req.user.id,
        operator_type: 'user', action: 'assigned',
        detail: `用户自选工程师 ID:${assignedEngineerId}，工单已直接指派`
      });
    }

    // 通知管理员（生产环境对接短信/订阅消息）
    console.log(`[新工单] ${orderNo} - ${fault_desc.substring(0, 50)}${assignedEngineerId ? ' [指定工程师:'+assignedEngineerId+']' : ''}`);

    res.json(success(order, assignedEngineerId ? '报修已提交，已指派工程师' : '报修提交成功'));
  } catch (err) {
    console.error('[CreateOrder]', err);
    res.json(fail('提交失败'));
  }
});

/**
 * GET /api/order/detail/:id
 * 工单详情（含完整关联信息）
 */
router.get('/detail/:id', auth, async (req, res) => {
  try {
    const order = await RepairOrder.findByPk(req.params.id, {
      include: [
        {
          model: Device,
          as: 'device',
          include: [{ model: DeviceCategory, as: 'category', attributes: ['id', 'name'] }]
        },
        { model: Engineer, as: 'engineer', attributes: ['id', 'user_id', 'name', 'phone', 'rating', 'avatar'] },
        { model: User, as: 'reporter', attributes: ['id', 'name', 'phone', 'company'] },
        { model: RepairRecord, as: 'repair_record' },
        { model: OrderComment, as: 'comment' },
        { model: OrderLog, as: 'logs', order: [['created_at', 'ASC']] },
        {
          model: Quotation,
          as: 'quotations',
          order: [['created_at', 'DESC']],
          separate: true
        }
      ]
    });

    if (!order) return res.json(fail('工单不存在'));

    // 权限检查
    const isReporter = order.user_id === req.user.id;
    const isEngineer = order.engineer && order.engineer.user_id === req.user.id;
    const isManager = ['manager', 'admin'].includes(req.user.role);
    if (!isReporter && !isEngineer && !isManager) {
      return res.json(fail('无权查看该工单'));
    }

    // 按角色过滤操作日志
    const { getRoleLevel } = require('../config/logVisibility');
    const userLevel = getRoleLevel(req.user.role);
    const orderJson = order.toJSON();
    if (orderJson.logs) {
      orderJson.logs = orderJson.logs.filter(log => (log.visibility || 0) <= userLevel);
    }

    res.json(success(orderJson));
  } catch (err) {
    console.error('[OrderDetail]', err);
    res.json(fail('获取失败'));
  }
});

/**
 * POST /api/order/cancel/:id
 * 取消工单
 */
router.post('/cancel/:id', auth, async (req, res) => {
  try {
    const order = await RepairOrder.findByPk(req.params.id);
    if (!order) return res.json(fail('工单不存在'));
    if (order.user_id !== req.user.id) return res.json(fail('无权操作'));
    if (!['pending', 'accepted', 'diagnosing', 'quoted'].includes(order.status)) {
      return res.json(fail('当前状态不可取消'));
    }

    order.status = 'cancelled';
    order.cancelled_at = new Date();
    order.cancel_reason = req.body.reason || '用户主动取消';
    await order.save();

    // 恢复设备状态
    if (order.device_id) {
      await Device.update({ status: 'normal' }, { where: { id: order.device_id } });
    }

    await OrderLog.create({
      order_id: order.id, operator_id: req.user.id,
      operator_type: 'user', action: 'cancelled', detail: order.cancel_reason
    });

    res.json(success(order, '工单已取消'));
  } catch (err) {
    res.json(fail('操作失败'));
  }
});

/**
 * POST /api/order/confirm/:id
 * 用户验收工单
 * Body: { rating, content, tags, signature_url }
 */
router.post('/confirm/:id', auth, async (req, res) => {
  try {
    const order = await RepairOrder.findByPk(req.params.id);
    if (!order) return res.json(fail('工单不存在'));
    if (order.user_id !== req.user.id) return res.json(fail('无权操作'));
    if (!['completed', 'pending_review'].includes(order.status)) return res.json(fail('工单尚未完成，无法验收'));

    const { rating, content, tags, signature_url, response_speed, skill_level, attitude, price_fairness } = req.body;

    // 更新工单
    order.status = 'confirmed';
    order.platform_status = 'confirmed';
    order.confirmed_at = new Date();
    await order.save();

    // 保存评价(含4维评分)
    await OrderComment.create({
      order_id: order.id,
      user_id: req.user.id,
      rating: rating || 5,
      content: content || '',
      tags: tags || [],
      response_speed: response_speed || rating || 5,
      skill_level: skill_level || rating || 5,
      attitude: attitude || rating || 5,
      price_fairness: price_fairness || rating || 5
    });

    // 更新签名
    if (signature_url && order.repair_record) {
      const record = await RepairRecord.findOne({ where: { order_id: order.id } });
      if (record) {
        record.signature_url = signature_url;
        await record.save();
      }
    }

    // 更新工程师评分
    if (order.engineer_id) {
      await updateEngineerRating(order.engineer_id);
    }

    await OrderLog.create({
      order_id: order.id, operator_id: req.user.id,
      operator_type: 'user', action: 'confirmed', detail: `验收完成，评分: ${rating}`
    });

    res.json(success(order, '验收成功，感谢评价'));
  } catch (err) {
    console.error('[ConfirmOrder]', err);
    res.json(fail('操作失败'));
  }
});

// ==============  管理端 ==============

/**
 * GET /api/order/list (管理端)
 * 全部工单列表 + 筛选
 * Query: ?status=&priority=&engineer_id=&keyword=&page=&pageSize=
 */
router.get('/list', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { status, priority, engineer_id, keyword, start_date, end_date } = req.query;
    const where = {};

    if (req.query.status) where.status = req.query.status.split(',');
    if (req.query.priority) where.priority = req.query.priority;
    if (req.query.engineer_id) where.engineer_id = parseInt(req.query.engineer_id);

    if (req.query.keyword) {
      where[Op.or] = [
        { order_no: { [Op.like]: `%${req.query.keyword}%` } },
        { fault_desc: { [Op.like]: `%${req.query.keyword}%` } }
      ];
    }

    if (req.query.start_date || req.query.end_date) {
      where.created_at = {};
      if (req.query.start_date) where.created_at[Op.gte] = new Date(req.query.start_date);
      if (req.query.end_date) where.created_at[Op.lte] = new Date(req.query.end_date);
    }

    const { count, rows } = await RepairOrder.findAndCountAll({
      where,
      include: [
        { model: Device, as: 'device', attributes: ['id', 'name', 'brand'] },
        { model: Engineer, as: 'engineer', attributes: ['id', 'name', 'phone'] },
        { model: User, as: 'reporter', attributes: ['id', 'name', 'phone', 'company'] }
      ],
      order: [['created_at', 'DESC']],
      offset,
      limit: pageSize
    });

    res.json(success({ list: rows, total: count, page, pageSize }));
  } catch (err) {
    console.error('[OrderList]', err);
    res.json(fail('获取失败'));
  }
});

/**
 * POST /api/order/assign/:id (管理端)
 * 派单/改派工程师
 * Body: { engineer_id }
 */
router.post('/assign/:id', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { engineer_id } = req.body;
    const order = await RepairOrder.findByPk(req.params.id);
    if (!order) return res.json(fail('工单不存在'));

    const oldEngineerId = order.engineer_id;
    order.engineer_id = engineer_id;
    order.status = 'accepted';
    order.accepted_at = new Date();
    await order.save();

    // 更新工程师状态
    await Engineer.update({ status: 'busy' }, { where: { id: engineer_id } });

    await OrderLog.create({
      order_id: order.id, operator_id: req.user.id,
      operator_type: 'manager', action: 'accepted',
      detail: oldEngineerId ? `改派工程师 ID:${oldEngineerId} -> ${engineer_id}` : '管理员派单',
      visibility: 2
    });

    res.json(success(order, '派单成功'));
  } catch (err) {
    console.error('[AssignOrder]', err);
    res.json(fail('操作失败'));
  }
});

// ==============  工具函数 ==============

async function generateUniqueOrderNo() {
  let orderNo;
  let exists = true;
  while (exists) {
    orderNo = generateOrderNo();
    exists = await RepairOrder.findOne({ where: { order_no: orderNo } });
  }
  return orderNo;
}

async function updateEngineerRating(engineerId) {
  const result = await OrderComment.findAll({
    include: [{ model: RepairOrder, as: 'order', where: { engineer_id: engineerId }, attributes: [] }],
    attributes: [
      [sequelize.fn('AVG', sequelize.col('rating')), 'avg'],
      [sequelize.fn('AVG', sequelize.col('response_speed')), 'avg_resp'],
      [sequelize.fn('AVG', sequelize.col('skill_level')), 'avg_skill'],
      [sequelize.fn('AVG', sequelize.col('attitude')), 'avg_attitude'],
      [sequelize.fn('AVG', sequelize.col('price_fairness')), 'avg_price'],
      [sequelize.fn('COUNT', sequelize.col('OrderComment.id')), 'count'],
      [sequelize.literal("SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END)"), 'good_count']
    ],
    raw: true
  });

  if (result && result[0]) {
    const { avg, avg_resp, avg_skill, avg_attitude, avg_price, count, good_count } = result[0];
    const goodRate = count > 0 ? ((good_count / count) * 100).toFixed(1) : 100;
    await Engineer.update(
      {
        rating: avg ? parseFloat(avg).toFixed(1) : 5.0,
        rating_response: avg_resp ? parseFloat(avg_resp).toFixed(1) : 5.0,
        rating_skill: avg_skill ? parseFloat(avg_skill).toFixed(1) : 5.0,
        rating_attitude: avg_attitude ? parseFloat(avg_attitude).toFixed(1) : 5.0,
        rating_price: avg_price ? parseFloat(avg_price).toFixed(1) : 5.0,
        review_count: count,
        good_rate: parseFloat(goodRate),
        total_orders: count
      },
      { where: { id: engineerId } }
    );
  }
}

async function sendNotification(userId, type, title, content, orderId) {
  try {
    await Notification.create({ user_id: userId, type, title, content, order_id: orderId });
  } catch (e) {
    console.error('[Notification]', e);
  }
}

module.exports = router;
