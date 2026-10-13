const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { Payment, Settlement, RepairOrder, Quotation, Engineer, OrderLog, PlatformSetting } = require('../models');
const { success, fail, parsePagination, generatePaymentNo, generateSettlementNo } = require('../utils/response');
const sequelize = require('../config/db');
const { Op } = require('sequelize');

// 获取平台配置
async function getSetting(key, defaultValue) {
  try {
    const s = await PlatformSetting.findByPk(key);
    return s ? s.value : defaultValue;
  } catch (e) { return defaultValue; }
}

async function markOrderPaid(orderId, transaction) {
  const order = await RepairOrder.findByPk(orderId, { transaction });
  if (!order) return null;

  order.payment_status = 'held';
  if (order.platform_status === 'quoted') order.platform_status = 'paid';
  if (['pending', 'accepted', 'diagnosing', 'quoted'].includes(order.status)) {
    order.status = 'paid';
  }
  await order.save({ transaction });
  return order;
}

async function calculateSettlementAmounts(payment, order) {
  const paidAmount = parseFloat(payment.amount);
  const configuredCommissionRate = parseFloat(await getSetting('commission_rate', '15.00'));
  const brokerEngineerPrice = order && parseFloat(order.engineer_price || 0);

  if (order && Number.isFinite(brokerEngineerPrice) && brokerEngineerPrice > 0) {
    const engineerAmount = parseFloat(Math.min(brokerEngineerPrice, paidAmount).toFixed(2));
    const commissionAmount = parseFloat((paidAmount - engineerAmount).toFixed(2));
    const commissionRate = paidAmount > 0 ? parseFloat((commissionAmount / paidAmount * 100).toFixed(2)) : 0;
    return { commissionRate, commissionAmount, engineerAmount };
  }

  const commissionAmount = parseFloat((paidAmount * configuredCommissionRate / 100).toFixed(2));
  const engineerAmount = parseFloat((paidAmount - commissionAmount).toFixed(2));
  return { commissionRate: configuredCommissionRate, commissionAmount, engineerAmount };
}

// ===== 创建支付 =====
router.post('/create', auth, async (req, res) => {
  try {
    const { order_id, method } = req.body;
    const order = await RepairOrder.findByPk(order_id);
    if (!order) return res.json(fail('工单不存在'));
    if (order.user_id !== req.user.id) return res.json(fail('无权操作'));
    if (order.payment_status === 'held' || ['paid', 'repairing', 'pending_review', 'confirmed'].includes(order.status)) {
      return res.json(fail('该工单已支付，无需重复创建支付单'));
    }

    const existingPending = await Payment.findOne({
      where: { order_id: order.id, status: 'pending' },
      order: [['created_at', 'DESC']]
    });
    if (existingPending) return res.json(success(existingPending, '支付单已存在'));

    // 确定金额：优先使用中标报价，否则使用第一份已批准的报价
    let amount = 0;
    let quotation_id = null;
    if (order.selected_quotation_id) {
      const q = await Quotation.findByPk(order.selected_quotation_id);
      if (q) { amount = parseFloat(q.total_cost); quotation_id = q.id; }
    }
    if (!amount) {
      const q = await Quotation.findOne({ where: { order_id: order.id, status: 'approved' }, order: [['created_at', 'DESC']] });
      if (q) { amount = parseFloat(q.total_cost); quotation_id = q.id; }
    }
    if (!amount) return res.json(fail('未找到已批准的报价'));

    let paymentNo;
    let exists = true;
    while (exists) { paymentNo = generatePaymentNo(); exists = await Payment.findOne({ where: { payment_no: paymentNo } }); }

    const payment = await Payment.create({
      payment_no: paymentNo,
      order_id: order.id,
      quotation_id,
      user_id: req.user.id,
      amount,
      method: method || 'mock',
      status: 'pending'
    });

    await OrderLog.create({
      order_id: order.id, operator_id: req.user.id,
      operator_type: 'user', action: 'payment_created',
      detail: `创建支付 ${paymentNo}，金额 ¥${amount}`
    });

    res.json(success(payment, '支付单已创建'));
  } catch (err) {
    console.error('[PaymentCreate]', err);
    res.json(fail('创建支付失败'));
  }
});

