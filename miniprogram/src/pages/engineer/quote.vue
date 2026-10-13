<template>
  <view class="quote-page">
    <!-- 工单简要信息 -->
    <view class="order-brief" v-if="order">
      <text class="ob-no">{{ order.order_no }}</text>
      <text class="ob-device">{{ order.device?.name || '未指定设备' }}</text>
      <text class="ob-fault">{{ order.fault_desc }}</text>
    </view>

    <!-- 诊断摘要 -->
    <view class="form-card">
      <view class="card-title">🔍 诊断摘要</view>
      <textarea v-model="diagnosis_summary" placeholder="请描述诊断结果，作为报价依据。例如：离心机电机轴承严重磨损，需更换电机总成及轴承套件..." class="form-textarea" />
      <view class="img-upload-row" style="margin-top:16rpx;">
        <view v-for="(img,i) in diagnosisImages" :key="'di'+i" class="img-item" @click="previewImage(diagnosisImages, i)">
          <image :src="img" mode="aspectFill" />
          <text class="img-del" @click.stop="diagnosisImages.splice(i,1)">✕</text>
        </view>
        <view class="img-add" @click="chooseDiagnosisImage" v-if="diagnosisImages.length < 6">
          <text class="add-icon">+</text>
          <text class="add-text">拍照</text>
        </view>
      </view>
    </view>

    <!-- 报价明细 -->
    <view class="form-card">
      <view class="card-title">💰 费用明细</view>

      <!-- 配件项 -->
      <view class="items-section">
        <view class="items-header">
          <text class="ih-label">配件 / 服务项目</text>
          <text class="ih-add" @click="addItem('parts')">+ 添加配件</text>
        </view>
        <view v-for="(item, i) in quoteItems.filter(it => it.type !== 'labor')" :key="'p'+i" class="item-row">
          <input v-model="item.name" placeholder="项目名称" class="item-input name" />
          <input v-model="item.spec" placeholder="规格型号" class="item-input spec" />
          <input v-model.number="item.qty" type="number" placeholder="数量" class="item-input qty" />
          <input v-model.number="item.unit_price" type="digit" placeholder="单价" class="item-input price" />
          <text class="item-subtotal">¥{{ ((item.qty||0) * (item.unit_price||0)).toFixed(2) }}</text>
          <text class="item-del" @click="removeItem(i)">✕</text>
        </view>
      </view>

      <!-- 人工费 -->
      <view class="items-section">
        <view class="items-header">
          <text class="ih-label">人工费</text>
          <text class="ih-add" @click="addItem('labor')">+ 添加人工项</text>
        </view>
        <view v-for="(item, i) in quoteItems.filter(it => it.type === 'labor')" :key="'l'+i" class="item-row">
          <input v-model="item.name" placeholder="服务内容（如：上门诊断+更换）" class="item-input name" />
          <input v-model.number="item.qty" type="number" placeholder="次数" class="item-input qty" />
          <input v-model.number="item.unit_price" type="digit" placeholder="单价" class="item-input price" />
          <text class="item-subtotal">¥{{ ((item.qty||0) * (item.unit_price||0)).toFixed(2) }}</text>
          <text class="item-del" @click="removeItemByType('labor', item)">✕</text>
        </view>
      </view>

      <!-- 汇总 -->
      <view class="cost-card">
        <view class="cc-row">
          <text>配件费</text><text>¥{{ partsCost.toFixed(2) }}</text>
        </view>
        <view class="cc-row">
          <text>人工费</text><text>¥{{ laborCost.toFixed(2) }}</text>
        </view>
        <view class="cc-row cc-divider">
          <text>报价合计</text><text class="cc-total">¥{{ totalCost.toFixed(2) }}</text>
        </view>
      </view>
    </view>

    <!-- 报价备注 -->
    <view class="form-card">
      <view class="card-title">📝 备注</view>
      <textarea v-model="notes" placeholder="如：建议使用原厂配件以保证设备稳定性、保修期说明等..." class="form-textarea short" />
      <view class="valid-row">
        <text class="vr-label">报价有效期：</text>
        <picker mode="date" :value="validUntil" @change="onDateChange">
          <text class="vr-date">{{ validUntil || '请选择' }}</text>
        </picker>
      </view>
    </view>

    <!-- 提交按钮 -->
    <view class="btn-area">
      <button class="btn-draft" @click="handleSubmit(false)" :loading="saving">💾 保存草稿</button>
      <button class="btn-submit" @click="handleSubmit(true)" :loading="submitting">📋 提交报价</button>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { getOrderDetail, createQuote, submitQuote, uploadImage } from '@/api/index';

