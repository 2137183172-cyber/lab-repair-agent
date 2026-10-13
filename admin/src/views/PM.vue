<template>
  <div class="pm-page">
    <el-tabs v-model="activeTab" @tab-change="loadData">
      <el-tab-pane label="PM记录" name="records" />
      <el-tab-pane label="PM模板" name="templates" />
    </el-tabs>

    <!-- PM Records -->
    <template v-if="activeTab === 'records'">
      <el-card shadow="never">
        <div class="toolbar">
          <el-select v-model="statusFilter" placeholder="状态" clearable style="width:130px" @change="loadData">
            <el-option label="待执行" value="scheduled" /><el-option label="执行中" value="in_progress" />
            <el-option label="已完成" value="completed" /><el-option label="已逾期" value="overdue" />
          </el-select>
          <el-tag v-if="overdueCount>0" type="danger" style="margin-left:12px">{{ overdueCount }} 条已逾期</el-tag>
          <el-button style="margin-left:auto" @click="genVisible=true">从模板生成PM任务</el-button>
        </div>
      </el-card>
      <el-card shadow="never" style="margin-top:16px">
        <el-table :data="records" stripe v-loading="loading">
          <el-table-column label="设备/客户" min-width="200">
            <template #default="{row}">{{ row.device?.name }} <span style="color:#999;font-size:12px">{{ row.device?.owner?.company || row.device?.company?.name || '' }}</span></template>
          </el-table-column>
          <el-table-column prop="title" label="任务" min-width="180" />
          <el-table-column prop="scheduled_at" label="计划日期" width="110" sortable />
          <el-table-column prop="performed_at" label="执行日期" width="110" />
          <el-table-column prop="performed_by" label="执行人" width="100" />
          <el-table-column prop="status" label="状态" width="90">
            <template #default="{row}">
              <el-tag :type="row.status==='completed'?'success':row.status==='overdue'?'danger':row.status==='in_progress'?'warning':'info'" size="small">
                {{ {scheduled:'待执行',in_progress:'执行中',completed:'已完成',overdue:'逾期',cancelled:'已取消'}[row.status] }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160">
            <template #default="{row}">
              <el-select v-model="row.status" size="small" style="width:130px" @change="changePMStatus(row,$event)">
                <el-option label="待执行" value="scheduled" />
                <el-option label="执行中" value="in_progress" />
                <el-option label="已完成" value="completed" />
                <el-option label="已逾期" value="overdue" />
                <el-option label="已取消" value="cancelled" />
              </el-select>
            </template>
          </el-table-column>
        </el-table>
        <div style="margin-top:16px;text-align:right">
          <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="total,prev,pager,next" @current-change="loadData" />
        </div>
      </el-card>
    </template>

    <!-- PM Templates -->
    <template v-if="activeTab === 'templates'">
      <el-card shadow="never">
        <div class="toolbar"><el-button type="primary" @click="openTplAdd">+ 新建模板</el-button></div>
      </el-card>
      <el-card shadow="never" style="margin-top:16px">
        <el-table :data="templates" stripe v-loading="loading">
          <el-table-column prop="template_name" label="模板名称" width="180" />
          <el-table-column prop="instrument_category?.name" label="适用设备分类" width="150" />
          <el-table-column prop="title" label="维护任务" min-width="200" />
          <el-table-column prop="frequency_days" label="周期(天)" width="90" />
          <el-table-column prop="estimated_hours" label="工时" width="70" />
          <el-table-column label="操作" width="100">
            <template #default="{row}"><el-button size="small" @click="editTpl(row)">编辑</el-button><el-button size="small" type="danger" @click="deleteTpl(row.id)">删除</el-button></template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>

    <!-- Generate Dialog -->
    <el-dialog v-model="genVisible" title="从模板生成PM任务" width="450px">
      <el-form label-width="80px">
        <el-form-item label="设备">
          <el-select v-model="genDeviceId" placeholder="选择设备" filterable clearable style="width:100%" @focus="loadDevices">
            <el-option v-for="d in deviceOpts" :key="d.id" :label="`${d.name} (${d.model||''}) 🏢${d.owner?.company||''}`" :value="d.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="genVisible=false">取消</el-button><el-button type="primary" @click="doGenerate">生成</el-button></template>
    </el-dialog>

    <!-- Template Dialog -->
    <el-dialog v-model="tplVisible" title="新建PM模板" width="500px">
      <el-form :model="tplForm" label-width="100px">
        <el-form-item label="模板名称"><el-input v-model="tplForm.template_name" /></el-form-item>
        <el-form-item label="适用设备分类">
          <el-select v-model="tplForm.instrument_type" placeholder="选择设备分类" filterable clearable style="width:100%" @focus="loadCatOpts">
            <el-option v-for="c in catOpts" :key="c.id" :label="c._label" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="任务名称"><el-input v-model="tplForm.title" /></el-form-item>
        <el-form-item label="周期(天)"><el-input-number v-model="tplForm.frequency_days" :min="1" style="width:100%" /></el-form-item>
        <el-form-item label="预计工时"><el-input-number v-model="tplForm.estimated_hours" :min="0" :precision="1" style="width:100%" /></el-form-item>
        <el-form-item label="维护说明"><el-input v-model="tplForm.description" type="textarea" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="tplVisible=false">取消</el-button><el-button type="primary" @click="saveTpl">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'; import { ElMessage } from 'element-plus'; import api from '@/api';
const activeTab = ref('records'); const loading = ref(false); const statusFilter = ref(''); const page = ref(1); const pageSize = ref(20); const total = ref(0); const overdueCount = ref(0);
const records = ref([]); const templates = ref([]);
const genVisible = ref(false); const genDeviceId = ref(null);
const deviceOpts = ref([]); const catOpts = ref([]);

async function loadCatOpts() {
  try {
    const r = await api.get('/device/categories');
    const cats = r.data?.data || r.data || [];
    const flat = [];
    function walk(tree, prefix) { tree.forEach(c => { flat.push({id:c.id, _label:(prefix?prefix+' > ':'')+c.name}); if(c.children) walk(c.children, (prefix?prefix+' > ':'')+c.name); }); }
    walk(cats, ''); catOpts.value = flat;
  } catch(e) {}
}

async function loadDevices() {
  try {
    const res = await api.get('/device/list', { params: { pageSize: 200 } });
    deviceOpts.value = res.data?.list || res.data?.list || [];
  } catch(e) {}
}
const tplVisible = ref(false);
const tplForm = reactive({ template_name:'',instrument_type:null,title:'',description:'',frequency_days:90,estimated_hours:1 });

async function loadData() {
  loading.value = true;
  try {
    if (activeTab.value === 'records') {
      const res = await api.get('/pm/records', { params: { status: statusFilter.value, page: page.value, pageSize: pageSize.value } });
      records.value = res.data?.list || []; total.value = res.data?.total || 0; overdueCount.value = res.data?.overdue_count || 0;
    } else {
      const res = await api.get('/pm/templates');
      templates.value = res.data?.data || [];
    }
  } catch (e) { ElMessage.error('加载失败'); }
  loading.value = false;
}

async function changePMStatus(row, newStatus) {
  try {
    const payload = { status: newStatus };
    if (newStatus === 'completed') payload.performed_at = new Date().toISOString();
    await api.put('/pm/status/'+row.id, payload);
    ElMessage.success('状态已更新'); loadData();
  } catch (e) { ElMessage.error('操作失败'); }
}
async function doGenerate() {
  try {
    await api.post('/pm/generate', { device_id: genDeviceId.value });
    ElMessage.success('PM任务已生成'); genVisible.value = false; loadData();
  } catch (e) { ElMessage.error('生成失败'); }
}
function openTplAdd() { Object.assign(tplForm, { template_name:'',instrument_type:null,title:'',description:'',frequency_days:90,estimated_hours:1 }); tplVisible.value = true; loadCatOpts(); }
async function saveTpl() {
  try {
    await api.post('/pm/templates/create', tplForm);
    ElMessage.success('模板已创建'); tplVisible.value = false; loadData();
  } catch (e) { ElMessage.error('创建失败'); }
}
function editTpl(row) { Object.assign(tplForm, { id:row.id, template_name:row.template_name, instrument_type:row.instrument_type, title:row.title, description:row.description||'', frequency_days:row.frequency_days, estimated_hours:row.estimated_hours }); tplVisible.value = true; loadCatOpts(); }
async function saveTplEdit() { try { await api.put('/pm/templates/'+tplForm.id, tplForm); ElMessage.success('已更新'); tplVisible.value = false; loadData(); } catch(e) { ElMessage.error('更新失败'); } }
async function deleteTpl(id) {
  try { await api.delete(`/pm/templates/${id}`); ElMessage.success('已删除'); loadData(); } catch (e) { /* ignore */ }
}
function exportData() { const csv=['设备,任务,计划日期,执行日期,执行人,状态'].concat(records.value.map(r=>[r.device?.name,r.title,r.scheduled_at,r.performed_at,r.performed_by,r.status].join(','))).join('\n'); const b=new Blob(['﻿'+csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='PM记录.csv'; a.click(); }

import { onMounted } from 'vue'; onMounted(loadData);
</script>
<style scoped>.toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px}</style>
