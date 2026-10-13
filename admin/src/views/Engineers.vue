<template>
  <div class="engineers-page">
    <el-card shadow="never">
      <div class="toolbar">
        <el-select v-model="typeFilter" placeholder="类型筛选" clearable style="width:160px" @change="loadEngineers">
          <el-option label="自营工程师" value="self_employed" />
          <el-option label="认证第三方" value="certified" />
        </el-select>
        <el-input v-model="keyword" placeholder="搜索姓名/电话/技能" clearable style="width:220px" @keyup.enter="loadEngineers" />
        <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width:140px;margin-left:12px" @change="loadEngineers">
          <el-option label="在线" value="online" />
          <el-option label="离线" value="offline" />
          <el-option label="忙碌" value="busy" />
        </el-select>
        <el-button type="primary" style="margin-left:auto" @click="openCreate">+ 添加工程师</el-button>
        <el-button type="success" style="margin-left:8px" @click="exportData">📥 导出</el-button>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-top:16px">
      <el-table :data="engineers" stripe v-loading="loading">
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="phone" label="电话" width="130" />
        <el-table-column prop="employee_no" label="工号" width="100" />
        <el-table-column prop="type" label="类型" width="90">
          <template #default="{row}">
            <el-tag :type="row.type==='self_employed'?'success':'warning'" size="small">
              {{ row.type==='self_employed'?'自营':'认证' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="skills" label="技能" min-width="200">
          <template #default="{row}">
            <template v-if="row.skills && row.skills.length">
              <el-tag v-for="s in (typeof row.skills === 'string' ? JSON.parse(row.skills) : row.skills)" :key="s" size="small" style="margin:2px">{{ s }}</el-tag>
            </template>
            <span v-else style="color:#CCC">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="service_area" label="服务区域" width="140">
          <template #default="{row}">
            <template v-if="row.service_area && row.service_area.length">
              <el-tag v-for="a in (typeof row.service_area === 'string' ? JSON.parse(row.service_area) : row.service_area)" :key="a" size="small" style="margin:2px">{{ a }}</el-tag>
            </template>
            <span v-else style="color:#CCC">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{row}">
            <el-tag :type="row.status==='online'?'success':row.status==='busy'?'warning':'info'" size="small">
              {{ {online:'在线',busy:'忙碌',offline:'离线'}[row.status] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="rating" label="评分" width="80">
          <template #default="{row}">⭐ {{ row.rating }}</template>
        </el-table-column>
        <el-table-column prop="total_orders" label="总工单" width="80" sortable />
        <el-table-column prop="completed_orders" label="完成" width="80" sortable />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{row}">
            <el-button size="small" type="primary" link @click="showDetail(row.id)">详情</el-button>
            <el-button size="small" type="warning" link @click="editType(row)">编辑</el-button>
            <el-button size="small" type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total"
                       layout="total, prev, pager, next" @current-change="loadEngineers" />
      </div>
    </el-card>

    <!-- 工程师详情弹窗 -->
    <el-dialog v-model="detailVisible" title="工程师详情" width="700px">
      <template v-if="engDetail.engineer">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="姓名">{{ engDetail.engineer.name }}</el-descriptions-item>
          <el-descriptions-item label="电话">{{ engDetail.engineer.phone }}</el-descriptions-item>
          <el-descriptions-item label="工号">{{ engDetail.engineer.employee_no || '-' }}</el-descriptions-item>
          <el-descriptions-item label="邮箱">{{ engDetail.engineer.email || '-' }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ engDetail.engineer.type === 'self_employed' ? '自营' : '认证第三方' }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ {online:'在线',busy:'忙碌',offline:'离线'}[engDetail.engineer.status] }}</el-descriptions-item>
          <el-descriptions-item label="评分">⭐ {{ engDetail.engineer.rating }}</el-descriptions-item>
          <el-descriptions-item label="余额">¥ {{ engDetail.engineer.balance }}</el-descriptions-item>
        </el-descriptions>
        <div style="margin-top:16px">
          <h4>绩效统计</h4>
          <el-row :gutter="12">
            <el-col :span="6"><el-statistic title="总工单" :value="engDetail.stats?.total || 0" /></el-col>
            <el-col :span="6"><el-statistic title="已完成" :value="engDetail.stats?.completed || 0" /></el-col>
            <el-col :span="6"><el-statistic title="进行中" :value="engDetail.stats?.pending || 0" /></el-col>
            <el-col :span="6"><el-statistic title="已取消" :value="engDetail.stats?.cancelled || 0" /></el-col>
          </el-row>
        </div>
        <div v-if="engDetail.recent_orders?.length" style="margin-top:16px">
          <h4>最近工单</h4>
          <el-table :data="engDetail.recent_orders" size="small" stripe>
            <el-table-column prop="order_no" label="工单号" width="200" />
            <el-table-column prop="device.name" label="设备" width="150" />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{row}">
                <el-tag size="small">{{ {pending:'待接单',accepted:'已接单',diagnosing:'诊断中',quoted:'待审批/支付',paid:'已支付',repairing:'维修中',completed:'维修完成',pending_review:'待评价',confirmed:'已验收',cancelled:'已取消'}[row.status] }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="时间">
              <template #default="{row}">{{ new Date(row.created_at).toLocaleString() }}</template>
            </el-table-column>
          </el-table>
        </div>
      </template>
    </el-dialog>

    <!-- 编辑工程师 -->
    <el-dialog v-model="editVisible" title="编辑工程师" width="450px">
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="类型">
          <el-radio-group v-model="editForm.type">
            <el-radio value="self_employed">自营</el-radio>
            <el-radio value="certified">认证第三方</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 添加工程师 -->
    <el-dialog v-model="createVisible" title="添加工程师" width="550px">
      <el-form :model="createForm" label-width="80px">
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="姓名"><el-input v-model="createForm.name" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="电话"><el-input v-model="createForm.phone" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="工号"><el-input v-model="createForm.employee_no" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="邮箱"><el-input v-model="createForm.email" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="类型">
          <el-radio-group v-model="createForm.type">
            <el-radio value="self_employed">自营工程师</el-radio>
            <el-radio value="certified">认证第三方</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="技能标签">
          <el-select v-model="createForm.skills" multiple filterable allow-create placeholder="输入技能回车添加" style="width:100%">
            <el-option v-for="s in dictSkills" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="服务区域">
          <el-select v-model="createForm.service_area" multiple filterable allow-create placeholder="输入城市回车添加" style="width:100%">
            <el-option v-for="a in dictAreas" :key="a" :label="a" :value="a" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible=false">取消</el-button>
        <el-button type="primary" @click="doCreate" :loading="creating">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { getEngineerList, getEngineerDetail, updateEngineerStatus } from '@/api';
import { ElMessage } from 'element-plus';

const engineers = ref([]); const loading = ref(false);
const keyword = ref(''); const typeFilter = ref(''); const statusFilter = ref('');
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const detailVisible = ref(false);
const engDetail = ref({});

const editVisible = ref(false);
const editForm = reactive({ id: null, type: '' });

// 添加工程师
const createVisible = ref(false); const creating = ref(false);
const createForm = reactive({ name:'', phone:'', email:'', employee_no:'', type:'certified', skills:[], service_area:[] });
const dictSkills = ref([]); const dictAreas = ref([]);

async function loadDicts() {
  try {
    const [s,a] = await Promise.all([
      api.get('/dictionary/list?group=skill_tag'),
      api.get('/dictionary/list?group=service_area')
    ]);
    dictSkills.value = (s.data?.list||s.data?.list||[]).map(x=>x.dict_value||x.value);
    dictAreas.value = (a.data?.list||a.data?.list||[]).map(x=>x.dict_value||x.value);
  } catch(e) {}
}

function openCreate() {
  Object.assign(createForm, { name:'', phone:'', email:'', employee_no:'', type:'certified', skills:[], service_area:[] });
  createVisible.value = true;
}
async function doCreate() {
  if (!createForm.name || !createForm.phone) return ElMessage.warning('姓名和电话必填');
  creating.value = true;
  try {
    await api.post('/admin/engineers', createForm);
    ElMessage.success('创建成功'); createVisible.value = false; loadEngineers();
  } catch(e) { ElMessage.error('创建失败'); }
  creating.value = false;
}

async function loadEngineers() {
  loading.value = true;
  try {
    const res = await getEngineerList({ keyword: keyword.value, type: typeFilter.value, status: statusFilter.value, page: page.value, pageSize: pageSize.value });
    engineers.value = res.data?.list || [];
    total.value = res.data?.total || 0;
  } catch (e) {
    ElMessage.error('加载失败');
  }
  loading.value = false;
}

async function showDetail(id) {
  detailVisible.value = true;
  try {
    const res = await getEngineerDetail(id);
    engDetail.value = res.data || {};
  } catch (e) { ElMessage.error('加载详情失败'); }
}

function editType(row) {
  editForm.id = row.id;
  editForm.type = row.type;
  editVisible.value = true;
}

async function saveEdit() {
  try {
    await updateEngineerStatus(editForm.id, { type: editForm.type });
    ElMessage.success('更新成功');
    editVisible.value = false;
    loadEngineers();
  } catch (e) { ElMessage.error('更新失败'); }
}

async function handleDelete(row) { try { await ElMessageBox.confirm('确定删除工程师？','警告',{type:'warning'}); await api.delete('/admin/engineers/'+row.id); ElMessage.success('已删除'); loadEngineers(); } catch(e){} }
function exportData() { const csv=['姓名,电话,工号,类型,状态,评分,总工单,完成'].concat(engineers.value.map(e=>[e.name,e.phone,e.employee_no,e.type,e.status,e.rating,e.total_orders,e.completed_orders].join(','))).join('\n'); const b=new Blob(['﻿'+csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='工程师列表.csv'; a.click(); }
import { ElMessageBox } from 'element-plus';
import api from '@/api';
import { onMounted } from 'vue';
onMounted(() => { loadEngineers(); loadDicts(); });
</script>

<style scoped>
.toolbar { display:flex; align-items:center; }
</style>
