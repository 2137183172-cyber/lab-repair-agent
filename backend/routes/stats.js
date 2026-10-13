const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { RepairOrder, RepairRecord, Device, Engineer, User, OrderComment } = require('../models');
const { success, fail } = require('../utils/response');
const { Op } = require('sequelize');
const sequelize = require('../config/db');

/**
 * GET /api/stats/dashboard
 * 管理后台仪表盘数据
 */
router.get('/dashboard', auth, requireRole('admin', 'manager', 'quality', 'engineer_lead'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalOrders, pendingOrders, todayOrders,
      completedOrders, totalDevices, totalEngineers,
      totalUsers
    ] = await Promise.all([
      RepairOrder.count(),
      RepairOrder.count({ where: { status: ['pending', 'accepted', 'diagnosing', 'quoted', 'paid', 'repairing'] } }),
      RepairOrder.count({ where: { created_at: { [Op.gte]: today } } }),
      RepairOrder.count({ where: { status: ['completed', 'confirmed'] } }),
      Device.count(),
      Engineer.count(),
      User.count({ where: { role: 'user' } })
    ]);

    res.json(success({
      total_orders: totalOrders,
      pending_orders: pendingOrders,
      today_orders: todayOrders,
      completed_orders: completedOrders,
      total_devices: totalDevices,
      total_engineers: totalEngineers,
      total_users: totalUsers
    }));
  } catch (err) {
    res.json(fail('获取失败'));
  }
});

/**
 * GET /api/stats/order-trend
 * 工单趋势（最近30天）
 */
router.get('/order-trend', auth, requireRole('admin', 'manager', 'quality', 'engineer_lead'), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const result = await RepairOrder.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        created_at: { [Op.gte]: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
      },
      group: [sequelize.fn('DATE', sequelize.col('created_at'))],
      order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
      raw: true
    });

    // 按状态分组统计
    const statusResult = await RepairOrder.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', 'id'), 'count']
      ],
      where: {
        created_at: { [Op.gte]: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
      },
      group: ['status'],
      raw: true
    });

    res.json(success({
      daily_trend: result,
      status_distribution: statusResult
    }));
  } catch (err) {
    console.error('[Trend]', err);
    res.json(fail('获取失败'));
  }
});

/**
 * GET /api/stats/engineer-ranking
 * 工程师排行榜（按完成数+评分）
 */
router.get('/engineer-ranking', auth, requireRole('admin', 'manager', 'quality', 'engineer_lead'), async (req, res) => {
  try {
    const engineers = await Engineer.findAll({
      attributes: ['id', 'name', 'avatar', 'rating', 'total_orders', 'completed_orders', 'type'],
      where: { total_orders: { [Op.gt]: 0 } },
      order: [['completed_orders', 'DESC'], ['rating', 'DESC']],
      limit: 20,
      raw: true
    });

    res.json(success(engineers));
  } catch (err) {
    res.json(fail('获取失败'));
  }
});

/**
 * GET /api/stats/fault-analysis
 * 故障类型分析（基于分类统计）
 */
router.get('/fault-analysis', auth, requireRole('admin', 'manager', 'quality', 'engineer_lead'), async (req, res) => {
  try {
    const result = await RepairOrder.findAll({
      attributes: [
        [sequelize.col('device.category.name'), 'category_name'],
        [sequelize.fn('COUNT', sequelize.col('RepairOrder.id')), 'count']
      ],
      include: [
        {
          model: Device, as: 'device',
          attributes: [],
          include: [{ model: require('../models/DeviceCategory'), as: 'category', attributes: [] }]
        }
      ],
      where: { device_id: { [Op.ne]: null } },
      group: [sequelize.col('device.category.name')],
      order: [[sequelize.fn('COUNT', sequelize.col('RepairOrder.id')), 'DESC']],
      limit: 15,
      raw: true
    });

    res.json(success(result));
  } catch (err) {
    console.error('[FaultAnalysis]', err);
    res.json(fail('获取失败'));
  }
});

/**
 * GET /api/stats/revenue-trend
 * 月度收入趋势
 */
router.get('/revenue-trend', auth, requireRole('admin', 'manager', 'quality', 'engineer_lead'), async (req, res) => {
  try {
    const { months = 12 } = req.query;
    const { RepairRecord, RepairOrder } = require('../models');
    const records = await RepairRecord.findAll({
      include: [{ model: RepairOrder, as: 'order', attributes: ['finished_at', 'status'] }],
      raw: false
    });

    // Aggregate by month
    const monthly = {};
    const now = new Date();
    for (let i = parseInt(months) - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthly[key] = { month: key, revenue: 0, orders: 0, parts_cost: 0, labor_cost: 0 };
    }

    records.forEach(r => {
      if (r.order?.finished_at) {
        const d = new Date(r.order.finished_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (monthly[key]) {
          monthly[key].revenue += Number(r.total_cost) || 0;
          monthly[key].orders += 1;
          monthly[key].parts_cost += Number(r.parts_cost) || 0;
          monthly[key].labor_cost += Number(r.labor_cost) || 0;
        }
      }
    });

    res.json(success(Object.values(monthly)));
  } catch (err) {
    console.error('[RevenueTrend]', err);
    res.json(fail('获取失败'));
  }
});

/**
 * GET /api/stats/area-stats
 * 区域服务量分析（按工程师服务区域+工单地址）
 */
router.get('/area-stats', auth, requireRole('admin', 'manager', 'quality', 'engineer_lead'), async (req, res) => {
  try {
    const { RepairOrder, Engineer } = require('../models');
    const { Op } = require('sequelize');

    // By engineer service area
    const engineers = await Engineer.findAll({
      attributes: ['service_area', 'total_orders', 'completed_orders']
    });
    const areaMap = {};
    engineers.forEach(e => {
      const areas = typeof e.service_area === 'string' ? JSON.parse(e.service_area || '[]') : (e.service_area || []);
      areas.forEach(a => {
        if (!areaMap[a]) areaMap[a] = { name: a, engineers: 0, orders: 0, completed: 0 };
        areaMap[a].engineers++;
        areaMap[a].orders += e.total_orders || 0;
        areaMap[a].completed += e.completed_orders || 0;
      });
    });

    res.json(success(Object.values(areaMap).sort((a, b) => b.orders - a.orders)));
  } catch (err) {
    console.error('[AreaStats]', err);
    res.json(fail('获取失败'));
  }
});

module.exports = router;
