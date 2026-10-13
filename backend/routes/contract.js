const router = require('express').Router();
const { Op } = require('sequelize');
const { auth, requireRole } = require('../middleware/auth');
const { ServiceContract, User } = require('../models');
const { success, fail, parsePagination } = require('../utils/response');

/**
 * GET /api/contract/list
 */
router.get('/list', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { keyword, status, type, page = 1, pageSize = 20 } = req.query;
    const { offset, limit } = parsePagination(req.query);
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (keyword) {
      where[Op.or] = [
        { contract_no: { [Op.like]: `%${keyword}%` } },
        { title: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const { count, rows } = await ServiceContract.findAndCountAll({
      where,
      include: [{ model: User, as: 'client', attributes: ['id', 'name', 'company', 'phone'] }],
      order: [['end_date', 'ASC']],
      offset, limit
    });

    // Count expiring soon (within 30 days)
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const expiringCount = await ServiceContract.count({
      where: { status: 'active', end_date: { [Op.between]: [new Date().toISOString().split('T')[0], thirtyDaysLater.toISOString().split('T')[0]] } }
    });

    res.json(success({ list: rows, total: count, expiring_count: expiringCount, page: parseInt(page), pageSize: parseInt(pageSize) }));
  } catch (err) {
    console.error('[Contract]', err);
    res.json(fail('获取失败'));
  }
});

router.post('/create', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const fields = ['user_id', 'contract_no', 'title', 'type', 'scope', 'devices', 'order_nos', 'start_date', 'end_date', 'amount', 'contact_name', 'contact_phone', 'signed_at', 'notes', 'attachments'];
    const data = {};
    fields.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    data.status = 'active';
    const contract = await ServiceContract.create(data);
    res.json(success(contract, '创建成功'));
  } catch (err) {
    console.error('[Contract Create]', err);
    res.json(fail('创建失败'));
  }
});

router.put('/update/:id', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const contract = await ServiceContract.findByPk(req.params.id);
    if (!contract) return res.json(fail('合同不存在'));
    const fields = ['title', 'type', 'scope', 'devices', 'start_date', 'end_date', 'amount', 'status', 'contact_name', 'contact_phone', 'notes', 'attachments'];
    fields.forEach(f => { if (req.body[f] !== undefined) contract[f] = req.body[f]; });
    await contract.save();
    res.json(success(contract, '更新成功'));
  } catch (err) { res.json(fail('更新失败')); }
});

router.delete('/delete/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await ServiceContract.destroy({ where: { id: req.params.id } });
    res.json(success(null, '已删除'));
  } catch (err) { res.json(fail('删除失败')); }
});

module.exports = router;
