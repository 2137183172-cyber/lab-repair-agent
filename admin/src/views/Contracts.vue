<template>
  <div class="contracts-page">
    <el-card shadow="never">
      <div class="toolbar">
        <el-input v-model="keyword" placeholder="搜索合同编号/名称" clearable style="width:240px" @keyup.enter="loadData" />
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width:130px;margin-left:12px" @change="loadData">
          <el-option label="生效中" value="active" />
          <el-option label="即将到期" value="expiring" />
          <el-option label="已过期" value="expired" />
        </el-select>
        <el-select v-model="typeFilter" placeholder="类型" clearable style="width:120px;margin-left:12px" @change="loadData">
          <el-option label="保修" value="warranty" />
          <el-option label="维保" value="maintenance" />
          <el-option label="全包" value="full_service" />
          <el-option label="按需" value="on_demand" />
        </el-select>
        <el-tag v-if="expiringCount > 0" type="warning" style="margin-left:12px">{{ expiringCount }} 个合同即将到期</el-tag>
        <el-button type="success" style="margin-left:8px" @click="exportData">📥 导出</el-button>
        <el-button type="primary" style="margin-left:8px" @click="openAdd">+ 新建合同</el-button>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-top:16px">
      <el-table :data="items" stripe v-loading="loading">
        <el-table-column prop="contract_no" label="合同编号" width="150" />
        <el-table-column prop="title" label="合同名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="client.name" label="客户" width="120" />
        <el-table-column prop="client.company" label="单位" width="140" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="80">
          <template #default="{row}">{{ {warranty:'保修',maintenance:'维保',full_service:'全包',on_demand:'按需'}[row.type] || row.type }}</template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="100" sortable>
          <template #default="{row}">¥{{ row.amount }}</template>
        </el-table-column>
        <el-table-column prop="start_date" label="开始" width="100" />
        <el-table-column prop="end_date" label="到期" width="100" sortable>
          <template #default="{row}">
            <span :style="{color: isExpiringSoon(row.end_date) ? '#FF4D4F' : ''}">{{ row.end_date }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{row}">
            <el-tag :type="row.status==='active'?'success':row.status==='expiring'?'warning':'info'" size="small">
              {{ {active:'生效中',expiring:'即将到期',expired:'已过期',terminated:'已终止'}[row.status] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="关联工单" width="160">
          <template #default="{row}">
            <template v-if="row.order_nos && row.order_nos.length">
              <el-tag v-for="no in row.order_nos" :key="no" size="small" style="margin:2px;cursor:pointer" type="success" @click="goOrder(no)">{{ no }}</el-tag>
            </template>
            <span v-else style="color:#CCC">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{row}">
            <el-button size="small" type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="row.status === 'active'" size="small" type="danger" @click="handleTerminate(row)">终止</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="total,prev,pager,next" @current-change="loadData" />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editForm.id ? '编辑合同' : '新建合同'" width="650px">
      <el-form :model="editForm" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="合同编号"><el-input v-model="editForm.contract_no" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="合同名称"><el-input v-model="editForm.title" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="客户ID"><el-input-number v-model="editForm.user_id" :min="1" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="类型">
            <el-select v-model="editForm.type" style="width:100%">
              <el-option label="维保" value="maintenance" /><el-option label="保修" value="warranty" />
              <el-option label="全包" value="full_service" /><el-option label="按需" value="on_demand" />
            </el-select>
          </el-form-item></el-col>
          <el-col :span="8"><el-form-item label="金额"><el-input-number v-model="editForm.amount" :min="0" :precision="2" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="开始日期"><el-date-picker v-model="editForm.start_date" type="date" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="结束日期"><el-date-picker v-model="editForm.end_date" type="date" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="联系人"><el-input v-model="editForm.contact_name" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="电话"><el-input v-model="editForm.contact_phone" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="关联工单">
          <el-select v-model="editForm.order_nos" multiple filterable
            placeholder="选择工单（可输入关键词过滤）" style="width:100%" @focus="loadOrderOpts">
            <el-option v-for="o in orderOptions" :key="o.order_no" :label="`${o.order_no} — ${o.device?.name||'未知设备'} (${statusMap[o.status]})`" :value="o.order_no" />
          </el-select>
          <span style="font-size:11px;color:#999">点开下拉选择工单，可输入关键词过滤。列表中点工单号标签可跳转</span>
        </el-form-item>
        <el-form-item label="服务范围"><el-input v-model="editForm.scope" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="附件">
          <div v-for="(f,i) in editForm.attachments" :key="i" style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:13px">{{ f.name }}</span>
            <span style="font-size:11px;color:#999">({{ formatSize(f.size) }})</span>
            <a :href="f.url" target="_blank" style="font-size:12px;color:#1677FF">预览</a>
            <el-button size="small" type="danger" @click="editForm.attachments.splice(i,1)">删</el-button>
          </div>
          <el-upload :show-file-list="false" :before-upload="beforeUpload" :http-request="uploadFile" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip">
            <el-button size="small" type="primary">📎 上传附件</el-button>
          </el-upload>
          <span style="font-size:11px;color:#BBB;margin-left:8px">支持 PDF/Word/Excel/PPT/ZIP</span>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="editForm.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/api';

const router = useRouter();

const items = ref([]); const loading = ref(false);
const keyword = ref(''); const statusFilter = ref(''); const typeFilter = ref('');
const page = ref(1); const pageSize = ref(20); const total = ref(0); const expiringCount = ref(0);

const orderOptions = ref([]); const searchLoading = ref(false);
const statusMap = { pending:'待接单', accepted:'已接单', diagnosing:'诊断中', quoted:'待审批/支付', paid:'已支付', repairing:'维修中', completed:'维修完成', pending_review:'待评价', confirmed:'已验收', cancelled:'已取消' };

const dialogVisible = ref(false); const saving = ref(false);
const editForm = reactive({ user_id:null, contract_no:'', title:'', type:'maintenance', scope:'', order_nos:[], start_date:'', end_date:'', amount:0, contact_name:'', contact_phone:'', notes:'', attachments:[] });

function formatSize(s) { if(!s)return''; return s>1048576?(s/1048576).toFixed(1)+'MB':(s/1024).toFixed(1)+'KB'; }
async function uploadFile(options) {
  const fd = new FormData(); fd.append('file', options.file);
  try {
    const res = await api.post('/upload/file', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    const data = res.data?.data || res.data;
    editForm.attachments.push({ name: data.name || options.file.name, url: data.url, size: data.size || options.file.size });
    ElMessage.success('上传成功');
  } catch(e) { ElMessage.error('上传失败'); }
}
function beforeUpload(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['pdf','doc','docx','xls','xlsx','ppt','pptx','zip','rar'].includes(ext)) { ElMessage.error('不支持的文件类型'); return false; }
  if (file.size > 10*1024*1024) { ElMessage.error('文件不超过10MB'); return false; }
  return true;
}
function isExpiringSoon(date) {
  if (!date) return false;
  const d = new Date(date), now = new Date();
  const diff = (d - now) / (1000 * 60 * 60 * 24);
  return diff > 0 && diff <= 30;
}

async function loadData() {
  loading.value = true;
  try {
    const res = await api.get('/contract/list', { params: { keyword: keyword.value, status: statusFilter.value, type: typeFilter.value, page: page.value, pageSize: pageSize.value } });
    items.value = res.data?.list || [];
    total.value = res.data?.total || 0;
    expiringCount.value = res.data?.expiring_count || 0;
  } catch (e) { ElMessage.error('加载失败'); }
  loading.value = false;
}

function openAdd() {
  Object.assign(editForm, { id:null, user_id:null, contract_no:'', title:'', type:'maintenance', scope:'', order_nos:[], start_date:'', end_date:'', amount:0, contact_name:'', contact_phone:'', notes:'', attachments:[] });
  dialogVisible.value = true;
}
async function loadOrderOpts() {
  if (orderOptions.value.length > 0) return;
  searchLoading.value = true;
  try {
    const res = await api.get('/order/list', { params: { pageSize: 100 } });
    orderOptions.value = res.data?.list || res.data?.list || [];
  } catch(e) { orderOptions.value = []; }
  searchLoading.value = false;
}
function goOrder(no) { router.push('/orders'); }
function openEdit(row) {
  Object.assign(editForm, { ...row });
  dialogVisible.value = true;
}
async function saveEdit() {
  saving.value = true;
  try {
    if (editForm.id) {
      await api.put(`/contract/update/${editForm.id}`, editForm);
    } else {
      await api.post('/contract/create', editForm);
    }
    ElMessage.success('保存成功'); dialogVisible.value = false; loadData();
  } catch (e) { ElMessage.error('保存失败'); }
  saving.value = false;
}
async function handleTerminate(row) {
  try {
    await ElMessageBox.confirm(`确定终止合同「${row.title}」？`, '提示', { type: 'warning' });
    await api.put(`/contract/update/${row.id}`, { status: 'terminated' });
    ElMessage.success('已终止'); loadData();
  } catch (e) { /* cancelled */ }
}
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除合同「${row.title}」？`, '删除', { type: 'warning' });
    await api.delete(`/contract/delete/${row.id}`);
    ElMessage.success('已删除'); loadData();
  } catch (e) { /* cancelled */ }
}
function exportData() {
  const csv = ['合同编号,名称,客户,类型,金额,开始,到期,状态'].concat(items.value.map(c=>[c.contract_no,c.title,c.client?.name||'',c.type,c.amount,c.start_date,c.end_date,c.status].join(','))).join('\n');
  const b=new Blob(['﻿'+csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='合同列表.csv'; a.click();
}

import { onMounted } from 'vue';
onMounted(loadData);
</script>

<style scoped>
.toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
</style>
