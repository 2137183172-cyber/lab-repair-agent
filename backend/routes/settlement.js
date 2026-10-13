const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { Settlement, Withdrawal, Payment, Engineer, RepairOrder, OrderLog, PlatformSetting } = require('../models');
const { success, fail, parsePagination, generateWithdrawalNo } = require('../utils/response');
const sequelize = require('../config/db');

// ===== 工程师钱包总览 =====
router.get('/wallet', auth, requireRole('engineer'), async (req, res) => {
  try {
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id } });
    if (!engineer) return res.json(fail('工程师不存在'));

    const pendingCount = await Settlement.count({
      where: { recipient_id: engineer.id, recipient_type: 'engineer', status: 'held' }
    });
    const pendingAmount = await Settlement.sum('engineer_amount', {
      where: { recipient_id: engineer.id, recipient_type: 'engineer', status: 'held' }
    }) || 0;

    res.json(success({
      balance: parseFloat(engineer.balance),
      frozen_balance: parseFloat(engineer.frozen_balance),
      total_earned: parseFloat(engineer.total_earned),
      pending_count: pendingCount,
      pending_amount: parseFloat(pendingAmount)
    }));
  } catch (err) { res.json(fail('获取失败')); }
});

// ===== 工程师结算记录 =====
router.get('/list', auth, requireRole('engineer'), async (req, res) => {
  try {
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id } });
    if (!engineer) return res.json(fail('工程师不存在'));
    const { page, pageSize, offset } = parsePagination(req.query);
    const { count, rows } = await Settlement.findAndCountAll({
      where: { recipient_id: engineer.id, recipient_type: 'engineer' },
      order: [['created_at', 'DESC']],
      offset, limit: pageSize
    });
    res.json(success({ list: rows, total: count, page, pageSize }));
  } catch (err) { res.json(fail('获取失败')); }
});

// ===== 管理员手动释放结算 =====
router.post('/release/:id', auth, requireRole('admin'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const settlement = await Settlement.findByPk(req.params.id);
    if (!settlement) return res.json(fail('结算记录不存在'));
    if (settlement.status !== 'held') return res.json(fail('仅冻结状态可释放'));
    if (settlement.recipient_type !== 'engineer') return res.json(fail('仅工程师结算可释放'));

    settlement.status = 'released';
    settlement.released_at = new Date();
    await settlement.save({ transaction: t });

    // 解冻 → 可提现余额
    const amount = parseFloat(settlement.engineer_amount);
    await sequelize.query(
      'UPDATE engineers SET balance = balance + :amount, frozen_balance = frozen_balance - :amount, total_earned = total_earned + :amount WHERE id = :id',
      { replacements: { amount, id: settlement.recipient_id }, type: sequelize.QueryTypes.UPDATE, transaction: t }
    );

    await OrderLog.create({
      order_id: settlement.order_id, operator_id: req.user.id,
      operator_type: 'admin', action: 'settlement_released',
      detail: `管理员手动释放结算 ${settlement.settlement_no}，金额 ¥${amount}`
    }, { transaction: t });

    await t.commit();
    res.json(success(settlement, '已释放到工程师余额'));
  } catch (err) {
    await t.rollback();
    console.error('[SettleRelease]', err.message);
    res.json(fail('释放失败'));
  }
});

// ===== 管理端结算列表 =====
router.get('/admin/list', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.recipient_type) where.recipient_type = req.query.recipient_type;
    const { count, rows } = await Settlement.findAndCountAll({
      where, order: [['created_at', 'DESC']], offset, limit: pageSize
    });
    res.json(success({ list: rows, total: count, page, pageSize }));
  } catch (err) { res.json(fail('获取失败')); }
});

// ===== 提现申请 =====
router.post('/withdraw/apply', auth, requireRole('engineer'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id }, transaction: t });
    if (!engineer) { await t.rollback(); return res.json(fail('工程师不存在')); }

    const { amount, method, account_info } = req.body;
    const withdrawAmount = parseFloat(amount);
    if (!withdrawAmount || withdrawAmount <= 0) { await t.rollback(); return res.json(fail('提现金额无效')); }

    const minAmount = parseFloat(await PlatformSetting.findByPk('withdrawal_min_amount', { transaction: t }).then(s => s?.value || 100));
    if (withdrawAmount < minAmount) { await t.rollback(); return res.json(fail(`最低提现金额 ¥${minAmount}`)); }
    if (withdrawAmount > parseFloat(engineer.balance)) { await t.rollback(); return res.json(fail('余额不足')); }

    let withdrawNo; let ex = true;
    while (ex) { withdrawNo = generateWithdrawalNo(); ex = await Withdrawal.findOne({ where: { withdrawal_no: withdrawNo } }); }

    const withdrawal = await Withdrawal.create({
      withdrawal_no: withdrawNo,
      engineer_id: engineer.id,
      amount: withdrawAmount,
      fee: 0,
      actual_amount: withdrawAmount,
      method: method || 'manual',
      account_info: account_info || { bank_name: engineer.bank_name, bank_account: engineer.bank_account, bank_holder: engineer.bank_holder, alipay_account: engineer.alipay_account },
      status: 'pending'
    }, { transaction: t });

    // 冻结余额
    await sequelize.query(
      'UPDATE engineers SET balance = balance - :amt, frozen_balance = frozen_balance + :amt WHERE id = :id AND balance >= :amt',
      { replacements: { amt: withdrawAmount, id: engineer.id }, type: sequelize.QueryTypes.UPDATE, transaction: t }
    );

    await t.commit();
    res.json(success(withdrawal, '提现申请已提交，等待审批'));
  } catch (err) {
    await t.rollback();
    console.error('[WithdrawApply]', err);
    res.json(fail('申请失败'));
  }
});

