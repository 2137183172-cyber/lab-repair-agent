<template>
  <div class="calibrations-page">
    <el-card shadow="never">
      <div class="toolbar">
        <el-select v-model="statusFilter" placeholder="校准状态" clearable style="width:140px" @change="loadData">
          <el-option label="已过期" value="overdue" /><el-option label="即将到期" value="upcoming" /><el-option label="正常" value="ok" />
        </el-select>
        <el-tag v-if="overdueCount > 0" type="danger" style="margin-left:12px">{{ overdueCount }} 台设备校准已过期！</el-tag>
        <el-button type="primary" style="margin-left:auto" @click="openAdd">+ 添加校准记录</el-button>
        <el-button type="success" style="margin-left:8px" @click="exportData">📥 导出</el-button>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-top:16px">
      <el-table :data="items" stripe v-loading="loading">
        <el-table-column label="设备" min-width="180">
          <template #default="{row}">{{ row.device?.name }} <span style="color:#999;font-size:12px">{{ row.device?.owner?.company || '' }}</span></template>
        </el-table-column>
        <el-table-column prop="plan_name" label="校准计划" width="150" />
        <el-table-column prop="calibration_type" label="方式" width="80">
          <template #default="{row}">{{ {internal:'内部',external:'外部',self_check:'自检'}[row.calibration_type] }}</template>
        </el-table-column>
        <el-table-column prop="cert_no" label="证书编号" width="130" />
        <el-table-column prop="calibrated_by" label="校准机构" width="130" />
        <el-table-column prop="last_calibrated_at" label="上次校准" width="110" sortable />
        <el-table-column prop="next_due_at" label="到期日" width="110" sortable>
          <template #default="{row}">
            <span :class="isOverdue(row.next_due_at) ? 'text-danger' : isUpcoming(row.next_due_at) ? 'text-warn' : ''">
              {{ row.next_due_at?.split('T')[0] || '-' }}
            </span>
            <el-tag v-if="isOverdue(row.next_due_at)" type="danger" size="small" style="margin-left:4px">过期</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="result" label="结果" width="90">
          <template #default="{row}">
            <el-tag :type="row.result==='pass'?'success':row.result==='conditional_pass'?'warning':'danger'" size="small">
              {{ {pass:'合格',conditional_pass:'有条件合格',fail:'不合格'}[row.result] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{row}">
            <el-button size="small" type="primary" @click="openEdit(row)">更新</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="total,prev,pager,next" @current-change="loadData" />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editForm.id ? '更新校准' : '添加校准'" width="550px">
      <el-form :model="editForm" label-width="90px">
        <el-form-item label="设备">
          <el-select v-model="editForm.device_id" placeholder="选择设备" filterable clearable style="width:100%" @focus="loadDevices">
            <el-option v-for="d in deviceOpts" :key="d.id" :label="`${d.name} (${d.model||''}) 🏢${d.owner?.company||d.company_id||'-'} 📍${d.lab_name||''}`" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="计划名称"><el-input v-model="editForm.plan_name" placeholder="如：年度温度校准" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="校准方式">
            <el-select v-model="editForm.calibration_type" style="width:100%">
              <el-option label="内部校准" value="internal" /><el-option label="外部送检" value="external" /><el-option label="自检" value="self_check" />
            </el-select>
          </el-form-item></el-col>
          <el-col :span="12"><el-form-item label="周期(天)"><el-input-number v-model="editForm.cycle_days" :min="1" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="证书编号"><el-input v-model="editForm.cert_no" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="校准机构"><el-input v-model="editForm.calibrated_by" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="上次校准日期"><el-date-picker v-model="editForm.last_calibrated_at" type="date" style="width:100%" /></el-form-item>
        <el-form-item label="校准结果">
          <el-radio-group v-model="editForm.result">
            <el-radio value="pass">合格</el-radio><el-radio value="conditional_pass">有条件合格</el-radio><el-radio value="fail">不合格</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="标准"><el-input v-model="editForm.standard" placeholder="如：JJF 1101-2019" /></el-form-item>
        <el-form-item label="证书文件">
          <el-upload :show-file-list="false" :before-upload="beforeUpload" :http-request="doUpload" accept=".pdf,.jpg,.jpeg,.png">
            <el-button size="small" type="primary">📎 上传证书 (PDF/图片)</el-button>
          </el-upload>
          <span v-if="editForm.cert_url" style="font-size:12px;color:#52C41A;margin-left:8px">✅ {{ editForm.cert_url.split('/').pop() }}</span>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="editForm.notes" type="textarea" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="saveEdit" :loading="saving">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'; import { ElMessage } from 'element-plus'; import api from '@/api';
const items = ref([]); const loading = ref(false); const statusFilter = ref(''); const page = ref(1); const pageSize = ref(20); const total = ref(0); const overdueCount = ref(0);
const deviceOpts = ref([]); const devLoading = ref(false);
async function loadDevices() {
  try {
    const res = await api.get('/device/list', { params: { pageSize: 200 } });
    deviceOpts.value = res.data?.list || res.data?.list || [];
  } catch(e) {}
}

function beforeUpload(file) { const v=['pdf','jpg','jpeg','png']; if(!v.includes(file.name.split('.').pop().toLowerCase())){ElMessage.error('仅支持 PDF/JPG/PNG');return false}; if(file.size>10*1024*1024){ElMessage.error('文件不超过10MB');return false}; return true; }
async function doUpload(options) { const fd=new FormData();fd.append('file',options.file);try{const res=await api.post('/upload/file',fd,{headers:{'Content-Type':'multipart/form-data'}});editForm.cert_url=res.data?.data?.url||res.data?.url;ElMessage.success('上传成功')}catch(e){ElMessage.error('上传失败')}}

const dialogVisible = ref(false); const saving = ref(false);
const editForm = reactive({ device_id:null,plan_name:'',calibration_type:'external',cycle_days:365,last_calibrated_at:'',cert_no:'',cert_url:'',calibrated_by:'',standard:'',result:'pass',notes:'' });

function isOverdue(d) { return d && new Date(d) < new Date(); }
function isUpcoming(d) { if (!d) return false; const diff = (new Date(d) - new Date()) / (1000*3600*24); return diff > 0 && diff <= 30; }

async function loadData() { loading.value = true; try { const res = await api.get('/calibration/list', { params: { status: statusFilter.value, page: page.value, pageSize: pageSize.value } }); items.value = res.data?.list || []; total.value = res.data?.total || 0; overdueCount.value = res.data?.overdue_count || 0; } catch (e) { ElMessage.error('加载失败'); } loading.value = false; }
function openAdd() { Object.assign(editForm, { id:null,device_id:null,plan_name:'',calibration_type:'external',cycle_days:365,last_calibrated_at:'',cert_no:'',cert_url:'',calibrated_by:'',standard:'',result:'pass',notes:'' }); dialogVisible.value = true; }
function openEdit(row) { Object.assign(editForm, { ...row, last_calibrated_at: row.last_calibrated_at?.split('T')[0] || '' }); dialogVisible.value = true; }
async function saveEdit() { saving.value = true; try { if (editForm.id) { await api.put(`/calibration/update/${editForm.id}`, editForm); } else { await api.post('/calibration/create', editForm); } ElMessage.success('保存成功'); dialogVisible.value = false; loadData(); } catch (e) { ElMessage.error('保存失败'); } saving.value = false; }

async function handleDelete(row) { try { await ElMessageBox.confirm('删除此校准记录？','警告',{type:'warning'}); await api.delete('/calibration/delete/'+row.id); ElMessage.success('已删除'); loadData(); } catch(e){} }
function exportData() { const csv=['设备,校准计划,方式,证书编号,机构,上次校准,到期日,结果'].concat(items.value.map(c=>[c.device?.name,c.plan_name,c.calibration_type,c.cert_no,c.calibrated_by,c.last_calibrated_at,c.next_due_at,c.result].join(','))).join('\n'); const b=new Blob(['﻿'+csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='校准列表.csv'; a.click(); }
import { ElMessageBox } from 'element-plus';
import { onMounted } from 'vue'; onMounted(loadData);
</script>
<style scoped>.toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.text-danger{color:#FF4D4F;font-weight:600}.text-warn{color:#FA8C16}</style>