// ===== 执行支付 =====
router.post('/pay/:paymentNo', auth, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const payment = await Payment.findOne({ where: { payment_no: req.params.paymentNo } });
    if (!payment) { await t.rollback(); return res.json(fail('支付单不存在')); }
    if (payment.status !== 'pending') { await t.rollback(); return res.json(fail('支付单状态异常')); }
    if (payment.user_id !== req.user.id) { await t.rollback(); return res.json(fail('无权操作')); }

    // Mock 模式：即时成功
    if (payment.method === 'mock') {
      payment.status = 'success';
      payment.paid_at = new Date();
      payment.wx_transaction_id = 'MOCK_' + Date.now();
      await payment.save({ transaction: t });

      // 支付成功后工单进入 paid，等待工程师开始维修。
      const order = await markOrderPaid(payment.order_id, t);

      // 创建分账记录
      const { commissionRate, commissionAmount, engineerAmount } = await calculateSettlementAmounts(payment, order);

      const settlementTPlus = parseInt(await getSetting('settlement_t_plus', '7'));

      // 平台佣金结算
      let settleNo; let ex = true;
      while (ex) { settleNo = generateSettlementNo(); ex = await Settlement.findOne({ where: { settlement_no: settleNo } }); }
      await Settlement.create({
        settlement_no: settleNo, payment_id: payment.id, order_id: payment.order_id,
        recipient_id: null, recipient_type: 'platform', amount: commissionAmount,
        commission_rate: commissionRate, commission_amount: commissionAmount, engineer_amount: 0,
        status: 'released', settle_at: new Date(), released_at: new Date()
      }, { transaction: t });

      // 工程师结算（held 状态，T+N 后释放）
      if (order && order.engineer_id) {
        let settleNo2; let ex2 = true;
        while (ex2) { settleNo2 = generateSettlementNo(); ex2 = await Settlement.findOne({ where: { settlement_no: settleNo2 } }); }
        const settleDate = new Date(Date.now() + settlementTPlus * 86400000);
        await Settlement.create({
          settlement_no: settleNo2, payment_id: payment.id, order_id: payment.order_id,
          recipient_id: order.engineer_id, recipient_type: 'engineer', amount: engineerAmount,
          commission_rate: commissionRate, commission_amount: commissionAmount, engineer_amount: engineerAmount,
          status: 'held', settle_at: settleDate
        }, { transaction: t });

        // 冻结工程师余额
        await Engineer.increment({ frozen_balance: engineerAmount }, { where: { id: order.engineer_id }, transaction: t });
      }

      await OrderLog.create({
        order_id: payment.order_id, operator_id: req.user.id,
        operator_type: 'user', action: 'paid',
        detail: `支付成功 ¥${payment.amount}（mock），佣金 ¥${commissionAmount}(${commissionRate}%)，工程师待结算 ¥${engineerAmount}`
      }, { transaction: t });

      await t.commit();
      res.json(success({
        payment_no: payment.payment_no,
        amount: payment.amount,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        engineer_amount: engineerAmount,
        paid_at: payment.paid_at
      }, '支付成功'));
    } else {
      // 微信支付 JSAPI 预留接口
      await t.rollback();
      return res.json(fail('微信支付暂未接入，请使用模拟支付'));
    }
  } catch (err) {
    await t.rollback();
    console.error('[Payment]', err);
    res.json(fail('支付失败'));
  }
});

// ===== 查询支付状态 =====
router.get('/status/:orderId', auth, async (req, res) => {
  try {
    const payments = await Payment.findAll({
      where: { order_id: req.params.orderId },
      order: [['created_at', 'DESC']]
    });
    const latest = payments.length > 0 ? payments[0] : null;
    res.json(success({ latest, list: payments }));
  } catch (err) {
    res.json(fail('查询失败'));
  }
});

// ===== 退款 =====
router.post('/refund/:paymentNo', auth, requireRole('admin', 'manager'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const payment = await Payment.findOne({ where: { payment_no: req.params.paymentNo } });
    if (!payment) { await t.rollback(); return res.json(fail('支付单不存在')); }
    if (payment.status !== 'success') { await t.rollback(); return res.json(fail('仅已支付可退款')); }

    const { reason, amount } = req.body;
    const refundAmount = parseFloat(amount) || payment.amount;

    payment.status = 'refunding';
    payment.refund_reason = reason || '管理员发起退款';
    payment.refund_amount = refundAmount;
    await payment.save({ transaction: t });

    // Mock: 即时退款
    if (payment.method === 'mock') {
      payment.status = 'refunded';
      payment.refunded_at = new Date();
      await payment.save({ transaction: t });

      const order = await RepairOrder.findByPk(payment.order_id, { transaction: t });
      if (order) {
        order.payment_status = 'refunded';
        if (order.status === 'paid') order.status = 'quoted';
        await order.save({ transaction: t });
      }

      // C-B2: 回滚结算记录 — 取消所有关联的 held 状态结算，并扣减工程师冻结余额
      const settlements = await Settlement.findAll({
        where: { payment_id: payment.id, status: 'held', recipient_type: 'engineer' }
      });
      for (const s of settlements) {
        s.status = 'cancelled';
        await s.save({ transaction: t });
        // 扣减工程师冻结余额
        const engAmount = parseFloat(s.engineer_amount);
        if (engAmount > 0) {
          await sequelize.query(
            'UPDATE engineers SET frozen_balance = GREATEST(0, frozen_balance - :amt) WHERE id = :id',
            { replacements: { amt: engAmount, id: s.recipient_id }, type: sequelize.QueryTypes.UPDATE, transaction: t }
          );
        }
      }
    }

    await OrderLog.create({
      order_id: payment.order_id, operator_id: req.user.id,
      operator_type: 'admin', action: 'refund',
      detail: `退款 ¥${refundAmount}，原因: ${reason || '无'}`
    }, { transaction: t });

    await t.commit();
    res.json(success(payment, '退款已处理'));
  } catch (err) {
    await t.rollback();
    console.error('[Refund]', err);
    res.json(fail('退款失败'));
  }
});

