const API_BASE_STORAGE_KEY = 'zhhk_api_base_url';
const DEFAULT_MP_WEIXIN_API_BASE = 'http://127.0.0.1:3000/api';

function getApiBaseUrl() {
  const savedBaseUrl = uni.getStorageSync(API_BASE_STORAGE_KEY);
  if (savedBaseUrl) return savedBaseUrl;

  // #ifdef H5
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    return `http://${window.location.hostname}:3000/api`;
  }
  // #endif

  // #ifdef MP-WEIXIN
  return DEFAULT_MP_WEIXIN_API_BASE;
  // #endif

  return 'http://localhost:3000/api';
}

const BASE_URL = getApiBaseUrl();
const TOKEN_KEY = 'zhhk_token';

function getToken() {
  return uni.getStorageSync(TOKEN_KEY) || '';
}

function setToken(token) {
  uni.setStorageSync(TOKEN_KEY, token);
}

function clearToken() {
  uni.removeStorageSync(TOKEN_KEY);
}

function setApiBaseUrl(url) {
  if (!url) {
    uni.removeStorageSync(API_BASE_STORAGE_KEY);
    return;
  }
  uni.setStorageSync(API_BASE_STORAGE_KEY, String(url).replace(/\/$/, ''));
}

function request(url, options = {}) {
  const { method = 'GET', data = {}, header = {}, showLoading = false } = options;

  if (!url.includes('/user/login') && !getToken()) {
    uni.switchTab({ url: '/pages/mine/mine' });
    return Promise.reject(new Error('请先登录'));
  }

  if (showLoading) {
    uni.showLoading({ title: '加载中...', mask: true });
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url: getApiBaseUrl() + url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
        ...header
      },
      success(res) {
        if (res.statusCode === 200) {
          const body = res.data;
          if (body.code === 200) {
            resolve(body.data);
          } else if (body.code === 401) {
            clearToken();
            reject(new Error('请先登录'));
          } else {
            reject(new Error(body.message || '请求失败'));
          }
        } else if (res.statusCode === 401) {
          clearToken();
          reject(new Error('请先登录'));
        } else {
          reject(new Error(`服务器错误 ${res.statusCode}`));
        }
      },
      fail(err) {
        console.error('[API Network Error]', getApiBaseUrl() + url, err);
        const detail = err && (err.errMsg || err.message) ? `：${err.errMsg || err.message}` : '';
        reject(new Error(`网络错误，请检查后端服务和请求域名${detail}`));
      },
      complete() {
        if (showLoading) uni.hideLoading();
      }
    });
  });
}

export function wxLogin(code, profile = {}) {
  return request('/user/login', { method: 'POST', data: { code, ...profile }, showLoading: true });
}
export function getUserProfile() { return request('/user/profile'); }
export function updateUserProfile(data) { return request('/user/profile', { method: 'PUT', data }); }
export function getUserOrders(params) { return request('/user/orders', { data: params }); }
export function getUserDashboard() { return request('/user/dashboard'); }

export function createOrder(data) { return request('/order/create', { method: 'POST', data, showLoading: true }); }
export function getOrderDetail(id) { return request(`/order/detail/${id}`, { showLoading: true }); }
export function cancelOrder(id, reason = '') { return request(`/order/cancel/${id}`, { method: 'POST', data: { reason } }); }
export function confirmOrder(id, data) { return request(`/order/confirm/${id}`, { method: 'POST', data, showLoading: true }); }

export function getCategories() { return request('/device/categories'); }
export function getDeviceList(params) { return request('/device/list', { data: params }); }
export function getDeviceDetail(id) { return request(`/device/detail/${id}`, { showLoading: true }); }
export function createDevice(data) { return request('/device/create', { method: 'POST', data, showLoading: true }); }
export function updateDevice(id, data) { return request(`/device/update/${id}`, { method: 'PUT', data }); }
export function deleteDevice(id) { return request(`/device/delete/${id}`, { method: 'DELETE' }); }
export function getDeviceMaintenance(id) { return request(`/device/${id}/maintenance`); }
export function addDeviceMaintenance(id, data) { return request(`/device/${id}/maintenance`, { method: 'POST', data }); }

