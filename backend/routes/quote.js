const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { Quotation, RepairOrder, Engineer, User, OrderLog, Payment } = require('../models');
const { success, fail, parsePagination, generateQuotationNo, generatePaymentNo } = require('../utils/response');
const sequelize = require('../config/db');

// ==============  工程师创建/提交报价 ==============

/**
 * POST /api/quote/create
 * 工程师为工单创建报价单（草稿或直接提交）
 * Body: { order_id, diagnosis_summary, diagnosis_images, items, notes, valid_until, submit }
 */
router.post('/create', auth, requireRole('engineer', 'manager', 'admin'), async (req, res) => {
  try {
    const { order_id, diagnosis_summary, diagnosis_images, items, notes, valid_until, submit } = req.body;

    if (!order_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.json(fail('请填写报价明细'));
    }

    const order = await RepairOrder.findByPk(order_id);
    if (!order) return res.json(fail('工单不存在'));

    // 只有 assigned engineer / admin / manager 可以报价
    const isManager = ['manager', 'admin'].includes(req.user.role);
    if (!isManager) {
      const eng = await Engineer.findOne({ where: { user_id: req.user.id } });
      if (!eng || eng.id !== order.engineer_id) {
        return res.json(fail('无权为该工单创建报价'));
      }
    }

    // 计算费用
    let labor_cost = 0, parts_cost = 0;
    items.forEach(item => {
      const sub = parseFloat(item.subtotal) || parseFloat(item.qty) * parseFloat(item.unit_price) || 0;
      item.subtotal = sub;
      if (item.type === 'labor') labor_cost += sub;
      else if (item.type === 'parts') parts_cost += sub;
      else {
        // 'other' 类型归入配件费
        parts_cost += sub;
      }
    });
    const total_cost = labor_cost + parts_cost;

    // 生成报价单号
    let quotationNo;
    let exists = true;
    while (exists) {
      quotationNo = generateQuotationNo();
      exists = await Quotation.findOne({ where: { quotation_no: quotationNo } });
    }

    const isSubmit = submit === true || submit === 'true' || submit === 1;
    const now = isSubmit ? new Date() : null;

    const quotation = await Quotation.create({
      order_id,
      quotation_no: quotationNo,
      diagnosis_summary: diagnosis_summary || '',
      diagnosis_images: diagnosis_images || [],
      items,
      labor_cost,
      parts_cost,
      total_cost,
      status: isSubmit ? 'submitted' : 'draft',
      submitted_at: now,
      notes: notes || '',
      valid_until: valid_until || null,
      created_by: req.user.id,
      revision: 1
    });

    // 如果直接提交，更新工单状态为 quoted
    if (isSubmit) {
      order.status = 'quoted';
      await order.save();

      await OrderLog.create({
        order_id: order.id,
        operator_id: req.user.id,
        operator_type: 'engineer',
        action: 'quoted',
        detail: `提交报价单 ${quotationNo}，总金额 ¥${total_cost}`
      });
    } else {
      await OrderLog.create({
        order_id: order.id,
        operator_id: req.user.id,
        operator_type: 'engineer',
        action: 'quote_draft',
        detail: `创建报价草稿 ${quotationNo}`
      });
    }

    res.json(success(quotation, isSubmit ? '报价已提交，等待客户审批' : '报价草稿已保存'));
  } catch (err) {
    console.error('[QuoteCreate]', err);
    res.json(fail('创建报价失败'));
  }
});

/**
 * PUT /api/quote/submit/:id
 * 将草稿报价提交审批
 */
router.put('/submit/:id', auth, requireRole('engineer', 'manager', 'admin'), async (req, res) => {
  try {
    const quotation = await Quotation.findByPk(req.params.id);
    if (!quotation) return res.json(fail('报价单不存在'));
    if (quotation.status !== 'draft') return res.json(fail('仅草稿状态可提交'));

    quotation.status = 'submitted';
    quotation.submitted_at = new Date();
    await quotation.save();

    // 更新工单状态
    const order = await RepairOrder.findByPk(quotation.order_id);
    if (order) {
      order.status = 'quoted';
      await order.save();
    }

    await OrderLog.create({
      order_id: quotation.order_id,
      operator_id: req.user.id,
      operator_type: 'engineer',
      action: 'quoted',
      detail: `提交报价单 ${quotation.quotation_no}，总金额 ¥${quotation.total_cost}`
    });

    res.json(success(quotation, '报价已提交'));
  } catch (err) {
    console.error('[QuoteSubmit]', err);
    res.json(fail('提交失败'));
  }
});

