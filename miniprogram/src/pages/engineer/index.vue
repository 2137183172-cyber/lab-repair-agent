<template>
  <view class="workbench">
    <!-- 顶部状态 -->
    <view class="header">
      <view class="status-switch">
        <text class="switch-label">工作状态</text>
        <view class="switch-options">
          <view class="switch-opt" :class="{ active: status === 'online' }" @click="setStatus('online')">🟢 在线</view>
          <view class="switch-opt" :class="{ active: status === 'busy' }" @click="setStatus('busy')">🔴 忙碌</view>
          <view class="switch-opt" :class="{ active: status === 'offline' }" @click="setStatus('offline')">⚫ 离线</view>
        </view>
      </view>
    </view>

    <!-- 今日数据 -->
    <view class="stats-row">
      <view class="stat"><text class="sn">{{ stats?.today_orders || 0 }}</text><text>今日工单</text></view>
      <view class="stat"><text class="sn">{{ stats?.month_orders || 0 }}</text><text>本月工单</text></view>
      <view class="stat"><text class="sn">{{ stats?.completed_orders || 0 }}</text><text>累计完成</text></view>
      <view class="stat"><text class="sn star">⭐ {{ stats?.rating || '5.0' }}</text><text>评分</text></view>
      <view class="stat"><text class="sn">{{ custCount }}</text><text>我的客户</text></view>
      <view class="stat"><text class="sn">{{ devCount }}</text><text>我的设备</text></view>
    </view>

    <!-- 快捷操作 -->
    <view class="action-grid">
      <view class="action-item primary" @click="goOrderPool">
        <text class="ai-num">{{ poolCount }}</text>
        <text>工单池</text>
        <text class="ai-desc">待抢工单</text>
      </view>
      <view class="action-item" @click="goMyOrders('accepted')">
        <text class="ai-num warn">{{ myCount }}</text>
        <text>我的工单</text>
        <text class="ai-desc">进行中</text>
      </view>
    </view>

    <!-- 最近待处理工单 -->
    <view class="card">
      <text class="card-title">新工单提醒</text>
      <view v-for="o in recentOrders" :key="o.id" class="order-mini" @click="goDetail(o.id)">
        <view class="om-left">
          <text class="om-no">{{ o.order_no }}</text>
          <text class="om-device">{{ o.device?.name || '未指定' }}</text>
          <text class="om-addr">📍 {{ o.reporter?.company || '未知' }}</text>
        </view>
        <view class="om-right">
          <text class="om-priority" :class="o.priority">{{ priorityMap[o.priority] }}</text>
          <button size="mini" type="primary" @click.stop="handleAccept(o.id)">接单</button>
        </view>
      </view>
      <view v-if="recentOrders.length === 0" class="empty">暂无待处理工单</view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getEngineerProfile, getEngineerStats, getOrderPool, getMyCustomers, getMyDevices, acceptOrder, updateEngineerStatus } from '@/api/index';

const status = ref('offline');
const stats = ref({});
const recentOrders = ref([]);
const poolCount = ref(0); const myCount = ref(0);
const custCount = ref(0); const devCount = ref(0);
const priorityMap = { normal: '普通', urgent: '紧急', critical: '严重' };

async function init() {
  try {
    const profile = await getEngineerProfile();
    status.value = profile.status || 'offline';
    const [s, pool] = await Promise.all([getEngineerStats(), getOrderPool({ pageSize: 5 })]);
    stats.value = s;
    poolCount.value = pool.total || 0;
    recentOrders.value = pool.list || [];
    // 加载客户和设备统计
    getMyCustomers().then(r => { custCount.value = r?.length || 0; }).catch(()=>{});
    getMyDevices().then(r => { devCount.value = r?.length || 0; }).catch(()=>{});
  } catch (e) { /* ignore */ }
}

async function setStatus(s) {
  status.value = s;
  try { await updateEngineerStatus({ status: s }); } catch (e) { /* ignore */ }
}

async function handleAccept(orderId) {
  try {
    await acceptOrder(orderId);
    uni.showToast({ title: '接单成功', icon: 'success' });
    init();
  } catch (e) { uni.showToast({ title: e.message, icon: 'none' }); }
}

function goOrderPool() { uni.navigateTo({ url: '/pages/engineer/orders?type=pool' }); }
function goMyOrders(s) { uni.navigateTo({ url: `/pages/engineer/orders?type=mine&status=${s}` }); }
function goDetail(id) { uni.navigateTo({ url: `/pages/orders/detail?id=${id}` }); }

onMounted(init);
</script>

<style lang="scss" scoped>
.workbench { min-height: 100vh; background: #F5F6FA; }
.header { background: linear-gradient(135deg, #1677FF, #0958D9); padding: 30rpx; color: #fff; }
.status-switch { .switch-label { font-size: 24rpx; opacity: 0.85; } }
.switch-options { display: flex; gap: 12rpx; margin-top: 16rpx; }
.switch-opt { padding: 10rpx 28rpx; border-radius: 40rpx; font-size: 26rpx; background: rgba(255,255,255,0.2); &.active { background: #fff; color: #1677FF; font-weight: 600; } }
.stats-row { display: flex; margin: 24rpx; background: #fff; border-radius: 16rpx; padding: 24rpx; }
.stat { flex:1; text-align: center; font-size: 22rpx; color: #999; .sn { font-size: 38rpx; font-weight: bold; color: #1677FF; display: block; } .sn.star { color: #FAAD14; } }
.action-grid { display: flex; gap: 16rpx; margin: 0 24rpx 24rpx; }
.action-item { flex:1; background: #fff; border-radius: 16rpx; padding: 24rpx; text-align: center; font-size: 26rpx; color: #333; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06); }
.action-item.primary { background: linear-gradient(135deg, #E6F4FF, #BAE0FF); }
.ai-num { font-size: 52rpx; font-weight: bold; color: #1677FF; display: block; }
.ai-num.warn { color: #FA8C16; }
.ai-desc { display: block; font-size: 22rpx; color: #999; margin-top: 4rpx; }
.card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin: 0 24rpx 24rpx; }
.card-title { font-size: 30rpx; font-weight: bold; margin-bottom: 16rpx; display: block; }
.order-mini { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid #F5F5F5; }
.om-no { font-size: 24rpx; font-weight: 600; display: block; }
.om-device { font-size: 26rpx; color: #333; display: block; }
.om-addr { font-size: 22rpx; color: #999; }
.om-priority { font-size: 22rpx; padding: 4rpx 12rpx; border-radius: 8rpx; &.urgent { background:#FFF7E6; color:#FA8C16; } &.critical { background:#FFF1F0; color:#FF4D4F; } }
.empty { text-align: center; padding: 60rpx 0; color: #999; }
</style>
