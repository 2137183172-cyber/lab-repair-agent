const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { RepairOrder, Engineer, Quotation, EngineerBid, User, Device, DeviceCategory, OrderLog, OrderComment } = require('../models');
const { success, fail, parsePagination, generateQuotationNo } = require('../utils/response');
const { Op } = require('sequelize');
const sequelize = require('../config/db');

// ==============  工程师端：需求广场 ==============

/**
 * GET /api/marketplace/public-orders
 * 工程师浏览需求广场（公开招标工单，按智能匹配排序）
 * Query: ?skill=&region=&page=&pageSize=
 */
router.get('/public-orders', auth, async (req, res) => {
  try {
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id } });
    const isEngineer = !!engineer;

    const { page, pageSize, offset } = parsePagination(req.query);

    // 基础过滤：公开招标中
    const where = {
      is_public: true,
      status: { [Op.in]: ['pending', 'quoted'] },
      engineer_id: null
    };

    if (req.query.keyword) {
      where[Op.or] = [
        { fault_desc: { [Op.like]: `%${req.query.keyword}%` } },
        { order_no: { [Op.like]: `%${req.query.keyword}%` } }
      ];
    }
    // "我的发布" 筛选
    if (req.query.my_only === '1' || req.query.my_only === 'true') {
      where.user_id = req.user.id;
    }

    const { count, rows } = await RepairOrder.findAndCountAll({
      where,
      include: [
        { model: Device, as: 'device', attributes: ['id', 'name', 'model', 'brand', 'lab_name'] },
        { model: User, as: 'reporter', attributes: ['id', 'name', 'company'] },
        {
          model: EngineerBid, as: 'bids',
          attributes: ['id', 'engineer_id'],
          include: [{ model: Engineer, as: 'engineer', attributes: ['id', 'name', 'rating'] }]
        }
      ],
      order: [['priority', 'DESC'], ['created_at', 'DESC']],
      offset,
      limit: pageSize
    });

    // 工程师：计算匹配度 + 订阅；普通用户：直接展示
    const engSkills = isEngineer ? (engineer.skills || []).map(s => s.toLowerCase()) : [];
    const engRegions = isEngineer ? (engineer.service_area || []).map(r => r.toLowerCase()) : [];

    const scoredOrders = rows.map(order => {
      if (!isEngineer) {
        return { ...order.toJSON(), match_score: 0, skill_match: 0, area_match: 0, bid_count: order.bids?.length || 0, has_bid: false, is_mine: order.user_id === req.user.id };
      }
      let skillMatch = 0, areaMatch = 0;
      const deviceKeywords = [order.device?.name||'', order.device?.model||'', order.device?.brand||'', order.fault_desc||''].join(' ').toLowerCase();
      engSkills.forEach(s => { if (deviceKeywords.includes(s)) skillMatch++; });
      skillMatch = Math.min(skillMatch / Math.max(1, engSkills.length), 1);
      const reporterCompany = (order.reporter?.company || '').toLowerCase();
      engRegions.forEach(r => { if (reporterCompany.includes(r)) areaMatch++; });
      areaMatch = Math.min(areaMatch, 1);
      const matchScore = skillMatch * 0.5 + areaMatch * 0.3 + (order.priority === 'critical' ? 0.2 : order.priority === 'urgent' ? 0.1 : 0);
      return { ...order.toJSON(), match_score: Math.round(matchScore*100), skill_match: Math.round(skillMatch*100), area_match: Math.round(areaMatch*100), bid_count: order.bids?.length||0, has_bid: order.bids?.some(b => b.engineer_id === engineer.id)||false, is_mine: order.user_id === req.user.id };
    });

    if (isEngineer) {
      scoredOrders.sort((a, b) => b.match_score - a.match_score);
      const today = new Date().toISOString().split('T')[0];
      if (engineer.daily_view_date !== today) { engineer.daily_view_count = 0; engineer.daily_view_date = today; }
      engineer.daily_view_count = (engineer.daily_view_count || 0) + 1;
      await engineer.save();
    }

    const PLANS = { free: { name: '免费版', daily_views: 3 }, vip: { name: 'VIP版', daily_views: 20 }, svip: { name: 'SVIP版', daily_views: 999 } };
    const plan = isEngineer ? (PLANS[engineer.subscription_plan] || PLANS.free) : null;

    res.json(success({
      list: scoredOrders, total: count,
      matched_count: isEngineer ? scoredOrders.filter(o=>o.match_score>0).length : count,
      subscription: isEngineer ? {
        plan: engineer.subscription_plan, plan_name: plan?.name||'免费版',
        daily_views: plan?.daily_views||0, used_today: engineer.daily_view_count,
        remaining: Math.max(0, (plan?.daily_views||0) - engineer.daily_view_count),
        expires_at: engineer.subscription_expires_at
      } : { plan:'guest', plan_name:'游客浏览', daily_views:999, used_today:0, remaining:999, expires_at:null },
      page, pageSize
    }));
  } catch (err) {
    console.error('[PublicOrders]', err);
    res.json(fail('获取需求广场失败'));
  }
});

