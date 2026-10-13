<template>
  <div class="inventory-page">
    <el-card shadow="never">
      <div class="toolbar">
        <el-input v-model="keyword" placeholder="搜索名称/SKU/供应商" clearable style="width:260px" @keyup.enter="loadData" />
        <el-select v-model="categoryFilter" placeholder="分类筛选" clearable style="width:150px;margin-left:12px" @change="loadData">
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
        </el-select>
        <el-checkbox v-model="lowStockOnly" style="margin-left:12px" @change="loadData">仅看库存不足</el-checkbox>
        <el-button type="primary" style="margin-left:auto" @click="openAdd">+ 添加配件</el-button>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-top:16px">
      <el-table :data="items" stripe v-loading="loading">
        <el-table-column prop="name" label="名称" width="160" />
        <el-table-column prop="sku" label="SKU" width="120" />
        <el-table-column prop="category" label="分类" width="100" />
        <el-table-column prop="quantity" label="库存" width="80" sortable>
          <template #default="{row}">
            <el-tag :type="row.quantity <= row.threshold ? 'danger' : 'success'">{{ row.quantity }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="unit" label="单位" width="60" />
        <el-table-column prop="unit_price" label="单价" width="90">
          <template #default="{row}">¥{{ row.unit_price }}</template>
        </el-table-column>
        <el-table-column prop="threshold" label="预警线" width="80" />
        <el-table-column prop="supplier" label="供应商" min-width="100" />
        <el-table-column prop="location" label="位置" width="100" />
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{row}">
            <el-button size="small" @click="openIn(row)">入库</el-button>
            <el-button size="small" type="warning" @click="openOut(row)">出库</el-button>
            <el-button size="small" type="info" @click="openTransactions(row)">流水</el-button>
            <el-button size="small" type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="total,prev,pager,next" @current-change="loadData" />
      </div>
    </el-card>

    <!-- 添加/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editForm.id ? '编辑配件' : '添加配件'" width="550px">
      <el-form :model="editForm" label-width="80px">
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="名称"><el-input v-model="editForm.name" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="SKU"><el-input v-model="editForm.sku" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="分类"><el-input v-model="editForm.category" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="供应商"><el-input v-model="editForm.supplier" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="数量"><el-input-number v-model="editForm.quantity" :min="0" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="单位"><el-input v-model="editForm.unit" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="单价"><el-input-number v-model="editForm.unit_price" :min="0" :precision="2" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="预警线"><el-input-number v-model="editForm.threshold" :min="0" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="存放位置"><el-input v-model="editForm.location" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="备注"><el-input v-model="editForm.notes" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 入库/出库弹窗（增强版：含来源去向） -->
    <el-dialog v-model="stockDialogVisible" :title="stockMode === 'in' ? '入库' : '出库'" width="480px">
      <el-form label-width="80px">
        <el-form-item label="配件"><strong>{{ stockTarget?.name }}</strong></el-form-item>
        <el-form-item label="当前库存">{{ stockTarget?.quantity }} {{ stockTarget?.unit }}</el-form-item>
        <el-form-item :label="stockMode==='in'?'入库来源':'出库去向'">
          <el-select v-model="stockForm.related_type" style="width:100%" @change="onStockTypeChange">
            <template v-if="stockMode==='in'">
              <el-option label="采购入库" value="purchase" />
              <el-option label="退货入库" value="return" />
              <el-option label="手动调整" value="adjustment" />
            </template>
            <template v-else>
              <el-option label="工单出库" value="repair_order" />
              <el-option label="报废出库" value="scrap" />
              <el-option label="手动调整" value="adjustment" />
            </template>
          </el-select>
        </el-form-item>
        <el-form-item v-if="stockForm.related_type === 'repair_order'" label="关联工单">
          <el-select v-model="stockForm.related_id" filterable remote :remote-method="searchOrders"
                     :loading="orderSearching" placeholder="输入工单号搜索" style="width:100%"
                     value-key="id">
            <el-option v-for="o in orderOptions" :key="o.id" :label="o.order_no" :value="o.id">
              <span>{{ o.order_no }}</span>
              <span style="float:right;color:#999;font-size:12px">{{ o.status }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item v-if="stockForm.related_type === 'purchase'" label="采购来源">
          <el-input v-model="stockForm.related_name" placeholder="如：供应商名称 / 采购单号" />
        </el-form-item>
        <el-form-item :label="stockMode==='in'?'入库数量':'出库数量'">
          <el-input-number v-model="stockForm.quantity" :min="1" style="width:100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="stockForm.notes" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="stockDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="doStock" :loading="stockSaving">确认</el-button>
      </template>
    </el-dialog>

    <!-- 出入库流水侧边栏 -->
    <el-drawer v-model="txDrawerVisible" title="出入库流水" direction="rtl" size="500px">
      <template #header>
        <span style="font-weight:600">{{ txPart?.name }}</span>
        <span style="color:#999;margin-left:8px;font-size:13px">当前库存: {{ txPart?.quantity }} {{ txPart?.unit }}</span>
      </template>
      <div v-if="transactions.length === 0" style="text-align:center;padding:60px 0;color:#999">暂无流水记录</div>
      <el-timeline v-else>
        <el-timeline-item v-for="tx in transactions" :key="tx.id"
                          :timestamp="tx.created_at"
                          :color="tx.type==='in'?'#52C41A':'#FA8C16'"
                          :icon="tx.type==='in'?'el-icon-bottom':'el-icon-top'"
                          placement="top">
          <div class="tx-card">
            <div class="tx-header">
              <el-tag :type="tx.type==='in'?'success':'warning'" size="small">{{ tx.type==='in'?'入库':'出库' }}</el-tag>
              <span class="tx-qty">{{ tx.type==='in'?'+':'-' }}{{ tx.quantity }} {{ txPart?.unit }}</span>
            </div>
            <div class="tx-from">{{ tx.related_name || '--' }}</div>
            <div class="tx-meta">
              <span>库存 {{ tx.before_qty }} → {{ tx.after_qty }}</span>
              <span v-if="tx.operator" style="margin-left:8px">操作人: {{ tx.operator }}</span>
            </div>
            <div v-if="tx.notes" class="tx-note">{{ tx.notes }}</div>
          </div>
        </el-timeline-item>
      </el-timeline>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/api';

const items = ref([]); const loading = ref(false);
const keyword = ref(''); const categoryFilter = ref(''); const lowStockOnly = ref(false);
const page = ref(1); const pageSize = ref(20); const total = ref(0);
const categories = ref([]);

const dialogVisible = ref(false); const saving = ref(false);
const editForm = reactive({ name:'',sku:'',category:'',quantity:0,unit:'个',unit_price:0,threshold:5,location:'',supplier:'',notes:'' });

// 出入库弹窗
const stockDialogVisible = ref(false); const stockMode = ref('in');
const stockTarget = ref(null); const stockSaving = ref(false);
const stockForm = reactive({ quantity:1, related_type:'purchase', related_id:null, related_name:'', notes:'' });
const orderOptions = ref([]); const orderSearching = ref(false);

// 流水侧边栏
const txDrawerVisible = ref(false); const txPart = ref(null);
const transactions = ref([]);

// 类型中文映射
const RELATED_LABELS = { purchase:'采购入库', repair_order:'工单出库', return:'退货入库', scrap:'报废出库', adjustment:'手动调整' };

async function loadData() {
  loading.value = true;
  try {
    const res = await api.get('/inventory/list', { params: { keyword: keyword.value, category: categoryFilter.value, lowStock: lowStockOnly.value ? '1' : '', page: page.value, pageSize: pageSize.value } });
    items.value = res.data?.list || [];
    total.value = res.data?.total || 0;
    const cats = new Set(items.value.map(i => i.category).filter(Boolean));
    categories.value = [...cats];
  } catch (e) { ElMessage.error('加载失败'); }
  loading.value = false;
}

function openAdd() {
  Object.assign(editForm, { id: null, name:'',sku:'',category:'',quantity:0,unit:'个',unit_price:0,threshold:5,location:'',supplier:'',notes:'' });
  dialogVisible.value = true;
}
function openEdit(row) { Object.assign(editForm, row); dialogVisible.value = true; }
async function saveEdit() {
  saving.value = true;
  try {
    if (editForm.id) { await api.put(`/inventory/update/${editForm.id}`, editForm); }
    else { await api.post('/inventory/create', editForm); }
    ElMessage.success('保存成功');
    dialogVisible.value = false; loadData();
  } catch (e) { ElMessage.error('保存失败'); }
  saving.value = false;
}
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.name}」？`, '提示', { type: 'warning' });
    await api.delete(`/inventory/delete/${row.id}`);
    ElMessage.success('已删除'); loadData();
  } catch (e) { /* cancelled */ }
}

// 入库/出库
function openIn(row) {
  stockTarget.value = row; stockMode.value = 'in';
  stockForm.quantity = 1; stockForm.related_type = 'purchase';
  stockForm.related_id = null; stockForm.related_name = ''; stockForm.notes = '';
  stockDialogVisible.value = true;
}
function openOut(row) {
  stockTarget.value = row; stockMode.value = 'out';
  stockForm.quantity = 1; stockForm.related_type = 'repair_order';
  stockForm.related_id = null; stockForm.related_name = ''; stockForm.notes = '';
  orderOptions.value = [];
  stockDialogVisible.value = true;
}
function onStockTypeChange(val) {
  stockForm.related_id = null; stockForm.related_name = '';
  if (val === 'repair_order') orderOptions.value = [];
}
async function searchOrders(query) {
  if (!query || query.length < 1) { orderOptions.value = []; return; }
  orderSearching.value = true;
  try {
    const res = await api.get('/inventory/order-options', { params: { keyword: query } });
    orderOptions.value = res.data || [];
  } catch (e) { /* ignore */ }
  orderSearching.value = false;
}
async function doStock() {
  stockSaving.value = true;
  try {
    // 构建关联名称
    let relatedName = '';
    const rt = stockForm.related_type;
    if (rt === 'repair_order' && stockForm.related_id) {
      const order = orderOptions.value.find(o => o.id === stockForm.related_id);
      relatedName = `工单 ${order?.order_no || '#' + stockForm.related_id} 消耗`;
    } else if (rt === 'purchase') {
      relatedName = stockForm.related_name || `采购入库（${stockTarget.value.supplier || '供应商'}）`;
    } else {
      relatedName = stockForm.related_name || RELATED_LABELS[rt] || '出入库';
    }

    const url = stockMode.value === 'in' ? `/inventory/in/${stockTarget.value.id}` : `/inventory/out/${stockTarget.value.id}`;
    await api.post(url, {
      quantity: stockForm.quantity,
      related_type: rt,
      related_id: stockForm.related_id || null,
      related_name: relatedName,
      notes: stockForm.notes
    });
    ElMessage.success(stockMode.value === 'in' ? '入库成功' : '出库成功');
    stockDialogVisible.value = false; loadData();
  } catch (e) { ElMessage.error(e.response?.data?.message || '操作失败'); }
  stockSaving.value = false;
}

// 流水查询
async function openTransactions(row) {
  txPart.value = row; txDrawerVisible.value = true; transactions.value = [];
  try {
    const res = await api.get(`/inventory/transactions/${row.id}`);
    transactions.value = res.data?.list || [];
  } catch (e) { ElMessage.error('加载流水失败'); }
}

import { onMounted } from 'vue';
onMounted(loadData);
</script>

<style scoped>
.toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
.tx-card { padding: 4px 0; }
.tx-header { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
.tx-qty { font-size:18px; font-weight:700; }
.tx-from { font-size:13px; color:#333; margin-bottom:4px; }
.tx-meta { font-size:12px; color:#999; }
.tx-note { font-size:12px; color:#666; margin-top:4px; padding:4px 8px; background:#FAFAFA; border-radius:4px; }
</style>
