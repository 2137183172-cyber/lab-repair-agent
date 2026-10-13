<template>
  <view class="repair-page">
    <!-- 工单信息 -->
    <view class="order-info" v-if="order">
      <view class="oi-header">
        <text class="oi-no">{{ order.order_no }}</text>
        <text class="oi-status" :class="order.status">{{ statusMap[order.status] }}</text>
      </view>
      <view class="oi-device">
        <text class="label">设备：</text><text>{{ order.device?.name || '未指定' }}</text>
      </view>
      <view class="oi-desc">
        <text class="label">故障描述：</text><text>{{ order.fault_desc }}</text>
      </view>
      <view class="oi-contact">
        <text>联系人：{{ order.contact_name || order.reporter?.name }} {{ order.contact_phone || order.reporter?.phone }}</text>
        <text class="oi-addr" v-if="order.address">📍 {{ order.address }}</text>
      </view>
      <!-- 故障图片 -->
      <view class="oi-images" v-if="order.fault_images && order.fault_images.length">
        <image v-for="(img,i) in order.fault_images" :key="i" :src="img" mode="aspectFill" @click="previewImage(order.fault_images, i)" />
      </view>
    </view>

    <!-- 操作区 -->
    <view class="action-section">
      <!-- ===== 已接单 → 开始诊断 ===== -->
      <view v-if="order?.status === 'accepted'" class="start-section">
        <view class="section-title">🔍 现场诊断</view>
        <view class="tip">
          <text>• 确认已到达现场</text>
          <text>• 开机检查，诊断故障原因</text>
          <text>• 拍照记录设备当前状态</text>
          <text>• 如需更换高价值配件，可先创建报价单</text>
        </view>
        <button class="btn-primary" @click="handleStartDiagnosis" :loading="submitting">🔍 开始诊断</button>
      </view>

      <!-- ===== 诊断中 → 创建报价 ===== -->
      <view v-if="order?.status === 'diagnosing'" class="start-section">
        <view class="section-title">🔍 诊断中</view>
        <view class="tip">
          <text>• 请根据诊断结果决定是否需要报价</text>
          <text>• 如需更换高价值配件，先提交报价单给客户审批</text>
          <text>• 报价审批并支付后才可开始维修</text>
        </view>
        <button class="btn-primary" @click="goCreateQuote">📋 创建报价单</button>
      </view>

      <!-- ===== 已报价（等待审批） ===== -->
      <view v-if="order?.status === 'quoted'" class="quote-status-section">
        <view class="section-title">⏳ 报价待审批/支付</view>
        <view class="quote-card" v-if="latestQuote" @click="goQuoteDetail(latestQuote.id)">
          <view class="qc-header">
            <text class="qc-no">{{ latestQuote.quotation_no }}</text>
            <text class="qc-badge" :class="latestQuote.status">
              {{ quoteStatusMap[latestQuote.status] }}
            </text>
          </view>
          <view class="qc-summary" v-if="latestQuote.diagnosis_summary">
            <text class="qc-label">诊断：</text>{{ latestQuote.diagnosis_summary }}
          </view>
          <view class="qc-items" v-if="latestQuote.items">
            <view v-for="(item, i) in latestQuote.items.slice(0, 3)" :key="i" class="qc-item">
              <text class="qc-item-name">{{ item.name }}</text>
              <text class="qc-item-qty">×{{ item.qty }}</text>
              <text class="qc-item-price">¥{{ item.unit_price }}</text>
            </view>
            <text v-if="latestQuote.items.length > 3" class="qc-more">...共{{ latestQuote.items.length }}项</text>
          </view>
          <view class="qc-total">
            <text>合计：</text><text class="qc-total-price">¥{{ latestQuote.total_cost }}</text>
          </view>
        </view>
        <view class="tip" style="margin-top: 24rpx;">
          <text>💡 等待客户或管理员审批报价并完成支付</text>
          <text>支付完成后即可开始维修</text>
        </view>
      </view>

      <!-- ===== 已支付 → 开始维修 ===== -->
      <view v-if="order?.status === 'paid'" class="start-section">
        <view class="section-title">✅ 已支付</view>
        <view class="tip">
          <text>• 客户已完成支付或管理员已确认线下收款</text>
          <text>• 可以开始维修并按已审批报价填写报告</text>
        </view>
        <button class="btn-primary" @click="handleStartRepair" :loading="submitting">开始维修</button>
      </view>

      <!-- ===== 维修中 → 填报告（原有流程） ===== -->
      <view v-if="order?.status === 'repairing'" class="report-section">
        <view class="section-title">维修报告</view>

        <!-- 已审批报价提示 -->
        <view class="approved-quote-banner" v-if="approvedQuote">
          <text class="aqb-title">✅ 已审批报价 — ¥{{ approvedQuote.total_cost }}</text>
          <text class="aqb-desc">配件清单已自动带入下方"使用配件"区域</text>
        </view>

        <!-- 维修前照片 -->
        <view class="form-group">
          <text class="form-label">维修前照片</text>
          <view class="img-upload-row">
            <view v-for="(img,i) in beforeImages" :key="'b'+i" class="img-item" @click="previewImage(beforeImages, i)">
              <image :src="img" mode="aspectFill" />
              <text class="img-del" @click.stop="beforeImages.splice(i,1)">✕</text>
            </view>
            <view class="img-add" @click="chooseImage('before')" v-if="beforeImages.length < 6">
              <text class="add-icon">+</text>
              <text class="add-text">添加</text>
            </view>
          </view>
        </view>

        <!-- 故障原因 -->
        <view class="form-group">
          <text class="form-label">故障原因诊断</text>
          <textarea v-model="form.fault_cause" placeholder="请描述故障原因" class="form-textarea" />
        </view>

        <!-- 处理方案 -->
        <view class="form-group">
          <text class="form-label">处理方案</text>
          <textarea v-model="form.solution" placeholder="请描述处理方案" class="form-textarea" />
        </view>

        <!-- 使用配件 -->
        <view class="form-group">
          <text class="form-label">使用配件</text>
          <view v-for="(p,i) in form.parts_used" :key="i" class="part-row">
            <input v-model="p.name" placeholder="配件名称" class="part-input" />
            <input v-model="p.sku" placeholder="型号" class="part-input short" />
            <input v-model.number="p.qty" type="number" placeholder="数量" class="part-input xs" />
            <input v-model.number="p.unit_price" type="digit" placeholder="单价" class="part-input short" />
            <text class="part-total">¥{{ ((p.qty||0)*(p.unit_price||0)).toFixed(2) }}</text>
            <text class="part-del" @click="form.parts_used.splice(i,1)">✕</text>
          </view>
          <button class="btn-add-part" @click="form.parts_used.push({name:'',sku:'',qty:1,unit_price:0})">+ 添加配件</button>
        </view>

        <!-- 人工费 -->
        <view class="form-group">
          <text class="form-label">人工费（元）</text>
          <input v-model.number="form.labor_cost" type="digit" placeholder="0.00" class="form-input" />
        </view>

        <!-- 费用汇总 -->
        <view class="cost-summary" v-if="totalCost > 0">
          <text>配件费：¥{{ partsCost.toFixed(2) }}</text>
          <text>人工费：¥{{ (form.labor_cost||0).toFixed(2) }}</text>
          <text class="total">合计：¥{{ totalCost.toFixed(2) }}</text>
        </view>

        <!-- 维修后照片 -->
        <view class="form-group">
          <text class="form-label">维修后照片</text>
          <view class="img-upload-row">
            <view v-for="(img,i) in afterImages" :key="'a'+i" class="img-item" @click="previewImage(afterImages, i)">
              <image :src="img" mode="aspectFill" />
              <text class="img-del" @click.stop="afterImages.splice(i,1)">✕</text>
            </view>
            <view class="img-add" @click="chooseImage('after')" v-if="afterImages.length < 6">
              <text class="add-icon">+</text>
              <text class="add-text">添加</text>
            </view>
          </view>
        </view>

        <!-- 备注 -->
        <view class="form-group">
          <text class="form-label">备注</text>
          <textarea v-model="form.notes" placeholder="其他需要说明的事项..." class="form-textarea" />
        </view>

        <button class="btn-primary" @click="handleSubmitReport" :loading="submitting">📋 提交维修报告</button>
      </view>
    </view>

    <!-- 已完成的维修记录 -->
    <view class="record-section" v-if="['pending_review', 'completed', 'confirmed'].includes(order?.status)">
      <view class="section-title">✅ 维修已完成</view>
      <view class="record-card" v-if="record">
        <view class="rc-item"><text class="rc-label">故障原因：</text>{{ record.fault_cause }}</view>
        <view class="rc-item"><text class="rc-label">处理方案：</text>{{ record.solution }}</view>
        <view class="rc-item" v-if="record.parts_used && record.parts_used.length">
          <text class="rc-label">使用配件：</text>
          <text v-for="(p,i) in record.parts_used" :key="i">{{ p.name }} ×{{ p.qty }} ¥{{ p.unit_price }}/个</text>
        </view>
        <view class="rc-cost">
          <text>人工费 ¥{{ record.labor_cost }} + 配件费 ¥{{ record.parts_cost }} =</text>
          <text class="rc-total">¥{{ record.total_cost }}</text>
        </view>
        <view class="rc-images" v-if="record.after_images && record.after_images.length">
          <text class="rc-label">维修后照片：</text>
          <view class="img-row">
            <image v-for="(img,i) in record.after_images" :key="i" :src="img" mode="aspectFill" @click="previewImage(record.after_images, i)" />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, reactive } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { getOrderDetail, startDiagnosis, startRepair, completeRepair, uploadImage, getOrderQuotes } from '@/api/index';

