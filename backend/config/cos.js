/**
 * 腾讯云COS对象存储配置
 * 用于存储报修图片、设备图片、维修前后照片
 */
const COS = require('cos-nodejs-sdk-v5');
require('dotenv').config();

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY
});

const BUCKET = process.env.COS_BUCKET;
const REGION = process.env.COS_REGION;

/**
 * 上传文件到COS
 * @param {string} key - 文件路径, 如 repair/2024/01/xxx.jpg
 * @param {Buffer} body - 文件内容
 * @returns {Promise<string>} 文件URL
 */
function uploadFile(key, body) {
  return new Promise((resolve, reject) => {
    cos.putObject({
      Bucket: BUCKET,
      Region: REGION,
      Key: key,
      Body: body,
      ContentType: getContentType(key)
    }, (err, data) => {
      if (err) return reject(err);
      resolve(`https://${BUCKET}.cos.${REGION}.myqcloud.com/${key}`);
    });
  });
}

/**
 * 批量上传
 */
function uploadFiles(files) {
  return Promise.all(files.map(f => uploadFile(f.key, f.body)));
}

/**
 * 删除文件
 */
function deleteFile(key) {
  return new Promise((resolve, reject) => {
    cos.deleteObject({
      Bucket: BUCKET,
      Region: REGION,
      Key: key
    }, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

function getContentType(key) {
  const ext = key.split('.').pop().toLowerCase();
  const map = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf'
  };
  return map[ext] || 'application/octet-stream';
}

module.exports = { uploadFile, uploadFiles, deleteFile, BUCKET, REGION };
