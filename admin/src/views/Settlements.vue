<template>
  <div class="settlements-page">
    <el-card shadow="never">
      <template #header>结算管理</template>
      <el-tabs v-model="tab" @tab-change="loadData">
        <el-tab-pane label="冻结中" name="held" />
        <el-tab-pane label="已释放" name="released" />
        <el-tab-pane label="全部" name="" />
      </el-tabs>
      <el-table :data="list" stripe v-loading="loading">
        <el-table-column prop="settlement_no" label="结算单号" width="200" />
        <el-table-column prop="order_id" label="工单" width="80" />
        <el-table-column label="收款方" width="80"><template #default="{row}">{{ row.recipient_type === 'platform' ? '平台' : '工程师' }}</template></el-table-column>
        <el-table-column label="金额"><template #default="{row}">¥{{ row.amount }}</template></el-table-column>
        <el-table-column label="佣金率"><template #default="{row}">{{ row.commission_rate }}%</template></el-table-column>
        <el-table-column label="佣金"><template #default="{row}">¥{{ row.commission_amount }}</template></el-table-column>
        <el-table-column label="工程师所得"><template #default="{row}">¥{{ row.engineer_amount }}</template></el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{row}"><el-tag :type="{'held':'warning','released':'success','withdrawn':'info'}[row.status]" size="small">{{ {'held':'冻结','released':'已释放','withdrawn':'已提现'}[row.status] }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{row}">
            <el-button v-if="row.status==='held'" type="success" size="small" @click="handleRelease(row)">释放</el-button>
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

const tab = ref('held'); const list = ref([]); const loading = ref(false); const page = ref(1); const total = ref(0);

async function loadData() {
  loading.value = true;
  try {
    const params = { page: page.value, pageSize: 20 };
    if (tab.value) params.status = tab.value;
    const res = await api.get('/settlement/admin/list', { params });
    list.value = res.data?.list || []; total.value = res.data?.total || 0;
  } catch (e) { /* ignore */ }
  loading.value = false;
}

async function handleRelease(row) {
  ElMessageBox.confirm(`释放结算 ¥${row.engineer_amount} 到工程师余额？`, '确认释放', { type: 'warning' }).then(async () => {
    try { await api.post(`/settlement/release/${row.id}`); ElMessage.success('已释放'); loadData(); } catch (e) { ElMessage.error('失败'); }
  }).catch(() => {});
}

// Initial
setTimeout(() => loadData(), 100);
</script>
