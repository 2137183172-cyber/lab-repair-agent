<template>
  <div class="customers-page">
    <el-card shadow="never">
      <div class="toolbar">
        <el-input v-model="keyword" placeholder="搜索客户名称/电话/单位" clearable style="width:280px" @keyup.enter="loadData" />
        <el-button type="primary" style="margin-left:12px" @click="loadData">搜索</el-button>
        <el-button type="success" style="margin-left:auto" @click="openCreate">+ 新建客户</el-button>
        <el-button type="success" style="margin-left:8px" @click="exportData">📥 导出</el-button>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-top:16px">
      <el-table :data="customers" stripe v-loading="loading" @row-click="showDetail" style="cursor:pointer">
        <el-table-column prop="name" label="客户姓名" width="100" />
        <el-table-column label="登录名" width="100">
          <template #default="{row}">{{ (row.openid || '').replace('dev_', '') }}</template>
        </el-table-column>
        <el-table-column prop="phone" label="电话" width="130" />
        <el-table-column prop="company" label="单位/公司" min-width="180" show-overflow-tooltip />
        <el-table-column prop="department" label="部门/实验室" width="140" show-overflow-tooltip />
        <el-table-column prop="device_count" label="设备数" width="80" sortable />
        <el-table-column prop="order_count" label="工单数" width="80" sortable />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{row}">
            <el-tag v-if="row.status==='active'" type="success" size="small">已审核</el-tag>
            <el-tag v-else-if="row.status==='pending'" type="warning" size="small">待审核</el-tag>
            <el-tag v-else type="info" size="small">已禁用</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="last_login_at" label="最后登录" width="160">
          <template #default="{row}">{{ row.last_login_at ? new Date(row.last_login_at).toLocaleString() : '-' }}</template>
        </el-table-column>
        <el-table-column prop="created_at" label="注册时间" width="110">
          <template #default="{row}">{{ new Date(row.created_at).toLocaleDateString() }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{row}">
            <el-button size="small" type="primary" link @click.stop="showDetail(row)">详情</el-button>
            <el-button size="small" link @click.stop="openEdit(row)">编辑</el-button>
            <el-button v-if="row.status==='pending'" size="small" type="success" link @click.stop="approve(row)">审核通过</el-button>
            <el-button v-else size="small" type="danger" link @click.stop="toggleStatus(row)">{{ row.status==='active'?'禁用':'启用' }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="total,prev,pager,next" @current-change="loadData" />
      </div>
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="客户详情" width="700px">
      <template v-if="currentCustomer">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="姓名">{{ currentCustomer.name }}</el-descriptions-item>
          <el-descriptions-item label="登录名">{{ (currentCustomer.openid||'').replace('dev_','') }}</el-descriptions-item>
          <el-descriptions-item label="电话">{{ currentCustomer.phone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="单位">{{ currentCustomer.company || '-' }}</el-descriptions-item>
          <el-descriptions-item label="部门">{{ currentCustomer.department || '-' }}</el-descriptions-item>
          <el-descriptions-item label="注册时间">{{ new Date(currentCustomer.created_at).toLocaleString() }}</el-descriptions-item>
        </el-descriptions>
        <div style="margin-top:16px">
          <el-row :gutter="12">
            <el-col :span="8"><el-statistic title="设备数" :value="custDetail.device_count||0" /></el-col>
            <el-col :span="8"><el-statistic title="工单数" :value="custDetail.order_count||0" /></el-col>
            <el-col :span="8"><el-statistic title="合同数" :value="custDetail.contract_count||0" /></el-col>
          </el-row>
        </div>
        <div v-if="custDetail.recent_orders?.length" style="margin-top:12px">
          <h4>最近工单</h4>
          <el-table :data="custDetail.recent_orders" size="small" stripe>
            <el-table-column prop="order_no" label="工单号" width="180" />
            <el-table-column prop="device?.name" label="设备" width="140" />
            <el-table-column prop="status" label="状态" width="80" />
            <el-table-column prop="created_at" label="时间" width="150" />
          </el-table>
        </div>
      </template>
    </el-dialog>

    <!-- 新建/编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="editForm.id ? '编辑客户' : '新建客户'" width="500px">
      <el-form :model="editForm" label-width="80px">
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="登录名" v-if="!editForm.id"><el-input v-model="editForm.login_name" placeholder="小程序登录标识" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="姓名"><el-input v-model="editForm.name" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="电话"><el-input v-model="editForm.phone" /></el-form-item>
        <el-form-item label="单位"><el-input v-model="editForm.company" /></el-form-item>
        <el-form-item label="公司">
          <el-select v-model="editForm.company_id" placeholder="选择归属公司" clearable filterable style="width:100%" @focus="loadCompanies">
            <el-option v-for="c in companyOpts" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="部门"><el-input v-model="editForm.department" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible=false">取消</el-button>
        <el-button type="primary" @click="saveForm" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/api';

const customers = ref([]); const loading = ref(false); const keyword = ref('');
const page = ref(1); const pageSize = ref(20); const total = ref(0);

const detailVisible = ref(false); const currentCustomer = ref(null); const custDetail = ref({});
const formVisible = ref(false); const saving = ref(false);
const editForm = reactive({ login_name:'', name:'', phone:'', company:'', company_id:null, department:'' });
const companyOpts = ref([]);
async function loadCompanies() {
  try {
    const r = await api.get('/company/list', { params: { pageSize: 100 } });
    companyOpts.value = r.data?.list || r.data?.list || [];
  } catch(e) {}
}

async function loadData() {
  loading.value = true;
  try {
    // 只查 role='user' 的客户
    const res = await api.get('/admin/users', { params: { role: 'user', keyword: keyword.value, page: page.value, pageSize: pageSize.value } });
    const list = res.data?.list || res.data?.list || [];
    total.value = res.data?.total || res.data?.total || 0;
    // 统计每个客户的设备和工单
    for (const c of list) {
      try {
        const d = await api.get('/admin/users/' + c.id);
        c.device_count = d.data?.device_count || d.data?.device_count || 0;
        c.order_count = d.data?.order_count || d.data?.order_count || 0;
      } catch(e) { c.device_count = 0; c.order_count = 0; }
    }
    customers.value = list;
  } catch (e) { ElMessage.error('加载失败'); }
  loading.value = false;
}

async function showDetail(row) {
  currentCustomer.value = row; detailVisible.value = true;
  try {
    const res = await api.get('/admin/users/' + row.id);
    custDetail.value = res.data?.data || res.data || {};
  } catch(e) {}
}

function openCreate() {
  Object.assign(editForm, { id:null, login_name:'', name:'', phone:'', company:'', company_id:null, department:'' });
  formVisible.value = true;
}
function openEdit(row) {
  Object.assign(editForm, { id:row.id, login_name:'', name:row.name, phone:row.phone||'', company:row.company||'', company_id:row.company_id||null, department:row.department||'' });
  formVisible.value = true;
}
async function saveForm() {
  saving.value = true;
  try {
    if (editForm.id) {
      await api.put('/admin/users/' + editForm.id, editForm);
    } else {
      await api.post('/admin/users', { login_name: editForm.login_name, name: editForm.name, phone: editForm.phone, company: editForm.company, department: editForm.department, role: 'user' });
    }
    ElMessage.success('已保存'); formVisible.value = false; loadData();
  } catch(e) { ElMessage.error('保存失败'); }
  saving.value = false;
}
async function approve(row) {
  try {
    await api.put('/admin/users/' + row.id + '/status', { status: 'active' });
    ElMessage.success('审核通过，客户现在可以登录了');
    loadData();
  } catch(e) { ElMessage.error('操作失败'); }
}
async function toggleStatus(row) {
  const ns = row.status === 'active' ? 'disabled' : 'active';
  try {
    await ElMessageBox.confirm(`确定${ns==='active'?'启用':'禁用'}该客户？`, '提示', { type: 'warning' });
    await api.put('/admin/users/' + row.id + '/status', { status: ns });
    ElMessage.success('已' + (ns==='active'?'启用':'禁用')); loadData();
  } catch(e) {}
}
function exportData() {
  const csv = ['姓名,电话,单位,部门,设备数,工单数,注册时间'].concat(customers.value.map(c => [c.name,c.phone,c.company,c.department,c.device_count,c.order_count,c.created_at].join(','))).join('\n');
  const b = new Blob(['﻿'+csv],{type:'text/csv'}); const a = document.createElement('a'); a.href=URL.createObjectURL(b); a.download='客户列表.csv'; a.click();
}

import { onMounted } from 'vue'; onMounted(loadData);
</script>
<style scoped>.toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px}</style>