// ==============  用户端：工程师大厅 ==============

/**
 * GET /api/marketplace/engineers
 * 用户浏览工程师大厅
 * Query: ?sort=recommend|rating|orders|reviews|response &skill=&region=&type=&favorites=1
 */
router.get('/engineers', auth, async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const sortBy = req.query.sort || 'rating';
    const andConditions = [{ status: { [Op.in]: ['online', 'busy'] } }];

    // 使用 sequelize.where + fn 生成 JSON_CONTAINS（比 literal 更安全可靠）
    if (req.query.skill) {
      andConditions.push(
        sequelize.where(sequelize.fn('JSON_CONTAINS', sequelize.col('skills'), JSON.stringify(req.query.skill)), 1)
      );
    }
    if (req.query.region) {
      andConditions.push(
        sequelize.where(sequelize.fn('JSON_CONTAINS', sequelize.col('service_area'), JSON.stringify(req.query.region)), 1)
      );
    }
    if (req.query.type) andConditions.push({ type: req.query.type });
    const where = { [Op.and]: andConditions };

    // 收藏筛选
    if (req.query.favorites === '1' || req.query.favorites === 'true') {
      const favIds = await sequelize.query(
        'SELECT engineer_id FROM favorites WHERE user_id = ?',
        { replacements: [req.user.id], type: sequelize.QueryTypes.SELECT }
      );
      const ids = (favIds || []).map(f => f.engineer_id);
      if (ids.length === 0) return res.json(success({ list: [], total: 0, page, pageSize }));
      where.id = { [Op.in]: ids };
    }

    // 排序映射
    const orderMap = {
      rating: [['rating', 'DESC'], ['completed_orders', 'DESC']],
      orders: [['completed_orders', 'DESC'], ['rating', 'DESC']],
      reviews: [['review_count', 'DESC'], ['rating', 'DESC']],
      response: [['rating_response', 'DESC'], ['rating', 'DESC']]
    };

    let allEngineers;
    if (sortBy === 'recommend') {
      // 推荐模式：加载全部在线工程师，智能匹配
      allEngineers = await Engineer.findAll({
        where,
        attributes: ['id', 'name', 'type', 'skills', 'service_area', 'rating', 'rating_response', 'rating_skill', 'rating_attitude', 'rating_price', 'review_count', 'good_rate', 'total_orders', 'completed_orders', 'avatar', 'status']
      });

      // 获取用户设备关键词
      const userDevices = await sequelize.query(
        'SELECT d.name, d.model, d.brand, dc.name as cat_name FROM devices d LEFT JOIN device_categories dc ON d.category_id = dc.id WHERE d.user_id = ? LIMIT 20',
        { replacements: [req.user.id], type: sequelize.QueryTypes.SELECT }
      );
      const deviceKeywords = new Set();
      (userDevices || []).forEach(d => {
        [d.name, d.model, d.brand, d.cat_name].filter(Boolean).forEach(t => {
          String(t).toLowerCase().split(/[\s\-/]+/).forEach(w => { if (w.length > 1) deviceKeywords.add(w); });
        });
      });

      // 计算推荐分
      const scored = allEngineers.map(e => {
        const skills = (e.skills || []).map(s => String(s).toLowerCase());
        const matchedSkills = skills.filter(s => deviceKeywords.has(s) || [...deviceKeywords].some(dk => s.includes(dk) || dk.includes(s)));
        const skillMatch = skills.length > 0 ? Math.min(matchedSkills.length / Math.max(1, skills.length), 1) : 0;
        const score = skillMatch * 0.4 + (parseFloat(e.rating) / 5) * 0.3 + (parseFloat(e.good_rate || 100) / 100) * 0.15 + (parseFloat(e.rating_response || 5) / 5) * 0.15;
        return { ...e.toJSON(), match_score: Math.round(score * 100), skill_match: Math.round(skillMatch * 100), match_devices: matchedSkills.length };
      });
      scored.sort((a, b) => b.match_score - a.match_score);
      allEngineers = scored;
    } else {
      allEngineers = await Engineer.findAll({
        where,
        attributes: ['id', 'name', 'type', 'skills', 'service_area', 'rating', 'rating_response', 'rating_skill', 'rating_attitude', 'rating_price', 'review_count', 'good_rate', 'total_orders', 'completed_orders', 'avatar', 'status'],
        order: orderMap[sortBy] || orderMap.rating
      });
    }

    // 获取收藏状态
    const favRows = await sequelize.query(
      'SELECT engineer_id FROM favorites WHERE user_id = ?',
      { replacements: [req.user.id], type: sequelize.QueryTypes.SELECT }
    );
    const favSet = new Set(favRows.map(f => f.engineer_id));

    // 分页
    const total = allEngineers.length;
    const paged = allEngineers.slice(offset, offset + pageSize);
    const list = paged.map(e => {
      const obj = e.toJSON ? e.toJSON() : e;
      return {
        ...obj,
        is_favorited: favSet.has(obj.id),
        completion_rate: (obj.total_orders > 0 ? Math.round((obj.completed_orders || 0) / obj.total_orders * 100) : 0)
      };
    });

    res.json(success({ list, total, page, pageSize }));
  } catch (err) {
    console.error('[Engineers]', err);
    res.json(fail('获取工程师列表失败'));
  }
});