// ==============  客户/管理员审批报价 ==============

/**
 * POST /api/quote/:id/approve
 * 审批通过报价单
 * Body: { notes } (可选的审批备注)
 */
router.post('/:id/approve', auth, async (req, res) => {
  try {
    const quotation = await Quotation.findByPk(req.params.id, {
      include: [{ model: RepairOrder, as: 'order' }]
    });
    if (!quotation) return res.json(fail('报价单不存在'));
    if (quotation.status !== 'submitted') return res.json(fail('当前状态不可审批'));

    const order = quotation.order;
    if (!order) return res.json(fail('关联工单不存在'));

    // 权限：报修用户本人 或 管理员/经理
    const isReporter = order.user_id === req.user.id;
    const isManager = ['manager', 'admin'].includes(req.user.role);
    if (!isReporter && !isManager) return res.json(fail('无权审批'));

    const transaction = await sequelize.transaction();

    try {
      // 更新报价单
      quotation.status = 'approved';
      quotation.approved_at = new Date();
      quotation.approved_by = req.user.id;
      quotation.notes = req.body.notes ? `${quotation.notes || ''}\n【审批备注】${req.body.notes}` : quotation.notes;
      await quotation.save({ transaction });

      // 报价审批通过后进入待支付，支付成功后再进入 paid。
      order.status = 'quoted';
      await order.save({ transaction });

      // 自动创建支付记录
      let paymentNo; let pExists = true;
      while (pExists) { paymentNo = generatePaymentNo(); pExists = await Payment.findOne({ where: { payment_no: paymentNo } }); }

      const payMethod = ['mock', 'offline'].includes(req.body.method)
        ? req.body.method
        : (order.is_public ? 'mock' : 'offline');
      const payment = await Payment.create({
        payment_no: paymentNo,
        order_id: order.id,
        quotation_id: quotation.id,
        user_id: order.user_id,
        amount: parseFloat(quotation.total_cost),
        method: payMethod,
        status: payMethod === 'mock' ? 'pending' : 'pending'
      }, { transaction });

      await OrderLog.create({
        order_id: order.id,
        operator_id: req.user.id,
        operator_type: isManager ? 'manager' : 'user',
        action: 'quote_approved',
        detail: `报价审批通过 ${quotation.quotation_no}，总金额 ¥${quotation.total_cost}，支付方式: ${payMethod === 'offline' ? '线下' : '在线'}，支付单: ${paymentNo}`
      }, { transaction });

      await transaction.commit();
      res.json(success({
        quotation,
        payment,
        message: payMethod === 'offline' ? '报价已通过（线下支付），待管理员确认收款' : '报价已通过，请完成支付'
      }, payMethod === 'offline' ? '报价已通过，线下支付待确认' : '报价已通过，请完成支付'));
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  } catch (err) {
    console.error('[QuoteApprove]', err);
    res.json(fail('审批失败'));
  }
});

/**
 * POST /api/quote/:id/reject
 * 驳回报价单
 * Body: { reject_reason }
 */
router.post('/:id/reject', auth, async (req, res) => {
  try {
    const { reject_reason } = req.body;
    if (!reject_reason || !reject_reason.trim()) {
      return res.json(fail('请填写驳回原因'));
    }

    const quotation = await Quotation.findByPk(req.params.id, {
      include: [{ model: RepairOrder, as: 'order' }]
    });
    if (!quotation) return res.json(fail('报价单不存在'));
    if (quotation.status !== 'submitted') return res.json(fail('当前状态不可审批'));

    const order = quotation.order;
    if (!order) return res.json(fail('关联工单不存在'));

    const isReporter = order.user_id === req.user.id;
    const isManager = ['manager', 'admin'].includes(req.user.role);
    if (!isReporter && !isManager) return res.json(fail('无权审批'));

    quotation.status = 'rejected';
    quotation.rejected_at = new Date();
    quotation.reject_reason = reject_reason;
    await quotation.save();

    // 工单退回诊断状态，允许重新报价
    order.status = 'diagnosing';
    await order.save();

    await OrderLog.create({
      order_id: order.id,
      operator_id: req.user.id,
      operator_type: isManager ? 'manager' : 'user',
      action: 'quote_rejected',
      detail: `驳回报价 ${quotation.quotation_no}，原因: ${reject_reason}`
    });

    res.json(success(quotation, '已驳回报价'));
  } catch (err) {
    console.error('[QuoteReject]', err);
    res.json(fail('驳回失败'));
  }
});

// ==============  查询报价 ==============

/**
 * GET /api/quote/detail/:id
 * 报价单详情
 */
router.get('/detail/:id', auth, async (req, res) => {
  try {
    const quotation = await Quotation.findByPk(req.params.id, {
      include: [
        {
          model: RepairOrder, as: 'order',
          attributes: ['id', 'order_no', 'status', 'fault_desc', 'user_id', 'engineer_id']
        },
        { model: User, as: 'creator', attributes: ['id', 'name'] },
        { model: User, as: 'approver', attributes: ['id', 'name'] }
      ]
    });
    if (!quotation) return res.json(fail('报价单不存在'));

    res.json(success(quotation));
  } catch (err) {
    console.error('[QuoteDetail]', err);
    res.json(fail('获取失败'));
  }
});

/**
 * GET /api/quote/order/:orderId
 * 获取工单的所有报价单
 */
router.get('/order/:orderId', auth, async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { count, rows } = await Quotation.findAndCountAll({
      where: { order_id: req.params.orderId },
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name'] },
        { model: User, as: 'approver', attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'DESC']],
      offset,
      limit: pageSize
    });

    // 获取最新一份有效报价（用于前端展示）
    const latest = rows.length > 0 ? rows[0] : null;

    res.json(success({ list: rows, total: count, latest, page, pageSize }));
  } catch (err) {
    console.error('[QuoteList]', err);
    res.json(fail('获取报价列表失败'));
  }
});

