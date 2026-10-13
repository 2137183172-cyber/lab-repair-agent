<template>
  <div class="companies-page">
    <el-card shadow="never">
      <div class="toolbar">
        <el-input v-model="keyword" placeholder="搜索公司名/联系人" clearable style="width:240px" @keyup.enter="loadData" />
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width:120px;margin-left:12px" @change="loadData">
          <el-option label="启用" value="active" /><el-option label="停用" value="inactive" />
        </el-select>
        <el-button type="primary" style="margin-left:auto" @click="openAdd">+ 新建公司</el-button>
        <el-button type="success" style="margin-left:8px" @click="exportData">📥 导出</el-button>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-top:16px">
      <el-table :data="items" stripe v-loading="loading">
        <el-table-column prop="name" label="公司名称" min-width="200" />
        <el-table-column prop="short_name" label="简称" width="100" />
        <el-table-column prop="code" label="编码" width="100" />
        <el-table-column prop="industry" label="行业" width="100">
          <template #default="{row}">{{ {pharma:'制药',biotech:'生物技术',cro:'CRO',ivd:'体外诊断',academic:'学术'}[row.industry] || row.industry }}</template>
        </el-table-column>
        <el-table-column prop="subscription_type" label="订阅" width="80">
          <template #default="{row}"><el-tag size="small" :type="row.subscription_type==='enterprise'?'danger':row.subscription_type==='pro'?'warning':'info'">{{ row.subscription_type }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="user_count" label="用户" width="60" />
        <el-table-column prop="device_count" label="设备" width="60" />
        <el-table-column prop="order_count" label="工单" width="60" />
        <el-table-column prop="status" label="状态" width="70">
          <template #default="{row}"><el-tag :type="row.status==='active'?'success':'info'" size="small">{{ row.status==='active'?'启用':'停用' }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="contact_name" label="联系人" width="100" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{row}">
            <el-button size="small" type="primary" @click="showDetail(row.id)">详情</el-button>
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="total,prev,pager,next" @current-change="loadData" />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editForm.id ? '编辑公司' : '新建公司'" width="600px">
      <el-form :model="editForm" label-width="80px">
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="公司名称"><el-input v-model="editForm.name" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="简称"><el-input v-model="editForm.short_name" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="编码"><el-input v-model="editForm.code" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="行业">
            <el-select v-model="editForm.industry" style="width:100%">
              <el-option label="制药" value="pharma" /><el-option label="生物技术" value="biotech" />
              <el-option label="CRO" value="cro" /><el-option label="体外诊断" value="ivd" /><el-option label="学术" value="academic" />
            </el-select>
          </el-form-item></el-col>
          <el-col :span="8"><el-form-item label="订阅">
            <el-select v-model="editForm.subscription_type" style="width:100%">
              <el-option label="免费" value="free" /><el-option label="基础" value="basic" />
              <el-option label="专业版" value="pro" /><el-option label="企业版" value="enterprise" />
            </el-select>
          </el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="联系人"><el-input v-model="editForm.contact_name" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="电话"><el-input v-model="editForm.contact_phone" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="邮箱"><el-input v-model="editForm.contact_email" /></el-form-item>
        <el-form-item label="地址"><el-input v-model="editForm.address" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="设备上限"><el-input-number v-model="editForm.max_devices" :min="1" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="用户上限"><el-input-number v-model="editForm.max_users" :min="1" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="备注"><el-input v-model="editForm.notes" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="公司详情" width="700px">
      <template v-if="companyDetail.company">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="名称">{{ companyDetail.company.name }}</el-descriptions-item>
          <el-descriptions-item label="订阅">{{ companyDetail.company.subscription_type }}</el-descriptions-item>
          <el-descriptions-item label="用户数">{{ companyDetail.users?.length }}</el-descriptions-item>
          <el-descriptions-item label="设备数">{{ companyDetail.devices?.length }}</el-descriptions-item>
          <el-descriptions-item label="联系人">{{ companyDetail.company.contact_name }}</el-descriptions-item>
          <el-descriptions-item label="电话">{{ companyDetail.company.contact_phone }}</el-descriptions-item>
        </el-descriptions>
        <div style="margin-top:16px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h4>成员 ({{ companyDetail.users?.length || 0 }})</h4>
            <el-button size="small" type="primary" @click="openAddMember">+ 添加成员</el-button>
          </div>
          <el-table :data="companyDetail.users" size="small" stripe v-if="companyDetail.users?.length">
            <el-table-column prop="name" label="姓名" /><el-table-column prop="phone" label="电话" />
            <el-table-column prop="role" label="角色" /><el-table-column prop="status" label="状态" />
            <el-table-column label="操作" width="80">
              <template #default="{row}"><el-button size="small" type="danger" @click="removeMember(row)">移除</el-button></template>
            </el-table-column>
          </el-table>
          <div v-else style="color:#CCC;text-align:center;padding:20px">暂无成员</div>
        </div>
      </template>
    </el-dialog>

    <!-- 添加成员 -->
    <el-dialog v-model="memberVisible" title="添加成员" width="500px">
      <el-select v-model="selectedUserId" placeholder="搜索用户" filterable remote
        :remote-method="searchUsers" :loading="userSearchLoading" style="width:100%">
        <el-option v-for="u in userOptions" :key="u.id" :label="`${u.name} (${u.phone||''}) — ${u.company||''}`" :value="u.id" />
      </el-select>
      <template #footer>
        <el-button @click="memberVisible=false">取消</el-button>
        <el-button type="primary" @click="doAddMember" :loading="addingMember">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'; import { ElMessage } from 'element-plus'; import api from '@/api';
