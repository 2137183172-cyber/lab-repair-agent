const router = require('express').Router();
const { Op } = require('sequelize');
const { auth, requireRole } = require('../middleware/auth');
const { Company, User, Device, RepairOrder } = require('../models');
const { success, fail, parsePagination } = require('../utils/response');

// GET /api/company/list
router.get('/list', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { keyword, status, page = 1, pageSize = 20 } = req.query;
    const { offset, limit } = parsePagination(req.query);
    const where = {};
    if (status) where.status = status;
    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { contact_name: { [Op.like]: `%${keyword}%` } }
      ];
    }
    const { count, rows } = await Company.findAndCountAll({ where, order: [['created_at', 'DESC']], offset, limit });
    // Count related data for each company
    const result = await Promise.all(rows.map(async (c) => {
      const [userCount, deviceCount, orderCount] = await Promise.all([
        User.count({ where: { company_id: c.id } }),
        Device.count({ where: { company_id: c.id } }),
        RepairOrder.count({ where: { company_id: c.id } })
      ]);
      return { ...c.toJSON(), user_count: userCount, device_count: deviceCount, order_count: orderCount };
    }));
    res.json(success({ list: result, total: count, page: parseInt(page), pageSize: parseInt(pageSize) }));
  } catch (err) { console.error('[Company]', err); res.json(fail('获取失败')); }
});

// GET /api/company/:id
router.get('/:id', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) return res.json(fail('公司不存在'));
    const [users, devices, recentOrders] = await Promise.all([
      User.findAll({ where: { company_id: company.id }, attributes: ['id', 'name', 'phone', 'role', 'status'] }),
      Device.findAll({ where: { company_id: company.id }, attributes: ['id', 'name', 'model', 'status'], limit: 50 }),
      RepairOrder.findAll({ where: { company_id: company.id }, order: [['created_at', 'DESC']], limit: 20 })
    ]);
    res.json(success({ company, users, devices, recent_orders: recentOrders }));
  } catch (err) { res.json(fail('获取失败')); }
});

// POST /api/company/create
router.post('/create', auth, requireRole('admin'), async (req, res) => {
  try {
    const fields = ['name', 'short_name', 'code', 'industry', 'contact_name', 'contact_phone', 'contact_email', 'address', 'subscription_type', 'max_devices', 'max_users', 'notes'];
    const data = {};
    fields.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    const company = await Company.create(data);
    res.json(success(company, '创建成功'));
  } catch (err) { console.error('[Company Create]', err); res.json(fail('创建失败')); }
});

// PUT /api/company/update/:id
router.put('/update/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) return res.json(fail('公司不存在'));
    const fields = ['name', 'short_name', 'industry', 'contact_name', 'contact_phone', 'contact_email', 'address', 'status', 'subscription_type', 'max_devices', 'max_users', 'notes'];
    fields.forEach(f => { if (req.body[f] !== undefined) company[f] = req.body[f]; });
    await company.save();
    res.json(success(company, '更新成功'));
  } catch (err) { res.json(fail('更新失败')); }
});

// DELETE /api/company/delete/:id
router.delete('/delete/:id', auth, requireRole('admin'), async (req, res) => {
  try { await Company.destroy({ where: { id: req.params.id } }); res.json(success(null, '已删除')); }
  catch (err) { res.json(fail('删除失败')); }
});

module.exports = router;