// ==============  竞标 ==============

/**
 * POST /api/marketplace/bid/:orderId
 * 工程师对公开工单竞标（创建报价单+竞标记录，事务）
 * Body: { diagnosis_summary, diagnosis_images, items, notes, valid_until }
 */
router.post('/bid/:orderId', auth, requireRole('engineer'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const engineer = await Engineer.findOne({ where: { user_id: req.user.id } });
    if (!engineer) return res.json(fail('工程师信息不存在'));

    const order = await RepairOrder.findByPk(req.params.orderId);
    if (!order) return res.json(fail('工单不存在'));
    if (!order.is_public) return res.json(fail('该工单非公开招标'));
    if (order.status === 'cancelled' || order.status === 'confirmed') return res.json(fail('该工单已结束'));
    if (order.engineer_id) return res.json(fail('该工单已被承接'));

    // 检查是否已竞标
    const existingBid = await EngineerBid.findOne({
      where: { order_id: order.id, engineer_id: engineer.id }
    });
    if (existingBid) return res.json(fail('您已对该工单提交过报价'));

    const { diagnosis_summary, diagnosis_images, items, notes, valid_until } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.json(fail('请填写报价明细'));
    }

    // 计算费用
    let labor_cost = 0, parts_cost = 0;
    items.forEach(item => {
      const sub = parseFloat(item.subtotal) || parseFloat(item.qty) * parseFloat(item.unit_price) || 0;
      item.subtotal = sub;
      if (item.type === 'labor') labor_cost += sub;
      else parts_cost += sub;
    });

    // 生成报价单号
    let quotationNo;
    let exists = true;
    while (exists) {
      quotationNo = generateQuotationNo();
      exists = await Quotation.findOne({ where: { quotation_no: quotationNo } });
    }

    // 创建报价单
    const quotation = await Quotation.create({
      order_id: order.id,
      quotation_no: quotationNo,
      diagnosis_summary: diagnosis_summary || '',
      diagnosis_images: diagnosis_images || [],
      items,
      labor_cost,
      parts_cost,
      total_cost: labor_cost + parts_cost,
      status: 'submitted',
      submitted_at: new Date(),
      notes: notes || '',
      valid_until: valid_until || null,
      created_by: req.user.id,
      revision: 1
    }, { transaction: t });

    // 创建竞标记录
    const bid = await EngineerBid.create({
      order_id: order.id,
      engineer_id: engineer.id,
      quotation_id: quotation.id,
      status: 'bidding',
      submitted_at: new Date()
    }, { transaction: t });

    // 更新工单状态为 quoted（表示已有报价等待审批）
    // 注意：不改为accepted，因为可能有多个工程师竞标
    if (order.status === 'pending') {
      order.status = 'quoted';
      await order.save({ transaction: t });
    }

    await OrderLog.create({
      order_id: order.id,
      operator_id: req.user.id,
      operator_type: 'engineer',
      action: 'bid',
      detail: `工程师 ${engineer.name} 竞标报价 ¥${(labor_cost + parts_cost).toFixed(2)}`
    }, { transaction: t });

    await t.commit();
    res.json(success({ quotation, bid }, '竞标报价已提交'));
  } catch (err) {
    await t.rollback();
    console.error('[Bid]', err);
    res.json(fail('竞标失败'));
  }
});

// ==============  查看竞标 ==============

/**
 * GET /api/marketplace/bids/:orderId
 * 用户查看工单的所有竞标（用于对比选标）
 */
