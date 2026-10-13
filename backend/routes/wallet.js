const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { Engineer, Settlement, Withdrawal } = require('../models');
const { success, fail, parsePagination } = require('../utils/response');

// ===== 钱包仪表盘 =====
router.get('/dashboard', auth, requireRole('engineer'), async (req, res) => {
  try {
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id } });
    if (!engineer) return res.json(fail('工程师不存在'));

    const pendingCount = await Settlement.count({
      where: { recipient_id: engineer.id, recipient_type: 'engineer', status: 'held' }
    });
    const pendingAmount = await Settlement.sum('engineer_amount', {
      where: { recipient_id: engineer.id, recipient_type: 'engineer', status: 'held' }
    }) || 0;

    const releasedTotal = await Settlement.sum('engineer_amount', {
      where: { recipient_id: engineer.id, recipient_type: 'engineer', status: 'released' }
    }) || 0;

    const withdrawnTotal = await Withdrawal.sum('amount', {
      where: { engineer_id: engineer.id, status: 'completed' }
    }) || 0;

    res.json(success({
      balance: parseFloat(engineer.balance),
      frozen_balance: parseFloat(engineer.frozen_balance),
      total_earned: parseFloat(engineer.total_earned),
      pending_settlements: { count: pendingCount, amount: parseFloat(pendingAmount) },
      released_total: parseFloat(releasedTotal),
      withdrawn_total: parseFloat(withdrawnTotal)
    }));
  } catch (err) { res.json(fail('获取失败')); }
});

// ===== 收支明细 =====
router.get('/bills', auth, requireRole('engineer'), async (req, res) => {
  try {
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id } });
    if (!engineer) return res.json(fail('工程师不存在'));
    const { page, pageSize, offset } = parsePagination(req.query);

    // 合并结算记录和提现记录
    const settlements = await Settlement.findAll({
      where: { recipient_id: engineer.id, recipient_type: 'engineer' },
      order: [['created_at', 'DESC']],
      limit: pageSize, offset
    });

    // 简单返回结算记录（提现记录单独查）
    const bills = settlements.map(s => ({
      id: `settle_${s.id}`,
      type: 'settlement',
      description: `工单 #${s.order_id} 结算`,
      amount: parseFloat(s.engineer_amount),
      status: s.status,
      created_at: s.created_at,
      settled_at: s.released_at
    }));

    res.json(success({ list: bills, total: bills.length, page, pageSize }));
  } catch (err) { res.json(fail('获取失败')); }
});

module.exports = router;
