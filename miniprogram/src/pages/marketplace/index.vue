<template>
  <view class="marketplace">
    <view class="header"><text class="title">需求广场</text><text class="sub">公开招标工单</text></view>

    <!-- 筛选Tab -->
    <view class="filter-tabs">
      <view class="ft-item" :class="{ active: filterTab === 'all' }" @click="switchFilter('all')">
        <text>全部招标</text>
        <text class="ft-count" v-if="totalCount">{{ totalCount }}</text>
      </view>
      <view class="ft-item" :class="{ active: filterTab === 'mine' }" @click="switchFilter('mine')">
        <text>我的发布</text>
        <text class="ft-count" v-if="mineCount">{{ mineCount }}</text>
      </view>
    </view>

    <!-- 订阅状态条 -->
    <view class="sub-bar" v-if="subscription && subscription.plan !== 'guest'" @click="goSubscribe">
      <text class="sb-plan">{{ subscription.plan_name }}</text>
      <text class="sb-count">今日已看 {{ subscription.used_today }}/{{ subscription.daily_views }} 条</text>
      <text class="sb-upgrade" v-if="subscription.plan !== 'svip'">升级 ›</text>
    </view>
    <!-- 超限提示 -->
    <view class="limit-tip" v-if="subscription && subscription.remaining <= 0 && subscription.plan !== 'guest'">
      <text>今日浏览次数已用完，升级VIP/SVIP查看更多</text>
      <button class="btn-upgrade" @click="goSubscribe">立即升级</button>
    </view>

    <view v-if="!userStore.isLoggedIn" class="login-tip" @click="goLogin">
      <text>👋 请先登录后查看需求广场</text>
    </view>
    <view v-else-if="orders.length === 0 && !loading" class="empty">
      <text v-if="filterTab === 'mine'">你还没有发布公开招标</text>
      <text v-else>暂无公开招标工单</text>
    </view>
    <view v-for="o in orders" :key="o.id" class="order-card" @click="handleCardClick(o)">
      <view class="oc-header">
        <text class="oc-no">{{ o.order_no }}</text>
        <view class="oc-badges">
          <text class="oc-mine-badge" v-if="o.is_mine">我的发布</text>
          <text class="oc-priority" :class="o.priority">{{ {'normal':'普通','urgent':'⚠紧急','critical':'🔴严重'}[o.priority] }}</text>
        </view>
      </view>
      <text class="oc-device">{{ o.device?.name || '未指定设备' }} · {{ o.device?.brand || '' }}</text>
      <text class="oc-fault">{{ o.fault_desc }}</text>
      <view class="oc-meta">
        <text>{{ o.reporter?.company || '' }}</text>
        <text class="oc-match" v-if="o.match_score">匹配度 {{ o.match_score }}%</text>
      </view>
      <view class="oc-footer">
        <text class="oc-bids">{{ o.bid_count || 0 }} 人竞标</text>
        <text class="oc-tag" v-if="o.is_mine && o.bid_count > 0" @click.stop="goBids(o)">查看竞标 ›</text>
        <text class="oc-tag" v-else-if="o.has_bid">✅ 已竞标</text>
        <text class="oc-tag" v-else-if="!o.is_mine">去竞标 →</text>
        <text class="oc-tag" v-else>等待竞标</text>
      </view>
    </view>
    <view v-if="loading" class="loading">加载中...</view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useUserStore } from '@/store/index';
import { getPublicOrders, getSubscriptionStatus } from '@/api/index';

const userStore = useUserStore();
const orders = ref([]);
const loading = ref(false);
const subscription = ref(null);
const filterTab = ref('all');
const totalCount = ref(0);
const mineCount = ref(0);

function switchFilter(tab) {
  filterTab.value = tab;
  loadOrders();
}

async function loadOrders() {
  loading.value = true;
  try {
    const params = {};
    if (filterTab.value === 'mine') params.my_only = '1';
    const data = await getPublicOrders(params);
    orders.value = data.list || [];
    totalCount.value = data.total || 0;
    if (filterTab.value === 'all') mineCount.value = (data.list || []).filter(o => o.is_mine).length;
    if (data.subscription) subscription.value = data.subscription;
  } catch (e) { /* ignore */ }
  loading.value = false;
}

async function loadSubStatus() {
  try { subscription.value = await getSubscriptionStatus(); } catch (e) { /* ignore */ }
}

function goLogin() { uni.switchTab({ url: '/pages/mine/mine' }); }
function goSubscribe() { uni.navigateTo({ url: '/pages/marketplace/subscribe' }); }

