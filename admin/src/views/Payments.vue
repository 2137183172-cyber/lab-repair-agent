<template>
  <div class="payments-page">
    <el-card shadow="never">
      <template #header>支付记录</template>
      <el-table :data="list" stripe v-loading="loading">
        <el-table-column prop="payment_no" label="支付单号" width="200" />
        <el-table-column prop="order_id" label="工单" width="70" />
        <el-table-column label="金额"><template #default="{row}">¥{{ row.amount }}</template></el-table-column>
        <el-table-column prop="method" label="方式" width="70">
          <template #default="{row}">
            <el-tag :type="row.method==='offline'?'info':row.method==='mock'?'warning':''" size="small">{{ {'mock':'模拟','offline':'线下','wx_jsapi':'微信','alipay':'支付宝'}[row.method] || row.method }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{row}"><el-tag :type="{'success':'success','pending':'warning','failed':'danger','refunded':'info'}[row.status]" size="small">{{ {'pending':'待支付','success':'已支付','failed':'失败','refunding':'退款中','refunded':'已退款'}[row.status] }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="paid_at" label="支付时间" width="160" />
        <el-table-column label="操作" width="120">
          <template #default="{row}">
            <el-button v-if="row.method==='offline'&&row.status==='pending'" type="success" size="small" @click="handleConfirm(row)">确认收款</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination v-model:current-page="page" :total="total" :page-size="20" layout="prev,pager,next" @current-change="loadData" style="margin-top:16px;text-align:right" />
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/api';

const list = ref([]); const loading = ref(false); const page = ref(1); const total = ref(0);

async function loadData() {
  loading.value = true;
  try {
    const res = await api.get('/payment/list', { params: { page: page.value, pageSize: 20 } });
    list.value = res.data?.list || []; total.value = res.data?.total || 0;
  } catch (e) { /* ignore */ }
  loading.value = false;
}

async function handleConfirm(row) {
  ElMessageBox.confirm(`确认已收到线下付款 ¥${row.amount}？确认后将自动分账。`, '确认收款', { type: 'warning' }).then(async () => {
    try {
      await api.post(`/payment/confirm-offline/${row.payment_no}`);
      ElMessage.success('收款已确认，分账已生成');
      loadData();
    } catch (e) { ElMessage.error(e.response?.data?.message || '失败'); }
  }).catch(() => {});
}

setTimeout(() => loadData(), 100);
</script>
