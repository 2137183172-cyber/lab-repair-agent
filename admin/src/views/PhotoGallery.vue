<template>
  <div class="gallery-page">
    <el-card shadow="never">
      <div class="toolbar">
        <el-select v-model="catFilter" placeholder="照片分类" clearable style="width:150px" @change="loadData">
          <el-option label="故障照片" value="fault" /><el-option label="维修前" value="repair_before" />
          <el-option label="维修后" value="repair_after" /><el-option label="设备照片" value="device" />
          <el-option label="证书" value="certificate" /><el-option label="签名" value="signature" />
          <el-option label="其他" value="other" />
        </el-select>
        <el-select v-model="entityFilter" placeholder="关联类型" clearable style="width:130px;margin-left:12px" @change="loadData">
          <el-option label="工单" value="Order" /><el-option label="设备" value="Device" />
          <el-option label="校准" value="Calibration" />
        </el-select>
        <el-tag style="margin-left:12px">共 {{ total }} 张照片</el-tag>
        <span style="margin-left:auto;color:#999;font-size:13px">
          存储位置: {{ uploadPath }}
        </span>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-top:16px">
      <div v-if="photos.length === 0 && !loading" style="text-align:center;padding:80px;color:#CCC">
        <div style="font-size:64px">📷</div>
        <div style="margin-top:12px">暂无照片，小程序端上传故障照片后这里会自动显示</div>
      </div>
      <div class="photo-grid" v-loading="loading">
        <div v-for="p in photos" :key="p.id" class="photo-card" @click="preview(p)">
          <div class="photo-img">
            <img :src="p.file_url" :alt="p.file_name" @error="e=>e.target.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><rect fill=%22%23EEE%22 width=%22200%22 height=%22200%22/><text fill=%22%23CCC%22 x=%22100%22 y=%22110%22 text-anchor=%22middle%22 font-size=%2240%22>📷</text></svg>'" />
          </div>
          <div class="photo-info">
            <el-tag size="small" :type="catTag[p.category]">{{ catLabel[p.category] || p.category }}</el-tag>
            <span class="pi-entity" v-if="p.entity_type">{{ p.entity_type }}#{{ p.entity_id }}</span>
            <span class="pi-date">{{ formatDate(p.created_at) }}</span>
          </div>
          <div class="photo-name">{{ p.file_name }}</div>
        </div>
      </div>
      <div style="margin-top:16px;text-align:right">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total"
          layout="total,prev,pager,next" @current-change="loadData" />
      </div>
    </el-card>

    <!-- 预览 -->
    <el-dialog v-model="previewVisible" title="照片详情" width="700px">
      <div style="text-align:center">
        <img :src="currentPhoto?.file_url" style="max-width:100%;max-height:60vh;border-radius:8px" />
      </div>
      <el-descriptions :column="2" border size="small" style="margin-top:16px">
        <el-descriptions-item label="文件名">{{ currentPhoto?.file_name }}</el-descriptions-item>
        <el-descriptions-item label="分类">{{ catLabel[currentPhoto?.category] }}</el-descriptions-item>
        <el-descriptions-item label="大小">{{ formatSize(currentPhoto?.file_size) }}</el-descriptions-item>
        <el-descriptions-item label="MIME">{{ currentPhoto?.mime_type }}</el-descriptions-item>
        <el-descriptions-item label="关联">{{ currentPhoto?.entity_type }} #{{ currentPhoto?.entity_id }}</el-descriptions-item>
        <el-descriptions-item label="上传时间">{{ formatDateTime(currentPhoto?.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="URL" :span="2"><a :href="currentPhoto?.file_url" target="_blank" style="color:#1677FF">{{ currentPhoto?.file_url }}</a></el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'; import { ElMessage } from 'element-plus'; import api from '@/api';

const photos = ref([]); const loading = ref(false); const catFilter = ref(''); const entityFilter = ref('');
const page = ref(1); const pageSize = ref(24); const total = ref(0);
const previewVisible = ref(false); const currentPhoto = ref(null);
const uploadPath = 'backend/uploads/images/';

const catLabel = { fault:'故障照片', repair_before:'维修前', repair_after:'维修后', device:'设备照片', certificate:'证书', signature:'签名', other:'其他' };
const catTag = { fault:'danger', repair_before:'warning', repair_after:'success', device:'', certificate:'info', signature:'', other:'info' };

function formatDate(d) { if(!d) return ''; return new Date(d).toLocaleDateString(); }
function formatDateTime(d) { if(!d) return ''; return new Date(d).toLocaleString(); }
function formatSize(s) { if(!s) return '-'; return s>1048576?(s/1048576).toFixed(1)+'MB':(s/1024).toFixed(1)+'KB'; }

async function loadData() {
  loading.value = true;
  try {
    const params = { page: page.value, pageSize: pageSize.value };
    if (catFilter.value) params.category = catFilter.value;
    if (entityFilter.value) params.entity_type = entityFilter.value;
    const res = await api.get('/upload/gallery', { params });
    photos.value = res.data?.list || res.data?.list || [];
    total.value = res.data?.total || res.data?.total || 0;
  } catch (e) { ElMessage.error('加载失败'); }
  loading.value = false;
}
function preview(p) { currentPhoto.value = p; previewVisible.value = true; }

import { onMounted } from 'vue'; onMounted(loadData);
</script>
<style scoped>
.toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.photo-card{cursor:pointer;border-radius:8px;overflow:hidden;border:1px solid #EEE;transition:box-shadow .2s}
.photo-card:hover{box-shadow:0 4px 16px rgba(0,0,0,0.1)}
.photo-img{width:100%;height:160px;background:#F5F6FA;overflow:hidden;display:flex;align-items:center;justify-content:center}
.photo-img img{width:100%;height:100%;object-fit:cover}
.photo-info{display:flex;align-items:center;gap:8px;padding:8px 10px 0}
.pi-entity{font-size:11px;color:#999}
.pi-date{font-size:11px;color:#CCC;margin-left:auto}
.photo-name{font-size:12px;color:#666;padding:4px 10px 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
</style>
