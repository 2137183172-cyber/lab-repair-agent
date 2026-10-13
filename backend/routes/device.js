const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { Device, DeviceCategory, RepairOrder, RepairRecord, Engineer, MaintenanceRecord, User } = require('../models');
const { success, fail, parsePagination } = require('../utils/response');
const QRCode = require('qrcode');

/**
 * GET /api/device/categories
 * 设备分类列表（树形）
 */
// 管理端分类CRUD（仅 admin/manager）
router.post('/category/create', auth, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { name, parent_id, icon, sort_order } = req.body;
    const cat = await DeviceCategory.create({ name, parent_id: parent_id||0, icon: icon||'', sort_order: sort_order||0 });
    res.json(success(cat, '创建成功'));
  } catch(err) { res.json(fail('创建失败')); }
});
router.put('/category/update/:id', auth, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const cat = await DeviceCategory.findByPk(req.params.id);
    if (!cat) return res.json(fail('不存在'));
    ['name','parent_id','icon','sort_order'].forEach(f=>{ if(req.body[f]!==undefined) cat[f]=req.body[f]; });
    await cat.save();
    res.json(success(cat, '更新成功'));
  } catch(err) { res.json(fail('更新失败')); }
});
router.delete('/category/delete/:id', auth, requireRole('admin', 'manager'), async (req, res) => {
  try {
    await DeviceCategory.destroy({where:{id:req.params.id}});
    await DeviceCategory.destroy({where:{parent_id:req.params.id}});
    res.json(success(null, '已删除'));
  } catch(err) { res.json(fail('删除失败')); }
});

router.get('/categories', auth, async (req, res) => {
  try {
    const categories = await DeviceCategory.findAll({
      order: [['sort_order', 'ASC'], ['id', 'ASC']]
    });

    // 构建树形结构
    const tree = [];
    const map = {};
    categories.forEach(c => {
      map[c.id] = { id: c.id, name: c.name, parent_id: c.parent_id, icon: c.icon, children: [] };
    });
    categories.forEach(c => {
      if (c.parent_id && map[c.parent_id]) {
        map[c.parent_id].children.push(map[c.id]);
      } else {
        tree.push(map[c.id]);
      }
    });

    res.json(success(tree));
  } catch (err) {
    res.json(fail('获取失败'));
  }
});

/**
 * GET /api/device/list
 * 我的设备列表
 * Query: ?category_id=&keyword=&status=&page=&pageSize=
 */
router.get('/list', auth, async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { category_id, keyword, status } = req.query;
    const where = {};
    // 管理员看全部，普通用户只看自己的
    if (!['admin','manager'].includes(req.user.role)) {
      where.user_id = req.user.id;
    }

    if (category_id) where.category_id = parseInt(category_id);
    if (status) where.status = status;
    if (keyword) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { model: { [Op.like]: `%${keyword}%` } },
        { brand: { [Op.like]: `%${keyword}%` } },
        { serial_no: { [Op.like]: `%${keyword}%` } },
        { lab_name: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const { count, rows } = await Device.findAndCountAll({
      where,
      include: [
        { model: DeviceCategory, as: 'category', attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'DESC']],
      offset,
      limit: pageSize
    });

    res.json(success({ list: rows, total: count, page, pageSize }));
  } catch (err) {
    console.error('[DeviceList]', err);
    res.json(fail('获取失败'));
  }
});

/**
 * GET /api/device/detail/:id
 * 设备详情 + 历史维修记录
 */
router.get('/detail/:id', auth, async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.id, {
      include: [{ model: DeviceCategory, as: 'category', attributes: ['id', 'name'] }]
    });
    if (!device) return res.json(fail('设备不存在'));

    // 历史维修记录
    const repairHistory = await RepairOrder.findAll({
      where: { device_id: req.params.id },
      include: [
        { model: require('../models/Engineer'), as: 'engineer', attributes: ['id', 'name'] },
        { model: require('../models/RepairRecord'), as: 'repair_record' }
      ],
      order: [['created_at', 'DESC']],
      limit: 20
    });

    res.json(success({ device, repair_history: repairHistory }));
  } catch (err) {
    res.json(fail('获取失败'));
  }
});

