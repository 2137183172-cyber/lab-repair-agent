<template>
  <view class="orders-page">
    <!-- 未登录提示 -->
    <view class="login-tip" v-if="!userStore.isLoggedIn" @click="goLogin">
      <text class="lt-icon">👋</text>
      <text class="lt-text">请先登录后查看工单</text>
      <text class="lt-arrow">›</text>
    </view>

    <!-- 状态筛选标签 -->
    <scroll-view scroll-x class="tab-bar" v-if="userStore.isLoggedIn">
      <view v-for="tab in tabs" :key="tab.value"
            class="tab-item" :class="{ active: activeTab === tab.value }"
            @click="activeTab = tab.value; loadOrders()">
        {{ tab.label }}
      </view>
    </scroll-view>

    <!-- 工单列表 -->
    <scroll-view scroll-y class="order-list" @scrolltolower="loadMore" refresher-enabled @refresherrefresh="onRefresh">
      <view v-for="order in orders" :key="order.id" class="order-card" @click="goDetail(order.id)">
        <view class="oc-header">
          <text class="oc-no">{{ order.order_no }}</text>
          <text class="oc-status" :class="order.status">{{ statusMap[order.status] }}</text>
        </view>
        <view class="oc-body">
          <text class="oc-device">{{ order.device?.name || '未指定设备' }}</text>
          <text class="oc-desc">{{ order.fault_desc }}</text>
        </view>
        <view class="oc-footer">
          <text class="oc-time">{{ formatTime(order.created_at) }}</text>
          <text v-if="order.engineer" class="oc-engineer">
            🔧 {{ order.engineer.name }}
          </text>
        </view>
      </view>
      <view v-if="orders.length === 0 && !loading" class="empty">
        <text>暂无工单</text>
      </view>
      <text v-if="loading" class="loading-tip">加载中...</text>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { getUserOrders } from '@/api/index';
import { useUserStore } from '@/store/index';
const userStore = useUserStore();

const tabs = [
  { label: '全部', value: '' },
  { label: '待接单', value: 'pending' },
  { label: '待支付', value: 'quoted' },
  { label: '已支付', value: 'paid' },
  { label: '维修中', value: 'repairing' },
  { label: '待评价', value: 'pending_review' },
  { label: '已完成', value: 'confirmed' },
  { label: '已取消', value: 'cancelled' }
];

const statusMap = {
  pending: '待接单', accepted: '已接单', diagnosing: '诊断中',
  quoted: '待审批/支付', paid: '已支付', repairing: '维修中', completed: '维修完成',
  pending_review: '待评价', confirmed: '已评价', cancelled: '已取消'
};

const activeTab = ref('');
const orders = ref([]);
const loading = ref(false);
const page = ref(1);
const total = ref(0);

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

async function loadOrders() {
  if (!userStore.isLoggedIn || !userStore.token) return;
  page.value = 1;
  orders.value = [];
  loading.value = true;
  try {
    const res = await getUserOrders({ status: activeTab.value, page: 1, pageSize: 10 });
    orders.value = res.list || [];
    total.value = res.total;
  } catch (e) { /* ignore */ }
  finally { loading.value = false; }
}

async function loadMore() {
  if (loading.value || orders.value.length >= total.value) return;
  loading.value = true;
  page.value++;
  try {
    const res = await getUserOrders({ status: activeTab.value, page: page.value, pageSize: 10 });
    orders.value.push(...(res.list || []));
  } catch (e) { /* ignore */ }
  finally { loading.value = false; }
}

function onRefresh() { loadOrders(); }
function goLogin() { uni.switchTab({ url: '/pages/mine/mine' }); }
function goDetail(id) { if (!userStore.isLoggedIn) return goLogin(); uni.navigateTo({ url: `/pages/orders/detail?id=${id}` }); }

import { onShow } from '@dcloudio/uni-app';
onShow(() => {
  // 读取从"我的"页传来的筛选
  const filter = getApp().globalData.orderFilter;
  if (filter) {
    activeTab.value = filter;
    getApp().globalData.orderFilter = ''; // 用完清除
  }
  loadOrders();
});
</script>

<style lang="scss" scoped>
.login-tip { margin: 40rpx 24rpx; padding: 40rpx; text-align: center; background: #E6F4FF; border-radius: 16rpx; font-size: 28rpx; color: #1677FF; }
.orders-page { min-height: 100vh; background: #F5F6FA; }
.tab-bar {
  white-space: nowrap; background: #fff; padding: 16rpx 24rpx;
  position: sticky; top: 0; z-index: 10;
  .tab-item {
    display: inline-block; padding: 12rpx 28rpx; margin-right: 16rpx;
    border-radius: 40rpx; font-size: 26rpx; color: #666; background: #F5F5F5;
    &.active { color: #fff; background: #1677FF; }
  }
}
.order-list { padding: 24rpx; }
.order-card {
  background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
  .oc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
  .oc-no { font-size: 26rpx; font-weight: 600; color: #333; }
  .oc-device { font-size: 28rpx; color: #333; display: block; font-weight: 500; }
  .oc-desc { font-size: 24rpx; color: #999; margin-top: 6rpx; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .oc-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 16rpx; }
  .oc-time { font-size: 22rpx; color: #CCC; }
  .oc-engineer { font-size: 24rpx; color: #666; }
}
.oc-status {
  font-size: 24rpx; padding: 6rpx 16rpx; border-radius: 8rpx;
  &.pending { background:#FFF7E6; color:#FA8C16; }
  &.accepted, &.paid, &.repairing { background:#E6F4FF; color:#1677FF; }
  &.quoted, &.completed, &.pending_review { background:#FFF7E6; color:#FA8C16; }
  &.confirmed { background:#F6FFED; color:#52C41A; }
  &.cancelled { background:#F5F5F5; color:#999; }
}
.empty { text-align: center; padding: 120rpx 0; color: #999; font-size: 28rpx; }
.loading-tip { text-align: center; padding: 24rpx; color: #999; font-size: 24rpx; display: block; }
</style>
