import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 15000
});

// 请求拦截
api.interceptors.request.use(config => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 响应拦截
api.interceptors.response.use(
  res => {
    if (res.data.code === 401) {
      localStorage.removeItem('admin_token');
      window.location.hash = '#/login';
      return Promise.reject(new Error('未登录'));
    }
    return res.data;
  },
  err => {
    if (!err.response) {
      const target = import.meta.env.VITE_API_PROXY_TARGET || import.meta.env.VITE_API_BASE || '/api';
      err.message = `网络连接失败，请确认后端服务已启动，API地址：${target}`;
    }
    return Promise.reject(err);
  }
);

export function login(data) { return api.post('/user/admin-login', data); }

// Dashboard
export function getDashboard() { return api.get('/stats/dashboard'); }
export function getOrderTrend(days = 30) { return api.get('/stats/order-trend', { params: { days } }); }
export function getEngineerRanking() { return api.get('/stats/engineer-ranking'); }
export function getFaultAnalysis() { return api.get('/stats/fault-analysis'); }

// Orders
export function getOrderList(params) { return api.get('/order/list', { params }); }
export function getOrderDetail(id) { return api.get(`/order/detail/${id}`); }
export function assignOrder(id, data) { return api.post(`/order/assign/${id}`, data); }

// Broker process orders
export function getBrokerOrders(params) { return api.get('/broker/orders', { params }); }
export function brokerReviewOrder(id, data) { return api.post(`/broker/orders/${id}/review`, data); }
export function brokerPriceOrder(id, data) { return api.post(`/broker/orders/${id}/price`, data); }
export function brokerAssignOrder(id, data) { return api.post(`/broker/orders/${id}/assign`, data); }
export function brokerPlatformReview(id, data) { return api.post(`/broker/orders/${id}/platform-review`, data); }

// Devices
export function getDeviceList(params) { return api.get('/device/list', { params }); }
export function getCategories() { return api.get('/device/categories'); }
export function getDeviceMaintenance(id) { return api.get(`/device/${id}/maintenance`); }
export function addDeviceMaintenance(id, data) { return api.post(`/device/${id}/maintenance`, data); }

// Engineers
export function getEngineerList(params) { return api.get('/admin/engineers', { params }); }
export function getEngineerDetail(id) { return api.get(`/admin/engineers/${id}`); }
export function updateEngineerStatus(id, data) { return api.put(`/admin/engineers/${id}/status`, data); }

// Users
export function getUserList(params) { return api.get('/admin/users', { params }); }
export function getUserDetail(id) { return api.get(`/admin/users/${id}`); }
export function updateUserStatus(id, data) { return api.put(`/admin/users/${id}/status`, data); }
export function createUser(data) { return api.post('/admin/users', data); }

export default api;
