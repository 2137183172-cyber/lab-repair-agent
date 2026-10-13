<template>
  <div class="order-detail" v-loading="loading">
    <el-page-header @back="$router.back()" :content="'工单 ' + (order?.order_no || '')" />

    <el-row :gutter="16" style="margin-top:16px" v-if="order">
      <el-col :span="14">
        <!-- 基本信息 -->
        <el-card shadow="never"><template #header>工单信息</template>
          <el-descriptions :column="2" size="small" border>
            <el-descriptions-item label="工单号">{{ order.order_no }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="tagMap[order.status]">{{ statusMap[order.status] }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="报修人">{{ order.reporter?.name }}</el-descriptions-item>
            <el-descriptions-item label="电话">{{ order.reporter?.phone || order.contact_phone }}</el-descriptions-item>
            <el-descriptions-item label="设备">{{ order.device?.name || '未指定' }}</el-descriptions-item>
            <el-descriptions-item label="紧急程度">{{ priorityMap[order.priority] }}</el-descriptions-item>
            <el-descriptions-item label="创建时间" :span="2">{{ order.created_at }}</el-descriptions-item>
            <el-descriptions-item label="故障描述" :span="2">{{ order.fault_desc }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 故障图片 -->
        <el-card shadow="never" style="margin-top:16px" v-if="order.fault_images?.length">
          <template #header>故障图片</template>
          <el-image v-for="(img,i) in order.fault_images" :key="i" :src="img" style="width:150px;height:150px;margin-right:8px" :preview-src-list="order.fault_images" />
        </el-card>

        <!-- ===== 报价单（新） ===== -->
        <el-card shadow="never" style="margin-top:16px" v-if="quotations.length">
          <template #header>
            <span>📋 报价记录</span>
            <el-tag v-if="latestQuote" :type="quoteTagMap[latestQuote.status]" size="small" style="margin-left:12px">
              {{ quoteStatusMap[latestQuote.status] }}
            </el-tag>
          </template>

          <!-- 最新报价详情 -->
          <template v-if="latestQuote">
            <el-descriptions :column="2" size="small" border>
              <el-descriptions-item label="报价单号">{{ latestQuote.quotation_no }}</el-descriptions-item>
              <el-descriptions-item label="版本">第{{ latestQuote.revision }}版</el-descriptions-item>
              <el-descriptions-item label="诊断摘要" :span="2">{{ latestQuote.diagnosis_summary || '无' }}</el-descriptions-item>
              <el-descriptions-item label="人工费">¥{{ latestQuote.labor_cost }}</el-descriptions-item>
              <el-descriptions-item label="配件费">¥{{ latestQuote.parts_cost }}</el-descriptions-item>
              <el-descriptions-item label="总金额"><strong style="color:#FF4D4F;font-size:16px">¥{{ latestQuote.total_cost }}</strong></el-descriptions-item>
              <el-descriptions-item label="有效期">{{ latestQuote.valid_until || '未设置' }}</el-descriptions-item>
              <el-descriptions-item label="创建人" v-if="latestQuote.creator">{{ latestQuote.creator.name }}</el-descriptions-item>
              <el-descriptions-item label="审批人" v-if="latestQuote.approver">{{ latestQuote.approver.name }}</el-descriptions-item>
            </el-descriptions>

            <!-- 报价明细 -->
            <div style="margin-top:12px">
              <strong>费用明细：</strong>
              <el-table :data="latestQuote.items" size="small" style="margin-top:8px" border>
                <el-table-column prop="name" label="项目" />
                <el-table-column prop="spec" label="规格" width="120" />
                <el-table-column label="类型" width="80">
                  <template #default="{row}">
                    <el-tag size="small">{{ row.type === 'labor' ? '人工' : row.type === 'parts' ? '配件' : '其他' }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="qty" label="数量" width="70" align="center" />
                <el-table-column label="单价" width="100">
                  <template #default="{row}">¥{{ row.unit_price }}</template>
                </el-table-column>
                <el-table-column label="小计" width="100">
                  <template #default="{row}">¥{{ ((row.qty||0)*(row.unit_price||0)).toFixed(2) }}</template>
                </el-table-column>
              </el-table>
            </div>

            <!-- 驳回原因 -->
            <el-alert v-if="latestQuote.status === 'rejected' && latestQuote.reject_reason"
              :title="'驳回原因：' + latestQuote.reject_reason" type="error" show-icon style="margin-top:12px" />

            <!-- 备注 -->
            <div v-if="latestQuote.notes" style="margin-top:12px;color:#999;font-size:13px">
              <strong>备注：</strong>{{ latestQuote.notes }}
            </div>

            <!-- 审批按钮 (管理员) -->
            <div v-if="latestQuote.status === 'submitted'" style="margin-top:16px;padding-top:16px;border-top:1px solid #EBEEF5">
              <el-input v-model="rejectReason" placeholder="驳回原因（选填）" size="small" style="width:300px;margin-right:12px" />
              <el-button type="danger" @click="handleRejectQuote(latestQuote.id)" :loading="quoteLoading">驳回报价</el-button>
              <el-button type="success" @click="handleApproveQuote(latestQuote.id)" :loading="quoteLoading">通过报价</el-button>
            </div>
          </template>

          <!-- 历史报价 -->
          <el-collapse v-if="quotations.length > 1" style="margin-top:12px">
            <el-collapse-item :title="`历史报价 (${quotations.length - 1} 版)`">
              <el-timeline>
                <el-timeline-item v-for="q in quotations.slice(1)" :key="q.id"
                  :timestamp="q.created_at" placement="top">
                  <p><strong>{{ q.quotation_no }}</strong> — ¥{{ q.total_cost }}</p>
                  <p style="color:#999">{{ quoteStatusMap[q.status] }}<span v-if="q.reject_reason"> — {{ q.reject_reason }}</span></p>
                </el-timeline-item>
              </el-timeline>
            </el-collapse-item>
          </el-collapse>
        </el-card>

        <!-- 维修记录 -->
        <el-card shadow="never" style="margin-top:16px" v-if="order.repair_record">
          <template #header>维修记录</template>
          <el-descriptions :column="2" size="small" border>
            <el-descriptions-item label="故障原因" :span="2">{{ order.repair_record.fault_cause }}</el-descriptions-item>
            <el-descriptions-item label="处理方案" :span="2">{{ order.repair_record.solution }}</el-descriptions-item>
            <el-descriptions-item label="人工费">¥{{ order.repair_record.labor_cost }}</el-descriptions-item>
            <el-descriptions-item label="配件费">¥{{ order.repair_record.parts_cost }}</el-descriptions-item>
            <el-descriptions-item label="总费用"><strong style="color:#FF4D4F">¥{{ order.repair_record.total_cost }}</strong></el-descriptions-item>
          </el-descriptions>
          <div v-if="order.repair_record.parts_used?.length" style="margin-top:12px">
            <strong>更换配件：</strong>
            <el-tag v-for="p in order.repair_record.parts_used" :key="p.name" style="margin:4px">{{ p.name }} ×{{ p.qty }} ¥{{ p.unit_price }}</el-tag>
          </div>
        </el-card>

        <!-- 操作日志 -->
        <el-card shadow="never" style="margin-top:16px">
          <template #header>操作记录</template>
          <el-timeline>
            <el-timeline-item v-for="log in order.logs" :key="log.id" :timestamp="log.created_at" placement="top">
              {{ log.detail }}
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>

      <!-- 右侧边栏 -->
      <el-col :span="10">
        <!-- 指派工程师 -->
        <el-card shadow="never" v-if="order.status === 'pending'">
          <template #header>指派工程师</template>
          <el-select v-model="selectedEngineer" placeholder="选择工程师" style="width:100%" filterable @focus="loadEngineers">
            <el-option v-for="e in engineers" :key="e.id" :label="`${e.name} — ${e.type==='self_employed'?'自营':'认证'} ⭐${e.rating} (${e.status==='online'?'在线':e.status==='busy'?'忙碌':'离线'})`" :value="e.id" />
          </el-select>
          <el-button type="primary" style="width:100%;margin-top:12px" @click="handleAssign" :loading="assigning">确认派单</el-button>
        </el-card>

        <!-- 已指派工程师 -->
        <el-card shadow="never" v-if="order.engineer">
          <template #header>维修工程师</template>
          <div style="display:flex;align-items:center;gap:12px">
            <el-avatar :size="56">{{ order.engineer.name?.charAt(0) }}</el-avatar>
            <div>
              <div><strong>{{ order.engineer.name }}</strong></div>
              <div style="color:#999;font-size:13px">{{ order.engineer.phone }}</div>
              <div>⭐ {{ order.engineer.rating }}分</div>
            </div>
          </div>
        </el-card>

        <!-- 报价审批快捷操作 -->
        <el-card shadow="never" style="margin-top:16px" v-if="latestQuote?.status === 'submitted'">
          <template #header>💬 报价审批（快捷）</template>
          <p style="font-size:13px;color:#666;margin-bottom:12px">
            工单 <strong>{{ order.order_no }}</strong> 等待报价审批
          </p>
          <p style="font-size:20px;color:#FF4D4F;font-weight:bold">¥{{ latestQuote.total_cost }}</p>
          <div style="margin-top:12px">
            <el-input v-model="rejectReasonSide" placeholder="驳回原因" size="small" style="margin-bottom:8px" />
            <el-button-group>
              <el-button type="danger" size="small" @click="handleRejectQuote(latestQuote.id)" :loading="quoteLoading">驳回</el-button>
              <el-button type="success" size="small" @click="handleApproveQuote(latestQuote.id)" :loading="quoteLoading">通过</el-button>
            </el-button-group>
          </div>
        </el-card>

        <!-- 评价 -->
        <el-card shadow="never" style="margin-top:16px" v-if="order.comment">
          <template #header>用户评价</template>
          <div>⭐ {{ order.comment.rating }} / 5</div>
          <div style="margin-top:8px">{{ order.comment.content || '无文字评价' }}</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { getOrderDetail, assignOrder } from '@/api';
import api from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const route = useRoute();
const order = ref(null); const loading = ref(true);
const engineers = ref([]); const selectedEngineer = ref(null); const assigning = ref(false);
const quotations = ref([]);
const quoteLoading = ref(false);
const rejectReason = ref('');
const rejectReasonSide = ref('');

const latestQuote = computed(() => quotations.value.length > 0 ? quotations.value[0] : null);

async function loadEngineers() {
  try {
    const res = await api.get('/admin/engineers', { params: { pageSize: 100 } });
    engineers.value = res.data?.list || res.data || [];
  } catch(e) {}
}

const statusMap = { pending:'待接单', accepted:'已接单', diagnosing:'诊断中', quoted:'待审批/支付', paid:'已支付', repairing:'维修中', completed:'维修完成', pending_review:'待评价', confirmed:'已评价', cancelled:'已取消' };
const tagMap = { pending:'warning', accepted:'', diagnosing:'', quoted:'warning', paid:'', repairing:'', completed:'success', pending_review:'warning', confirmed:'success', cancelled:'info' };
const priorityMap = { normal:'普通', urgent:'⚠️ 紧急', critical:'🔴 严重' };
const quoteStatusMap = { draft:'草稿', submitted:'待审批', approved:'已通过', rejected:'已驳回' };
const quoteTagMap = { draft:'info', submitted:'warning', approved:'success', rejected:'danger' };

async function loadDetail() {
  loading.value = true;
  try {
    const res = await getOrderDetail(route.params.id);
    order.value = res.data || res;

    // 加载报价信息
    if (order.value?.quotations?.length) {
      quotations.value = order.value.quotations;
    } else {
      // 单独请求
      try {
        const qRes = await api.get(`/quote/order/${route.params.id}`);
        quotations.value = qRes.data?.list || [];
      } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore */ }
  finally { loading.value = false; }
}

async function handleAssign() {
  if (!selectedEngineer.value) return ElMessage.warning('请选择工程师');
  assigning.value = true;
  try {
    await assignOrder(order.value.id, { engineer_id: selectedEngineer.value });
    ElMessage.success('派单成功');
    loadDetail();
  } catch (e) { ElMessage.error('派单失败'); }
  finally { assigning.value = false; }
}

async function handleApproveQuote(quoteId) {
  ElMessageBox.confirm('确认通过该报价？系统将生成支付单，支付完成后工程师才能开始维修。', '确认审批', {
    confirmButtonText: '确认通过',
    cancelButtonText: '取消',
    type: 'success'
  }).then(async () => {
    quoteLoading.value = true;
    try {
      await api.post(`/quote/${quoteId}/approve`, { notes: rejectReason.value || rejectReasonSide.value });
      ElMessage.success('报价已通过');
      rejectReason.value = '';
      rejectReasonSide.value = '';
      loadDetail();
    } catch (e) { ElMessage.error(e.response?.data?.message || '操作失败'); }
    finally { quoteLoading.value = false; }
  }).catch(() => {});
}

async function handleRejectQuote(quoteId) {
  const reason = rejectReason.value || rejectReasonSide.value;
  ElMessageBox.prompt('请输入驳回原因', '驳回报价', {
    confirmButtonText: '确认驳回',
    cancelButtonText: '取消',
    inputPlaceholder: '如：价格偏高，请重新报价',
    inputType: 'textarea',
    type: 'warning'
  }).then(async ({ value }) => {
    if (!value || !value.trim()) {
      return ElMessage.warning('请填写驳回原因');
    }
    quoteLoading.value = true;
    try {
      await api.post(`/quote/${quoteId}/reject`, { reject_reason: value });
      ElMessage.success('报价已驳回');
      rejectReason.value = '';
      rejectReasonSide.value = '';
      loadDetail();
    } catch (e) { ElMessage.error(e.response?.data?.message || '操作失败'); }
    finally { quoteLoading.value = false; }
  }).catch(() => {});
}

onMounted(() => { loadDetail(); loadEngineers(); });
</script>
