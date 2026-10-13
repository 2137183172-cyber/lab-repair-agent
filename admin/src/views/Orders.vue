<template>
  <div class="orders-page">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="filters" size="default">
        <el-form-item label="状态">
          <el-select v-model="filters.status" clearable placeholder="全部" style="width:150px" @change="loadData">
            <el-option v-for="(v,k) in statusOptions" :key="k" :label="v" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="工单号/故障描述" clearable style="width:220px" @keyup.enter="loadData" />
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束" @change="loadData" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">搜索</el-button>
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="success" style="margin-left:auto" @click="exportData">📥 导出</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never" style="margin-top:16px">
      <el-table :data="orders" stripe v-loading="loading" @row-click="goDetail" :row-class-name="rowClass">
        <el-table-column prop="order_no" label="工单号" width="160" />
        <el-table-column prop="device.name" label="设备" min-width="140" />
        <el-table-column prop="fault_desc" label="故障描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="reporter.name" label="报修人" width="100" />
        <el-table-column prop="engineer.name" label="工程师" width="100">
          <template #default="{row}">{{ row.engineer?.name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="240">
          <template #default="{row}">
            <!-- 已取消：特殊显示 -->
            <div v-if="row.status==='cancelled'" class="pipeline-bar">
              <span class="pipeline-dot cancelled">✕</span>
              <span class="pipeline-label-cancel">已取消</span>
            </div>
            <!-- 正常流程：进度条 -->
            <el-tooltip v-else :content="stageTooltip(row)" placement="top" :show-after="300">
              <div class="pipeline-bar">
                <template v-for="(s, idx) in pipelineStages" :key="s.key">
                  <span class="pipeline-dot" :class="dotClass(row, idx)" :style="dotStyle(row, idx)">
                    {{ dotIcon(row, idx) }}
                  </span>
                  <span v-if="idx < pipelineStages.length-1" class="pipeline-line" :class="lineClass(row, idx)"></span>
                </template>
              </div>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="priority" label="紧急" width="70">
          <template #default="{row}"><el-tag :type="row.priority==='critical'?'danger':row.priority==='urgent'?'warning':''" size="small">{{ {normal:'普通',urgent:'紧急',critical:'严重'}[row.priority] }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{row}">
            <el-button size="small" type="primary" link @click.stop="goDetail(row)">详情</el-button>
            <el-button v-if="row.status==='pending'" size="small" type="danger" link @click.stop="cancelOrder(row)">取消</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right">
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total"
                       layout="total, prev, pager, next" @current-change="loadData" />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { getOrderList } from '@/api';
import api from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter(); const route = useRoute();
const orders = ref([]);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const dateRange = ref([]);
const filters = reactive({ status: '', keyword: '' });

const statusOptions = { pending:'待接单', accepted:'已接单', diagnosing:'诊断中', quoted:'待审批/支付', paid:'已支付', repairing:'维修中', completed:'维修完成', pending_review:'待评价', confirmed:'已评价', cancelled:'已取消' };
const statusTag = { pending:'warning', accepted:'', diagnosing:'info', quoted:'warning', paid:'', repairing:'', completed:'success', pending_review:'warning', confirmed:'success', cancelled:'info' };

// 流程管线定义
const pipelineStages = [
  { key:'pending',       label:'待接单', icon:'📋' },
  { key:'accepted',      label:'已接单', icon:'✅' },
  { key:'diagnosing',    label:'诊断中', icon:'🔍' },
  { key:'quoted',        label:'待审批', icon:'💰' },
  { key:'paid',          label:'已支付', icon:'💳' },
  { key:'repairing',     label:'维修中', icon:'🔧' },
  { key:'completed',     label:'维修完成', icon:'✔️' },
  { key:'pending_review',label:'待评价', icon:'📝' },
  { key:'confirmed',     label:'已评价', icon:'⭐' },
];
const stageIndex = Object.fromEntries(pipelineStages.map((s,i) => [s.key, i]));

function dotClass(row, idx) {
  const cur = stageIndex[row.status];
  if (cur === undefined) return 'future';
  if (idx < cur) return 'past';
  if (idx === cur) {
    if (row.status==='pending') return 'current-warn';
    if (row.status==='quoted') return 'current-warn';
    return 'current';
  }
  return 'future';
}
function dotStyle(row, idx) {
  // 不同阶段用不同主色
  return {};
}
function dotIcon(row, idx) {
  const cur = stageIndex[row.status];
  if (cur === undefined) return '';
  if (idx < cur) return '✓';
  if (idx === cur) return '●';
  return '';
}
function lineClass(row, idx) {
  const cur = stageIndex[row.status];
  if (cur === undefined) return 'future';
  if (idx < cur) return 'past';
  return 'future';
}
function stageTooltip(row) {
  if (!row) return '';
  const cur = stageIndex[row.status];
  if (cur === undefined) return '已取消';
  return pipelineStages.map((s, i) => {
    const mark = i < cur ? '✅' : i === cur ? '📍' : '⏳';
    return `${mark} ${s.label}`;
  }).join(' → ');
}

