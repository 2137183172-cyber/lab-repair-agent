<template>
  <view class="devices-page">
    <view class="search-bar">
      <input v-model="keyword" placeholder="搜索设备名称/品牌/型号" @confirm="loadDevices" />
    </view>

    <scroll-view scroll-y class="device-list" @scrolltolower="loadMore">
      <view v-for="d in devices" :key="d.id" class="device-card" @click="goDetail(d.id)">
        <view class="dc-header">
          <text class="dc-name">{{ d.name }}</text>
          <text class="dc-status" :class="d.status">{{ statusMap[d.status] }}</text>
        </view>
        <view class="dc-info">
          <text>{{ d.brand }} {{ d.model }}</text>
          <text class="dc-lab">📍 {{ d.lab_name }} {{ d.lab_room }}</text>
        </view>
        <view class="dc-footer">
          <text class="dc-serial">SN: {{ d.serial_no || '-' }}</text>
          <text v-if="d.warranty_end" class="dc-warranty" :class="{ expired: isExpired(d.warranty_end) }">
            {{ isExpired(d.warranty_end) ? '已过保' : '保修至 ' + d.warranty_end }}
          </text>
        </view>
      </view>
      <view v-if="devices.length === 0 && !loading" class="empty">
        <text>暂无设备</text>
        <text class="empty-hint">扫码或手动添加您的实验仪器</text>
        <button type="primary" size="mini" @click="goAdd">添加设备</button>
      </view>
    </scroll-view>

    <!-- 悬浮添加按钮 -->
    <view class="fab" @click="goAdd">+</view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { getDeviceList } from '@/api/index';

const keyword = ref('');
const devices = ref([]);
const loading = ref(false);
const page = ref(1);
const total = ref(0);

const statusMap = { normal: '正常', repairing: '维修中', scrapped: '已报废' };

function isExpired(date) { return new Date(date) < new Date(); }

async function loadDevices() {
  page.value = 1; devices.value = []; loading.value = true;
  try {
    const res = await getDeviceList({ keyword: keyword.value, page: 1, pageSize: 20 });
    devices.value = res.list || [];
    total.value = res.total;
  } catch (e) { /* ignore */ }
  finally { loading.value = false; }
}

async function loadMore() {
  if (loading.value || devices.value.length >= total.value) return;
  page.value++; loading.value = true;
  try {
    const res = await getDeviceList({ keyword: keyword.value, page: page.value, pageSize: 20 });
    devices.value.push(...(res.list || []));
  } catch (e) { /* ignore */ }
  finally { loading.value = false; }
}

function goDetail(id) { uni.navigateTo({ url: `/pages/devices/detail?id=${id}` }); }
function goAdd() { uni.navigateTo({ url: '/pages/devices/add' }); }

import { onShow } from '@dcloudio/uni-app';
onShow(() => { loadDevices(); });
</script>

<style lang="scss" scoped>
.devices-page { min-height: 100vh; background: #F5F6FA; padding: 24rpx; padding-bottom: 120rpx; }
.search-bar { margin-bottom: 16rpx; input { width: 100%; height: 72rpx; background: #fff; border-radius: 40rpx; padding: 0 32rpx; font-size: 28rpx; box-sizing: border-box; } }
.device-card {
  background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
  .dc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8rpx; }
  .dc-name { font-size: 30rpx; font-weight: 600; color: #333; }
  .dc-info { font-size: 24rpx; color: #999; .dc-lab { margin-left: 16rpx; } }
  .dc-footer { display: flex; justify-content: space-between; margin-top: 12rpx; }
  .dc-serial { font-size: 22rpx; color: #CCC; }
  .dc-warranty { font-size: 22rpx; color: #52C41A; &.expired { color: #FF4D4F; } }
}
.dc-status { font-size: 22rpx; padding: 4rpx 12rpx; border-radius: 8rpx;
  &.normal { background:#F6FFED; color:#52C41A; }
  &.repairing { background:#FFF7E6; color:#FA8C16; }
  &.scrapped { background:#F5F5F5; color:#999; }
}
.empty { text-align: center; padding: 120rpx 0; color: #999; font-size: 28rpx; .empty-hint { display: block; margin: 12rpx 0; font-size: 24rpx; } }
.fab { position: fixed; right: 40rpx; bottom: 120rpx; width: 100rpx; height: 100rpx; background: #1677FF; color: #fff; border-radius: 50%; font-size: 52rpx; line-height: 100rpx; text-align: center; box-shadow: 0 8rpx 24rpx rgba(22,119,255,0.4); }
</style>
