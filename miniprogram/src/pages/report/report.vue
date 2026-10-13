<template>
  <view class="report-page">
    <!-- 进度步骤条 -->
    <view class="steps">
      <view class="step active"><text>1. 选择设备</text></view>
      <view class="step" :class="{ active: step >= 2 }"><text>2. 描述故障</text></view>
      <view class="step" :class="{ active: step >= 3 }"><text>3. 提交确认</text></view>
    </view>

    <!-- Step 1: 选择设备 -->
    <view v-if="step === 1" class="step-content">
      <view class="search-bar">
        <input v-model="deviceKeyword" placeholder="搜索设备名称/型号/品牌" @input="searchDevice" />
      </view>
      <scroll-view scroll-y class="device-list">
        <view v-for="d in deviceList" :key="d.id"
              class="device-item" :class="{ selected: selectedDevice?.id === d.id }"
              @click="selectDevice(d)">
          <text class="di-name">{{ d.name }}</text>
          <text class="di-info">{{ d.brand }} {{ d.model }} | {{ d.lab_name }}</text>
          <text class="di-status" :class="d.status">{{ d.status === 'normal' ? '正常' : '维修中' }}</text>
        </view>
        <view v-if="deviceList.length === 0" class="empty-tip">
          <text>暂无设备，请先添加设备</text>
          <button size="mini" @click="goAddDevice">去添加</button>
        </view>
      </scroll-view>
      <view class="step-actions">
        <text class="link" @click="step = 2; selectedDevice = null">跳过，直接报修</text>
        <button type="primary" :disabled="!selectedDevice" @click="step = 2">下一步</button>
      </view>
    </view>

    <!-- Step 2: 描述故障 -->
    <view v-if="step === 2" class="step-content">
      <view class="form-item">
        <text class="label">故障描述 <text class="required">*</text></text>
        <textarea v-model="form.fault_desc" placeholder="请详细描述故障现象，如：离心机无法启动，报E03错误"
                  maxlength="500" show-count />
      </view>
      <view class="form-item">
        <text class="label">故障图片</text>
        <view class="upload-row">
          <view v-for="(img, i) in form.fault_images" :key="i" class="upload-img" @click="previewImage(i)">
            <image :src="img" mode="aspectFill" />
            <text class="remove-btn" @click.stop="removeImage(i)">×</text>
          </view>
          <view v-if="form.fault_images.length < 9" class="upload-btn" @click="chooseImage">
            <text>+</text>
            <text>添加图片</text>
          </view>
        </view>
      </view>
      <view class="form-item">
        <text class="label">紧急程度</text>
        <view class="priority-row">
          <view v-for="p in priorities" :key="p.value"
                class="priority-tag" :class="{ active: form.priority === p.value }"
                @click="form.priority = p.value">{{ p.label }}</view>
        </view>
      </view>
      <view class="form-item">
        <text class="label">联系人</text>
        <input v-model="form.contact_name" placeholder="请输入联系人姓名" />
      </view>
      <view class="form-item">
        <text class="label">联系电话</text>
        <input v-model="form.contact_phone" type="number" placeholder="请输入联系电话" />
      </view>
      <view class="form-item">
        <text class="label">服务地址</text>
        <input v-model="form.address" placeholder="请输入详细地址" />
      </view>
      <view class="form-item public-switch">
        <view class="ps-left">
          <text class="ps-title">公开招标</text>
          <text class="ps-desc">发布到需求广场，多位工程师竞标</text>
        </view>
        <switch :checked="form.is_public" @change="onPublicSwitch" color="#1677FF" />
      </view>

      <!-- 指定工程师（关闭公开招标时显示） -->
      <view class="form-item engineer-select" v-if="!form.is_public">
        <view class="es-header">
          <text class="label">选择工程师 <text class="optional">(可选)</text></text>
          <text class="es-link" @click="goFavorites">管理收藏 ›</text>
        </view>
        <view v-if="favEngineers.length === 0" class="es-empty">
          <text class="es-empty-text">暂无收藏的工程师</text>
          <view class="es-empty-actions">
            <text class="es-action" @click="goEngineers">去工程师大厅浏览</text>
          </view>
        </view>
        <scroll-view scroll-x class="es-scroll" v-else>
          <view class="es-item" :class="{ selected: selectedEngineer?.id === eng.id }"
                v-for="eng in favEngineers" :key="eng.id"
                @click="selectEngineer(eng)">
            <view class="esi-top">
              <text class="esi-name">{{ eng.name }}</text>
              <text class="esi-status" :class="eng.status">{{ eng.status === 'online' ? '在线' : eng.status === 'busy' ? '忙碌' : '离线' }}</text>
            </view>
            <text class="esi-rating">⭐ {{ eng.rating }} · {{ eng.total_orders || 0 }}单</text>
            <view class="esi-skills" v-if="eng.skills">
              <text v-for="s in (eng.skills||[]).slice(0,3)" :key="s" class="esi-skill">{{ s }}</text>
            </view>
            <text class="esi-check" v-if="selectedEngineer?.id === eng.id">✅ 已选</text>
          </view>
        </scroll-view>
        <view v-if="selectedEngineer" class="es-selected">
          <text>已选择：</text>
          <text class="ess-name">{{ selectedEngineer.name }}</text>
          <text class="ess-clear" @click="selectedEngineer = null">✕</text>
        </view>
      </view>
      <view class="step-actions">
        <button @click="step = 1">上一步</button>
        <button type="primary" @click="validateAndNext" :loading="submitting">提交报修</button>
      </view>
    </view>

    <!-- Step 3: 提交确认 -->
    <view v-if="step === 3" class="step-content">
      <text class="success-icon">✅</text>
      <text class="success-title">报修提交成功!</text>
      <text class="success-no">工单号: {{ createdOrderNo }}</text>
      <view class="success-actions">
        <button @click="goOrders">查看工单</button>
        <button type="primary" @click="goHome">返回首页</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, reactive, watch } from 'vue';