// ===== 工程师提现列表 =====
router.get('/withdraw/list', auth, requireRole('engineer'), async (req, res) => {
  try {
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id } });
    if (!engineer) return res.json(fail('工程师不存在'));
    const { page, pageSize, offset } = parsePagination(req.query);
    const { count, rows } = await Withdrawal.findAndCountAll({
      where: { engineer_id: engineer.id },
      order: [['created_at', 'DESC']], offset, limit: pageSize
    });
    res.json(success({ list: rows, total: count, page, pageSize }));
  } catch (err) { res.json(fail('获取失败')); }
});

// ===== 管理端提现列表 =====
router.get('/withdraw/admin/list', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const where = {};
    if (req.query.status) where.status = req.query.status;
    const { count, rows } = await Withdrawal.findAndCountAll({
      where, order: [['created_at', 'ASC']], offset, limit: pageSize
    });
    for (const w of rows) {
      const eng = await Engineer.findByPk(w.engineer_id, { attributes: ['name', 'phone'] });
      w.dataValues.engineer_name = eng?.name || '';
      w.dataValues.engineer_phone = eng?.phone || '';
    }
    res.json(success({ list: rows, total: count, page, pageSize }));
  } catch (err) { res.json(fail('获取失败')); }
});

// ===== 审批通过 =====
router.post('/withdraw/:id/approve', auth, requireRole('admin'), async (req, res) => {
  try {
    const w = await Withdrawal.findByPk(req.params.id);
    if (!w) return res.json(fail('提现记录不存在'));
    if (w.status !== 'pending') return res.json(fail('状态异常，不可审批'));
    w.status = 'approved';
    w.approved_by = req.user.id;
    w.approved_at = new Date();
    w.remark = (w.remark || '') + '\n审批备注: ' + (req.body.remark || '已通过');
    await w.save();
    res.json(success(w, '审批通过'));
  } catch (err) { res.json(fail('操作失败')); }
});

// ===== 驳回 =====
router.post('/withdraw/:id/reject', auth, requireRole('admin'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const w = await Withdrawal.findByPk(req.params.id, { transaction: t });
    if (!w) { await t.rollback(); return res.json(fail('不存在')); }
    if (w.status !== 'pending') { await t.rollback(); return res.json(fail('状态异常')); }

    w.status = 'rejected';
    w.remark = (w.remark || '') + '\n驳回原因: ' + (req.body.remark || '无');
    await w.save({ transaction: t });

    // 退回余额
    const wAmt = parseFloat(w.amount);
    await sequelize.query(
      'UPDATE engineers SET balance = balance + :amt, frozen_balance = frozen_balance - :amt WHERE id = :id',
      { replacements: { amt: wAmt, id: w.engineer_id }, type: sequelize.QueryTypes.UPDATE, transaction: t }
    );

    await t.commit();
    res.json(success(w, '已驳回'));
  } catch (err) {
    await t.rollback();
    res.json(fail('操作失败'));
  }
});

// ===== 标记打款完成 =====
router.post('/withdraw/:id/complete', auth, requireRole('admin'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const w = await Withdrawal.findByPk(req.params.id, { transaction: t });
    if (!w) { await t.rollback(); return res.json(fail('不存在')); }
    if (w.status !== 'approved') { await t.rollback(); return res.json(fail('仅已审批可标记打款')); }

    w.status = 'completed';
    w.completed_at = new Date();
    await w.save({ transaction: t });

    // 扣除冻结余额
    const wAmt2 = parseFloat(w.amount);
    await sequelize.query(
      'UPDATE engineers SET frozen_balance = frozen_balance - :amt WHERE id = :id',
      { replacements: { amt: wAmt2, id: w.engineer_id }, type: sequelize.QueryTypes.UPDATE, transaction: t }
    );

    await t.commit();
    res.json(success(w, '打款完成'));
  } catch (err) {
    await t.rollback();
    res.json(fail('操作失败'));
  }
});

module.exports = router;