const items = ref([]); const loading = ref(false); const keyword = ref(''); const statusFilter = ref('');
const page = ref(1); const pageSize = ref(20); const total = ref(0);
const dialogVisible = ref(false); const saving = ref(false); const detailVisible = ref(false); const companyDetail = ref({});
const editForm = reactive({ name:'',short_name:'',code:'',industry:'',subscription_type:'free',contact_name:'',contact_phone:'',contact_email:'',address:'',max_devices:50,max_users:10,notes:'' });

async function loadData() { loading.value = true; try { const res = await api.get('/company/list', { params: { keyword: keyword.value, status: statusFilter.value, page: page.value, pageSize: pageSize.value } }); items.value = res.data?.list || []; total.value = res.data?.total || 0; } catch (e) { ElMessage.error('加载失败'); } loading.value = false; }
function openAdd() { Object.assign(editForm, { id:null,name:'',short_name:'',code:'',industry:'',subscription_type:'free',contact_name:'',contact_phone:'',contact_email:'',address:'',max_devices:50,max_users:10,notes:'' }); dialogVisible.value = true; }
function openEdit(row) { Object.assign(editForm, { ...row }); dialogVisible.value = true; }
async function saveEdit() { saving.value = true; try { if (editForm.id) { await api.put(`/company/update/${editForm.id}`, editForm); } else { await api.post('/company/create', editForm); } ElMessage.success('保存成功'); dialogVisible.value = false; loadData(); } catch (e) { ElMessage.error('保存失败'); } saving.value = false; }
const memberVisible = ref(false); const selectedUserId = ref(null);
const userOptions = ref([]); const userSearchLoading = ref(false); const addingMember = ref(false);

async function searchUsers(query) {
  if (!query) { userOptions.value = []; return; }
  userSearchLoading.value = true;
  try {
    const res = await api.get('/admin/users', { params: { keyword: query, pageSize: 20 } });
    userOptions.value = (res.data?.list || []).filter(u => !u.company_id);
  } catch(e) { userOptions.value = []; }
  userSearchLoading.value = false;
}
function openAddMember() { selectedUserId.value = null; userOptions.value = []; memberVisible.value = true; searchUsers(''); }
async function doAddMember() {
  if (!selectedUserId.value) return;
  addingMember.value = true;
  try {
    await api.put('/admin/users/'+selectedUserId.value, { company_id: companyDetail.value.company?.id });
    ElMessage.success('已添加'); memberVisible.value = false;
    const res = await api.get('/company/'+companyDetail.value.company.id);
    companyDetail.value = res.data || {};
  } catch(e) { ElMessage.error('添加失败'); }
  addingMember.value = false;
}
async function removeMember(row) {
  try {
    await api.put('/admin/users/'+row.id, { company_id: null });
    ElMessage.success('已移除'); companyDetail.value.users = companyDetail.value.users.filter(u=>u.id!==row.id);
  } catch(e) { ElMessage.error('移除失败'); }
}

async function showDetail(id) { detailVisible.value = true; try { const res = await api.get('/company/'+id); companyDetail.value = res.data || {}; } catch (e) { ElMessage.error('加载失败'); } }

async function handleDelete(row) { try { await ElMessageBox.confirm('确定删除？','警告',{type:'warning'}); await api.delete('/company/delete/'+row.id); ElMessage.success('已删除'); loadData(); } catch(e){} }
function exportData() { const csv=['名称,简称,行业,订阅,用户数,设备数,工单数'].concat(items.value.map(c=>[c.name,c.short_name,c.industry,c.subscription_type,c.user_count,c.device_count,c.order_count].join(','))).join('\n'); const b=new Blob(['﻿'+csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='公司列表.csv'; a.click(); }
import { ElMessageBox } from 'element-plus';
import { onMounted } from 'vue'; onMounted(loadData);
</script>
<style scoped>.toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }</style>