import { getDeviceList, createOrder, uploadImage, getFavorites } from '@/api/index';
import { useUserStore } from '@/store/index';
const userStore = useUserStore();

const step = ref(1);
const deviceKeyword = ref('');
const deviceList = ref([]);
const allDevices = ref([]);
const selectedDevice = ref(null);
const submitting = ref(false);
const createdOrderNo = ref('');
const favEngineers = ref([]);
const selectedEngineer = ref(null);

const priorities = [
  { label: '普通', value: 'normal' },
  { label: '紧急', value: 'urgent' },
  { label: '严重', value: 'critical' }
];

const form = reactive({
  fault_desc: '',
  fault_images: [],
  fault_video: '',
  priority: 'normal',
  contact_name: '',
  contact_phone: '',
  address: '',
  scheduled_at: null,
  is_public: false
});

function searchDevice() {
  const kw = deviceKeyword.value.toLowerCase();
  deviceList.value = kw ? allDevices.value.filter(d =>
    (d.name||'').toLowerCase().includes(kw) ||
    (d.model||'').toLowerCase().includes(kw) ||
    (d.brand||'').toLowerCase().includes(kw)
  ) : allDevices.value;
}

async function loadDevices() {
  if (!userStore.isLoggedIn) return;
  try {
    const res = await getDeviceList({ pageSize: 100 });
    allDevices.value = (res.list || []).filter(d => d.status === 'normal');
    deviceList.value = allDevices.value;
  } catch (e) { /* ignore */ }
}

function selectDevice(d) { selectedDevice.value = d; }

function chooseImage() {
  uni.chooseImage({
    count: 9 - form.fault_images.length,
    sizeType: ['compressed'],
    sourceType: ['camera', 'album'],
    success: async (res) => {
      for (const path of res.tempFilePaths) {
        try {
          const result = await uploadImage(path);
          form.fault_images.push(result.url);
        } catch (e) {
          uni.showToast({ title: '图片上传失败', icon: 'none' });
        }
      }
    }
  });
}

