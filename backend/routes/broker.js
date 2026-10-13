const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { RepairOrder, Engineer, Quotation, Payment, User, Device, OrderLog } = require('../models');
const { success, fail, parsePagination, generateQuotationNo, generatePaymentNo } = require('../utils/response');
const sequelize = require('../config/db');
const { Op } = require('sequelize');

const brokerRoles = ['manager', 'admin', 'engineer_lead'];
const visibleStatuses = [
  'pending_review',
  'reviewing',
  'need_more_info',
  'pricing',
  'quoted',
  'paid',
  'assigned',
  'repairing',
  'engineer_completed',
  'platform_review',
  'pending_customer_confirm',
  'confirmed',
  'rejected',
  'settlement_pending',
  'settled'
];

function canTransit(from, to) {
  const map = {
    pending_review: ['reviewing', 'pricing', 'need_more_info', 'rejected'],
    reviewing: ['pricing', 'need_more_info', 'rejected'],
    need_more_info: ['reviewing', 'pricing', 'rejected'],
    pricing: ['quoted', 'assigned', 'rejected'],
    quoted: ['paid', 'pricing', 'rejected'],
    paid: ['assigned'],
    assigned: ['repairing', 'pricing'],
    repairing: ['engineer_completed', 'platform_review'],
    engineer_completed: ['platform_review'],
    platform_review: ['pending_customer_confirm', 'repairing'],
    pending_customer_confirm: ['confirmed'],
    confirmed: ['settlement_pending', 'settled'],
    settlement_pending: ['settled']
  };
  if (!from) return true;
  return from === to || (map[from] || []).includes(to);
}

async function log(orderId, userId, action, detail, transaction) {
  await OrderLog.create({
    order_id: orderId,
    operator_id: userId,
    operator_type: 'manager',
    action,
    detail,
    visibility: 2
  }, { transaction });
}

router.get('/orders', auth, requireRole(...brokerRoles), async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const where = {};
    if (req.query.platform_status) where.platform_status = req.query.platform_status;
    if (req.query.status) where.status = req.query.status;
    if (req.query.manager_id) where.manager_id = parseInt(req.query.manager_id, 10);
    if (req.query.keyword) {
      where[Op.or] = [
        { order_no: { [Op.like]: `%${req.query.keyword}%` } },
        { fault_desc: { [Op.like]: `%${req.query.keyword}%` } },
        { contact_name: { [Op.like]: `%${req.query.keyword}%` } },
        { contact_phone: { [Op.like]: `%${req.query.keyword}%` } }
      ];
    }

    const { count, rows } = await RepairOrder.findAndCountAll({
      where,
      include: [
        { model: User, as: 'reporter', attributes: ['id', 'name', 'phone', 'company'] },
        { model: Engineer, as: 'engineer', attributes: ['id', 'name', 'phone', 'rating', 'status'] },
        { model: Device, as: 'device', attributes: ['id', 'name', 'model', 'brand', 'lab_name'] }
      ],
      order: [['created_at', 'DESC']],
      offset,
      limit: pageSize
    });

    res.json(success({ list: rows, total: count, page, pageSize, statuses: visibleStatuses }));
  } catch (err) {
    console.error('[BrokerOrders]', err);
    res.json(fail('获取中间人订单列表失败'));
  }
});

router.post('/orders/:id/review', auth, requireRole(...brokerRoles), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const order = await RepairOrder.findByPk(req.params.id, { transaction: t });
    if (!order) {
      await t.rollback();
      return res.json(fail('工单不存在'));
    }

    const nextStatus = req.body.platform_status || 'reviewing';
    if (!visibleStatuses.includes(nextStatus)) {
      await t.rollback();
      return res.json(fail('无效的平台状态'));
    }
    if (!canTransit(order.platform_status || 'pending_review', nextStatus)) {
      await t.rollback();
      return res.json(fail(`平台状态不可从 ${order.platform_status} 流转到 ${nextStatus}`));
    }

    order.manager_id = req.user.id;
    order.platform_status = nextStatus;
    if (req.body.priority) order.priority = req.body.priority;
    if (req.body.internal_notes !== undefined) order.internal_notes = req.body.internal_notes;
    await order.save({ transaction: t });
    await log(order.id, req.user.id, 'broker_review', `中间人审核：${nextStatus}`, t);
    await t.commit();

    res.json(success(order, '审核状态已更新'));
  } catch (err) {
    await t.rollback();
    console.error('[BrokerReview]', err);
    res.json(fail('审核失败'));
  }
});

