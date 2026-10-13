<template>
  <div class="cat-page">
    <el-card shadow="never">
      <div class="toolbar">
        <span style="font-weight:600">📂 设备分类管理</span>
        <el-button type="primary" style="margin-left:auto" @click="openAdd(0)">+ 添加顶级分类</el-button>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-top:16px">
      <el-table :data="flatList" stripe v-loading="loading" row-key="id" default-expand-all>
        <el-table-column prop="name" label="分类名称" min-width="200">
          <template #default="{row}">
            <span :style="{paddingLeft: (row._level*24)+'px'}">
              {{ row._level > 0 ? '└ ' : '' }}{{ row.name }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="sort_order" label="排序" width="80" />
        <el-table-column prop="icon" label="图标" width="80">
          <template #default="{row}">{{ row.icon || '-' }}</template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="160">
          <template #default="{row}">{{ new Date(row.created_at).toLocaleDateString() }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{row}">
            <el-button size="small" type="success" @click="openAdd(row.id)">+ 子分类</el-button>
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total"
          layout="total, prev, pager, next" @current-change="loadData" />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editForm.id ? '编辑分类' : '添加分类'" width="450px">
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="名称"><el-input v-model="editForm.name" /></el-form-item>
        <el-form-item label="父级">
          <el-select v-model="editForm.parent_id" placeholder="顶级分类" clearable style="width:100%">
            <el-option v-for="c in parentOpts" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="图标"><el-input v-model="editForm.icon" placeholder="emoji或URL" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="editForm.sort_order" :min="0" style="width:100%" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button type="primary" @click="saveEdit" :loading="saving">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'; import { ElMessage, ElMessageBox } from 'element-plus'; import api from '@/api';

const loading = ref(false); const categories = ref([]); const flatList = ref([]);
const page = ref(1); const pageSize = ref(50); const total = ref(0);
const dialogVisible = ref(false); const saving = ref(false); const parentOpts = ref([]);
const editForm = reactive({ name:'', parent_id:null, icon:'', sort_order:0 });

function flatten(tree, level=0) {
  const result = [];
  tree.forEach(c => { result.push({...c,_level:level}); if(c.children?.length) result.push(...flatten(c.children, level+1)); });
  return result;
}

async function loadData() {
  loading.value = true;
  try {
    const res = await api.get('/device/categories');
    categories.value = res.data?.data || res.data || [];
    flatList.value = flatten(categories.value);
    parentOpts.value = categories.value.map(c => ({id:c.id, name:c.name}));
  } catch(e) { ElMessage.error('加载失败'); }
  loading.value = false;
}

function openAdd(parentId) {
  Object.assign(editForm, { id:null, name:'', parent_id:parentId||null, icon:'', sort_order:0 });
  dialogVisible.value = true;
}
function openEdit(row) {
  Object.assign(editForm, { id:row.id, name:row.name, parent_id:row.parent_id||null, icon:row.icon||'', sort_order:row.sort_order||0 });
  dialogVisible.value = true;
}
async function saveEdit() {
  saving.value = true;
  try {
    const url = editForm.id ? '/device/category/update/'+editForm.id : '/device/category/create';
    await (editForm.id ? api.put(url, editForm) : api.post(url, editForm));
    ElMessage.success('已保存'); dialogVisible.value = false; loadData();
  } catch(e) { ElMessage.error('保存失败'); }
  saving.value = false;
}
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm('删除该分类？子分类也会被删除', '警告', {type:'warning'});
    await api.delete('/device/category/delete/'+row.id);
    ElMessage.success('已删除'); loadData();
  } catch(e){}
}

onMounted(loadData);
</script>
<style scoped>.toolbar{display:flex;align-items:center}</style>