/**
 * POST /api/device/admin/create
 * 管理端为客户添加设备
 */
router.post('/admin/create', auth, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { user_id, name, model, category_id, brand, serial_no, asset_no, lab_name, lab_room, location, purchase_date, warranty_start, warranty_end, manual_url, notes } = req.body;
    if (!user_id || !name) return res.json(fail('用户和设备名称为必填'));
    const user = await User.findByPk(user_id);
    if (!user) return res.json(fail('用户不存在'));
    // 生成二维码
    const qrData = JSON.stringify({ d: 'admin' });
    const qrBuffer = await QRCode.toBuffer(qrData, { width: 300, margin: 2 });
    const qrUrl = saveLocal('qrcodes/admin_' + Date.now() + '.png', qrBuffer);
    const device = await Device.create({
      user_id, company_id: user.company_id || null,
      name, model: model || '', category_id: category_id || null,
      brand: brand || '', serial_no: serial_no || '', asset_no: asset_no || '',
      lab_name: lab_name || '', lab_room: lab_room || '', location: location || '',
      purchase_date: purchase_date || null, warranty_start: warranty_start || null,
      warranty_end: warranty_end || null, manual_url: manual_url || '', qr_code_url: qrUrl, notes: notes || '', status: 'normal'
    });
    res.json(success(device, '添加成功'));
  } catch (err) { console.error(err); res.json(fail('添加失败')); }
});

function saveLocal(key, buffer) {
  const path = require('path'); const fs = require('fs');
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  const filePath = path.join(uploadsDir, key);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, buffer);
  return '/uploads/' + key;
}

/**
 * POST /api/device/create
 * 添加设备（同时生成二维码）
 */
router.post('/create', auth, async (req, res) => {
  try {
    const { name, model, category_id, brand, serial_no, asset_no, lab_name, lab_room, location,
            purchase_date, warranty_start, warranty_end, images, notes } = req.body;
    if (!name) return res.json(fail('设备名称不能为空'));

    // 创建设备
    const device = await Device.create({
      user_id: req.user.id, name, model, category_id, brand, serial_no, asset_no,
      lab_name, lab_room, location,
      purchase_date: purchase_date || null,
      warranty_start: warranty_start || null,
      warranty_end: warranty_end || null,
      images: images || [],
      notes: notes || ''
    });

    // 生成二维码（本地存储 + COS fallback）
    const qrData = JSON.stringify({ d: device.id, t: 'device' });
    const qrBuffer = await QRCode.toBuffer(qrData, { width: 300, margin: 2 });
    const fs = require('fs'); const path = require('path');
    const qrDir = path.join(__dirname, '..', 'uploads', 'qrcode');
    if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });
    const localPath = path.join(qrDir, `device_${device.id}.png`);
    fs.writeFileSync(localPath, qrBuffer);
    const qrUrl = `/uploads/qrcode/device_${device.id}.png`;

    // 上传二维码到COS或本地
    try {
      const { uploadFile } = require('../config/cos');
      const qrUrl = await uploadFile(cosKey, qrBuffer);
      device.qr_code_url = qrUrl;
    } catch (e) {
      // COS未配置，使用本地
      device.qr_code_url = qrUrl;
    }
    await device.save();

    res.json(success(device, '设备添加成功'));
  } catch (err) {
    console.error('[CreateDevice]', err);
    res.json(fail('添加失败'));
  }
});

/**
 * PUT /api/device/update/:id
 * 更新设备信息
 */
