<template>
  <div class="settings-page">
    <el-card shadow="never">
      <template #header>平台配置</template>
      <el-table :data="settings" stripe v-loading="loading">
        <el-table-column prop="key" label="配置项" width="200" />
        <el-table-column prop="value" label="当前值" />
        <el-table-column prop="description" label="说明" min-width="200" />
        <el-table-column label="操作" width="120">
          <template #default="{row}">
            <el-button type="primary" size="small" @click="editSetting(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="编辑配置" width="400px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="配置键"><el-input v-model="editForm.key" disabled /></el-form-item>
        <el-form-item label="值"><el-input v-model="editForm.value" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="editForm.description" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveSetting">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import api from '@/api';

const settings = ref([]); const loading = ref(false); const dialogVisible = ref(false);
const editForm = reactive({ key: '', value: '', description: '' });

async function loadData() {
  loading.value = true;
  try { const res = await api.get('/settings'); settings.value = res.data || []; } catch (e) { /* ignore */ }
  loading.value = false;
}

function editSetting(row) {
  editForm.key = row.key; editForm.value = row.value; editForm.description = row.description || '';
  dialogVisible.value = true;
}

async function saveSetting() {
  try {
    await api.put(`/settings/${editForm.key}`, { value: editForm.value, description: editForm.description });
    ElMessage.success('已更新'); dialogVisible.value = false; loadData();
  } catch (e) { ElMessage.error('失败'); }
}

setTimeout(() => loadData(), 100);
</script>
