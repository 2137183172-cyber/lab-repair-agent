/**
 * 统一响应格式
 */
function success(data = null, message = 'ok') {
  return { code: 200, message, data };
}

function fail(message = 'error', code = 400) {
  return { code, message, data: null };
}

/**
 * 分页参数解析
 */
function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize) || 10));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/**
 * 工单编号生成
 * 格式: ZC + YYYYMMDD + 4位随机
 */
function generateOrderNo() {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('');
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `ZC${date}${random}`;
}

/**
 * 报价单编号生成
 * 格式: BJ + YYYYMMDD + 4位随机
 */
function generateQuotationNo() {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('');
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `BJ${date}${random}`;
}

/**
 * 支付单编号生成 — PAY + YYYYMMDD + 6位随机
 */
function generatePaymentNo() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const random = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  return `PAY${date}${random}`;
}

/**
 * 结算单编号生成 — SETTLE + YYYYMMDD + 6位随机
 */
function generateSettlementNo() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const random = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  return `SETTLE${date}${random}`;
}

/**
 * 提现单编号生成 — WD + YYYYMMDD + 6位随机
 */
function generateWithdrawalNo() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const random = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  return `WD${date}${random}`;
}

module.exports = { success, fail, parsePagination, generateOrderNo, generateQuotationNo, generatePaymentNo, generateSettlementNo, generateWithdrawalNo };
