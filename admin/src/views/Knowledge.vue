<template>
  <div class="knowledge-page">
    <el-card shadow="never">
      <div class="toolbar">
        <el-input v-model="keyword" placeholder="搜索标题/摘要" clearable style="width:240px" @keyup.enter="loadData" />
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width:120px;margin-left:12px" @change="loadData">
          <el-option label="已发布" value="published" />
          <el-option label="草稿" value="draft" />
        </el-select>
        <el-button type="primary" style="margin-left:auto" @click="openAdd">+ 写文章</el-button>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-top:16px">
      <el-table :data="articles" stripe v-loading="loading">
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="category" label="分类" width="100" />
        <el-table-column prop="tags" label="标签" width="160">
          <template #default="{row}">
            <el-tag v-for="t in (row.tags||[])" :key="t" size="small" style="margin:2px">{{ t }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{row}">
            <el-tag :type="row.status==='published'?'success':'info'" size="small">{{ row.status==='published'?'已发布':'草稿' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="view_count" label="阅读" width="70" sortable />
        <el-table-column prop="created_at" label="创建时间" width="160">
          <template #default="{row}">{{ new Date(row.created_at).toLocaleDateString() }}</template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{row}">
            <el-button size="small" type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" :type="row.status==='draft'?'success':''" @click="togglePublish(row)">
              {{ row.status==='draft'?'发布':'撤回' }}
            </el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="total,prev,pager,next" @current-change="loadData" />
      </div>
    </el-card>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editForm.id ? '编辑文章' : '写文章'" width="1000px" top="10px" @opened="initEditor" @closed="destroyEditor">
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="标题"><el-input v-model="editForm.title" placeholder="文章标题" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="分类"><el-input v-model="editForm.category" placeholder="如：故障诊断、使用技巧" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="标签">
              <el-select v-model="editForm.tags" multiple filterable allow-create placeholder="输入标签回车添加" style="width:100%">
                <el-option v-for="t in commonTags" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="摘要"><el-input v-model="editForm.summary" type="textarea" :rows="2" placeholder="文章摘要..." /></el-form-item>
        <el-form-item label="封面图URL"><el-input v-model="editForm.cover_image" placeholder="可选封面图URL" /></el-form-item>
        <el-form-item label="正文">
          <div style="border:1px solid #DCDFE6;border-radius:4px;z-index:1">
            <Toolbar style="border-bottom:1px solid #EEE" :editor="editorRef" :defaultConfig="toolbarConfig" mode="simple" />
            <Editor style="height:400px;overflow-y:hidden" v-model="editForm.content" :defaultConfig="editorConfig" mode="simple" @onCreated="onEditorCreated" />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button @click="saveDraft" :loading="saving">保存草稿</el-button>
        <el-button type="primary" @click="savePublish" :loading="saving">发布</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, shallowRef, onBeforeUnmount } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/api';
import { Editor, Toolbar } from '@wangeditor/editor-for-vue';
import '@wangeditor/editor/dist/css/style.css';

// 富文本编辑器
const editorRef = shallowRef();
const toolbarConfig = { excludeKeys: ['group-video'] };
const editorConfig = { placeholder: '请输入正文...', MENU_CONF: {} };

editorConfig.MENU_CONF.uploadImage = {
  async customUpload(file, insertFn) {
    const form = new FormData(); form.append('file', file);
    try {
      const res = await api.post('/upload/image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = res.data?.url || res.data?.url;
      if (url) insertFn(url);
    } catch(e) { ElMessage.error('图片上传失败'); }
  }
};

const onEditorCreated = (editor) => { editorRef.value = editor; };
const initEditor = () => {};
const destroyEditor = () => { if (editorRef.value) editorRef.value.destroy(); };
onBeforeUnmount(() => destroyEditor());

const articles = ref([]); const loading = ref(false);
const keyword = ref(''); const statusFilter = ref('');
const page = ref(1); const pageSize = ref(20); const total = ref(0);
const commonTags = ['离心机', 'PCR仪', '质谱仪', '色谱仪', '故障诊断', '日常保养', '安全须知', '校准方法'];

const dialogVisible = ref(false); const saving = ref(false);
const editForm = reactive({ title:'',content:'',summary:'',category:'',tags:[],cover_image:'',status:'draft' });

async function loadData() {
  loading.value = true;
  try {
    const res = await api.get('/knowledge/admin/list', { params: { keyword: keyword.value, status: statusFilter.value, page: page.value, pageSize: pageSize.value } });
    articles.value = res.data?.list || [];
    total.value = res.data?.total || 0;
  } catch (e) { ElMessage.error('加载失败'); }
  loading.value = false;
}

function openAdd() {
  Object.assign(editForm, { id:null,title:'',content:'',summary:'',category:'',tags:[],cover_image:'',status:'draft' });
  dialogVisible.value = true;
}
function openEdit(row) {
  Object.assign(editForm, { ...row, tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []) });
  dialogVisible.value = true;
}
async function saveArticle(status) {
  saving.value = true; editForm.status = status;
  try {
    if (editForm.id) {
      await api.put(`/knowledge/admin/update/${editForm.id}`, editForm);
    } else {
      await api.post('/knowledge/admin/create', editForm);
    }
    ElMessage.success(status === 'published' ? '已发布' : '草稿已保存');
    dialogVisible.value = false; loadData();
  } catch (e) { ElMessage.error('保存失败'); }
  saving.value = false;
}
function saveDraft() { saveArticle('draft'); }
function savePublish() { saveArticle('published'); }
async function togglePublish(row) {
  const newStatus = row.status === 'published' ? 'draft' : 'published';
  try {
    await api.put(`/knowledge/admin/update/${row.id}`, { status: newStatus });
    ElMessage.success(newStatus === 'published' ? '已发布' : '已撤回');
    loadData();
  } catch (e) { ElMessage.error('操作失败'); }
}
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.title}」？`, '提示', { type: 'warning' });
    await api.delete(`/knowledge/admin/delete/${row.id}`);
    ElMessage.success('已删除'); loadData();
  } catch (e) { /* cancelled */ }
}

import { onMounted } from 'vue';
onMounted(loadData);
</script>

<style scoped>
.toolbar { display:flex; align-items:center; }
</style>
