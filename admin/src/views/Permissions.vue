<template>
  <div class="perm-page">
    <el-card shadow="never">
      <div class="toolbar">
        <span style="font-size:16px;font-weight:600">🔐 角色权限自由配置</span>
        <el-button type="primary" style="margin-left:16px" @click="initDefaults" :loading="seeding">恢复默认</el-button>
        <el-tag type="warning" style="margin-left:12px">修改后即时生效，无需重启</el-tag>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-top:16px">
      <el-tabs v-model="activeRole" @tab-change="loadPerms">
        <el-tab-pane v-for="r in roles" :key="r.key" :label="r.label" :name="r.key" />
      </el-tabs>

      <el-table :data="permRows" stripe size="small" v-loading="loading">
        <el-table-column prop="label" label="菜单模块" width="160" />
        <el-table-column label="权限级别" width="320">
          <template #default="{row}">
            <el-radio-group v-model="row.access" @change="markDirty">
              <el-radio-button value="full">🟢 完整操作</el-radio-button>
              <el-radio-button value="view">🔵 仅查看</el-radio-button>
              <el-radio-button value="none">⚪ 不可见</el-radio-button>
            </el-radio-group>
          </template>
        </el-table-column>
        <el-table-column label="说明">
          <template #default="{row}">
            <span v-if="row.access==='full'" style="color:#52C41A">可增删改查全部操作</span>
            <span v-else-if="row.access==='view'" style="color:#1677FF">仅可查看列表和详情</span>
            <span v-else style="color:#CCC">左侧菜单不显示此项</span>
          </template>
        </el-table-column>
      </el-table>

      <div style="margin-top:20px;text-align:right">
        <el-button type="primary" size="large" @click="save" :loading="saving">💾 保存「{{ roleLabel }}」的权限</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import api from '@/api';

const roles = [
  { key: 'admin', label: '超级管理员' },
  { key: 'manager', label: '运营经理' },
  { key: 'quality', label: '质量负责人' },
  { key: 'engineer_lead', label: '工程师组长' },
  { key: 'viewer', label: '只读用户' },
];
const allMenus = ref([]); // from API
const rolePerms = ref({}); // { role: { path: access } }

const activeRole = ref('admin');
const loading = ref(false); const saving = ref(false); const seeding = ref(false);
const permRows = ref([]);
const dirty = ref(false);

const roleLabel = computed(() => roles.find(r => r.key === activeRole.value)?.label || '');

// Load all menus + permissions
async function loadMenus() {
  try {
    const [menuRes, permRes] = await Promise.all([
      api.get('/permission/menus'),
      api.get('/permission/roles')
    ]);
    allMenus.value = menuRes.data || [];
    rolePerms.value = permRes.data || {};
  } catch (e) { ElMessage.error('加载菜单失败'); }
}

async function loadPerms() {
  if (allMenus.value.length === 0) await loadMenus();
  loading.value = true;
  const currentPerms = rolePerms.value[activeRole.value] || {};
  permRows.value = allMenus.value.map(m => ({
    path: m.path,
    label: m.label,
    access: currentPerms[m.path] || 'none'
  }));
  dirty.value = false;
  loading.value = false;
}

function markDirty() { dirty.value = true; }

async function save() {
  saving.value = true;
  const permissions = {};
  permRows.value.forEach(r => { permissions[r.path] = r.access; });
  try {
    await api.put('/permission/save', { role: activeRole.value, permissions });
    // Update local cache
    rolePerms.value[activeRole.value] = permissions;
    ElMessage.success('权限已保存，用户刷新页面后生效');
    dirty.value = false;
  } catch (e) { ElMessage.error('保存失败'); }
  saving.value = false;
}

async function initDefaults() {
  seeding.value = true;
  try {
    await api.post('/permission/seed');
    await loadMenus();
    await loadPerms();
    ElMessage.success('已恢复默认权限');
  } catch (e) { ElMessage.error('初始化失败'); }
  seeding.value = false;
}

import { onMounted } from 'vue';
onMounted(loadPerms);
</script>

<style scoped>
.toolbar { display:flex; align-items:center; }
</style>