export function getEngineerProfile() { return request('/engineer/profile'); }
export function updateEngineerStatus(data) { return request('/engineer/status', { method: 'PUT', data }); }
export function getOrderPool(params) { return request('/engineer/order-pool', { data: params }); }
export function acceptOrder(orderId) { return request(`/engineer/accept/${orderId}`, { method: 'POST' }); }
export function getMyOrders(params) { return request('/engineer/my-orders', { data: params }); }
export function startRepair(orderId) { return request(`/engineer/start-repair/${orderId}`, { method: 'POST' }); }
export function completeRepair(orderId, data) { return request(`/engineer/complete-repair/${orderId}`, { method: 'POST', data, showLoading: true }); }
export function getEngineerStats() { return request('/engineer/stats'); }
export function getMyCustomers() { return request('/engineer/my-customers'); }
export function getMyDevices() { return request('/engineer/my-devices'); }
export function startDiagnosis(orderId) { return request(`/engineer/start-diagnosis/${orderId}`, { method: 'POST' }); }

export function createQuote(data) { return request('/quote/create', { method: 'POST', data, showLoading: true }); }
export function submitQuote(id) { return request(`/quote/submit/${id}`, { method: 'PUT' }); }
export function getQuoteDetail(id) { return request(`/quote/detail/${id}`); }
export function getOrderQuotes(orderId) { return request(`/quote/order/${orderId}`); }
export function approveQuote(id, notes = '', method = undefined) {
  return request(`/quote/${id}/approve`, { method: 'POST', data: { notes, method }, showLoading: true });
}
export function rejectQuote(id, reason) {
  return request(`/quote/${id}/reject`, { method: 'POST', data: { reject_reason: reason }, showLoading: true });
}
export function updateQuote(id, data) { return request(`/quote/update/${id}`, { method: 'PUT', data }); }

export function getPublicOrders(params) { return request('/marketplace/public-orders', { data: params }); }
export function getEngineerHall(params) { return request('/marketplace/engineers', { data: params }); }
export function submitBid(orderId, data) { return request(`/marketplace/bid/${orderId}`, { method: 'POST', data, showLoading: true }); }
export function getBids(orderId) { return request(`/marketplace/bids/${orderId}`); }
export function selectWinner(orderId, quotationId) {
  return request(`/marketplace/select-bid/${orderId}`, { method: 'POST', data: { quotation_id: quotationId }, showLoading: true });
}

export function createPayment(data) { return request('/payment/create', { method: 'POST', data, showLoading: true }); }
export function executePayment(paymentNo) { return request(`/payment/pay/${paymentNo}`, { method: 'POST', showLoading: true }); }
export function getPaymentStatus(orderId) { return request(`/payment/status/${orderId}`); }

export function getWalletDashboard() { return request('/wallet/dashboard'); }
export function getWalletBills(params) { return request('/wallet/bills', { data: params }); }
export function applyWithdrawal(data) { return request('/settlement/withdraw/apply', { method: 'POST', data, showLoading: true }); }
export function getWithdrawalList(params) { return request('/settlement/withdraw/list', { data: params }); }
export function updateBankInfo(data) { return request('/engineer/bank-info', { method: 'PUT', data }); }

export function addFavorite(engineerId) { return request(`/favorite/${engineerId}`, { method: 'POST' }); }
export function removeFavorite(engineerId) { return request(`/favorite/${engineerId}`, { method: 'DELETE' }); }
export function getFavorites() { return request('/favorite/list'); }

export function getSubscriptionPlans() { return request('/subscription/plans'); }
export function getSubscriptionStatus() { return request('/subscription/status'); }
export function subscribePlan(plan, period) {
  return request('/subscription/subscribe', { method: 'POST', data: { plan, period }, showLoading: true });
}
export function getSubscriptionHistory() { return request('/subscription/history'); }

export function uploadImage(filePath) {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: getApiBaseUrl() + '/upload/image',
      filePath,
      name: 'file',
      header: { Authorization: `Bearer ${getToken()}` },
      success(res) {
        try {
          const data = JSON.parse(res.data);
          if (data.code === 200) resolve(data.data);
          else reject(new Error(data.message));
        } catch (error) {
          reject(new Error('上传失败'));
        }
      },
      fail(err) {
        console.error('[API Upload Error]', getApiBaseUrl() + '/upload/image', err);
        reject(err);
      }
    });
  });
}

export { getToken, setToken, clearToken, getApiBaseUrl, setApiBaseUrl, BASE_URL };
