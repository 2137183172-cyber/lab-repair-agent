const router = require('express').Router();
const { Op } = require('sequelize');
const sequelize = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const { PartsInventory, StockTransaction, RepairOrder } = require('../models');
const { success, fail, parsePagination } = require('../utils/response');

// 出入库来源/去向映射
const RELATED_LABELS = {
  purchase: '采购入库',
  repair_order: '工单出库',
  return: '退货入库',
  scrap: '报废出库',
  adjustment: '手动调整'
};

/**
 * GET /api/inventory/list
 * 配件库存列表
 */
router.get('/list', auth, async (req, res) => {
  try {
    const { keyword, category, page = 1, pageSize = 20, lowStock } = req.query;
    const { offset, limit } = parsePagination(req.query);
    const where = {};
    if (category) where.category = category;
    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { sku: { [Op.like]: `%${keyword}%` } },
        { supplier: { [Op.like]: `%${keyword}%` } }
      ];
    }
    if (lowStock === '1') {
      where.quantity = { [Op.lte]: sequelize.col('threshold') };
    }

    const { count, rows } = await PartsInventory.findAndCountAll({
      where, order: [['updated_at', 'DESC']], offset, limit
    });

    const lowStockCount = await PartsInventory.count({
      where: { quantity: { [Op.lte]: sequelize.col('threshold') } }
    });

    res.json(success({ list: rows, total: count, low_stock_count: lowStockCount, page: parseInt(page), pageSize: parseInt(pageSize) }));
  } catch (err) {
    console.error('[Inventory]', err);
    res.json(fail('获取库存列表失败'));
  }
});

/**
 * POST /api/inventory/create
 * 添加配件（同时记录初始入库流水）
 */
router.post('/create', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { name, sku, category, quantity, unit, unit_price, threshold, location, supplier, notes } = req.body;
    const part = await PartsInventory.create({
      name, sku: sku || '', category: category || '', quantity: quantity || 0,
      unit: unit || '个', unit_price: unit_price || 0, threshold: threshold || 5,
      location: location || '', supplier: supplier || '', notes: notes || ''
    });
    // 如果有初始库存，记录入库流水
    if (part.quantity > 0) {
      await StockTransaction.create({
        part_id: part.id, type: 'in', quantity: part.quantity,
        before_qty: 0, after_qty: part.quantity,
        related_type: 'purchase', related_name: `初始库存（供应商: ${supplier || '未知'}）`,
        operator: req.user?.name || req.user?.username || '系统', notes: '新建配件初始库存'
      });
    }
    res.json(success(part, '添加成功'));
  } catch (err) {
    console.error('[Inventory Create]', err);
    res.json(fail('添加失败'));
  }
});

/**
 * PUT /api/inventory/update/:id
 * 更新配件信息（不改库存数量）
 */
router.put('/update/:id', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const part = await PartsInventory.findByPk(req.params.id);
    if (!part) return res.json(fail('配件不存在'));
    const fields = ['name', 'sku', 'category', 'unit', 'unit_price', 'threshold', 'location', 'supplier', 'notes'];
    fields.forEach(f => { if (req.body[f] !== undefined) part[f] = req.body[f]; });
    await part.save();
    res.json(success(part, '更新成功'));
  } catch (err) {
    res.json(fail('更新失败'));
  }
});

/**
 * DELETE /api/inventory/delete/:id
 */
router.delete('/delete/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await PartsInventory.destroy({ where: { id: req.params.id } });
    await StockTransaction.destroy({ where: { part_id: req.params.id } });
    res.json(success(null, '已删除'));
  } catch (err) {
    res.json(fail('删除失败'));
  }
});

/**
 * POST /api/inventory/in/:id
 * 入库（记录流水）
 */
router.post('/in/:id', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { quantity, related_type, related_id, related_name, notes } = req.body;
    const part = await PartsInventory.findByPk(req.params.id);
    if (!part) return res.json(fail('配件不存在'));

    const qty = parseInt(quantity) || 0;
    if (qty <= 0) return res.json(fail('入库数量必须大于0'));

    const beforeQty = part.quantity;
    part.quantity += qty;
    await part.save();

    // 记录入库流水
    const rt = related_type || 'purchase';
    await StockTransaction.create({
      part_id: part.id, type: 'in', quantity: qty,
      before_qty: beforeQty, after_qty: part.quantity,
      related_type: rt,
      related_id: related_id || null,
      related_name: related_name || `${RELATED_LABELS[rt] || '入库'}（${part.supplier || '供应商'}）`,
      operator: req.user?.name || req.user?.username || '系统', notes: notes || ''
    });

    res.json(success(part, `入库 +${qty}，当前库存 ${part.quantity}`));
  } catch (err) {
    res.json(fail('入库失败'));
  }
});

/**
 * POST /api/inventory/out/:id
 * 出库（记录流水）
 */
router.post('/out/:id', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { quantity, related_type, related_id, related_name, notes } = req.body;
    const part = await PartsInventory.findByPk(req.params.id);
    if (!part) return res.json(fail('配件不存在'));

    const qty = parseInt(quantity) || 0;
    if (qty <= 0) return res.json(fail('出库数量必须大于0'));
    if (part.quantity < qty) return res.json(fail(`库存不足，当前仅剩 ${part.quantity}`));

    const beforeQty = part.quantity;
    part.quantity -= qty;
    await part.save();

    // 记录出库流水
    const rt = related_type || 'repair_order';
    await StockTransaction.create({
      part_id: part.id, type: 'out', quantity: qty,
      before_qty: beforeQty, after_qty: part.quantity,
      related_type: rt,
      related_id: related_id || null,
      related_name: related_name || RELATED_LABELS[rt] || '出库',
      operator: req.user?.name || req.user?.username || '系统', notes: notes || ''
    });

    res.json(success(part, `出库 -${qty}，当前库存 ${part.quantity}`));
  } catch (err) {
    res.json(fail('出库失败'));
  }
});

/**
 * GET /api/inventory/transactions/:partId
 * 查询某个配件的出入库流水
 */
router.get('/transactions/:partId', auth, async (req, res) => {
  try {
    const { page = 1, pageSize = 50 } = req.query;
    const { offset, limit } = parsePagination(req.query);
    const { count, rows } = await StockTransaction.findAndCountAll({
      where: { part_id: req.params.partId },
      order: [['created_at', 'DESC']],
      offset, limit
    });
    res.json(success({ list: rows, total: count }));
  } catch (err) {
    console.error('[Inventory Transactions]', err);
    res.json(fail('获取流水失败'));
  }
});

/**
 * GET /api/inventory/order-options
 * 获取最近工单列表（供出库时选择关联工单）
 */
router.get('/order-options', auth, async (req, res) => {
  try {
    const { keyword } = req.query;
    const where = {};
    if (keyword) {
      where[Op.or] = [
        { order_no: { [Op.like]: `%${keyword}%` } }
      ];
    }
    const orders = await RepairOrder.findAll({
      where,
      attributes: ['id', 'order_no', 'status', 'device_id'],
      order: [['created_at', 'DESC']],
      limit: 50
    });
    res.json(success(orders.map(o => ({ id: o.id, order_no: o.order_no, status: o.status }))));
  } catch (err) {
    res.json(fail('获取工单列表失败'));
  }
});

module.exports = router;