router.put('/update/:id', auth, async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.id);
    if (!device) return res.json(fail('设备不存在'));
    if (device.user_id !== req.user.id) return res.json(fail('无权操作'));

    const fields = ['name', 'model', 'category_id', 'brand', 'serial_no', 'asset_no',
      'lab_name', 'lab_room', 'location', 'purchase_date', 'warranty_start',
      'warranty_end', 'images', 'manual_url', 'notes'];
    fields.forEach(f => {
      if (req.body[f] !== undefined) device[f] = req.body[f];
    });
    await device.save();

    res.json(success(device, '更新成功'));
  } catch (err) {
    res.json(fail('更新失败'));
  }
});

/**
 * POST /api/device/regenerate-qr/:id
 * 重新生成设备二维码
 */
router.post('/regenerate-qr/:id', auth, async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.id);
    if (!device) return res.json(fail('设备不存在'));

    const qrData = JSON.stringify({ d: device.id, t: 'device' });
    const qrBuffer = await QRCode.toBuffer(qrData, { width: 300, margin: 2 });
    const cosKey = `qrcode/device_${device.id}_${Date.now()}.png`;

    const { uploadFile } = require('../config/cos');
    const qrUrl = await uploadFile(cosKey, qrBuffer);
    device.qr_code_url = qrUrl;
    await device.save();

    res.json(success({ qr_code_url: qrUrl }, '二维码已更新'));
  } catch (err) {
    res.json(fail('生成失败'));
  }
});

/**
 * DELETE /api/device/delete/:id
 * 删除设备（软删除：标记为报废）
 */
router.delete('/delete/:id', auth, async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.id);
    if (!device) return res.json(fail('设备不存在'));
    if (device.user_id !== req.user.id) return res.json(fail('无权操作'));

    device.status = 'scrapped';
    await device.save();

    res.json(success(null, '设备已报废'));
  } catch (err) {
    res.json(fail('操作失败'));
  }
});

// ====== 设备保养/巡检/维修记录 ======

/**
 * GET /api/device/:id/maintenance
 * 设备生命周期记录
 */
router.get('/:id/maintenance', auth, async (req, res) => {
  try {
    const records = await MaintenanceRecord.findAll({
      where: { device_id: req.params.id },
      order: [['performed_at', 'DESC']]
    });

    // Also get repair history
    const repairs = await RepairOrder.findAll({
      where: { device_id: req.params.id },
      include: [
        { model: RepairRecord, as: 'repair_record' },
        { model: Engineer, as: 'engineer', attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'DESC']]
    });

    // Merge into lifecycle timeline
    const timeline = [
      ...records.map(r => ({
        type: r.type,
        title: r.title,
        date: r.performed_at,
        description: r.description,
        performed_by: r.performed_by,
        cost: r.cost,
        status: r.status,
        next_due_at: r.next_due_at,
        source: 'maintenance'
      })),
      ...repairs.map(r => ({
        type: 'repair',
        title: `维修工单 ${r.order_no}`,
        date: r.finished_at || r.created_at,
        description: r.fault_desc,
        performed_by: r.engineer?.name,
        cost: r.repair_record?.total_cost,
        status: r.status,
        source: 'repair',
        order_id: r.id,
        order_no: r.order_no
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(success({ records, repairs, timeline }));
  } catch (err) {
    console.error('[Maintenance]', err);
    res.json(fail('获取失败'));
  }
});

/**
 * POST /api/device/:id/maintenance
 * 添加保养/巡检记录
 */
router.post('/:id/maintenance', auth, async (req, res) => {
  try {
    const { type, title, description, performed_by, performed_at, next_due_at, cost, notes } = req.body;
    const record = await MaintenanceRecord.create({
      device_id: req.params.id,
      type: type || 'maintenance',
      title: title || '保养记录',
      description: description || '',
      performed_by: performed_by || '',
      performed_at: performed_at || new Date(),
      next_due_at: next_due_at || null,
      cost: cost || 0,
      status: 'completed',
      notes: notes || ''
    });
    res.json(success(record, '添加成功'));
  } catch (err) {
    console.error('[Maintenance Create]', err);
    res.json(fail('添加失败'));
  }
});

// ===== 批量导入 =====
const multer = require('multer');
const ExcelJS = require('exceljs');
const upload = multer({ storage: multer.memoryStorage() });

function normalizeImportRows(worksheet) {
  const headerRow = worksheet.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value || '').trim();
  });

  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const item = {};
    let hasValue = false;
    headers.forEach((header, colNumber) => {
      if (!header) return;
      const value = row.getCell(colNumber).value;
      const normalized = value && typeof value === 'object' && value.text ? value.text : value;
      if (normalized !== null && normalized !== undefined && normalized !== '') hasValue = true;
      item[header] = normalized ?? '';
    });
    if (hasValue) rows.push({ rowNumber, data: item });
  });
  return rows;
}