const order = ref(null);
const orderId = ref('');
const diagnosis_summary = ref('');
const diagnosisImages = ref([]);
const quoteItems = ref([]);
const notes = ref('');
const validUntil = ref('');
const saving = ref(false);
const submitting = ref(false);

const partsCost = computed(() =>
  quoteItems.value
    .filter(it => it.type !== 'labor')
    .reduce((sum, it) => sum + (it.qty || 0) * (it.unit_price || 0), 0)
);
const laborCost = computed(() =>
  quoteItems.value
    .filter(it => it.type === 'labor')
    .reduce((sum, it) => sum + (it.qty || 0) * (it.unit_price || 0), 0)
);
const totalCost = computed(() => partsCost.value + laborCost.value);

function addItem(type) {
  quoteItems.value.push({ name: '', spec: '', qty: 1, unit_price: 0, type });
}
function removeItem(idx) {
  quoteItems.value.splice(idx, 1);
}
function removeItemByType(type, target) {
  const idx = quoteItems.value.findIndex(it => it.type === type && it === target);
  if (idx >= 0) quoteItems.value.splice(idx, 1);
}

function onDateChange(e) {
  validUntil.value = e.detail.value;
}

async function chooseDiagnosisImage() {
  uni.chooseImage({
    count: 6 - diagnosisImages.value.length,
    sizeType: ['compressed'],
    success: async (res) => {
      uni.showLoading({ title: '上传中...' });
      for (const fp of res.tempFilePaths) {
        try {
          const data = await uploadImage(fp);
          diagnosisImages.value.push(data.url || data);
        } catch (e) { /* skip */ }
      }
      uni.hideLoading();
    }
  });
}

function previewImage(urls, current) {
  uni.previewImage({ urls, current: urls[current] || urls[0] });
}

async function handleSubmit(submit) {
  if (submit && quoteItems.value.length === 0) {
    return uni.showToast({ title: '请至少添加一项报价明细', icon: 'none' });
  }

  if (submit) {
    submitting.value = true;
  } else {
    saving.value = true;
  }

  try {
    const result = await createQuote({
      order_id: orderId.value,
      diagnosis_summary: diagnosis_summary.value,
      diagnosis_images: diagnosisImages.value,
      items: quoteItems.value.map(it => ({
        ...it,
        subtotal: (it.qty || 0) * (it.unit_price || 0)
      })),
      notes: notes.value,
      valid_until: validUntil.value || undefined,
      submit
    });

    uni.showToast({ title: submit ? '报价已提交' : '草稿已保存', icon: 'success' });
    setTimeout(() => uni.navigateBack(), 800);
  } catch (e) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' });
  }
  saving.value = false;
  submitting.value = false;
}

onLoad(async (options) => {
  // C-F5: 兼容 id 和 orderId 两种参数名
  const oid = options.id || options.orderId;
  if (oid) {
    orderId.value = oid;
    try {
      const data = await getOrderDetail(oid);
      order.value = data.order || data;
    } catch (e) { /* ignore */ }
  }
});
</script>

