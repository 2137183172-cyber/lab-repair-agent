<template>
  <div class="dashboard">
    <el-row :gutter="16">
      <el-col :span="6" v-for="card in statCards" :key="card.label">
        <el-card shadow="hover" class="stat-card" :class="{ clickable: card.clickable }" @click="card.clickable && goOrders(card.filter)">
          <div class="stat-content">
            <div class="stat-info">
              <div class="stat-value" :style="{color:card.color}">{{ card.value }}</div>
              <div class="stat-label">{{ card.label }}</div>
            </div>
            <el-icon :size="48" :color="card.color"><component :is="card.icon" /></el-icon>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="16">
        <el-card shadow="hover"><template #header>工单趋势（近30天）</template>
          <div ref="trendChart" style="height:320px"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover"><template #header>状态分布</template>
          <div ref="statusChart" style="height:320px"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="12">
        <el-card shadow="hover"><template #header>故障类型分布</template>
          <div ref="faultChart" style="height:300px"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="hover"><template #header>月度收入趋势</template>
          <div ref="revenueChart" style="height:300px"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="hover" style="margin-top:16px">
      <template #header>工程师排行榜</template>
      <el-table :data="engineerRanking" stripe size="small">
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="name" label="姓名" />
        <el-table-column prop="type" label="类型">
          <template #default="{row}"><el-tag :type="row.type==='self_employed'?'success':'info'" size="small">{{ row.type==='self_employed'?'自营':'认证' }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="completed_orders" label="完成工单" sortable />
        <el-table-column prop="rating" label="评分" sortable>
          <template #default="{row}">⭐ {{ row.rating }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import * as echarts from 'echarts';
import { getDashboard, getOrderTrend, getEngineerRanking, getFaultAnalysis } from '@/api';
import api from '@/api';

const router = useRouter();
function goOrders(filter) { router.push('/orders' + (filter || '')); }

const dashboard = ref({});
const engineerRanking = ref([]);
const trendChart = ref(null);
const statusChart = ref(null);
const faultChart = ref(null);
const revenueChart = ref(null);

const statCards = ref([
  { label: '总工单', value: 0, color: '#1677FF', icon: 'Document', clickable: true, filter: '' },
  { label: '待处理', value: 0, color: '#FA8C16', icon: 'Clock', clickable: true, filter: '?status=pending' },
  { label: '今日新增', value: 0, color: '#52C41A', icon: 'Plus', clickable: true, filter: '?today=1' },
  { label: '注册用户', value: 0, color: '#722ED1', icon: 'User', clickable: false, filter: '' }
]);

async function loadData() {
  try {
    const [d, t, r, f, rev] = await Promise.all([
      getDashboard(), getOrderTrend(30), getEngineerRanking(),
      getFaultAnalysis(),
      api.get('/stats/revenue-trend', { params: { months: 12 } })
    ]);
    dashboard.value = d.data;
    statCards.value[0].value = d.data.total_orders;
    statCards.value[1].value = d.data.pending_orders;
    statCards.value[2].value = d.data.today_orders;
    statCards.value[3].value = d.data.total_users;
    engineerRanking.value = r.data;

    await nextTick();
    renderTrendChart(t.data.daily_trend || []);
    renderStatusChart(t.data.status_distribution || []);
    renderFaultChart(f.data || []);
    renderRevenueChart(rev.data || []);
  } catch (e) { /* ignore */ }
}

// W-A1: 存储图表实例，用于销毁
let trendChartInst = null, statusChartInst = null, faultChartInst = null, revenueChartInst = null;

function renderTrendChart(data) {
  if (!trendChart.value) return;
  if (trendChartInst) trendChartInst.dispose();
  trendChartInst = echarts.init(trendChart.value);
  trendChartInst.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: data.map(d => d.date) },
    yAxis: { type: 'value' },
    series: [{ data: data.map(d => d.count), type: 'line', smooth: true, areaStyle: { color: 'rgba(22,119,255,0.1)' }, lineStyle: { color: '#1677FF' }, itemStyle: { color: '#1677FF' } }],
    grid: { left: 40, right: 20, top: 20, bottom: 30 }
  });
}

function renderStatusChart(data) {
  if (!statusChart.value) return;
  if (statusChartInst) statusChartInst.dispose();
  const map = { pending:'待接单', accepted:'已接单', diagnosing:'诊断中', quoted:'待审批/支付', paid:'已支付', repairing:'维修中', completed:'维修完成', pending_review:'待评价', confirmed:'已验收', cancelled:'已取消' };
  statusChartInst = echarts.init(statusChart.value);
  statusChartInst.setOption({
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie', radius: ['50%', '75%'], center: ['50%', '55%'],
      data: data.map(d => ({ name: map[d.status] || d.status, value: d.count })),
      label: { formatter: '{b}\n{d}%' }
    }],
    color: ['#FA8C16', '#1677FF', '#722ED1', '#52C41A', '#13C2C2', '#999']
  });
}

function renderFaultChart(data) {
  if (!faultChart.value) return;
  if (faultChartInst) faultChartInst.dispose();
  faultChartInst = echarts.init(faultChart.value);
  faultChartInst.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: data.map(d => d.category), inverse: true },
    series: [{ data: data.map(d => d.count), type: 'bar', itemStyle: { color: '#FA8C16', borderRadius: [0, 4, 4, 0] } }],
    grid: { left: 120, right: 20, top: 10, bottom: 20 }
  });
}

function renderRevenueChart(data) {
  if (!revenueChart.value) return;
  if (revenueChartInst) revenueChartInst.dispose();
  revenueChartInst = echarts.init(revenueChart.value);
  revenueChartInst.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['收入', '工单数'], bottom: 0 },
    xAxis: { type: 'category', data: data.map(d => d.month) },
    yAxis: [
      { type: 'value', name: '元' },
      { type: 'value', name: '单' }
    ],
    series: [
      { name: '收入', data: data.map(d => d.revenue), type: 'bar', itemStyle: { color: 'rgba(22,119,255,0.7)' } },
      { name: '工单数', data: data.map(d => d.orders), type: 'line', yAxisIndex: 1, itemStyle: { color: '#52C41A' } }
    ],
    grid: { left: 60, right: 60, top: 20, bottom: 40 }
  });
}

onMounted(loadData);
// W-A1: 组件卸载时销毁所有 ECharts 实例，防止内存泄漏
onUnmounted(() => {
  trendChartInst?.dispose();
  statusChartInst?.dispose();
  faultChartInst?.dispose();
  revenueChartInst?.dispose();
});
</script>

<style scoped>
.stat-card .stat-content { display:flex; justify-content:space-between; align-items:center; }
.stat-value { font-size: 32px; font-weight: bold; }
.stat-label { font-size: 14px; color: #999; margin-top: 4px; }
.stat-card.clickable { cursor: pointer; transition: transform 0.2s; }
.stat-card.clickable:hover { transform: translateY(-2px); }
</style>