/**
 * POST /api/device/import
 * 批量导入设备 (Excel: 设备名称/型号/品牌/分类/序列号/实验室/房间号/客户手机)
 */
router.post('/import', auth, requireRole('manager', 'admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.json(fail('请上传Excel文件'));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.worksheets[0];
    const rows = worksheet ? normalizeImportRows(worksheet) : [];

    if (!rows.length) return res.json(fail('文件为空'));

    const results = { total: rows.length, success: 0, errors: [] };
    const devices = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].data;
      const rowNumber = rows[i].rowNumber;
      const name = (row['设备名称'] || row['name'] || '').toString().trim();
      if (!name) { results.errors.push({ row: rowNumber, msg: '设备名称不能为空' }); continue; }

      // 查找客户 (by 手机号)
      let user_id = null, company_id = null;
      const phone = (row['客户手机'] || row['手机号'] || row['phone'] || '').toString().trim();
      if (phone) {
        const user = await User.findOne({ where: { phone, role: 'user' }, attributes: ['id', 'company_id'] });
        if (user) { user_id = user.id; company_id = user.company_id; }
        else { results.errors.push({ row: rowNumber, msg: '手机号 ' + phone + ' 未找到对应客户' }); continue; }
      }
      if (!user_id) { results.errors.push({ row: rowNumber, msg: '请提供客户手机号' }); continue; }

      // 查找/创建分类
      const catName = (row['分类'] || row['category'] || '').toString().trim();
      let category_id = null;
      if (catName) {
        let cat = await DeviceCategory.findOne({ where: { name: catName } });
        if (!cat) cat = await DeviceCategory.create({ name: catName, parent_id: 0 });
        category_id = cat.id;
      }

      const device = {
        user_id, company_id, category_id,
        name,
        model: (row['型号'] || row['model'] || '').toString().trim(),
        brand: (row['品牌'] || row['brand'] || '').toString().trim(),
        serial_no: (row['序列号'] || row['serial_no'] || '').toString().trim(),
        asset_no: (row['资产编号'] || row['asset_no'] || '').toString().trim(),
        lab_name: (row['实验室'] || row['lab_name'] || row['lab'] || '').toString().trim(),
        lab_room: (row['房间号'] || row['lab_room'] || row['room'] || '').toString().trim(),
        status: 'normal'
      };
      devices.push(device);
    }

    // 批量插入
    if (devices.length > 0) {
      await Device.bulkCreate(devices);
      results.success = devices.length;
    }

    res.json(success(results,
      '导入完成：' + results.success + '条成功' + (results.errors.length > 0 ? '，' + results.errors.length + '条失败' : '')
    ));
  } catch (err) {
    console.error('[DeviceImport]', err.message);
    res.json(fail('导入失败'));
  }
});

/**
 * GET /api/device/template
 * 下载导入模板 (CSV)
 */
router.get('/template', auth, async (req, res) => {
  const headers = '设备名称,型号,品牌,分类,序列号,资产编号,实验室,房间号,客户手机';
  const example = '高速冷冻离心机,Sorvall LYNX 6000,Thermo Fisher,离心机,SN001,,分子实验室,301,13000000000';
  const csv = '﻿' + headers + '\n' + example;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=device_template.csv');
  res.send(csv);
});

module.exports = router;
