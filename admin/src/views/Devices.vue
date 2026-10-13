<template>
  <div class="devices-page">
    <el-card shadow="never">
      <div class="toolbar">
        <el-input v-model="keyword" placeholder="搜索设备" clearable style="width:280px" @keyup.enter="loadData" />
        <el-select v-model="categoryFilter" placeholder="分类筛选" clearable style="width:180px;margin-left:12px" @change="loadData">
          <el-option v-for="c in flatCategories" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
        <el-button type="primary" style="margin-left:12px" @click="loadData">搜索</el-button>
        <el-button type="success" style="margin-left:auto" @click="openAdd">+ 添加设备</el-button>
        <el-button style="margin-left:8px" @click="downloadTemplate">📋 模板</el-button>
        <el-button type="warning" style="margin-left:8px" @click="openImport">📥 批量导入</el-button>
        <el-button type="success" style="margin-left:8px" @click="exportData">📤 导出</el-button>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-top:16px">
      <el-table :data="devices" stripe v-loading="loading">
        <el-table-column prop="name" label="设备名称" min-width="160" />
        <el-table-column prop="brand" label="品牌" width="100" />
        <el-table-column prop="model" label="型号" width="120" />
        <el-table-column prop="category.name" label="分类" width="100" />
        <el-table-column prop="lab_name" label="实验室" width="140" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{row}">
            <el-tag :type="row.status==='normal'?'success':row.status==='repairing'?'warning':'info'" size="small">{{ row.status==='normal'?'正常':row.status==='repairing'?'维修中':'已报废' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="warranty_end" label="保修截止" width="120" />
        <el-table-column label="校准状态" width="90">
          <template #default="{row}">
            <el-tag v-if="row._calStatus==='overdue'" type="danger" size="small">已过期</el-tag>
            <el-tag v-else-if="row._calStatus==='upcoming'" type="warning" size="small">即将到期</el-tag>
            <el-tag v-else-if="row._calStatus==='ok'" type="success" size="small">正常</el-tag>
            <span v-else style="color:#CCC">-</span>
          </template>
        </el-table-column>
        <el-table-column label="PM状态" width="80">
          <template #default="{row}">
            <el-tag v-if="row._pmOverdue" type="danger" size="small">{{ row._pmOverdue }}逾期</el-tag>
            <el-tag v-else-if="row._pmCount" type="success" size="small">{{ row._pmCount }}计划</el-tag>
            <span v-else style="color:#CCC">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="添加时间" width="160" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{row}"><el-button size="small" type="primary" link @click="showDetail(row)">详情</el-button></template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="total,prev,pager,next" @current-change="loadData" />
      </div>
    </el-card>

    <el-dialog v-model="detailVisible" title="设备详情" width="600px">
      <template v-if="currentDevice">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="名称" :span="2"><b>{{ currentDevice.name }}</b></el-descriptions-item>
          <el-descriptions-item label="品牌">{{ currentDevice.brand || '-' }}</el-descriptions-item>
          <el-descriptions-item label="型号">{{ currentDevice.model || '-' }}</el-descriptions-item>
          <el-descriptions-item label="分类">{{ currentDevice.category?.name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="序列号">{{ currentDevice.serial_no || '-' }}</el-descriptions-item>
          <el-descriptions-item label="资产编号">{{ currentDevice.asset_no || '-' }}</el-descriptions-item>
          <el-descriptions-item label="实验室">{{ currentDevice.lab_name || '-' }} {{ currentDevice.lab_room || '' }}</el-descriptions-item>
          <el-descriptions-item label="详细位置">{{ currentDevice.location || '-' }}</el-descriptions-item>
          <el-descriptions-item label="采购日期">{{ currentDevice.purchase_date || '-' }}</el-descriptions-item>
          <el-descriptions-item label="保修开始">{{ currentDevice.warranty_start || '-' }}</el-descriptions-item>
          <el-descriptions-item label="保修截止">{{ currentDevice.warranty_end || '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ statusMap[currentDevice.status] || currentDevice.status }}</el-descriptions-item>
          <el-descriptions-item label="说明书">{{ currentDevice.manual_url ? '✅ 已上传' : '❌ 无' }}</el-descriptions-item>
          <el-descriptions-item label="所属用户">{{ currentDevice.owner?.name || currentDevice.user_id || '-' }}</el-descriptions-item>
          <el-descriptions-item label="录入时间">{{ new Date(currentDevice.created_at).toLocaleString() }}</el-descriptions-item>
        </el-descriptions>
        <div style="margin-top:16px">
          <el-tabs v-model="detailTab">
            <el-tab-pane label="维修记录" name="repair">
              <el-table :data="deviceDetail.repair_history" size="small" stripe v-if="deviceDetail.repair_history?.length">
                <el-table-column prop="order_no" label="工单号" width="180" />
                <el-table-column prop="status" label="状态" width="80" />
                <el-table-column prop="created_at" label="时间" />
              </el-table>
              <div v-else style="color:#CCC;text-align:center;padding:20px">暂无维修记录</div>
            </el-tab-pane>
            <el-tab-pane label="校准记录" name="cal">
              <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center">
                <el-button size="small" type="primary" @click="showCalForm=!showCalForm">{{ showCalForm?'收起':'+ 为此设备添加校准' }}</el-button>
              </div>
              <el-form v-if="showCalForm" :model="calForm" label-width="80px" size="small" style="margin-bottom:16px;padding:12px;background:#F8FAFC;border-radius:8px">
                <el-row :gutter="8">
                  <el-col :span="12"><el-form-item label="计划名称"><el-input v-model="calForm.plan_name" placeholder="如: 年度温度校准" /></el-form-item></el-col>
                  <el-col :span="12"><el-form-item label="周期(天)"><el-input-number v-model="calForm.cycle_days" :min="1" style="width:100%" /></el-form-item></el-col>
                </el-row>
                <el-row :gutter="8">
                  <el-col :span="8"><el-form-item label="方式"><el-select v-model="calForm.calibration_type" style="width:100%"><el-option label="内部" value="internal"/><el-option label="外部" value="external"/><el-option label="自检" value="self_check"/></el-select></el-form-item></el-col>
                  <el-col :span="8"><el-form-item label="结果"><el-select v-model="calForm.result" style="width:100%"><el-option label="合格" value="pass"/><el-option label="有条件合格" value="conditional_pass"/><el-option label="不合格" value="fail"/></el-select></el-form-item></el-col>
                  <el-col :span="8"><el-form-item label="上次校准"><el-date-picker v-model="calForm.last_calibrated_at" type="date" style="width:100%" /></el-form-item></el-col>
                </el-row>
                <el-row :gutter="8">
                  <el-col :span="12"><el-form-item label="证书编号"><el-input v-model="calForm.cert_no" /></el-form-item></el-col>
                  <el-col :span="12"><el-form-item label="校准机构"><el-input v-model="calForm.calibrated_by" /></el-form-item></el-col>
                </el-row>
                <el-form-item label="标准"><el-input v-model="calForm.standard" placeholder="如: JJF 1101-2019" /></el-form-item>
                <el-button type="primary" size="small" @click="saveCal" :loading="savingCal">保存校准记录</el-button>
              </el-form>
              <el-table :data="deviceDetail.calibrations" size="small" stripe v-if="deviceDetail.calibrations?.length">
                <el-table-column prop="plan_name" label="校准计划" width="140" />
                <el-table-column prop="last_calibrated_at" label="上次校准" width="110" />
                <el-table-column prop="next_due_at" label="到期日" width="110" />
                <el-table-column prop="result" label="结果" width="80" />
                <el-table-column prop="cert_no" label="证书编号" />
              </el-table>
              <div v-else style="color:#CCC;text-align:center;padding:20px">暂无校准记录</div>
            </el-tab-pane>
            <el-tab-pane label="PM记录" name="pm">
              <div style="margin-bottom:12px;display:flex;gap:8px">
                <el-button size="small" type="success" @click="quickGenPM">🔧 从模板生成PM</el-button>
                <el-button size="small" @click="showPMForm=!showPMForm">📝 手动添加PM记录</el-button>
              </div>
              <el-form v-if="showPMForm" :model="pmForm" label-width="80px" size="small" style="margin-bottom:16px;padding:12px;background:#F8FAFC;border-radius:8px">
                <el-row :gutter="8">
                  <el-col :span="16"><el-form-item label="任务名称"><el-input v-model="pmForm.title" /></el-form-item></el-col>
                  <el-col :span="8"><el-form-item label="计划日期"><el-date-picker v-model="pmForm.scheduled_at" type="date" style="width:100%" /></el-form-item></el-col>
                </el-row>
                <el-form-item label="描述"><el-input v-model="pmForm.description" type="textarea" :rows="2" /></el-form-item>
                <el-button type="primary" size="small" @click="savePM" :loading="savingPM">保存PM记录</el-button>
              </el-form>
              <el-table :data="deviceDetail.pm_records" size="small" stripe v-if="deviceDetail.pm_records?.length">
                <el-table-column prop="title" label="任务" min-width="180" />
                <el-table-column prop="scheduled_at" label="计划日期" width="110" />
                <el-table-column prop="status" label="状态" width="80" />
              </el-table>
              <div v-else style="color:#CCC;text-align:center;padding:20px">暂无PM记录</div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="addVisible" title="为客户添加设备" width="550px">
      <el-form :model="addForm" label-width="80px">
        <el-form-item label="设备归属">
          <el-select v-model="addForm.user_id" placeholder="选择客户" filterable style="width:100%" @focus="loadUserOpts">
            <el-option v-for="u in userOpts" :key="u.id" :label="`${u.name} (${u.phone||''}) — ${u.company||''}`" :value="u.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备名称"><el-input v-model="addForm.name" placeholder="如: Eppendorf 5424R 离心机" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="品牌"><el-input v-model="addForm.brand" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="型号"><el-input v-model="addForm.model" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="分类">
          <el-select v-model="addForm.category_id" placeholder="选择分类" filterable style="width:100%" @focus="loadCats">
            <el-option v-for="c in catOpts" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="序列号"><el-input v-model="addForm.serial_no" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="资产编号"><el-input v-model="addForm.asset_no" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="实验室"><el-input v-model="addForm.lab_name" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="房间号"><el-input v-model="addForm.lab_room" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="详细位置"><el-input v-model="addForm.location" placeholder="如: 3楼东侧实验区" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="采购日期"><el-date-picker v-model="addForm.purchase_date" type="date" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="保修开始"><el-date-picker v-model="addForm.warranty_start" type="date" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="保修截止"><el-date-picker v-model="addForm.warranty_end" type="date" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="说明书">
          <el-upload :show-file-list="false" :http-request="uploadManual" accept=".pdf,.doc,.docx">
            <el-button size="small">📎 上传说明书 (PDF/Word)</el-button>
          </el-upload>
          <span v-if="addForm.manual_url" style="font-size:12px;color:#52C41A">✅ {{ addForm.manual_url.split('/').pop() }}</span>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="addForm.notes" type="textarea" placeholder="其他说明" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addVisible=false">取消</el-button>
        <el-button type="primary" @click="doAdd" :loading="adding">添加</el-button>
      </template>
    </el-dialog>
  </div>

  <!-- 批量导入 -->
  <el-dialog v-model="importDialog" title="批量导入设备" width="550px" @closed="importResult=null">
    <div style="margin-bottom:16px;color:#666;font-size:13px;line-height:2">
      <p>1. 点击「📋 模板」下载CSV模板</p>
      <p>2. 按模板格式填写（客户手机号必填，用于匹配归属）</p>
      <p>3. 上传文件，系统自动匹配客户和分类</p>
    </div>
    <el-upload :show-file-list="false" :http-request="handleImport" accept=".csv,.xlsx,.xls" drag>
      <div style="padding:30px"><el-icon style="font-size:40px;color:#1677FF"><Upload /></el-icon><p style="color:#999">拖拽或点击上传 Excel/CSV</p></div>
    </el-upload>
    <div v-if="importResult" style="margin-top:16px">
      <p><el-tag type="success">{{ importResult.success }}条成功</el-tag>
         <el-tag v-if="importResult.errors?.length" type="danger" style="margin-left:8px">{{ importResult.errors.length }}条失败</el-tag></p>
      <div v-if="importResult.errors?.length" style="max-height:200px;overflow-y:auto;margin-top:8px;font-size:13px">
        <p v-for="(e,i) in importResult.errors" :key="i" style="color:#FF4D4F">第{{ e.row }}行: {{ e.msg }}</p>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { getDeviceList } from '@/api';
import api from '@/api';
import { ElMessage } from 'element-plus';

const statusMap = { normal:'正常', repairing:'维修中', scrapped:'已报废' };
const devices = ref([]); const loading = ref(false);
const keyword = ref(''); const categoryFilter = ref(null); const flatCategories = ref([]);
const page = ref(1); const pageSize = ref(20); const total = ref(0);
const detailVisible = ref(false); const detailTab = ref('repair'); const currentDevice = ref(null); const deviceDetail = ref({});
// 内联校准表单
const showCalForm = ref(false); const savingCal = ref(false);
const calForm = reactive({ plan_name:'', calibration_type:'external', cycle_days:365, last_calibrated_at:'', cert_no:'', calibrated_by:'', standard:'', result:'pass' });
// 内联PM表单
const showPMForm = ref(false); const savingPM = ref(false);
const pmForm = reactive({ title:'', description:'', scheduled_at:'' });
const addVisible = ref(false); const adding = ref(false);
const addForm = reactive({ user_id:null, name:'', brand:'', model:'', category_id:null, serial_no:'', asset_no:'', lab_name:'', lab_room:'', location:'', purchase_date:'', warranty_start:'', warranty_end:'', manual_url:'', notes:'' });
const userOpts = ref([]); const catOpts = ref([]);

async function loadData() {
  loading.value = true;
  try {
    const res = await getDeviceList({ keyword: keyword.value, category_id: categoryFilter.value, page: page.value, pageSize: pageSize.value });
    const list = res.data?.list || []; total.value = res.data?.total || 0;
    // 补充校准/PM状态
    if (list.length > 0) {
      const ids = list.map(d => d.id).join(',');
      const [calRes, pmRes] = await Promise.all([
        api.get('/calibration/list?pageSize=200'),
        api.get('/pm/records?pageSize=200')
      ]);
      const cals = calRes.data?.list || calRes.data?.data?.list || [];
      const pms = pmRes.data?.list || pmRes.data?.data?.list || [];
      list.forEach(d => {
        const devCals = cals.filter(c => c.device_id === d.id);
        const now = new Date();
        const overdue = devCals.some(c => c.next_due_at && new Date(c.next_due_at) < now);
        const upcoming = devCals.some(c => { if(!c.next_due_at) return false; const diff = (new Date(c.next_due_at)-now)/(86400000); return diff > 0 && diff <= 30; });
        d._calStatus = overdue ? 'overdue' : upcoming ? 'upcoming' : devCals.length > 0 ? 'ok' : null;
        const devPms = pms.filter(p => p.device_id === d.id);
        d._pmCount = devPms.filter(p => p.status !== 'completed' && p.status !== 'cancelled').length;
        d._pmOverdue = devPms.filter(p => p.status === 'overdue').length;
      });
    }
    devices.value = list;
  } catch(e) { /* ignore */ }
  loading.value = false;
}

async function loadCategories() {
  try {
    const res = await api.get('/device/categories');
    const cats = res.data?.data || res.data || []; const flat = [];
    function walk(tree) { tree.forEach(c => { flat.push(c); if(c.children) walk(c.children); }); }
    walk(cats); flatCategories.value = flat;
  } catch(e) {}
}

async function showDetail(row) {
  currentDevice.value = row; deviceDetail.value = {}; detailTab.value = 'repair'; detailVisible.value = true;
  try {
    const [devRes, calRes, pmRes] = await Promise.all([
      api.get('/device/detail/'+row.id),
      api.get('/calibration/list?device_id='+row.id),
      api.get('/pm/records?device_id='+row.id)
    ]);
    const d = devRes.data?.data || devRes.data || {};
    currentDevice.value = d.device || row;
    deviceDetail.value = {
      ...d,
      calibrations: (calRes.data?.list || calRes.data?.data?.list || []),
      pm_records: (pmRes.data?.list || pmRes.data?.data?.list || [])
    };
  } catch(e) {}
}

async function loadUserOpts() { try { const r = await api.get('/admin/users',{params:{role:'user',pageSize:200}}); userOpts.value = r.data?.list || []; } catch(e){} }
async function loadCats() { try { const r = await api.get('/device/categories'); const flat = []; function w(t){t.forEach(c=>{flat.push(c);if(c.children)w(c.children)})}; w(r.data?.data||r.data||[]); catOpts.value = flat; } catch(e){} }
async function saveCal() { const did=currentDevice.value?.id; if(!did||!calForm.plan_name) return ElMessage.warning('请输入计划名称'); savingCal.value=true; try{await api.post('/calibration/create',{device_id:did,...calForm});ElMessage.success('已添加');showCalForm.value=false;const cr=await api.get('/calibration/list?device_id='+did);deviceDetail.value.calibrations=cr.data?.list||cr.data?.data?.list||[]}catch(e){ElMessage.error('添加失败')};savingCal.value=false }
async function savePM() { const did=currentDevice.value?.id; if(!did||!pmForm.title) return ElMessage.warning('请输入任务名称'); savingPM.value=true; try{await api.post('/pm/records/create',{device_id:did,...pmForm,status:'scheduled'});ElMessage.success('已添加');showPMForm.value=false;const pr=await api.get('/pm/records?device_id='+did);deviceDetail.value.pm_records=pr.data?.list||pr.data?.data?.list||[]}catch(e){ElMessage.error('添加失败')};savingPM.value=false }
async function quickGenPM() { const did=currentDevice.value?.id; if(!did) return; try{await api.post('/pm/generate',{device_id:did});ElMessage.success('PM已生成');const pr=await api.get('/pm/records?device_id='+did);deviceDetail.value.pm_records=pr.data?.list||pr.data?.data?.list||[]}catch(e){ElMessage.error('生成失败')} }
function openAdd() { Object.assign(addForm,{user_id:null,name:'',brand:'',model:'',category_id:null,serial_no:'',asset_no:'',lab_name:'',lab_room:'',location:'',purchase_date:'',warranty_start:'',warranty_end:'',manual_url:'',notes:''}); addVisible.value = true; loadUserOpts(); loadCats(); }
async function uploadManual(options) { const fd=new FormData();fd.append('file',options.file);try{const res=await api.post('/upload/file',fd,{headers:{'Content-Type':'multipart/form-data'}});addForm.manual_url=res.data?.data?.url||res.data?.url;ElMessage.success('已上传')}catch(e){ElMessage.error('上传失败')}}
async function doAdd() { if(!addForm.name||!addForm.user_id) return ElMessage.warning('请填写设备名称并选择客户'); adding.value = true; try { await api.post('/device/admin/create',addForm); ElMessage.success('客户登录小程序后即可看到'); addVisible.value = false; loadData(); } catch(e){ ElMessage.error('添加失败'); } adding.value = false; }
function exportData() { const csv=['名称,品牌,型号,分类,实验室,状态,保修截止'].concat(devices.value.map(d=>[d.name,d.brand,d.model,d.category?.name,d.lab_name,d.status,d.warranty_end].join(','))).join('\n'); const b=new Blob(['﻿'+csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='设备列表.csv'; a.click(); }
const importDialog = ref(false); const importResult = ref(null);
function openImport() { importDialog.value = true; importResult.value = null; }
function downloadTemplate() {
  const csv = '﻿设备名称,型号,品牌,分类,序列号,资产编号,实验室,房间号,客户手机\n高速冷冻离心机,Sorvall LYNX 6000,Thermo Fisher,离心机,SN001,,分子实验室,301,13000000000';
  const b = new Blob([csv], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = '设备导入模板.csv'; a.click();
}
async function handleImport(options) {
  const fd = new FormData(); fd.append('file', options.file);
  try {
    const res = await api.post('/device/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    if (res.data && res.data.code === 200) {
      importResult.value = res.data.data;
      ElMessage.success('导入完成: ' + importResult.value.success + '条');
      if (!importResult.value.errors || !importResult.value.errors.length) setTimeout(() => importDialog.value = false, 1500);
      loadData();
    } else {
      ElMessage.error(res.data?.message || '导入失败');
    }
  } catch (e) { ElMessage.error('导入失败'); }
}

onMounted(() => { loadData(); loadCategories(); });
</script>

<style scoped>
.toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
</style>