// ===== 管理员确认线下收款 =====
router.post('/confirm-offline/:paymentNo', auth, requireRole('manager', 'admin'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const payment = await Payment.findOne({ where: { payment_no: req.params.paymentNo } });
    if (!payment) { await t.rollback(); return res.json(fail('支付单不存在')); }
    if (payment.method !== 'offline') { await t.rollback(); return res.json(fail('仅线下支付可确认收款')); }
    if (payment.status !== 'pending') { await t.rollback(); return res.json(fail('状态异常')); }

    payment.status = 'success';
    payment.paid_at = new Date();
    payment.wx_transaction_id = 'OFFLINE_' + Date.now();
    await payment.save({ transaction: t });

    // 创建分账（和在线支付一样）
    const order = await markOrderPaid(payment.order_id, t);
    const { commissionRate, commissionAmount, engineerAmount } = await calculateSettlementAmounts(payment, order);
    const settlementTPlus = parseInt(await getSetting('settlement_t_plus', '7'));

    const { generateSettlementNo } = require('../utils/response');

    // 平台佣金
    let sn; let ex = true;
    while (ex) { sn = generateSettlementNo(); ex = await Settlement.findOne({ where: { settlement_no: sn } }); }
    await Settlement.create({
      settlement_no: sn, payment_id: payment.id, order_id: payment.order_id,
      recipient_id: null, recipient_type: 'platform', amount: commissionAmount,
      commission_rate: commissionRate, commission_amount: commissionAmount, engineer_amount: 0,
      status: 'released', settle_at: new Date(), released_at: new Date()
    }, { transaction: t });

    // 工程师结算
    if (order && order.engineer_id) {
      let sn2; let ex2 = true;
      while (ex2) { sn2 = generateSettlementNo(); ex2 = await Settlement.findOne({ where: { settlement_no: sn2 } }); }
      await Settlement.create({
        settlement_no: sn2, payment_id: payment.id, order_id: payment.order_id,
        recipient_id: order.engineer_id, recipient_type: 'engineer', amount: engineerAmount,
        commission_rate: commissionRate, commission_amount: commissionAmount, engineer_amount: engineerAmount,
        status: 'held', settle_at: new Date(Date.now() + settlementTPlus * 86400000)
      }, { transaction: t });

      await sequelize.query(
        'UPDATE engineers SET frozen_balance = frozen_balance + :amt WHERE id = :id',
        { replacements: { amt: engineerAmount, id: order.engineer_id }, type: sequelize.QueryTypes.UPDATE, transaction: t }
      );
    }

    await OrderLog.create({
      order_id: payment.order_id, operator_id: req.user.id,
      operator_type: 'admin', action: 'offline_paid',
      detail: `线下收款确认 ¥${payment.amount}，佣金 ¥${commissionAmount}，工程师冻结 ¥${engineerAmount}`
    }, { transaction: t });

    await t.commit();
    res.json(success({ payment, commission_rate: commissionRate, commission_amount: commissionAmount, engineer_amount: engineerAmount }, '线下收款已确认'));
  } catch (err) {
    await t.rollback();
    console.error('[OfflinePay]', err.message);
    res.json(fail('确认失败'));
  }
});

// ===== 管理端列表 =====
router.get('/list', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { count, rows } = await Payment.findAndCountAll({
      where: req.query.status ? { status: req.query.status } : {},
      order: [['created_at', 'DESC']],
      offset, limit: pageSize
    });
    res.json(success({ list: rows, total: count, page, pageSize }));
  } catch (err) {
    res.json(fail('获取失败'));
  }
});

module.exports = router;
