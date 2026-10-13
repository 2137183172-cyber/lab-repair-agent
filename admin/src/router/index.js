import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    redirect: '/dashboard',
    component: () => import('@/layout/Index.vue'),
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/Dashboard.vue'), meta: { title: '仪表盘', icon: 'Odometer' } },
      { path: 'orders', name: 'Orders', component: () => import('@/views/Orders.vue'), meta: { title: '工单管理', icon: 'Document' } },
      { path: 'broker-orders', name: 'BrokerOrders', component: () => import('@/views/BrokerOrders.vue'), meta: { title: '过程单管理', icon: 'Operation' } },
      { path: 'orders/:id', name: 'OrderDetail', component: () => import('@/views/OrderDetail.vue'), meta: { title: '工单详情', hidden: true } },
      { path: 'devices', name: 'Devices', component: () => import('@/views/Devices.vue'), meta: { title: '设备管理', icon: 'Monitor' } },
      { path: 'categories', name: 'Categories', component: () => import('@/views/Categories.vue'), meta: { title: '设备分类', icon: 'Menu' } },
      { path: 'engineers', name: 'Engineers', component: () => import('@/views/Engineers.vue'), meta: { title: '工程师管理', icon: 'User' } },
      { path: 'users', name: 'Users', component: () => import('@/views/Users.vue'), meta: { title: '人员管理', icon: 'Avatar' } },
      { path: 'customers', name: 'Customers', component: () => import('@/views/Customers.vue'), meta: { title: '客户管理', icon: 'User' } },
      { path: 'inventory', name: 'Inventory', component: () => import('@/views/Inventory.vue'), meta: { title: '备件库存', icon: 'Box' } },
      { path: 'knowledge', name: 'Knowledge', component: () => import('@/views/Knowledge.vue'), meta: { title: '知识库', icon: 'Reading' } },
      { path: 'contracts', name: 'Contracts', component: () => import('@/views/Contracts.vue'), meta: { title: '服务合同', icon: 'Tickets' } },
      { path: 'companies', name: 'Companies', component: () => import('@/views/Companies.vue'), meta: { title: '集团客户', icon: 'OfficeBuilding' } },
      { path: 'calibrations', name: 'Calibrations', component: () => import('@/views/Calibrations.vue'), meta: { title: '校准管理', icon: 'SetUp' } },
      { path: 'pm', name: 'PM', component: () => import('@/views/PM.vue'), meta: { title: '预防性维护', icon: 'Tools' } },
      { path: 'audit', name: 'AuditLogs', component: () => import('@/views/AuditLogs.vue'), meta: { title: '审计追踪', icon: 'List' } },
      { path: 'permissions', name: 'Permissions', component: () => import('@/views/Permissions.vue'), meta: { title: '权限配置', icon: 'Key' } },
      { path: 'dictionaries', name: 'Dictionaries', component: () => import('@/views/Dictionaries.vue'), meta: { title: '数据字典', icon: 'Collection' } },
      { path: 'photos', name: 'PhotoGallery', component: () => import('@/views/PhotoGallery.vue'), meta: { title: '照片库', icon: 'Picture' } },
      { path: 'settlements', name: 'Settlements', component: () => import('@/views/Settlements.vue'), meta: { title: '结算管理', icon: 'Coin' } },
      { path: 'withdrawals', name: 'Withdrawals', component: () => import('@/views/Withdrawals.vue'), meta: { title: '提现管理', icon: 'Money' } },
      { path: 'payments', name: 'Payments', component: () => import('@/views/Payments.vue'), meta: { title: '支付记录', icon: 'Wallet' } },
      { path: 'commission', name: 'CommissionSettings', component: () => import('@/views/CommissionSettings.vue'), meta: { title: '平台配置', icon: 'Setting' } },
    ]
  },
  { path: '/login', name: 'Login', component: () => import('@/views/Login.vue'), meta: { title: '登录' } },
  { path: '/:pathMatch(.*)', redirect: '/login' },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

const sensitiveRoutes = ['/broker-orders', '/settlements', '/withdrawals', '/payments', '/commission', '/permissions'];
const adminOnlyRoutes = ['/permissions'];

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('admin_token');

  if (to.path === '/login') {
    if (token) return next('/dashboard');
    return next();
  }

  if (!token) return next('/login');

  try {
    const userStr = localStorage.getItem('admin_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      const role = user.role || '';

      if (adminOnlyRoutes.some(r => to.path.startsWith(r)) && role !== 'admin') {
        return next('/dashboard');
      }
      if (sensitiveRoutes.some(r => to.path.startsWith(r)) && !['admin', 'manager', 'engineer_lead'].includes(role)) {
        return next('/dashboard');
      }
    }
  } catch (e) {
    // Ignore malformed local user data and let API permissions handle it.
  }

  next();
});

export default router;