<style lang="scss" scoped>
.quote-page { min-height: 100vh; background: #F5F6FA; padding-bottom: 40rpx; }

// Order Brief
.order-brief { background: #fff; margin: 24rpx; border-radius: 16rpx; padding: 24rpx; display: flex; flex-direction: column; gap: 8rpx; }
.ob-no { font-weight: 600; font-size: 28rpx; color: #1677FF; }
.ob-device { font-size: 26rpx; color: #333; }
.ob-fault { font-size: 24rpx; color: #999; line-height: 1.5; }

// Form Card
.form-card { background: #fff; margin: 0 24rpx 24rpx; border-radius: 16rpx; padding: 24rpx; }
.card-title { font-size: 30rpx; font-weight: 600; margin-bottom: 16rpx; }
.form-textarea { width: 100%; min-height: 140rpx; padding: 16rpx; background: #F5F6FA; border-radius: 8rpx; font-size: 26rpx; box-sizing: border-box; }
.form-textarea.short { min-height: 100rpx; }

// Image upload
.img-upload-row { display: flex; flex-wrap: wrap; gap: 12rpx; }
.img-item { position: relative; width: 140rpx; height: 140rpx;
  image { width: 100%; height: 100%; border-radius: 8rpx; }
  .img-del { position: absolute; top: -10rpx; right: -10rpx; width: 36rpx; height: 36rpx; background: #FF4D4F; color: #fff; border-radius: 50%; text-align: center; line-height: 36rpx; font-size: 22rpx; }
}
.img-add { width: 140rpx; height: 140rpx; background: #F5F6FA; border: 2rpx dashed #DDD; border-radius: 8rpx; display: flex; flex-direction: column; align-items: center; justify-content: center;
  .add-icon { font-size: 48rpx; color: #CCC; line-height: 1; }
  .add-text { font-size: 22rpx; color: #CCC; }
}

// Items
.items-section { margin-bottom: 24rpx; }
.items-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.ih-label { font-size: 26rpx; font-weight: 500; }
.ih-add { font-size: 24rpx; color: #1677FF; }
.item-row { display: flex; align-items: center; gap: 8rpx; margin-bottom: 12rpx; flex-wrap: wrap; }
.item-input { padding: 12rpx; background: #F5F6FA; border-radius: 8rpx; font-size: 24rpx;
  &.name { flex: 1; min-width: 160rpx; }
  &.spec { width: 120rpx; }
  &.qty { width: 70rpx; text-align: center; }
  &.price { width: 110rpx; }
}
.item-subtotal { font-size: 24rpx; color: #1677FF; white-space: nowrap; min-width: 90rpx; text-align: right; }
.item-del { font-size: 28rpx; color: #FF4D4F; padding: 4rpx; }

// Cost Card
.cost-card { background: #F6FFED; border-radius: 8rpx; padding: 16rpx 20rpx; }
.cc-row { display: flex; justify-content: space-between; font-size: 26rpx; color: #666; padding: 6rpx 0; }
.cc-divider { border-top: 1rpx solid #D9F7BE; margin-top: 8rpx; padding-top: 12rpx; }
.cc-total { font-size: 36rpx; font-weight: 600; color: #FF4D4F; }

// Valid date
.valid-row { display: flex; align-items: center; margin-top: 16rpx; }
.vr-label { font-size: 26rpx; color: #666; }
.vr-date { font-size: 26rpx; color: #1677FF; }

// Buttons
.btn-area { display: flex; gap: 16rpx; margin: 24rpx; }
.btn-draft { flex: 1; padding: 24rpx; background: #F5F6FA; color: #666; border-radius: 12rpx; font-size: 28rpx; border: 2rpx solid #E0E0E0; }
.btn-submit { flex: 1; padding: 24rpx; background: linear-gradient(135deg, #1677FF, #0958D9); color: #fff; border-radius: 12rpx; font-size: 28rpx; border: none; }

.safe-bottom { height: 100rpx; }
</style>