const order = ref(null);
const record = ref(null);
const latestQuote = ref(null);
const approvedQuote = ref(null);
const submitting = ref(false);
const beforeImages = ref([]);
const afterImages = ref([]);
const form = reactive({
  fault_cause: '',
  solution: '',
  parts_used: [],
  labor_cost: 0,
  notes: ''
});

const statusMap = {
  pending:'待接单', accepted:'已接单', diagnosing:'诊断中', quoted:'待审批',
  paid:'已支付', repairing:'维修中', pending_review:'待用户评价', completed:'已完成', confirmed:'已验收', cancelled:'已取消'
};
const quoteStatusMap = {
  draft:'草稿', submitted:'待审批', approved:'已通过', rejected:'已驳回'
};

const partsCost = computed(() =>
  form.parts_used.reduce((sum, p) => sum + (p.qty || 0) * (p.unit_price || 0), 0)
);
const totalCost = computed(() => partsCost.value + (parseFloat(form.labor_cost) || 0));

async function loadOrder(id) {
  try {
    const data = await getOrderDetail(id);
    order.value = data.order || data;
    record.value = data.repair_record || null;

    // 如果工单有 quotations，加载报价信息
    if (order.value?.quotations?.length) {
      latestQuote.value = order.value.quotations[0];
      approvedQuote.value = order.value.quotations.find(q => q.status === 'approved') || null;

      // 如果有已审批报价，自动填入配件和人工费
      if (approvedQuote.value && order.value.status === 'repairing') {
        if (approvedQuote.value.diagnosis_summary) {
          form.fault_cause = approvedQuote.value.diagnosis_summary;
        }
        if (approvedQuote.value.items) {
          form.parts_used = approvedQuote.value.items
            .filter(item => item.type === 'parts')
            .map(item => ({ name: item.name, sku: item.spec || '', qty: item.qty, unit_price: item.unit_price }));
        }
        if (approvedQuote.value.labor_cost) {
          form.labor_cost = parseFloat(approvedQuote.value.labor_cost);
        }
      }
    }

    // 如果没有 quotations 在 include 里，单独获取
    if (!order.value?.quotations) {
      try {
        const quoteData = await getOrderQuotes(order.value.id || id);
        if (quoteData?.latest) {
          latestQuote.value = quoteData.latest;
          approvedQuote.value = quoteData.list?.find(q => q.status === 'approved') || null;
        }
      } catch (e) { /* ignore */ }
    }
  } catch (e) {
    /* ignore */
  }
}

