const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const { auth } = require('../middleware/auth');
const { upload, generateCosKey } = require('../middleware/upload');
const { success, fail } = require('../utils/response');
const { UploadFile } = require('../models');

// COS 可能未配置，降级为本地存储
let uploadFile;
try {
  uploadFile = require('../config/cos').uploadFile;
} catch (e) {
  uploadFile = null;
}

// 确保 uploads 目录存在
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

/** 本地存储 fallback */
function saveLocal(key, buffer) {
  const filePath = path.join(uploadsDir, key);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${key}`;
}

/** 上传单个文件 */
async function doUpload(originalName, buffer) {
  const cosKey = generateCosKey('images', originalName);
  try {
    if (uploadFile) {
      return await uploadFile(cosKey, buffer);
    }
  } catch (e) { console.warn('[Upload] COS上传失败，使用本地存储'); }
  return saveLocal(cosKey, buffer);
}

/**
 * POST /api/upload/image
 */
router.post('/image', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.json(fail('请选择文件'));
    const url = await doUpload(req.file.originalname, req.file.buffer);
    // 记录到照片库
    await UploadFile.create({
      user_id: req.user?.id,
      file_name: req.file.originalname,
      file_url: url,
      file_path: url,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      category: req.body.category || 'fault',
      entity_type: req.body.entity_type || null,
      entity_id: req.body.entity_id || null
    });
    res.json(success({ url }, '上传成功'));
  } catch (err) {
    console.error('[Upload]', err);
    res.json(fail('上传失败'));
  }
});

/**
 * GET /api/upload/gallery — 照片库列表
 */
router.get('/list', auth, async (req, res) => {
  try {
    const files = await UploadFile.findAll({ order: [['created_at', 'DESC']], limit: 50 });
    res.json(success(files));
  } catch (err) { res.json(fail('获取失败')); }
});
router.get('/gallery', auth, async (req, res) => {
  try {
    const { category, entity_type, entity_id, page = 1, pageSize = 24 } = req.query;
    const where = {};
    if (category) where.category = category;
    if (entity_type) where.entity_type = entity_type;
    if (entity_id) where.entity_id = entity_id;

    const { count, rows } = await UploadFile.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: parseInt(pageSize)
    });

    res.json(success({ list: rows, total: count, page: parseInt(page), pageSize: parseInt(pageSize) }));
  } catch (err) {
    console.error('[Gallery]', err);
    res.json(fail('获取失败'));
  }
});

/**
 * POST /api/upload/images
 */
router.post('/images', auth, upload.array('files', 9), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.json(fail('请选择文件'));
    const results = await Promise.all(
      req.files.map(async file => {
        const url = await doUpload(file.originalname, file.buffer);
        return { url };
      })
    );
    res.json(success(results, `${results.length} 张图片上传成功`));
  } catch (err) {
    console.error('[Upload]', err);
    res.json(fail('上传失败'));
  }
});

/**
 * POST /api/upload/file — 上传文档 (PDF/Word/Excel)
 */
router.post('/file', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.json(fail('请选择文件'));
    const url = await doUpload(req.file.originalname, req.file.buffer);
    await UploadFile.create({
      user_id: req.user?.id,
      file_name: req.file.originalname,
      file_url: url,
      file_path: url,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      category: 'other',
      entity_type: req.body.entity_type || null,
      entity_id: req.body.entity_id || null
    });
    res.json(success({ url, name: req.file.originalname, size: req.file.size }, '上传成功'));
  } catch (err) {
    console.error('[Upload File]', err);
    res.json(fail('上传失败'));
  }
});

module.exports = router;
