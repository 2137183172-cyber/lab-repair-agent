<template>
  <el-container class="layout">
    <el-aside width="220px" class="aside">
      <div class="logo">
        <img src="/demo-lab.svg" class="logo-img" alt="智荟华科" />
        <p>仪器维修管理后台</p>
      </div>
      <el-menu :default-active="route.path" router background-color="#001529" text-color="#fff9" active-text-color="#fff">
        <template v-for="(group, gIdx) in groupedMenus" :key="gIdx">
          <div class="menu-group-title">{{ group.group }}</div>
          <el-menu-item v-for="menu in group.items" :key="menu.path" :index="menu.path">
            <el-icon><component :is="menu.icon" /></el-icon>
            <span>{{ menu.label.replace(/^[^\s]+\s/, '') }}</span>
          </el-menu-item>
        </template>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <span class="header-title">{{ route.meta.title }}</span>
        <div class="header-tools">
          <el-tag :type="roleTagType" size="small">{{ roleLabel }}</el-tag>
          <el-dropdown>
            <span class="user-dropdown">{{ userName }} <el-icon><ArrowDown /></el-icon></span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main"><router-view /></el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import api from '@/api';

const router = useRouter();
const route = useRoute();

const ROLES = {
  admin: '超级管理员',
  manager: '运营经理',
  quality: '质量负责人',
  engineer_lead: '工程师组长',
  viewer: '只读用户'
};
const ICON_MAP = {
  '/dashboard': 'DataBoard',
  '/orders': 'Document',
  '/broker-orders': 'Operation',
  '/devices': 'Cpu',
  '/categories': 'Grid',
  '/engineers': 'UserFilled',
  '/users': 'Avatar',
  '/customers': 'User',
  '/inventory': 'Box',
  '/knowledge': 'Reading',
  '/contracts': 'Tickets',
  '/companies': 'OfficeBuilding',
  '/calibrations': 'SetUp',
  '/pm': 'Tools',
  '/audit': 'List',
  '/permissions': 'Key',
  '/dictionaries': 'Collection',
  '/photos': 'Picture',
  '/settlements': 'Coin',
  '/withdrawals': 'Money',
  '/payments': 'Wallet',
  '/commission': 'Setting'
};

const userInfo = computed(() => {
  try { return JSON.parse(localStorage.getItem('admin_user') || '{}'); }
  catch { return {}; }
});
const userName = computed(() => userInfo.value.name || '管理员');
const userRole = computed(() => userInfo.value.role || 'viewer');
const roleLabel = computed(() => ROLES[userRole.value] || userRole.value);
const roleTagType = computed(() => ({ admin: 'danger', manager: 'warning', quality: 'success', engineer_lead: '', viewer: 'info' }[userRole.value] || 'info'));

const visibleMenus = ref([]);
const groupedMenus = ref([]);

function normalizeMenus(apiMenus) {
  const menus = apiMenus.map(m => ({
    path: m.path,
    label: m.label,
    group: m.group || '其他',
    icon: ICON_MAP[m.path] || 'Menu'
  }));

  if (['admin', 'manager', 'engineer_lead'].includes(userRole.value) && !menus.some(m => m.path === '/broker-orders')) {
    const orderIdx = menus.findIndex(m => m.path === '/orders');
    const brokerMenu = { path: '/broker-orders', label: '过程单管理', group: '业务运营', icon: 'Operation' };
    if (orderIdx >= 0) menus.splice(orderIdx + 1, 0, brokerMenu);
    else menus.unshift(brokerMenu);
  }
  return menus;
}

function groupMenus(menus) {
  const groups = [];
  const seen = new Set();
  menus.forEach(m => {
    if (!seen.has(m.group)) {
      seen.add(m.group);
      groups.push({ group: m.group, items: [] });
    }
    const group = groups.find(g => g.group === m.group);
    if (group) group.items.push(m);
  });
  return groups;
}

async function loadMenus() {
  try {
    const res = await api.get('/permission/my');
    const menus = normalizeMenus(res.data?.data || res.data || []);
    visibleMenus.value = menus;
    groupedMenus.value = groupMenus(menus);
  } catch (e) {
    const fallback = normalizeMenus([
      { path: '/dashboard', label: '仪表盘', group: '业务运营' },
      { path: '/orders', label: '工单管理', group: '业务运营' }
    ]);
    visibleMenus.value = fallback;
    groupedMenus.value = groupMenus(fallback);
  }
}

onMounted(loadMenus);

function logout() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
  router.push('/login');
}
</script>

<style lang="scss" scoped>
.layout { height: 100vh; }
.aside { background: #001529; overflow-y: auto; }
.logo {
  padding: 24px 16px;
  text-align: center;
  border-bottom: 1px solid rgba(255,255,255,0.1);

  .logo-img { width: 140px; height: auto; margin-bottom: 8px; }
  p { color: rgba(255,255,255,0.45); font-size: 12px; margin: 4px 0 0; }
}
.header {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e8e8e8;
  padding: 0 24px;
}
.header-title { font-size: 18px; font-weight: 600; }
.header-tools { display: flex; align-items: center; gap: 16px; }
.user-dropdown { cursor: pointer; display: flex; align-items: center; gap: 4px; }
.main { background: #f0f2f5; min-height: calc(100vh - 60px); }
.menu-group-title {
  font-size: 11px;
  color: rgba(255,255,255,0.3);
  padding: 16px 20px 6px;
  text-transform: uppercase;
  letter-spacing: 1px;
}
</style>