function chooseImage(type) {
  uni.chooseImage({
    count: 6,
    sizeType: ['compressed'],
    success: async (res) => {
      uni.showLoading({ title: '上传中...' });
      try {
        for (const fp of res.tempFilePaths) {
          const data = await uploadImage(fp);
          const url = data.url || data;
          if (type === 'before') beforeImages.value.push(url);
          else afterImages.value.push(url);
        }
      } catch (e) { uni.showToast({ title: '上传失败', icon: 'none' }); }
      uni.hideLoading();
    }
  });
}

function previewImage(urls, current) {
  uni.previewImage({ urls, current: urls[current] || urls[0] });
}

function goCreateQuote() {
  uni.navigateTo({ url: `/pages/engineer/quote?id=${order.value.id}` });
}

function goQuoteDetail(qid) {
  uni.navigateTo({ url: `/pages/engineer/quote-detail?id=${qid}&orderId=${order.value.id}` });
}

async function handleStartDiagnosis() {
  uni.showModal({
    title: '开始诊断',
    content: '确认已到达现场，准备诊断设备故障？',
    success: async (resp) => {
      if (!resp.confirm) return;
      submitting.value = true;
      try {
        await startDiagnosis(order.value.id);
        uni.showToast({ title: '已开始诊断', icon: 'success' });
        setTimeout(() => loadOrder(order.value.id), 500);
      } catch (e) { uni.showToast({ title: e.message || '操作失败', icon: 'none' }); }
      submitting.value = false;
    }
  });
}

