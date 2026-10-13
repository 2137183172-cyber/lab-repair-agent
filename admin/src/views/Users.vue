<template>
  <div class="users-page">
    <el-card shadow="never">
      <div class="toolbar">
        <el-input v-model="keyword" placeholder="搜索用户名/电话/单位" clearable style="width:280px" @keyup.enter="loadUsers" />
        <el-select v-model="roleFilter" placeholder="角色筛选" clearable style="width:150px;margin-left:12px" @change="loadUsers">
          <el-option v-for="(label, val) in staffRoles" :key="val" :label="label" :value="val" />
        </el-select>
        <el-button type="primary" style="margin-left:12px" @click="loadUsers">搜索</el-button>
        <span style="margin-left:12px;font-size:12px;color:#999">仅显示内部人员，客户在「客户管理」</span>
        <el-button type="success" style="margin-left:auto" @click="openCreate">+ 新建用户</el-button>
        <el-button type="warning" style="margin-left:8px" @click="permVisible = true">📋 权限说明</el-button>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-top:16px">
      <el-table :data="users" stripe v-loading="loading">
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column label="登录名" width="130">
          <template #default="{row}">{{ (row.openid || '').replace('admin_', '') }}</template>
        </el-table-column>
        <el-table-column prop="phone" label="电话" width="140" />
        <el-table-column prop="company" label="单位" min-width="160" show-overflow-tooltip />
        <el-table-column prop="role" label="角色" width="100">
          <template #default="{row}">
            <el-tag :type="roleTagColor(row.role)" size="small">{{ roleMap[row.role] || row.role }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{row}">
            <el-tag :type="row.status==='active'?'success':'danger'" size="small">{{ row.status==='active'?'正常':'禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="last_login_at" label="最后登录" width="160">
          <template #default="{row}">{{ row.last_login_at ? new Date(row.last_login_at).toLocaleString() : '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{row}">
            <el-button size="small" type="primary" link @click="showDetail(row)">详情</el-button>
            <el-button size="small" link @click="openEdit(row)">编辑</el-button>
            <el-button v-if="row.role !== 'admin'" size="small" :type="row.status==='active'?'danger':''" link
                       @click="toggleStatus(row)">{{ row.status==='active'?'禁用':'启用' }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="total,prev,pager,next" @current-change="loadUsers" />
      </div>
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="用户详情" width="600px">
      <el-descriptions v-if="currentUser" :column="2" border>
        <el-descriptions-item label="姓名">{{ currentUser.name }}</el-descriptions-item>
        <el-descriptions-item label="登录名">{{ (currentUser.openid || '').replace('admin_', '') }}</el-descriptions-item>
        <el-descriptions-item label="电话">{{ currentUser.phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="角色">{{ roleMap[currentUser.role] }}</el-descriptions-item>
        <el-descriptions-item label="单位">{{ currentUser.company || '-' }}</el-descriptions-item>
        <el-descriptions-item label="部门">{{ currentUser.department || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ currentUser.status === 'active' ? '正常' : '已禁用' }}</el-descriptions-item>
        <el-descriptions-item label="设备数">{{ userDetail.device_count ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="工单数">{{ userDetail.order_count ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="最后登录">{{ currentUser.last_login_at ? new Date(currentUser.last_login_at).toLocaleString() : '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <!-- 新建 / 编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="editForm.id ? '编辑用户' : '新建用户'" width="550px">
      <el-form :model="editForm" label-width="80px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="登录名" v-if="!editForm.id">
              <el-input v-model="editForm.login_name" placeholder="后台登录用的用户名">
                <template #append>.admin</template>
              </el-input>
              <div style="font-size:11px;color:#999;margin-top:4px">登录时输入此名称即可</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="姓名"><el-input v-model="editForm.name" placeholder="真实姓名" /></el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="电话"><el-input v-model="editForm.phone" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="角色">
              <el-select v-model="editForm.role" style="width:100%">
                <el-option v-for="(label, val) in adminRoles" :key="val" :label="label" :value="val" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="单位"><el-input v-model="editForm.company" /></el-form-item>
        <el-form-item label="部门"><el-input v-model="editForm.department" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" @click="saveForm" :loading="saving">{{ editForm.id ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>

    <!-- 权限说明 -->
    <el-dialog v-model="permVisible" title="📋 角色权限一览表" width="900px" top="20px">
      <el-alert type="info" :closable="false" style="margin-bottom:16px">
        每个角色拥有不同的菜单和操作权限，上级角色自动拥有下级的全部权限。
      </el-alert>
      <el-table :data="permTable" border stripe size="small">
        <el-table-column prop="module" label="模块" width="130" fixed />
        <el-table-column v-for="r in roleColumns" :key="r.key" :label="r.label" width="130" align="center">
          <template #default="{row}">
            <el-icon v-if="row[r.key] === 'full'" color="#52C41A" :size="18"><CircleCheckFilled /></el-icon>
            <el-icon v-else-if="row[r.key] === 'view'" color="#1677FF" :size="18"><View /></el-icon>
            <el-icon v-else color="#DDD" :size="18"><RemoveFilled /></el-icon>
          </template>
        </el-table-column>
      </el-table>
      <el-divider />
      <el-descriptions :column="1" border size="small" title="图例">
        <el-descriptions-item label="🟢 full (绿色勾)">
          全部操作权限（增删改查、导入导出）
        </el-descriptions-item>
        <el-descriptions-item label="🔵 view (蓝色眼睛)">
          仅查看，不可修改
        </el-descriptions-item>
        <el-descriptions-item label="⚪ — (灰色横线)">
          无权限，菜单不可见
        </el-descriptions-item>
      </el-descriptions>
      <el-divider />
      <el-descriptions :column="3" border size="small" title="角色说明">
        <el-descriptions-item v-for="r in roleInfo" :key="r.key" :label="r.label">
          Level {{ r.level }} · {{ r.desc }}
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { getUserList, getUserDetail, updateUserStatus, createUser } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/api';

const users = ref([]); const loading = ref(false);
const keyword = ref(''); const roleFilter = ref('');
const page = ref(1); const pageSize = ref(20); const total = ref(0);
const roleMap = { engineer:'工程师', manager:'运营经理', admin:'超级管理员', quality:'质量负责人', engineer_lead:'工程师组长', viewer:'只读用户' };
const staffRoles = { admin:'超级管理员', manager:'运营经理', quality:'质量负责人', engineer_lead:'工程师组长', viewer:'只读用户', engineer:'工程师' };
const adminRoles = { admin:'超级管理员', manager:'运营经理', quality:'质量负责人', engineer_lead:'工程师组长', viewer:'只读用户' };

function roleTagColor(r) {
  const m = { admin:'danger', manager:'warning', quality:'success', engineer_lead:'', viewer:'info', engineer:'warning', user:'info' };
  return m[r] || 'info';
}

const detailVisible = ref(false); const currentUser = ref(null); const userDetail = ref({});

const formVisible = ref(false); const saving = ref(false);
const editForm = reactive({ login_name:'', name:'', phone:'', company:'', department:'', role:'viewer' });

async function loadUsers() {
  loading.value = true;
  try {
    const res = await getUserList({ keyword: keyword.value, role: roleFilter.value, page: page.value, pageSize: pageSize.value });
    users.value = res.data?.list || []; total.value = res.data?.total || 0;
  } catch (e) { ElMessage.error('加载失败'); }
  loading.value = false;
}

async function showDetail(row) {
  currentUser.value = row; detailVisible.value = true;
  try { const res = await getUserDetail(row.id); userDetail.value = res.data || {}; } catch (e) { /* ignore */ }
}

function openCreate() {
  Object.assign(editForm, { id:null, login_name:'', name:'', phone:'', company:'', department:'', role:'viewer' });
  formVisible.value = true;
}
function openEdit(row) {
  Object.assign(editForm, { id:row.id, login_name:'', name:row.name, phone:row.phone||'', company:row.company||'', department:row.department||'', role:row.role });
  formVisible.value = true;
}
async function saveForm() {
  if (!editForm.name) return ElMessage.warning('请填写姓名');
  saving.value = true;
  try {
    if (editForm.id) {
      await api.put(`/admin/users/${editForm.id}`, { name: editForm.name, phone: editForm.phone, company: editForm.company, department: editForm.department, role: editForm.role });
    } else {
      if (!editForm.login_name) return ElMessage.warning('请填写登录名');
      await createUser({ login_name: editForm.login_name, name: editForm.name, phone: editForm.phone, company: editForm.company, department: editForm.department, role: editForm.role });
    }
    ElMessage.success(editForm.id ? '已更新' : '创建成功');
    formVisible.value = false; loadUsers();
  } catch (e) { ElMessage.error(e.response?.data?.message || '保存失败'); }
  saving.value = false;
}

async function toggleStatus(row) {
  const newStatus = row.status === 'active' ? 'disabled' : 'active';
  const action = newStatus === 'active' ? '启用' : '禁用';
  try {
    await ElMessageBox.confirm(`确定要${action}用户「${row.name}」吗？`, '提示', { type: 'warning' });
    await updateUserStatus(row.id, { status: newStatus });
    ElMessage.success(`已${action}`); loadUsers();
  } catch (e) { /* cancelled */ }
}

// 权限说明数据
const permVisible = ref(false);
const roleColumns = [
  { key: 'admin', label: '超级管理员' },
  { key: 'manager', label: '运营经理' },
  { key: 'quality', label: '质量负责人' },
  { key: 'engineer_lead', label: '工程师组长' },
  { key: 'viewer', label: '只读用户' },
];
const roleInfo = [
  { key: 'admin', level: 100, label: '超级管理员', desc: '全部12个模块，增删改查 + 系统配置' },
  { key: 'manager', level: 80, label: '运营经理', desc: '管人管单管合同，不碰系统配置' },
  { key: 'quality', level: 60, label: '质量负责人', desc: '管校准/PM/审计，确保合规' },
  { key: 'engineer_lead', level: 50, label: '工程师组长', desc: '管工程师和备件，看校准和PM' },
  { key: 'viewer', level: 10, label: '只读用户', desc: '仅查看仪表盘/工单/设备/知识库' },
];
const permTable = [
  { module: '📊 仪表盘', admin: 'full', manager: 'full', quality: 'full', engineer_lead: 'full', viewer: 'view' },
  { module: '📋 工单管理', admin: 'full', manager: 'full', quality: 'view', engineer_lead: 'full', viewer: 'view' },
  { module: '🔬 设备管理', admin: 'full', manager: 'full', quality: 'view', engineer_lead: 'view', viewer: 'view' },
  { module: '🔧 工程师管理', admin: 'full', manager: 'full', quality: '—', engineer_lead: 'full', viewer: '—' },
  { module: '👤 用户管理', admin: 'full', manager: 'full', quality: '—', engineer_lead: '—', viewer: '—' },
  { module: '📦 备件库存', admin: 'full', manager: 'view', quality: '—', engineer_lead: 'full', viewer: '—' },
  { module: '📚 知识库', admin: 'full', manager: 'full', quality: 'full', engineer_lead: 'full', viewer: 'view' },
  { module: '📄 服务合同', admin: 'full', manager: 'full', quality: 'view', engineer_lead: '—', viewer: '—' },
  { module: '🏢 集团客户', admin: 'full', manager: '—', quality: '—', engineer_lead: '—', viewer: '—' },
  { module: '📅 校准管理', admin: 'full', manager: '—', quality: 'full', engineer_lead: 'view', viewer: '—' },
  { module: '🔧 预防性维护', admin: 'full', manager: '—', quality: 'full', engineer_lead: 'full', viewer: '—' },
  { module: '📋 审计追踪', admin: 'full', manager: '—', quality: 'full', engineer_lead: '—', viewer: '—' },
];

import { onMounted } from 'vue';
onMounted(loadUsers);
</script>

<style scoped>
.toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
</style>