router.post('/orders/:id/price', auth, requireRole(...brokerRoles), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const order = await RepairOrder.findByPk(req.params.id, { transaction: t });
    if (!order) {
      await t.rollback();
      return res.json(fail('工单不存在'));
    }

    const customerPrice = parseFloat(req.body.customer_price);
    const engineerPrice = parseFloat(req.body.engineer_price);
    if (!Number.isFinite(customerPrice) || customerPrice <= 0) {
      await t.rollback();
      return res.json(fail('客户报价必须大于 0'));
    }
    if (!Number.isFinite(engineerPrice) || engineerPrice < 0) {
      await t.rollback();
      return res.json(fail('工程师结算价不能小于 0'));
    }
    if (engineerPrice > customerPrice) {
      await t.rollback();
      return res.json(fail('工程师结算价不能高于客户报价'));
    }

    let quotationNo;
    let exists = true;
    while (exists) {
      quotationNo = generateQuotationNo();
      exists = await Quotation.findOne({ where: { quotation_no: quotationNo }, transaction: t });
    }

    const items = Array.isArray(req.body.items) && req.body.items.length
      ? req.body.items
      : [{ name: '平台维修服务报价', qty: 1, unit_price: customerPrice, subtotal: customerPrice, type: 'labor' }];

    const quotation = await Quotation.create({
      order_id: order.id,
      quotation_no: quotationNo,
      diagnosis_summary: req.body.diagnosis_summary || '平台中间人定价',
      diagnosis_images: req.body.diagnosis_images || [],
      items,
      labor_cost: customerPrice,
      parts_cost: 0,
      total_cost: customerPrice,
      status: 'submitted',
      submitted_at: new Date(),
      notes: req.body.notes || '',
      valid_until: req.body.valid_until || null,
      created_by: req.user.id
    }, { transaction: t });

    order.manager_id = req.user.id;
    order.pricing_mode = req.body.pricing_mode || order.pricing_mode || 'direct';
    order.customer_price = customerPrice;
    order.engineer_price = engineerPrice;
    order.platform_margin = customerPrice - engineerPrice;
    order.selected_quotation_id = quotation.id;
    order.status = 'quoted';
    order.platform_status = 'quoted';
    if (req.body.internal_notes !== undefined) order.internal_notes = req.body.internal_notes;
    await order.save({ transaction: t });

    let paymentNo;
    let paymentExists = true;
    while (paymentExists) {
      paymentNo = generatePaymentNo();
      paymentExists = await Payment.findOne({ where: { payment_no: paymentNo }, transaction: t });
    }

    const payment = await Payment.create({
      payment_no: paymentNo,
      order_id: order.id,
      quotation_id: quotation.id,
      user_id: order.user_id,
      amount: customerPrice,
      method: req.body.method || 'mock',
      status: 'pending'
    }, { transaction: t });

    await log(order.id, req.user.id, 'broker_priced', `平台定价：客户价 ${customerPrice}，工程师结算价 ${engineerPrice}，毛利 ${customerPrice - engineerPrice}`, t);
    await t.commit();

    res.json(success({ order, quotation, payment }, '平台报价已生成'));
  } catch (err) {
    await t.rollback();
    console.error('[BrokerPrice]', err);
    res.json(fail('定价失败'));
  }
});

router.post('/orders/:id/assign', auth, requireRole(...brokerRoles), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const order = await RepairOrder.findByPk(req.params.id, { transaction: t });
    if (!order) {
      await t.rollback();
      return res.json(fail('工单不存在'));
    }
    const engineer = await Engineer.findByPk(req.body.engineer_id, { transaction: t });
    if (!engineer) {
      await t.rollback();
      return res.json(fail('工程师不存在'));
    }
    if (engineer.status === 'offline') {
      await t.rollback();
      return res.json(fail('工程师离线，不能派单'));
    }

    order.manager_id = req.user.id;
    order.engineer_id = engineer.id;
    order.status = order.status === 'pending' ? 'accepted' : order.status;
    order.platform_status = order.status === 'paid' ? 'assigned' : 'assigned';
    if (!order.accepted_at) order.accepted_at = new Date();
    if (req.body.engineer_price !== undefined) {
      const engineerPrice = parseFloat(req.body.engineer_price);
      if (!Number.isFinite(engineerPrice) || engineerPrice < 0) {
        await t.rollback();
        return res.json(fail('工程师结算价无效'));
      }
      order.engineer_price = engineerPrice;
      order.platform_margin = parseFloat(order.customer_price || 0) - engineerPrice;
    }
    await order.save({ transaction: t });
    await engineer.update({ status: 'busy' }, { transaction: t });
    await log(order.id, req.user.id, 'broker_assigned', `中间人派单给工程师 ${engineer.name}#${engineer.id}`, t);
    await t.commit();

    res.json(success({ order, engineer }, '派单成功'));
  } catch (err) {
    await t.rollback();
    console.error('[BrokerAssign]', err);
    res.json(fail('派单失败'));
  }
});

router.post('/orders/:id/platform-review', auth, requireRole(...brokerRoles), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const order = await RepairOrder.findByPk(req.params.id, { transaction: t });
    if (!order) {
      await t.rollback();
      return res.json(fail('工单不存在'));
    }
    if (!['pending_review', 'completed'].includes(order.status)) {
      await t.rollback();
      return res.json(fail('只有维修完成待复核的工单可平台复核'));
    }

    const approved = req.body.approved !== false;
    if (approved) {
      order.platform_status = 'pending_customer_confirm';
      order.status = 'pending_review';
    } else {
      order.platform_status = 'repairing';
      order.status = 'repairing';
    }
    if (req.body.internal_notes !== undefined) order.internal_notes = req.body.internal_notes;
    await order.save({ transaction: t });
    await log(order.id, req.user.id, approved ? 'broker_report_approved' : 'broker_report_rejected', req.body.notes || '', t);
    await t.commit();

    res.json(success(order, approved ? '平台复核通过' : '平台复核退回'));
  } catch (err) {
    await t.rollback();
    console.error('[BrokerPlatformReview]', err);
    res.json(fail('平台复核失败'));
  }
});

module.exports = router;