/**
 * PUT /api/quote/update/:id
 * 更新报价草稿
 */
router.put('/update/:id', auth, requireRole('engineer', 'manager', 'admin'), async (req, res) => {
  try {
    const quotation = await Quotation.findByPk(req.params.id);
    if (!quotation) return res.json(fail('报价单不存在'));
    if (quotation.status !== 'draft') return res.json(fail('仅草稿可编辑'));

    const { diagnosis_summary, diagnosis_images, items, notes, valid_until } = req.body;

    if (items && Array.isArray(items)) {
      let labor_cost = 0, parts_cost = 0;
      items.forEach(item => {
        const sub = parseFloat(item.subtotal) || parseFloat(item.qty) * parseFloat(item.unit_price) || 0;
        item.subtotal = sub;
        if (item.type === 'labor') labor_cost += sub;
        else if (item.type === 'parts') parts_cost += sub;
        else parts_cost += sub;
      });
      quotation.items = items;
      quotation.labor_cost = labor_cost;
      quotation.parts_cost = parts_cost;
      quotation.total_cost = labor_cost + parts_cost;
    }

    if (diagnosis_summary !== undefined) quotation.diagnosis_summary = diagnosis_summary;
    if (diagnosis_images !== undefined) quotation.diagnosis_images = diagnosis_images;
    if (notes !== undefined) quotation.notes = notes;
    if (valid_until !== undefined) quotation.valid_until = valid_until;

    await quotation.save();
    res.json(success(quotation, '草稿已更新'));
  } catch (err) {
    console.error('[QuoteUpdate]', err);
    res.json(fail('更新失败'));
  }
});

module.exports = router;
