const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { Engineer } = require('../models');
const { success, fail, generatePaymentNo } = require('../utils/response');
const sequelize = require('../config/db');

// 套餐配置
const PLANS = {
  free: { name: '免费版', daily_views: 3, price_monthly: 0, price_yearly: 0 },
  vip:  { name: 'VIP版',  daily_views: 20, price_monthly: 50, price_yearly: 450 },
  svip: { name: 'SVIP版', daily_views: 999, price_monthly: 100, price_yearly: 900 }
};

// 获取套餐列表
router.get('/plans', auth, async (req, res) => {
  try {
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id } });
    const currentPlan = engineer ? engineer.subscription_plan : 'free';
    const expiresAt = engineer ? engineer.subscription_expires_at : null;
    res.json(success({
      plans: Object.entries(PLANS).map(([key, p]) => ({ key, ...p, is_current: key === currentPlan })),
      current_plan: currentPlan,
      expires_at: expiresAt
    }));
  } catch (err) { res.json(fail('获取失败')); }
});

// 获取订阅状态
router.get('/status', auth, async (req, res) => {
  try {
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id } });
    if (!engineer) return res.json(fail('工程师不存在'));
    const plan = PLANS[engineer.subscription_plan] || PLANS.free;
    const today = new Date().toISOString().split('T')[0];
    const viewDate = engineer.daily_view_date;
    const viewCount = (viewDate === today) ? engineer.daily_view_count : 0;
    res.json(success({
      plan: engineer.subscription_plan,
      plan_name: plan.name,
      daily_views: plan.daily_views,
      used_today: viewCount,
      remaining: Math.max(0, plan.daily_views - viewCount),
      expires_at: engineer.subscription_expires_at,
      is_expired: engineer.subscription_expires_at && new Date(engineer.subscription_expires_at) < new Date()
    }));
  } catch (err) { res.json(fail('获取失败')); }
});

// 购买/续费订阅
router.post('/subscribe', auth, requireRole('engineer'), async (req, res) => {
  try {
    const { plan, period } = req.body; // plan: vip/svip, period: monthly/yearly
    const planConfig = PLANS[plan];
    if (!planConfig || plan === 'free') return res.json(fail('无效套餐'));
    const amount = period === 'yearly' ? planConfig.price_yearly : planConfig.price_monthly;
    if (!amount) return res.json(fail('无效周期'));

    const engineer = await Engineer.findOne({ where: { user_id: req.user.id } });
    if (!engineer) return res.json(fail('工程师不存在'));

    // Mock支付：直接激活
    const now = new Date();
    const days = period === 'yearly' ? 365 : 30;
    const expiresAt = new Date(now.getTime() + days * 86400000);

    engineer.subscription_plan = plan;
    engineer.subscription_expires_at = expiresAt;
    await engineer.save();

    // 记录订阅历史
    const paymentNo = generatePaymentNo();
    await sequelize.query(
      'INSERT INTO subscriptions (engineer_id, plan, period, amount, status, started_at, expires_at, payment_no) VALUES (?,?,?,?,?,?,?,?)',
      { replacements: [engineer.id, plan, period, amount, 'active', now, expiresAt, paymentNo], type: sequelize.QueryTypes.INSERT }
    );

    res.json(success({
      plan, plan_name: planConfig.name, period,
      amount, expires_at: expiresAt,
      payment_no: paymentNo,
      daily_views: planConfig.daily_views
    }, `订阅成功！${planConfig.name} · ${period === 'yearly' ? '年付' : '月付'} ¥${amount}`));
  } catch (err) {
    console.error('[Subscribe]', err.message);
    res.json(fail('订阅失败'));
  }
});

// 获取订阅历史
router.get('/history', auth, requireRole('engineer'), async (req, res) => {
  try {
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id } });
    if (!engineer) return res.json(fail('工程师不存在'));
    const rows = await sequelize.query(
      'SELECT * FROM subscriptions WHERE engineer_id = ? ORDER BY created_at DESC',
      { replacements: [engineer.id], type: sequelize.QueryTypes.SELECT }
    );
    res.json(success(rows));
  } catch (err) { res.json(fail('获取失败')); }
});

module.exports = router;
