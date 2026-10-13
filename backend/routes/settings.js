const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { PlatformSetting } = require('../models');
const { success, fail } = require('../utils/response');

// GET /api/settings/:key
router.get('/:key', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const setting = await PlatformSetting.findByPk(req.params.key);
    if (!setting) return res.json(fail('配置不存在'));
    res.json(success(setting));
  } catch (err) { res.json(fail('获取失败')); }
});

// PUT /api/settings/:key
router.put('/:key', auth, requireRole('admin'), async (req, res) => {
  try {
    const { value, description } = req.body;
    const setting = await PlatformSetting.findByPk(req.params.key);
    if (!setting) {
      await PlatformSetting.create({ key: req.params.key, value: value || '', description: description || '' });
    } else {
      if (value !== undefined) setting.value = value;
      if (description !== undefined) setting.description = description;
      await setting.save();
    }
    res.json(success(setting || { key: req.params.key, value }, '已更新'));
  } catch (err) { res.json(fail('更新失败')); }
});

// GET /api/settings — 获取所有配置
router.get('/', auth, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const settings = await PlatformSetting.findAll();
    res.json(success(settings));
  } catch (err) { res.json(fail('获取失败')); }
});

module.exports = router;