function removeImage(i) { form.fault_images.splice(i, 1); }
function previewImage(i) {
  uni.previewImage({ urls: form.fault_images, current: form.fault_images[i] });
}

function validateAndNext() {
  if (!form.fault_desc.trim()) {
    return uni.showToast({ title: '请填写故障描述', icon: 'none' });
  }
  submitOrder();
}

function onPublicSwitch(e) {
  form.is_public = e.detail.value;
  if (form.is_public) selectedEngineer.value = null;  // 公开招标时清除选择
}

function selectEngineer(eng) {
  if (selectedEngineer.value?.id === eng.id) {
    selectedEngineer.value = null;
  } else {
    selectedEngineer.value = eng;
  }
}

async function loadFavorites() {
  if (!userStore.isLoggedIn) return;
  try {
    favEngineers.value = await getFavorites();
  } catch (e) { /* ignore */ }
}

function goFavorites() { uni.navigateTo({ url: '/pages/marketplace/engineers' }); }
function goEngineers() { uni.navigateTo({ url: '/pages/marketplace/engineers' }); }

async function submitOrder() {
  submitting.value = true;
  try {
    const data = {
      device_id: selectedDevice.value?.id || null,
      ...form,
      engineer_id: selectedEngineer.value?.id || null
    };
    const order = await createOrder(data);
    createdOrderNo.value = order.order_no;
    step.value = 3;
  } catch (e) {
    uni.showToast({ title: e.message || '提交失败', icon: 'none' });
  } finally {
    submitting.value = false;
  }
}

function goOrders() { uni.switchTab({ url: '/pages/orders/list' }); }
function goHome() { uni.switchTab({ url: '/pages/index/index' }); }
function goAddDevice() { uni.navigateTo({ url: '/pages/devices/add' }); }

onMounted(async () => {
  // 如果通过扫码或设备列表跳转进来，携带 device_id
  const pages = getCurrentPages();
  const options = pages[pages.length - 1].$page?.options || {};
  if (options.device_id) {
    await loadDevices();
    // 自动选中（C-F4: await 确保设备列表加载完成后再选中）
    const d = deviceList.value.find(x => x.id === parseInt(options.device_id));
    if (d) selectedDevice.value = d;
  } else {
    await loadDevices();
  }
  await loadFavorites();
});
</script>

