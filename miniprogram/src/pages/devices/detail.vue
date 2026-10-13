<template>
  <view class="detail-page" v-if="device">
    <!-- 设备二维码 -->
    <view class="qr-section">
      <image v-if="device.qr_code_url" :src="device.qr_code_url" mode="aspectFit" class="qr-img" @click="previewQR" />
      <text class="qr-hint">扫码即可报修</text>
    </view>

    <view class="card">
      <text class="card-title">{{ device.name }}</text>
      <view class="info-row"><text class="ir-label">品牌</text><text>{{ device.brand || '-' }}</text></view>
      <view class="info-row"><text class="ir-label">型号</text><text>{{ device.model || '-' }}</text></view>
      <view class="info-row"><text class="ir-label">分类</text><text>{{ device.category?.name || '-' }}</text></view>
      <view class="info-row"><text class="ir-label">序列号</text><text>{{ device.serial_no || '-' }}</text></view>
      <view class="info-row"><text class="ir-label">资产编号</text><text>{{ device.asset_no || '-' }}</text></view>
      <view class="info-row"><text class="ir-label">实验室</text><text>{{ device.lab_name }} {{ device.lab_room }}</text></view>
      <view class="info-row"><text class="ir-label">保修截止</text><text :class="{ expired: isExpired(device.warranty_end) }">{{ device.warranty_end || '未设置' }}</text></view>
      <view class="info-row"><text class="ir-label">状态</text><text :class="device.status">{{ statusMap[device.status] }}</text></view>
    </view>

    <!-- 设备生命周期时间线 -->
    <view class="card" v-if="timeline.length > 0">
      <text class="card-title">设备生命周期 ({{ timeline.length }})</text>
      <view class="timeline">
        <view v-for="(item, i) in timeline" :key="i" class="tl-item">
          <view class="tl-dot" :class="item.source"></view>
          <view class="tl-line" v-if="i < timeline.length - 1"></view>
          <view class="tl-content">
            <view class="tl-header">
              <text class="tl-type" :class="item.source">{{ typeLabels[item.type] || item.type }}</text>
              <text class="tl-date">{{ formatDate(item.date) }}</text>
            </view>
            <text class="tl-title">{{ item.title }}</text>
            <text class="tl-desc" v-if="item.description">{{ item.description }}</text>
            <view class="tl-meta" v-if="item.performed_by">
              <text>👤 {{ item.performed_by }}</text>
              <text v-if="item.cost">💰 ¥{{ Number(item.cost).toFixed(2) }}</text>
            </view>
            <text class="tl-next" v-if="item.next_due_at">下次到期：{{ item.next_due_at }}</text>
          </view>
        </view>
      </view>
    </view>
    <view class="card empty-card" v-else>
      <text class="empty-text">暂无维护记录</text>
    </view>

    <view class="btn-row">
      <button @click="goEdit">编辑设备</button>
      <button type="primary" @click="goReport">立即报修</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { getDeviceDetail, getDeviceMaintenance } from '@/api/index';

const device = ref(null);
const timeline = ref([]);

function isExpired(date) { return date && new Date(date) < new Date(); }
const statusMap = { normal: '正常', repairing: '维修中', scrapped: '已报废' };
const typeLabels = { maintenance: '保养', inspection: '巡检', calibration: '校准', repair: '维修' };

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`;
}

function goEdit() { uni.navigateTo({ url: `/pages/devices/add?id=${device.value.id}` }); }
function goReport() { uni.navigateTo({ url: `/pages/report/report?device_id=${device.value.id}` }); }
function goOrder(id) { uni.navigateTo({ url: `/pages/orders/detail?id=${id}` }); }
function previewQR() {
  uni.previewImage({ urls: [device.value.qr_code_url], current: device.value.qr_code_url });
}

onLoad(async (options) => {
  if (!options.id) return;
  try {
    const res = await getDeviceDetail(options.id);
    device.value = res.device;
    // Load lifecycle timeline
    const mt = await getDeviceMaintenance(options.id);
    timeline.value = mt.timeline || [];
  } catch (e) { /* ignore */ }
});
</script>

<style lang="scss" scoped>
.detail-page { min-height: 100vh; background: #F5F6FA; padding: 24rpx; padding-bottom: 120rpx; }
.qr-section { text-align: center; padding: 40rpx 0; background: #fff; border-radius: 16rpx; margin-bottom: 24rpx; }
.qr-img { width: 300rpx; height: 300rpx; }
.qr-hint { font-size: 24rpx; color: #999; display: block; margin-top: 12rpx; }
.card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 24rpx; }
.card-title { font-size: 32rpx; font-weight: bold; color: #333; display: block; margin-bottom: 16rpx; }
.info-row { display: flex; padding: 12rpx 0; border-bottom: 1rpx solid #F5F5F5; font-size: 26rpx; color: #333; }
.ir-label { width: 150rpx; color: #999; flex-shrink: 0; }
.expired { color: #FF4D4F; }

// Timeline
.timeline { padding-left: 32rpx; position: relative; }
.tl-item { position: relative; padding-bottom: 24rpx; padding-left: 24rpx; }
.tl-dot { position: absolute; left: -6rpx; top: 8rpx; width: 16rpx; height: 16rpx; border-radius: 50%;
  &.maintenance { background: #52C41A; }
  &.inspection { background: #1677FF; }
  &.calibration { background: #FA8C16; }
  &.repair { background: #FF4D4F; }
}
.tl-line { position: absolute; left: 1rpx; top: 28rpx; bottom: 0; width: 2rpx; background: #E8E8E8; }
.tl-content { background: #FAFAFA; border-radius: 12rpx; padding: 16rpx 20rpx; }
.tl-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6rpx; }
.tl-type { font-size: 22rpx; padding: 2rpx 12rpx; border-radius: 4rpx; color: #fff;
  &.maintenance { background: #52C41A; }
  &.inspection { background: #1677FF; }
  &.calibration { background: #FA8C16; }
  &.repair { background: #FF4D4F; }
}
.tl-date { font-size: 22rpx; color: #CCC; }
.tl-title { font-size: 26rpx; color: #333; font-weight: 500; display: block; }
.tl-desc { font-size: 24rpx; color: #666; margin-top: 4rpx; display: -webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow: hidden; }
.tl-meta { display: flex; gap: 24rpx; margin-top: 8rpx; font-size: 24rpx; color: #999; }
.tl-next { display: block; margin-top: 6rpx; font-size: 22rpx; color: #FA8C16; }
.empty-card { text-align: center; padding: 60rpx; }
.empty-text { color: #CCC; font-size: 28rpx; }

.btn-row { position: fixed; bottom: 0; left: 0; right: 0; display: flex; gap: 16rpx; padding: 24rpx; background: #fff; box-shadow: 0 -2rpx 12rpx rgba(0,0,0,0.06); }
</style>
