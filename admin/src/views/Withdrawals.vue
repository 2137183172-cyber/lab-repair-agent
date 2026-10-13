<template>
  <div class="withdrawals-page">
    <el-card shadow="never">
      <template #header>提现管理</template>
      <el-tabs v-model="tab" @tab-change="loadData">
        <el-tab-pane label="待审批" name="pending" />
        <el-tab-pane label="已审批" name="approved" />
        <el-tab-pane label="已完成" name="completed" />
        <el-tab-pane label="全部" name="" />
      </el-tabs>
      <el-table :data="list" stripe v-loading="loading">
        <el-table-column prop="withdrawal_no" label="提现单号" width="200" />
        <el-table-column prop="engineer_name" label="工程师" width="100" />
        <el-table-column label="金额"><template #default="{row}">¥{{ row.amount }}</template></el-table-column>
        <el-table-column label="手续费"><template #default="{row}">¥{{ row.fee }}</template></el-table-column>
        <el-table-column label="到账"><template #default="{row}">¥{{ row.actual_amount }}</template></el-table-column>
        <el-table-column prop="method" label="方式" width="70" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{row}"><el-tag :type="{'pending':'warning','approved':'','completed':'success','rejected':'danger'}[row.status]" size="small">{{ {'pending':'待审批','approved':'已审批','completed':'已打款','rejected':'已驳回'}[row.status] }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="240">
          <template #default="{row}">
            <template v-if="row.status === 'pending'">
              <el-button type="success" size="small" @click="handleApprove(row)">通过</el-button>
              <el-button type="danger" size="small" @click="handleReject(row)">驳回</el-button>
            </template>
            <el-button v-if="row.status === 'approved'" type="primary" size="small" @click="handleComplete(row)">标记打款</el-button>
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

const tab = ref('pending'); const list = ref([]); const loading = ref(false); const page = ref(1); const total = ref(0);

async function loadData() {
  loading.value = true;
  try {
    const params = { page: page.value, pageSize: 20 };
    if (tab.value) params.status = tab.value;
    const res = await api.get('/settlement/withdraw/admin/list', { params });
    list.value = res.data?.list || []; total.value = res.data?.total || 0;
  } catch (e) { /* ignore */ }
  loading.value = false;
}

async function handleApprove(row) { try { await api.post(`/settlement/withdraw/${row.id}/approve`); ElMessage.success('已审批'); loadData(); } catch (e) { ElMessage.error('失败'); } }
async function handleReject(row) {
  ElMessageBox.prompt('驳回原因', '驳回提现', { inputType: 'textarea' }).then(async ({value}) => {
    try { await api.post(`/settlement/withdraw/${row.id}/reject`, { remark: value || '无' }); ElMessage.success('已驳回'); loadData(); } catch (e) { ElMessage.error('失败'); }
  }).catch(() => {});
}
async function handleComplete(row) { try { await api.post(`/settlement/withdraw/${row.id}/complete`); ElMessage.success('打款完成'); loadData(); } catch (e) { ElMessage.error('失败'); } }

setTimeout(() => loadData(), 100);
</script>