async function handleStartRepair() {
  uni.showModal({
    title: '开始维修',
    content: '确认已完成支付，开始维修？',
    success: async (resp) => {
      if (!resp.confirm) return;
      submitting.value = true;
      try {
        await startRepair(order.value.id);
        uni.showToast({ title: '已开始维修', icon: 'success' });
        setTimeout(() => loadOrder(order.value.id), 500);
      } catch (e) { uni.showToast({ title: e.message || '操作失败', icon: 'none' }); }
      submitting.value = false;
    }
  });
}

async function handleSubmitReport() {
  if (!form.fault_cause) return uni.showToast({ title: '请填写故障原因', icon: 'none' });
  if (!form.solution) return uni.showToast({ title: '请填写处理方案', icon: 'none' });

  uni.showModal({
    title: '提交报告',
    content: `费用合计 ¥${totalCost.value.toFixed(2)}，确认提交？`,
    success: async (resp) => {
      if (!resp.confirm) return;
      submitting.value = true;
      try {
        await completeRepair(order.value.id, {
          fault_cause: form.fault_cause,
          solution: form.solution,
          parts_used: form.parts_used.filter(p => p.name),
          labor_cost: parseFloat(form.labor_cost) || 0,
          before_images: beforeImages.value,
          after_images: afterImages.value,
          notes: form.notes
        });
        uni.showToast({ title: '提交成功', icon: 'success' });
        setTimeout(() => loadOrder(order.value.id), 500);
      } catch (e) { uni.showToast({ title: e.message || '操作失败', icon: 'none' }); }
      submitting.value = false;
    }
  });
}

onLoad((options) => {
  if (options.id) loadOrder(options.id);
});
</script>