<style lang="scss" scoped>
.report-page { min-height: 100vh; background: #F5F6FA; padding: 24rpx; }
.steps {
  display: flex; justify-content: center; gap: 40rpx;
  background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 24rpx;
  .step { font-size: 26rpx; color: #ccc; }
  .step.active { color: #1677FF; font-weight: 600; }
}
.step-content { background: #fff; border-radius: 16rpx; padding: 30rpx; }
.device-list {
  max-height: 500rpx;
  .device-item {
    padding: 20rpx; border: 2rpx solid #EEE; border-radius: 12rpx; margin-bottom: 16rpx;
    &.selected { border-color: #1677FF; background: #F0F5FF; }
    .di-name { font-size: 28rpx; font-weight: 600; color: #333; display: block; }
    .di-info { font-size: 24rpx; color: #999; margin-top: 4rpx; display: block; }
    .di-status { font-size: 22rpx; color: #52C41A; &.repairing{color:#FA8C16;} }
  }
}
.form-item {
  margin-bottom: 24rpx;
  .label { font-size: 28rpx; color: #333; margin-bottom: 12rpx; display: block; font-weight: 500; }
  .required { color: #FF4D4F; }
  textarea { width: 100%; height: 160rpx; border: 2rpx solid #EEE; border-radius: 12rpx; padding: 16rpx; font-size: 28rpx; box-sizing: border-box; }
  input { width: 100%; height: 80rpx; border: 2rpx solid #EEE; border-radius: 12rpx; padding: 0 16rpx; font-size: 28rpx; box-sizing: border-box; }
}
.upload-row { display: flex; flex-wrap: wrap; gap: 16rpx; }
.upload-img {
  width: 160rpx; height: 160rpx; border-radius: 12rpx; overflow: hidden; position: relative;
  image { width: 100%; height: 100%; }
  .remove-btn { position: absolute; top: 0; right: 0; width: 40rpx; height: 40rpx; background: rgba(0,0,0,0.5); color: #fff; text-align: center; line-height: 40rpx; border-radius: 0 12rpx 0 12rpx; font-size: 28rpx; }
}
.upload-btn {
  width: 160rpx; height: 160rpx; border: 2rpx dashed #CCC; border-radius: 12rpx;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-size: 24rpx; color: #999; text:nth-child(1) { font-size: 48rpx; }
}
.priority-row { display: flex; gap: 16rpx; }
.priority-tag {
  padding: 12rpx 28rpx; border: 2rpx solid #EEE; border-radius: 40rpx; font-size: 26rpx; color: #666;
  &.active { border-color: #1677FF; color: #1677FF; background: #E6F4FF; }
}
.step-actions { display: flex; gap: 16rpx; margin-top: 32rpx; }
.link { font-size: 26rpx; color: #1677FF; padding: 16rpx; }
// 成功页
.success-icon { font-size: 80rpx; display: block; text-align: center; margin: 60rpx 0 24rpx; }
.success-title { font-size: 36rpx; font-weight: bold; color: #333; text-align: center; display: block; }
.success-no { font-size: 28rpx; color: #1677FF; text-align: center; display: block; margin-top: 12rpx; }
.success-actions { display: flex; gap: 16rpx; margin-top: 60rpx; }
.empty-tip { text-align: center; padding: 60rpx 0; color: #999; font-size: 28rpx; }

/* 选择工程师 */
.engineer-select {
  background: #F8FAFC; border-radius: 16rpx; padding: 20rpx; margin-bottom: 24rpx;
  .optional { font-size: 22rpx; color: #999; font-weight: 400; }
  .es-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
  .es-link { font-size: 24rpx; color: #1677FF; }
}
.es-empty { text-align: center; padding: 30rpx 0; }
.es-empty-text { font-size: 26rpx; color: #999; display: block; }
.es-empty-actions { margin-top: 12rpx; }
.es-action { font-size: 24rpx; color: #1677FF; }
.es-scroll { white-space: nowrap; display: flex; gap: 16rpx; padding-bottom: 8rpx; }
.es-item {
  display: inline-block; width: 280rpx; background: #fff; border-radius: 14rpx;
  padding: 20rpx; border: 2rpx solid #EEE; white-space: normal; position: relative;
  &.selected { border-color: #1677FF; background: #F0F5FF; }
}
.esi-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6rpx; }
.esi-name { font-size: 28rpx; font-weight: 600; color: #333; }
.esi-status { font-size: 20rpx; padding: 2rpx 10rpx; border-radius: 4rpx;
  &.online { background: #F6FFED; color: #52C41A; }
  &.busy { background: #FFF7E6; color: #FA8C16; }
  &.offline { background: #F5F5F5; color: #999; }
}
.esi-rating { font-size: 22rpx; color: #999; display: block; margin-bottom: 6rpx; }
.esi-skills { display: flex; flex-wrap: wrap; gap: 4rpx; margin-bottom: 6rpx; }
.esi-skill { font-size: 20rpx; padding: 2rpx 8rpx; background: #F0F5FF; color: #1677FF; border-radius: 4rpx; }
.esi-check { font-size: 22rpx; color: #1677FF; font-weight: 500; }
.es-selected {
  margin-top: 16rpx; padding: 14rpx 18rpx; background: #E6F4FF; border-radius: 10rpx;
  font-size: 26rpx; color: #333; display: flex; align-items: center; gap: 8rpx;
  .ess-name { font-weight: 600; color: #1677FF; }
  .ess-clear { margin-left: auto; font-size: 28rpx; color: #999; padding: 0 8rpx; }
}
</style>