// 超时判断
const TIMEOUT_MINUTES = { pending: 30, accepted: 120, diagnosing: 240, quoted: 120, paid: 240, repairing: 1440 };
function isOverdue(row) {
  if (!row.status || !row.updated_at) return false;
  const limit = TIMEOUT_MINUTES[row.status];
  if (!limit) return false;
  const elapsed = (Date.now() - new Date(row.updated_at).getTime()) / 60000;
  return elapsed > limit;
}

async function loadData() {
  loading.value = true;
  try {
    const params = { page: page.value, pageSize: pageSize.value, ...filters };
    if (dateRange.value?.length === 2) { params.start_date = dateRange.value[0]; params.end_date = dateRange.value[1]; }
    const res = await getOrderList(params);
    orders.value = res.data.list || [];
    total.value = res.data.total;
  } catch (e) { /* ignore */ }
  finally { loading.value = false; }
}

function resetFilters() { filters.status = ''; filters.keyword = ''; dateRange.value = []; page.value = 1; loadData(); }
function goDetail(row) { router.push(`/orders/${row.id}`); }
async function cancelOrder(row) {
  try {
    await ElMessageBox.confirm(`确定取消工单「${row.order_no}」？`, '取消工单', { type: 'warning' });
    await api.post(`/order/cancel/${row.id}`, { reason: '管理端取消' });
    ElMessage.success('已取消'); loadData();
  } catch (e) { /* cancelled */ }
}
function rowClass({row}) { return isOverdue(row) ? 'row-overdue' : ''; }
function exportData() {
  const csv = ['工单号,设备,报修人,状态,紧急程度,创建时间'].concat(orders.value.map(o=>[o.order_no,o.device?.name||'',o.reporter?.name||'',o.status,o.priority,o.created_at].join(','))).join('\n');
  const b=new Blob(['﻿'+csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='工单列表.csv'; a.click();
}

onMounted(() => {
  if (route.query.status) filters.status = route.query.status;
  if (route.query.today) { const d=new Date(); dateRange.value=[d.toISOString().split('T')[0], d.toISOString().split('T')[0]]; }
  loadData();
});
</script>

<style scoped>
.search-card { margin-bottom: 0; }

/* ====== 流程进度条 ====== */
.pipeline-bar {
  display: flex; align-items: center; gap: 0;
  padding: 2px 0;
}
.pipeline-dot {
  width: 18px; height: 18px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: bold; line-height: 1;
  flex-shrink: 0; transition: all 0.2s;
}
.pipeline-dot.past {
  background: #52C41A; color: #fff;
}
.pipeline-dot.current {
  background: #1677FF; color: #fff; box-shadow: 0 0 0 3px rgba(22,119,255,0.25);
  animation: pulse-dot 1.8s ease-in-out infinite;
}
.pipeline-dot.current-warn {
  background: #FA8C16; color: #fff; box-shadow: 0 0 0 3px rgba(250,140,22,0.25);
  animation: pulse-dot 1.2s ease-in-out infinite;
}
.pipeline-dot.future {
  background: #E8E8E8; color: #BBB;
}
.pipeline-dot.cancelled {
  background: #FF4D4F; color: #fff; width: 22px; height: 22px; font-size: 12px;
}
.pipeline-label-cancel {
  margin-left: 6px; font-size: 12px; color: #FF4D4F; font-weight: 500;
}
.pipeline-line {
  width: 14px; height: 2px; flex-shrink: 0; transition: background 0.3s;
}
.pipeline-line.past { background: #52C41A; }
.pipeline-line.future { background: #E8E8E8; }

@keyframes pulse-dot {
  0%, 100% { box-shadow: 0 0 0 3px rgba(22,119,255,0.25); }
  50% { box-shadow: 0 0 0 6px rgba(22,119,255,0.08); }
}

/* ====== 超时行高亮 ====== */
:deep(.row-overdue) { background: #FFF2F0 !important; }
:deep(.row-overdue:hover) { background: #FFE7E5 !important; }
:deep(.row-overdue td) { border-bottom-color: #FFCCC7 !important; }
</style>