<style lang="scss" scoped>
.repair-page { min-height: 100vh; background: #F5F6FA; padding-bottom: 40rpx; }

// Order Info
.order-info { background: #fff; margin: 24rpx; border-radius: 16rpx; padding: 24rpx; }
.oi-header { display: flex; justify-content: space-between; margin-bottom: 12rpx; }
.oi-no { font-weight: 600; font-size: 28rpx; }
.oi-status { font-size: 24rpx; padding: 6rpx 16rpx; border-radius: 8rpx; }
.oi-status.accepted, .oi-status.paid, .oi-status.repairing, .oi-status.diagnosing { background:#E6F4FF; color:#1677FF; }
.oi-status.quoted { background:#FFF7E6; color:#FA8C16; }
.oi-status.completed, .oi-status.pending_review, .oi-status.confirmed { background:#F6FFED; color:#52C41A; }
.oi-device, .oi-desc { font-size: 26rpx; margin-bottom: 8rpx; .label { color: #999; } }
.oi-contact { font-size: 24rpx; color: #999; display: flex; flex-direction: column; }
.oi-addr { margin-top: 4rpx; }
.oi-images { display: flex; gap: 12rpx; margin-top: 12rpx; flex-wrap: wrap;
  image { width: 140rpx; height: 140rpx; border-radius: 8rpx; background: #EEE; }
}

// Action Section
.action-section { margin: 0 24rpx; }
.section-title { font-size: 30rpx; font-weight: 600; margin-bottom: 24rpx; }
.start-section { background: #fff; border-radius: 16rpx; padding: 24rpx;
  .tip { margin-bottom: 24rpx; text { display: block; font-size: 26rpx; color: #666; line-height: 2; } }
}

// Quote Status
.quote-status-section { background: #fff; border-radius: 16rpx; padding: 24rpx; }
.quote-card { background: #FFFBE6; border: 2rpx solid #FFE58F; border-radius: 12rpx; padding: 20rpx; margin-bottom: 16rpx; }
.qc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.qc-no { font-weight: 600; font-size: 26rpx; }
.qc-badge { font-size: 22rpx; padding: 4rpx 12rpx; border-radius: 6rpx; background: #FFF7E6; color: #FA8C16; }
.qc-badge.approved { background: #F6FFED; color: #52C41A; }
.qc-badge.rejected { background: #FFF1F0; color: #FF4D4F; }
.qc-summary { font-size: 24rpx; color: #666; margin-bottom: 12rpx; line-height: 1.6; }
.qc-label { color: #999; }
.qc-items { margin-bottom: 12rpx; }
.qc-item { display: flex; align-items: center; gap: 12rpx; padding: 6rpx 0; font-size: 24rpx; }
.qc-item-name { flex: 1; color: #333; }
.qc-item-qty { color: #999; }
.qc-item-price { color: #1677FF; }
.qc-more { font-size: 22rpx; color: #999; padding-left: 8rpx; }
.qc-total { display: flex; justify-content: space-between; padding-top: 12rpx; border-top: 1rpx solid #FFE58F; font-size: 28rpx; }
.qc-total-price { color: #FF4D4F; font-weight: 600; font-size: 32rpx; }

// Approved Quote Banner
.approved-quote-banner { background: #F6FFED; border: 2rpx solid #B7EB8F; border-radius: 8rpx; padding: 16rpx 20rpx; margin-bottom: 24rpx;
  .aqb-title { display: block; font-size: 26rpx; font-weight: 600; color: #52C41A; }
  .aqb-desc { display: block; font-size: 22rpx; color: #999; margin-top: 4rpx; }
}

.report-section { background: #fff; border-radius: 16rpx; padding: 24rpx; }

// Form
.form-group { margin-bottom: 24rpx; }
.form-label { font-size: 26rpx; color: #333; font-weight: 500; margin-bottom: 12rpx; display: block; }
.form-textarea { width: 100%; min-height: 140rpx; padding: 16rpx; background: #F5F6FA; border-radius: 8rpx; font-size: 26rpx; box-sizing: border-box; }
.form-input { width: 100%; padding: 16rpx; background: #F5F6FA; border-radius: 8rpx; font-size: 26rpx; }

// Image Upload
.img-upload-row { display: flex; flex-wrap: wrap; gap: 12rpx; }
.img-item { position: relative; width: 140rpx; height: 140rpx;
  image { width: 100%; height: 100%; border-radius: 8rpx; }
  .img-del { position: absolute; top: -10rpx; right: -10rpx; width: 36rpx; height: 36rpx; background: #FF4D4F; color: #fff; border-radius: 50%; text-align: center; line-height: 36rpx; font-size: 22rpx; }
}
.img-add { width: 140rpx; height: 140rpx; background: #F5F6FA; border: 2rpx dashed #DDD; border-radius: 8rpx; display: flex; flex-direction: column; align-items: center; justify-content: center;
  .add-icon { font-size: 48rpx; color: #CCC; line-height: 1; }
  .add-text { font-size: 22rpx; color: #CCC; }
}

// Parts
.part-row { display: flex; align-items: center; gap: 8rpx; margin-bottom: 12rpx; }
.part-input { flex: 1; padding: 12rpx; background: #F5F6FA; border-radius: 8rpx; font-size: 24rpx; &.short { flex: 0 0 140rpx; } &.xs { flex: 0 0 80rpx; } }
.part-total { font-size: 24rpx; color: #1677FF; white-space: nowrap; }
.part-del { font-size: 28rpx; color: #FF4D4F; padding: 8rpx; }
.btn-add-part { width: 100%; padding: 16rpx; background: #F5F6FA; color: #1677FF; border: 2rpx dashed #1677FF; border-radius: 8rpx; font-size: 26rpx; }

// Cost Summary
.cost-summary { background: #F6FFED; border-radius: 8rpx; padding: 16rpx 24rpx; margin-bottom: 24rpx; display: flex; flex-direction: column; gap: 4rpx; font-size: 26rpx; color: #666;
  .total { color: #1677FF; font-weight: 600; font-size: 30rpx; }
}

// Record
.record-section { margin: 0 24rpx; }
.record-card { background: #fff; border-radius: 16rpx; padding: 24rpx; }
.rc-item { font-size: 26rpx; margin-bottom: 12rpx; }
.rc-label { color: #999; }
.rc-cost { font-size: 28rpx; margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid #F0F0F0; display: flex; justify-content: space-between; align-items: center; }
.rc-total { font-size: 36rpx; color: #FF4D4F; font-weight: 600; }
.rc-images { margin-top: 12rpx; }
.img-row { display: flex; gap: 12rpx; margin-top: 8rpx;
  image { width: 140rpx; height: 140rpx; border-radius: 8rpx; }
}

// Tip for quoted
.tip text { display: block; font-size: 24rpx; color: #999; line-height: 1.8; }

// Btn
.btn-primary { width: 100%; margin-top: 16rpx; background: linear-gradient(135deg, #1677FF, #0958D9); color: #fff; border-radius: 12rpx; padding: 24rpx; font-size: 30rpx; border: none; }
.btn-secondary { width: 100%; margin-top: 16rpx; background: #F5F6FA; color: #666; border-radius: 12rpx; padding: 24rpx; font-size: 28rpx; border: 2rpx solid #E0E0E0; }
</style>