function handleCardClick(order) {
  if (order.is_mine && order.bid_count > 0) {
    goBids(order);
  } else if (order.has_bid) {
    goBids(order);
  } else if (!order.is_mine) {
    goBid(order);
  }
}

function goBid(order) {
  uni.navigateTo({ url: `/pages/engineer/quote?orderId=${order.id}` });
}

function goBids(order) {
  uni.navigateTo({ url: `/pages/marketplace/bids?orderId=${order.id}` });
}

onMounted(() => { loadOrders(); loadSubStatus(); });
</script>

<style lang="scss" scoped>
.marketplace { min-height: 100vh; background: #F5F6FA; }
.header { background: linear-gradient(135deg, #1677FF, #0958D9); padding: 40rpx 30rpx 30rpx; color: #fff;
  .title { font-size: 40rpx; font-weight: bold; display: block; }
  .sub { font-size: 24rpx; opacity: 0.7; }
}
/* 筛选Tab */
.filter-tabs { margin: 16rpx 24rpx; display: flex; gap: 12rpx; }
.ft-item { flex: 1; text-align: center; padding: 18rpx; background: #fff; border-radius: 12rpx; font-size: 28rpx; color: #666; display: flex; align-items: center; justify-content: center; gap: 8rpx; }
.ft-item.active { background: #1677FF; color: #fff; font-weight: 600; }
.ft-count { font-size: 22rpx; padding: 2rpx 12rpx; border-radius: 10rpx; background: rgba(0,0,0,0.08); }
.ft-item.active .ft-count { background: rgba(255,255,255,0.25); }
.sub-bar { margin: 16rpx 24rpx; padding: 18rpx 20rpx; background: linear-gradient(135deg,#FFF7E6,#FFFBE6); border: 1rpx solid #FFE58F; border-radius: 12rpx; display: flex; align-items: center; }
.sb-plan { font-size: 24rpx; font-weight: 600; color: #D46B08; padding: 2rpx 12rpx; background: #FFF1B8; border-radius: 8rpx; }
.sb-count { flex: 1; text-align: center; font-size: 24rpx; color: #666; }
.sb-upgrade { font-size: 24rpx; color: #1677FF; font-weight: 500; }
.limit-tip { margin: 16rpx 24rpx; padding: 24rpx; background: #FFF1F0; border: 1rpx solid #FFA39E; border-radius: 12rpx; text-align: center; font-size: 26rpx; color: #CF1322; }
.btn-upgrade { margin-top: 16rpx; padding: 16rpx 40rpx; background: linear-gradient(135deg,#FF4D4F,#F5222D); color:#fff; border-radius: 10rpx; font-size: 28rpx; border:none; display:inline-block; width:auto; }
.login-tip { margin: 40rpx 24rpx; padding: 40rpx; text-align: center; background: #E6F4FF; border-radius: 16rpx; font-size: 28rpx; color: #1677FF; }
.empty { text-align: center; padding: 100rpx 0; color: #999; }
.order-card { background: #fff; margin: 16rpx 24rpx; border-radius: 16rpx; padding: 24rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06); }
.oc-header { display: flex; justify-content: space-between; margin-bottom: 8rpx; }
.oc-badges { display: flex; gap: 8rpx; align-items: center; }
.oc-no { font-weight: 600; font-size: 28rpx; color: #1677FF; }
.oc-mine-badge { font-size: 20rpx; padding: 4rpx 10rpx; border-radius: 6rpx; background: #E6F4FF; color: #1677FF; font-weight: 500; }
.oc-priority { font-size: 22rpx; padding: 4rpx 12rpx; border-radius: 6rpx; }
.oc-priority.critical { background: #FFF1F0; color: #FF4D4F; }
.oc-priority.urgent { background: #FFF7E6; color: #FA8C16; }
.oc-priority.normal { background: #F5F5F5; color: #999; }
.oc-device { font-size: 26rpx; color: #333; display: block; margin-bottom: 4rpx; }
.oc-fault { font-size: 24rpx; color: #666; display: block; margin-bottom: 8rpx; }
.oc-meta { display: flex; justify-content: space-between; font-size: 22rpx; color: #999; }
.oc-match { color: #52C41A; }
.oc-footer { display: flex; justify-content: space-between; margin-top: 12rpx; padding-top: 12rpx; border-top: 1rpx solid #F0F0F0; }
.oc-bids { font-size: 24rpx; color: #1677FF; }
.oc-tag { font-size: 24rpx; color: #FA8C16; font-weight: 500; }
.loading { text-align: center; padding: 40rpx; color: #999; }
</style>