router.get('/bids/:orderId', auth, async (req, res) => {
  try {
    const order = await RepairOrder.findByPk(req.params.orderId);
    if (!order) return res.json(fail('工单不存在'));

    // 权限：报修人本人 / 参与竞标的工程师 / 管理员
    const isOwner = order.user_id === req.user.id;
    const isManager = ['manager', 'admin'].includes(req.user.role);
    if (!isOwner && !isManager) {
      // Check if this engineer participated in bidding
      const engProfile = await Engineer.findOne({ where: { user_id: req.user.id } });
      const isParticipant = engProfile && await EngineerBid.findOne({ where: { order_id: order.id, engineer_id: engProfile.id } });
      if (!isParticipant) return res.json(fail('无权查看'));
    }

    const bids = await EngineerBid.findAll({
      where: { order_id: order.id },
      include: [
        {
          model: Quotation, as: 'quotation',
          attributes: ['id', 'quotation_no', 'total_cost', 'labor_cost', 'parts_cost', 'items', 'diagnosis_summary', 'notes', 'valid_until', 'submitted_at', 'status']
        },
        {
          model: Engineer, as: 'engineer',
          attributes: ['id', 'name', 'type', 'skills', 'rating', 'total_orders', 'completed_orders', 'avatar']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // 计算匹配度辅助信息
    const result = bids.map(bid => ({
      bid_id: bid.id,
      quotation: bid.quotation,
      engineer: bid.engineer,
      status: bid.status,
      submitted_at: bid.submitted_at,
      completion_rate: bid.engineer ? Math.round((bid.engineer.completed_orders || 0) / Math.max(1, bid.engineer.total_orders || 1) * 100) : 0,
      is_selected: order.selected_quotation_id === bid.quotation_id
    }));

    res.json(success({
      order_id: order.id,
      order_no: order.order_no,
      selected_quotation_id: order.selected_quotation_id,
      list: result,
      total: result.length
    }));
  } catch (err) {
    console.error('[Bids]', err);
    res.json(fail('获取竞标列表失败'));
  }
});

// ==============  选标 ==============

/**
 * POST /api/marketplace/select-bid/:orderId
 * 用户选择中标报价
 * Body: { quotation_id }
 */
router.post('/select-bid/:orderId', auth, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const order = await RepairOrder.findByPk(req.params.orderId);
    if (!order) return res.json(fail('工单不存在'));

    const isOwner = order.user_id === req.user.id;
    if (!isOwner) return res.json(fail('无权操作'));
    if (!['quoted', 'pending'].includes(order.status)) return res.json(fail('当前状态不可选标'));
    if (order.selected_quotation_id) return res.json(fail('已选择中标报价'));

    const { quotation_id } = req.body;
    if (!quotation_id) return res.json(fail('请选择中标报价'));

    const quotation = await Quotation.findByPk(quotation_id);
    if (!quotation || quotation.order_id !== order.id) {
      return res.json(fail('报价单不存在或不属于该工单'));
    }

    // 找到对应的竞标记录和工程师
    const bid = await EngineerBid.findOne({
      where: { order_id: order.id, quotation_id: quotation_id }
    });
    if (!bid) return res.json(fail('竞标记录不存在'));

    // 更新选中的报价为 approved，工单指派该工程师
    quotation.status = 'approved';
    quotation.approved_at = new Date();
    quotation.approved_by = req.user.id;
    await quotation.save({ transaction: t });

    // 更新工单
    order.selected_quotation_id = quotation_id;
    order.engineer_id = bid.engineer_id;
    order.status = 'quoted'; // 保持 quoted 状态，进入支付流程
    await order.save({ transaction: t });

    // 更新竞标状态
    await EngineerBid.update(
      { status: 'won' },
      { where: { id: bid.id }, transaction: t }
    );
    await EngineerBid.update(
      { status: 'lost' },
      { where: { order_id: order.id, id: { [Op.ne]: bid.id } }, transaction: t }
    );

    await OrderLog.create({
      order_id: order.id,
      operator_id: req.user.id,
      operator_type: 'user',
      action: 'bid_selected',
      detail: `用户选定中标方案：${quotation.quotation_no}，工程师ID ${bid.engineer_id}，金额 ¥${quotation.total_cost}`
    }, { transaction: t });

    await t.commit();
    res.json(success({ order, quotation, bid }, '已选定工程师，请完成支付'));
  } catch (err) {
    await t.rollback();
    console.error('[SelectBid]', err);
    res.json(fail('选标失败'));
  }
});

// ===== 工程师评价列表 =====
router.get('/engineer/:id/reviews', auth, async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { count, rows } = await OrderComment.findAndCountAll({
      include: [{ model: RepairOrder, as: 'order', where: { engineer_id: req.params.id }, attributes: ['order_no', 'created_at'] }],
      order: [['created_at', 'DESC']],
      offset, limit: pageSize
    });
    const list = rows.map(r => ({
      id: r.id, rating: r.rating, content: r.content, tags: r.tags,
      response_speed: r.response_speed, skill_level: r.skill_level,
      attitude: r.attitude, price_fairness: r.price_fairness,
      order_no: r.order?.order_no, created_at: r.created_at
    }));
    res.json(success({ list, total: count, page, pageSize }));
  } catch (err) { res.json(fail('获取失败')); }
});

module.exports = router;
