const router = require('express').Router();
const { Op } = require('sequelize');
const { auth, requireRole } = require('../middleware/auth');
const { User, Engineer, Device, RepairOrder, Company } = require('../models');
const { success, fail, parsePagination } = require('../utils/response');

// ====== 用户管理 ======

/**
 * POST /api/admin/users
 * 创建新用户（管理端）
 */
router.post('/users', auth, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { login_name, name, phone, company, department, role, company_id } = req.body;
    if (!login_name || !name) return res.json(fail('登录名和姓名为必填'));
    const openid = 'admin_' + login_name;
    const exist = await User.findOne({ where: { openid } });
    if (exist) return res.json(fail('登录名已存在'));
    const user = await User.create({
      openid, name, phone: phone || '', company: company || '',
      department: department || '', role: role || 'viewer', status: 'active',
      company_id: company_id || null
    });
    res.json(success(user, '创建成功'));
  } catch (err) {
    console.error('[Admin CreateUser]', err);
    res.json(fail('创建失败'));
  }
});

/**
 * GET /api/admin/users
 * 用户列表（管理端）
 */
router.get('/users', auth, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { keyword, role, status, company_id, page = 1, pageSize = 20 } = req.query;
    const { offset, limit } = parsePagination(req.query);
    const where = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (company_id) where.company_id = company_id;
    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { phone: { [Op.like]: `%${keyword}%` } },
        { company: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['unionid'] },
      include: [{ model: Company, as: 'tenant', attributes: ['id', 'name'], required: false }],
      order: [['created_at', 'DESC']],
      offset, limit
    });

    res.json(success({ list: rows, total: count, page: parseInt(page), pageSize: parseInt(pageSize) }));
  } catch (err) {
    console.error('[Admin Users]', err);
    res.json(fail('获取用户列表失败'));
  }
});

/**
 * PUT /api/admin/users/:id
 * 更新用户信息
 */
router.put('/users/:id', auth, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.json(fail('用户不存在'));
    const fields = ['name', 'phone', 'company', 'department', 'role', 'company_id'];
    fields.forEach(f => { if (req.body[f] !== undefined) user[f] = req.body[f]; });
    await user.save();
    res.json(success(user, '更新成功'));
  } catch (err) { res.json(fail('更新失败')); }
});

/**
 * GET /api/admin/users/:id
 * 用户详情（聚合设备、工单统计）
 */
router.get('/users/:id', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['openid', 'unionid'] }
    });
    if (!user) return res.json(fail('用户不存在'));

    const [deviceCount, orderCount, recentOrders] = await Promise.all([
      Device.count({ where: { user_id: user.id } }),
      RepairOrder.count({ where: { user_id: user.id } }),
      RepairOrder.findAll({
        where: { user_id: user.id },
        order: [['created_at', 'DESC']],
        limit: 10,
        include: [
          { model: Device, as: 'device', attributes: ['id', 'name', 'model'] },
          { model: Engineer, as: 'engineer', attributes: ['id', 'name'] }
        ]
      })
    ]);

    res.json(success({ user, device_count: deviceCount, order_count: orderCount, recent_orders: recentOrders }));
  } catch (err) {
    console.error('[Admin User Detail]', err);
    res.json(fail('获取用户详情失败'));
  }
});

/**
 * PUT /api/admin/users/:id/status
 * 启用/禁用用户
 */
router.put('/users/:id/status', auth, requireRole('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'disabled', 'pending'].includes(status)) return res.json(fail('无效的状态值'));
    const user = await User.findByPk(req.params.id);
    if (!user) return res.json(fail('用户不存在'));
    user.status = status;
    await user.save();
    res.json(success(user, status === 'active' ? '已启用' : '已禁用'));
  } catch (err) {
    res.json(fail('操作失败'));
  }
});

// ====== 工程师管理 ======

/**
 * POST /api/admin/engineers
 * 创建工程师
 */
router.post('/engineers', auth, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { name, phone, email, employee_no, type, skills, service_area, certifications } = req.body;
    // 先创建用户
    const user = await User.create({
      openid: 'dev_eng_' + (phone || Date.now()),
      name, phone: phone || '', role: 'engineer', status: 'active'
    });
    // 创建工程师
    const engineer = await Engineer.create({
      user_id: user.id, name, phone: phone || '', email: email || '',
      employee_no: employee_no || '', type: type || 'certified',
      skills: skills || [], service_area: service_area || [],
      certifications: certifications || [], status: 'offline'
    });
    res.json(success(engineer, '创建成功'));
  } catch (err) { console.error(err); res.json(fail('创建失败')); }
});

/**
 * GET /api/admin/engineers
 * 工程师列表（管理端）
 */
router.get('/engineers', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { type, status, keyword, page = 1, pageSize = 20 } = req.query;
    const { offset, limit } = parsePagination(req.query);
    const where = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (keyword) where[Op.or] = [{ name: {[Op.like]: '%'+keyword+'%'} }, { phone: {[Op.like]: '%'+keyword+'%'} }];

    const { count, rows } = await Engineer.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      offset, limit
    });

    res.json(success({ list: rows, total: count, page: parseInt(page), pageSize: parseInt(pageSize) }));
  } catch (err) {
    console.error('[Admin Engineers]', err);
    res.json(fail('获取工程师列表失败'));
  }
});

/**
 * GET /api/admin/engineers/:id
 * 工程师详情（含绩效统计）
 */
router.get('/engineers/:id', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const engineer = await Engineer.findByPk(req.params.id);
    if (!engineer) return res.json(fail('工程师不存在'));

    const [recentOrders, orderStats] = await Promise.all([
      RepairOrder.findAll({
        where: { engineer_id: engineer.id },
        order: [['created_at', 'DESC']],
        limit: 20,
        include: [
          { model: Device, as: 'device', attributes: ['id', 'name'] },
          { model: require('./user').User || User, as: 'reporter', attributes: ['id', 'name', 'company'] }
        ]
      }),
      RepairOrder.findAll({
        where: { engineer_id: engineer.id },
        attributes: ['status'],
        raw: true
      })
    ]);

    const stats = {
      total: orderStats.length,
      completed: orderStats.filter(o => o.status === 'completed' || o.status === 'confirmed').length,
      pending: orderStats.filter(o => ['pending', 'accepted', 'diagnosing', 'quoted', 'paid', 'repairing'].includes(o.status)).length,
      cancelled: orderStats.filter(o => o.status === 'cancelled').length
    };

    res.json(success({ engineer, recent_orders: recentOrders, stats }));
  } catch (err) {
    console.error('[Admin Engineer Detail]', err);
    res.json(fail('获取工程师详情失败'));
  }
});

/**
 * PUT /api/admin/engineers/:id/status
 * 管理端设置工程师状态
 */
router.delete('/engineers/:id', auth, requireRole('admin'), async (req, res) => {
  try { await Engineer.destroy({ where: { id: req.params.id } }); res.json(success(null, '已删除')); }
  catch (err) { res.json(fail('删除失败')); }
});

router.put('/engineers/:id/status', auth, requireRole('admin'), async (req, res) => {
  try {
    const { status, type } = req.body;
    const engineer = await Engineer.findByPk(req.params.id);
    if (!engineer) return res.json(fail('工程师不存在'));
    if (status && ['online', 'offline', 'busy'].includes(status)) engineer.status = status;
    if (type && ['self_employed', 'certified'].includes(type)) engineer.type = type;
    await engineer.save();
    res.json(success(engineer, '更新成功'));
  } catch (err) {
    res.json(fail('操作失败'));
  }
});

module.exports = router;
