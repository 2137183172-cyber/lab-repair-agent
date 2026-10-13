<template>
  <div class="audit-page">
    <el-card shadow="never">
      <div class="toolbar">
        <el-select v-model="entityFilter" placeholder="实体类型" clearable style="width:130px" @change="loadData">
          <el-option label="Device" value="Device" /><el-option label="Order" value="RepairOrder" />
          <el-option label="Calibration" value="Calibration" /><el-option label="PM" value="PMRecord" />
          <el-option label="User" value="User" />
        </el-select>
        <el-select v-model="actionFilter" placeholder="操作类型" clearable style="width:110px;margin-left:12px" @change="loadData">
          <el-option label="创建" value="create" /><el-option label="更新" value="update" /><el-option label="删除" value="delete" />
          <el-option label="签名" value="sign" /><el-option label="审批" value="approve" />
        </el-select>
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始" end-placeholder="结束"
                        style="margin-left:12px" value-format="YYYY-MM-DD" @change="loadData" />
        <el-tag style="margin-left:12px">共 {{ total }} 条审计记录</el-tag>
        <el-button type="success" style="margin-left:auto" @click="exportData">📥 导出</el-button>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-top:16px">
      <el-table :data="logs" stripe v-loading="loading" max-height="calc(100vh - 280px)">
        <el-table-column prop="created_at" label="时间" width="160">
          <template #default="{row}">{{ new Date(row.created_at).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column prop="user_name" label="操作人" width="100" />
        <el-table-column prop="user_role" label="角色" width="70" />
        <el-table-column prop="action" label="动作" width="80">
          <template #default="{row}">
            <el-tag :type="row.action==='delete'?'danger':row.action==='sign'?'success':row.action==='create'?'':'info'" size="small">{{ row.action }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="entity_type" label="实体类型" width="110" />
        <el-table-column prop="entity_id" label="实体ID" width="80" />
        <el-table-column prop="entity_name" label="实体名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="detail" label="详情" min-width="200" show-overflow-tooltip />
        <el-table-column prop="ip_address" label="IP" width="120" />
      </el-table>
      <div style="margin-top:16px;text-align:right">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="total,prev,pager,next" @current-change="loadData" />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'; import { ElMessage } from 'element-plus'; import api from '@/api';
const logs = ref([]); const loading = ref(false); const entityFilter = ref(''); const actionFilter = ref(''); const dateRange = ref([]);
const page = ref(1); const pageSize = ref(50); const total = ref(0);

async function loadData() {
  loading.value = true;
  try {
    const params = { page: page.value, pageSize: pageSize.value };
    if (entityFilter.value) params.entity_type = entityFilter.value;
    if (actionFilter.value) params.action = actionFilter.value;
    if (dateRange.value?.length === 2) { params.start = dateRange.value[0]; params.end = dateRange.value[1]; }
    const res = await api.get('/audit/logs', { params });
    logs.value = res.data?.list || []; total.value = res.data?.total || 0;
  } catch (e) { ElMessage.error('加载失败'); }
  loading.value = false;
}

function exportData() { const csv=['时间,操作人,角色,动作,实体类型,实体ID,详情'].concat(logs.value.map(l=>[l.created_at,l.user_name,l.user_role,l.action,l.entity_type,l.entity_id,l.detail].join(','))).join('\n'); const b=new Blob(['﻿'+csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='审计日志.csv'; a.click(); }
import { onMounted } from 'vue'; onMounted(loadData);
</script>
<style scoped>.toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px}</style>
