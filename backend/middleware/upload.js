const multer = require('multer');
const path = require('path');
const dayjs = require('dayjs');

/**
 * 文件上传中间件
 * 存储到内存，后续由业务层决定上传到COS还是本地
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,  // 10MB
    files: 9                       // 最多9张图
  },
  fileFilter(req, file, cb) {
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar'];
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip', 'application/x-rar-compressed', 'application/x-zip-compressed'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    // W-B8: 同时检查扩展名和 MIME 类型
    if (!allowedExts.includes(ext)) {
      return cb(new Error(`不支持的文件类型: ${ext}`));
    }
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error(`不支持的文件类型: ${file.mimetype}`));
    }
    cb(null, true);
  }
});

/**
 * 生成COS存储路径
 */
function generateCosKey(prefix, originalName) {
  const ext = path.extname(originalName);
  const date = dayjs().format('YYYY/MM/DD');
  const random = String(Math.random()).slice(2, 10);
  return `${prefix}/${date}/${random}${ext}`;
}

module.exports = { upload, generateCosKey };
