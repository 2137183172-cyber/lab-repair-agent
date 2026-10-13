<template>
  <div class="broker-orders-page">
    <div class="toolbar">
      <el-form :inline="true" :model="filters">
        <el-form-item label="过程状态">
          <el-select v-model="filters.platform_status" clearable placeholder="全部" style="width: 180px" @change="loadData">
            <el-option v-for="item in platformStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" clearable placeholder="工单号/联系人/故障" style="width: 240px" @keyup.enter="loadData" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="loadData">查询</el-button>
          <el-button :icon="Refresh" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <el-table :data="orders" v-loading="loading" stripe>
      <el-table-column prop="order_no" label="工单号" width="160" fixed="left" />
      <el-table-column label="客户/设备" min-width="230">
        <template #default="{ row }">
          <div class="primary-text">{{ row.reporter?.name || row.contact_name || '-' }}</div>
          <div class="muted">{{ row.reporter?.company || row.device?.lab_name || '-' }}</div>
          <div class="muted">{{ deviceText(row) }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="fault_desc" label="故障描述" min-width="220" show-overflow-tooltip />
      <el-table-column label="流程状态" width="150">
        <template #default="{ row }">
          <el-tag :type="platformStatusTag(row.platform_status)">{{ platformStatusLabel(row.platform_status) }}</el-tag>
          <div class="muted main-status">主状态：{{ orderStatusLabel(row.status) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="价格" width="170">
        <template #default="{ row }">
          <div>客户：{{ money(row.customer_price) }}</div>
          <div>工程师：{{ money(row.engineer_price) }}</div>
          <div class="margin">毛利：{{ money(row.platform_margin) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="工程师" width="140">
        <template #default="{ row }">
          <div>{{ row.engineer?.name || '-' }}</div>
          <div class="muted">{{ row.engineer?.phone || '' }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="updated_at" label="更新时间" width="170" />
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" :icon="View" @click="goDetail(row)">详情</el-button>
          <el-button link type="warning" :icon="Edit" @click="openReview(row)">审核</el-button>
          <el-button link type="success" :icon="Money" @click="openPrice(row)">定价</el-button>
          <el-button link type="primary" :icon="Position" @click="openAssign(row)">派单</el-button>
          <el-button link type="info" :icon="Checked" @click="openPlatformReview(row)">复核</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="loadData"
      />
    </div>

    <el-dialog v-model="reviewDialog.visible" title="过程审核" width="520px">
      <el-form :model="reviewDialog.form" label-width="100px">
        <el-form-item label="过程状态">
          <el-select v-model="reviewDialog.form.platform_status" style="width: 100%">
            <el-option label="进入审核" value="reviewing" />
            <el-option label="进入定价" value="pricing" />
            <el-option label="补充信息" value="need_more_info" />
            <el-option label="驳回" value="rejected" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="reviewDialog.form.priority" clearable style="width: 100%">
            <el-option label="普通" value="normal" />
            <el-option label="紧急" value="urgent" />
            <el-option label="严重" value="critical" />
          </el-select>
        </el-form-item>
        <el-form-item label="内部备注">
          <el-input v-model="reviewDialog.form.internal_notes" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitReview">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="priceDialog.visible" title="平台定价" width="560px">
      <el-form :model="priceDialog.form" label-width="110px">
        <el-form-item label="定价模式">
          <el-select v-model="priceDialog.form.pricing_mode" style="width: 100%">
            <el-option label="平台直接定价" value="direct" />
            <el-option label="工程师预估" value="engineer_estimate" />
            <el-option label="多工程师竞价" value="multi_bid" />
          </el-select>
        </el-form-item>
        <el-form-item label="客户报价">
          <el-input-number v-model="priceDialog.form.customer_price" :min="0" :precision="2" :step="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="工程师结算价">
          <el-input-number v-model="priceDialog.form.engineer_price" :min="0" :precision="2" :step="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="预计毛利">
          <el-input :model-value="money(priceDialog.form.customer_price - priceDialog.form.engineer_price)" disabled />
        </el-form-item>
        <el-form-item label="报价说明">
          <el-input v-model="priceDialog.form.notes" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="内部备注">
          <el-input v-model="priceDialog.form.internal_notes" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="priceDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitPrice">生成报价</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="assignDialog.visible" title="派单给工程师" width="560px">
      <el-form :model="assignDialog.form" label-width="110px">
        <el-form-item label="选择工程师">
          <el-select v-model="assignDialog.form.engineer_id" filterable style="width: 100%" @visible-change="handleEngineerDropdown">
            <el-option
              v-for="engineer in engineers"
              :key="engineer.id"
              :label="engineerOptionLabel(engineer)"
              :value="engineer.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="结算价">
          <el-input-number v-model="assignDialog.form.engineer_price" :min="0" :precision="2" :step="100" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitAssign">确认派单</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="platformReviewDialog.visible" title="平台复核" width="520px">
      <el-form :model="platformReviewDialog.form" label-width="100px">
        <el-form-item label="复核结果">
          <el-switch
            v-model="platformReviewDialog.form.approved"
            active-text="通过"
            inactive-text="退回维修"
          />
        </el-form-item>
        <el-form-item label="复核备注">
          <el-input v-model="platformReviewDialog.form.notes" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="platformReviewDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitPlatformReview">提交复核</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Checked, Edit, Money, Position, Refresh, Search, View } from '@element-plus/icons-vue';
import {
  brokerAssignOrder,
  brokerPlatformReview,
  brokerPriceOrder,
  brokerReviewOrder,
  getBrokerOrders,
  getEngineerList
} from '@/api';

const router = useRouter();
const loading = ref(false);
const submitting = ref(false);
const orders = ref([]);
const engineers = ref([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const currentOrder = ref(null);
const filters = reactive({ platform_status: '', keyword: '' });

const platformStatusOptions = [
  { value: 'pending_review', label: '待平台审核' },
  { value: 'reviewing', label: '审核中' },
  { value: 'need_more_info', label: '需补充信息' },
  { value: 'pricing', label: '待定价' },
  { value: 'quoted', label: '已报价待支付' },
  { value: 'paid', label: '已支付待派单' },
  { value: 'assigned', label: '已派单' },
  { value: 'repairing', label: '维修中' },
  { value: 'engineer_completed', label: '工程师完工' },
  { value: 'platform_review', label: '平台复核' },
  { value: 'pending_customer_confirm', label: '待客户确认' },
  { value: 'confirmed', label: '客户已确认' },
  { value: 'rejected', label: '已驳回' },
  { value: 'settlement_pending', label: '待结算' },
  { value: 'settled', label: '已结算' }
];
const orderStatusMap = {
  pending: '待接单',
  accepted: '已接单',
  quoted: '待支付',
  paid: '已支付',
  repairing: '维修中',
  completed: '维修完成',
  pending_review: '待评价',
  confirmed: '已确认',
  cancelled: '已取消'
};

const reviewDialog = reactive({ visible: false, form: { platform_status: 'reviewing', priority: '', internal_notes: '' } });
const priceDialog = reactive({ visible: false, form: { pricing_mode: 'direct', customer_price: 0, engineer_price: 0, notes: '', internal_notes: '' } });
const assignDialog = reactive({ visible: false, form: { engineer_id: null, engineer_price: 0 } });
const platformReviewDialog = reactive({ visible: false, form: { approved: true, notes: '' } });

function platformStatusLabel(status) {
  return platformStatusOptions.find(item => item.value === status)?.label || status || '未进入';
}

function platformStatusTag(status) {
  if (['rejected'].includes(status)) return 'danger';
  if (['need_more_info', 'pricing', 'quoted'].includes(status)) return 'warning';
  if (['confirmed', 'settled'].includes(status)) return 'success';
  if (['platform_review', 'pending_customer_confirm'].includes(status)) return 'info';
  return '';
}

function orderStatusLabel(status) {
  return orderStatusMap[status] || status || '-';
}

function money(value) {
  const num = Number(value || 0);
  return `¥${num.toFixed(2)}`;
}

function deviceText(row) {
  const device = row.device || {};
  return [device.brand, device.name, device.model].filter(Boolean).join(' / ') || '-';
}

function engineerOptionLabel(engineer) {
  return `${engineer.name || '工程师'} #${engineer.id} ${engineer.status ? `(${engineer.status})` : ''}`;
}

async function loadData() {
  loading.value = true;
  try {
    const res = await getBrokerOrders({ page: page.value, pageSize: pageSize.value, ...filters });
    orders.value = res.data?.list || [];
    total.value = res.data?.total || 0;
  } catch (e) {
    ElMessage.error(e.message || '过程单加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadEngineers() {
  const res = await getEngineerList({ page: 1, pageSize: 100 });
  engineers.value = res.data?.list || [];
}

function resetFilters() {
  filters.platform_status = '';
  filters.keyword = '';
  page.value = 1;
  loadData();
}

function goDetail(row) {
  router.push(`/orders/${row.id}`);
}

function openReview(row) {
  currentOrder.value = row;
  reviewDialog.form.platform_status = row.platform_status || 'reviewing';
  reviewDialog.form.priority = row.priority || '';
  reviewDialog.form.internal_notes = row.internal_notes || '';
  reviewDialog.visible = true;
}

function openPrice(row) {
  currentOrder.value = row;
  priceDialog.form.pricing_mode = row.pricing_mode || 'direct';
  priceDialog.form.customer_price = Number(row.customer_price || 0);
  priceDialog.form.engineer_price = Number(row.engineer_price || 0);
  priceDialog.form.notes = '';
  priceDialog.form.internal_notes = row.internal_notes || '';
  priceDialog.visible = true;
}

async function openAssign(row) {
  currentOrder.value = row;
  assignDialog.form.engineer_id = row.engineer_id || null;
  assignDialog.form.engineer_price = Number(row.engineer_price || 0);
  assignDialog.visible = true;
  if (!engineers.value.length) {
    try { await loadEngineers(); }
    catch (e) { ElMessage.error(e.message || '工程师列表加载失败'); }
  }
}

function openPlatformReview(row) {
  currentOrder.value = row;
  platformReviewDialog.form.approved = true;
  platformReviewDialog.form.notes = '';
  platformReviewDialog.visible = true;
}

function handleEngineerDropdown(visible) {
  if (visible && !engineers.value.length) {
    loadEngineers().catch(e => ElMessage.error(e.message || '工程师列表加载失败'));
  }
}

async function submitReview() {
  if (!currentOrder.value) return;
  submitting.value = true;
  try {
    await brokerReviewOrder(currentOrder.value.id, reviewDialog.form);
    ElMessage.success('审核状态已更新');
    reviewDialog.visible = false;
    loadData();
  } catch (e) {
    ElMessage.error(e.message || '审核失败');
  } finally {
    submitting.value = false;
  }
}

async function submitPrice() {
  if (!currentOrder.value) return;
  if (priceDialog.form.engineer_price > priceDialog.form.customer_price) {
    ElMessage.warning('工程师结算价不能高于客户报价');
    return;
  }
  submitting.value = true;
  try {
    await brokerPriceOrder(currentOrder.value.id, priceDialog.form);
    ElMessage.success('报价已生成');
    priceDialog.visible = false;
    loadData();
  } catch (e) {
    ElMessage.error(e.message || '定价失败');
  } finally {
    submitting.value = false;
  }
}

async function submitAssign() {
  if (!currentOrder.value || !assignDialog.form.engineer_id) {
    ElMessage.warning('请选择工程师');
    return;
  }
  submitting.value = true;
  try {
    await brokerAssignOrder(currentOrder.value.id, assignDialog.form);
    ElMessage.success('派单成功');
    assignDialog.visible = false;
    loadData();
  } catch (e) {
    ElMessage.error(e.message || '派单失败');
  } finally {
    submitting.value = false;
  }
}

async function submitPlatformReview() {
  if (!currentOrder.value) return;
  submitting.value = true;
  try {
    await brokerPlatformReview(currentOrder.value.id, platformReviewDialog.form);
    ElMessage.success('复核已提交');
    platformReviewDialog.visible = false;
    loadData();
  } catch (e) {
    ElMessage.error(e.message || '复核失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(loadData);
</script>

<style scoped>
.broker-orders-page {
  min-width: 980px;
}
.toolbar {
  background: #fff;
  border: 1px solid #e8e8e8;
  padding: 16px 16px 0;
  margin-bottom: 16px;
}
.primary-text {
  font-weight: 600;
  color: #1f2329;
}
.muted {
  color: #86909c;
  font-size: 12px;
  line-height: 1.6;
}
.main-status {
  margin-top: 4px;
}
.margin {
  color: #1677ff;
  font-weight: 600;
}
.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
