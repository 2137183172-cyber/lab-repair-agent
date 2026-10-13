<template>
  <view class="home">
    <!-- 顶部 -->
    <view class="header">
      <view class="header-top">
        <image src="/static/icons/demo-lab.svg" class="logo-img" mode="aspectFit" />
        <view class="header-text">
          <text class="logo-text">智荟华科</text>
          <text class="subtitle">生物仪器维修专家</text>
        </view>
      </view>
      <view class="user-info" v-if="userStore.isLoggedIn">
        <text class="greeting">{{ userStore.userInfo?.name || '用户' }}，你好</text>
      </view>
    </view>

    <!-- 未登录提示 -->
    <view class="login-tip" v-if="!userStore.isLoggedIn" @click="goLogin">
      <text class="lt-icon">👋</text>
      <text class="lt-text">点击登录，使用完整功能</text>
      <text class="lt-arrow">›</text>
    </view>

    <!-- 统计数据 -->
    <view class="stats-row" v-if="dashboard">
      <view class="stat-item">
        <text class="stat-num">{{ dashboard.device_count }}</text>
        <text class="stat-label">我的设备</text>
      </view>
      <view class="stat-item">
        <text class="stat-num warn">{{ dashboard.pending_orders }}</text>
        <text class="stat-label">进行中工单</text>
      </view>
      <view class="stat-item">
        <text class="stat-num">{{ dashboard.total_orders }}</text>
        <text class="stat-label">总工单</text>
      </view>
    </view>

    <!-- 核心操作 -->
    <view class="action-section">
      <text class="section-title">快捷操作</text>
      <view class="action-grid">
        <view class="action-item primary" @click="handleScanReport">
          <image src="/static/icons/demo-lab.svg" class="action-icon" mode="aspectFit" />
          <text class="action-label">扫码报修</text>
          <text class="action-desc">一物一码，即扫即报</text>
        </view>
        <view class="action-item" @click="goReport">
          <image src="/static/icons/demo-lab.svg" class="action-icon" mode="aspectFit" />
          <text class="action-label">手动报修</text>
          <text class="action-desc">选择设备，填写故障</text>
        </view>
        <view class="action-item" @click="goOrders">
          <image src="/static/icons/demo-lab.svg" class="action-icon" mode="aspectFit" />
          <text class="action-label">工单追踪</text>
          <text class="action-desc">实时查看维修进度</text>
        </view>
        <view class="action-item" @click="goDevices">
          <image src="/static/icons/demo-lab.svg" class="action-icon" mode="aspectFit" />
          <text class="action-label">设备管理</text>
          <text class="action-desc">管理我的仪器设备</text>
        </view>
        <view class="action-item marketplace-entry" @click="goMarketplace">
          <text class="action-icon-text">🏪</text>
          <text class="action-label">需求广场</text>
          <text class="action-desc">公开招标·多方竞标</text>
        </view>
        <view class="action-item engineer-entry" @click="goEngineers">
          <text class="action-icon-text">🔧</text>
          <text class="action-label">找工程师</text>
          <text class="action-desc">推荐·收藏·筛选</text>
        </view>
      </view>
    </view>

    <!-- 推荐工程师 -->
    <view class="recommend-section" v-if="recEngineers.length > 0">
      <view class="section-header">
        <text class="section-title">🔧 推荐工程师</text>
        <text class="section-more" @click="goEngineers">全部 ›</text>
      </view>
      <scroll-view scroll-x class="rec-scroll">
        <view v-for="eng in recEngineers" :key="eng.id" class="rec-card" @click="goEngineerDetail(eng.id)">
          <view class="rc-top">
            <text class="rc-name">{{ eng.name }}</text>
            <text class="rc-fav" v-if="eng.is_favorited">⭐</text>
          </view>
          <text class="rc-rating">⭐{{ eng.rating }} {{ eng.good_rate || 100 }}%好评</text>
          <view class="rc-skills" v-if="eng.skills">
            <text v-for="s in (eng.skills||[]).slice(0,3)" :key="s" class="rc-skill">{{ s }}</text>
          </view>
          <text class="rc-match" v-if="eng.match_devices">匹配你{{ eng.match_devices }}台设备</text>
        </view>
      </scroll-view>
    </view>

    <!-- 最近工单 -->
    <view class="recent-section" v-if="dashboard?.recent_order">
      <text class="section-title">最近工单</text>
      <view class="recent-card" @click="goDetail(dashboard.recent_order.id)">
        <view class="rc-left">
          <text class="rc-no">{{ dashboard.recent_order.order_no }}</text>
          <text class="rc-device">{{ dashboard.recent_order.device?.name || '未知设备' }}</text>
        </view>
        <view class="rc-right">
          <text class="rc-status" :class="dashboard.recent_order.status">
            {{ statusMap[dashboard.recent_order.status] }}
          </text>
          <text class="rc-time">{{ formatTime(dashboard.recent_order.created_at) }}</text>
        </view>
      </view>
    </view>

    <!-- 服务优势 -->
    <view class="feature-section">
      <text class="section-title">为什么选择智荟华科</text>
      <view class="feature-list">
        <view class="feature-item">
          <text class="fi-icon">🔧</text>
          <text class="fi-title">原厂认证工程师</text>
          <text class="fi-desc">团队具备Agilent/Thermo/Bio-Rad等品牌原厂培训资质</text>
        </view>
        <view class="feature-item">
          <text class="fi-icon">⚡</text>
          <text class="fi-title">2小时快速响应</text>
          <text class="fi-desc">报修后2小时内响应，24小时上门服务</text>
        </view>
        <view class="feature-item">
          <text class="fi-icon">💰</text>
          <text class="fi-title">费用仅为原厂40%</text>
          <text class="fi-desc">同等服务质量，更合理的价格</text>
        </view>
        <view class="feature-item">
          <text class="fi-icon">📋</text>
          <text class="fi-title">维修报告自动归档</text>
          <text class="fi-desc">符合GMP/GLP合规要求的完整维修档案</text>
        </view>
      </view>
    </view>

    <!-- 底部安全区 -->
    <view class="safe-bottom"></view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useUserStore } from '@/store/index';
import { getUserDashboard, getEngineerHall } from '@/api/index';

const userStore = useUserStore();
const dashboard = ref(null);
const recEngineers = ref([]);

const statusMap = {
  pending: '待接单',
  accepted: '已接单',
  diagnosing: '诊断中',
  quoted: '待审批/支付',
  paid: '已支付',
  repairing: '维修中',
  completed: '维修完成',
  pending_review: '待评价',
  confirmed: '已完成',
  cancelled: '已取消'
};

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function ensureLogin() {
  if (!userStore.isLoggedIn) {
    uni.switchTab({ url: '/pages/mine/mine' });
    return false;
  }
  return true;
}
function handleScanReport() {
  if (!ensureLogin()) return;
  uni.scanCode({
    scanType: ['qrCode'],
    success(res) {
      // 解析二维码中的设备ID，跳转报修页
      try {
        const data = JSON.parse(res.result);
        if (data.d) {
          uni.navigateTo({ url: `/pages/report/report?device_id=${data.d}` });
        } else {
          uni.navigateTo({ url: '/pages/report/report' });
        }
      } catch (e) {
        uni.navigateTo({ url: '/pages/report/report' });
      }
    },
    fail() {
      uni.showToast({ title: '扫码取消', icon: 'none' });
    }
  });
}

function goReport() { if (!ensureLogin()) return; uni.navigateTo({ url: '/pages/report/report' }); }
function goOrders() { if (!ensureLogin()) return; uni.switchTab({ url: '/pages/orders/list' }); }
function goDevices() { if (!ensureLogin()) return; uni.navigateTo({ url: '/pages/devices/list' }); }
function goMarketplace() { if (!ensureLogin()) return; uni.navigateTo({ url: '/pages/marketplace/index' }); }
function goEngineers() { if (!ensureLogin()) return; uni.navigateTo({ url: '/pages/marketplace/engineers' }); }
function goEngineerDetail(id) { if (!ensureLogin()) return; uni.navigateTo({ url: '/pages/marketplace/engineers' }); }
function goLogin() { uni.switchTab({ url: '/pages/mine/mine' }); }
function goDetail(id) { if (!ensureLogin()) return; uni.navigateTo({ url: `/pages/orders/detail?id=${id}` }); }

onMounted(async () => {
  if (userStore.isLoggedIn) {
    try { dashboard.value = await getUserDashboard(); } catch (e) { /* ignore */ }
    try {
      const r = await getEngineerHall({ sort: 'recommend', pageSize: 5 });
      recEngineers.value = r.list || [];
    } catch (e) { /* ignore */ }
  }
});
</script>

<style lang="scss" scoped>
.home {
  min-height: 100vh;
  background: #F5F6FA;
}
.header {
  background: linear-gradient(135deg, #1677FF, #0958D9);
  padding: 24rpx 30rpx 30rpx;
  color: #fff;
  .header-top {
    display: flex; align-items: center; gap: 16rpx;
    .logo-img { width: 66rpx; height: 72rpx; }
    .header-text { display: flex; flex-direction: column; }
    .logo-text { font-size: 36rpx; font-weight: bold; }
    .subtitle { font-size: 22rpx; opacity: 0.85; }
  }
  .user-info { margin-top: 8rpx; .greeting { font-size: 26rpx; opacity: 0.9; } }
}
.stats-row {
  display: flex; margin: -30rpx 24rpx 24rpx;
  .stat-item {
    flex:1; background: #fff; border-radius: 16rpx; padding: 24rpx;
    text-align: center; margin: 0 8rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
    .stat-num { font-size: 48rpx; font-weight: bold; color: #1677FF; display: block; }
    .stat-num.warn { color: #FA8C16; }
    .stat-label { font-size: 24rpx; color: #999; margin-top: 4rpx; display: block; }
  }
}
.section-title {
  font-size: 32rpx; font-weight: bold; color: #333;
  padding: 0 30rpx; margin-bottom: 16rpx; display: block;
}
.action-section {
  margin: 0 24rpx 24rpx;
  .action-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx;
    .action-item {
      background: #fff; border-radius: 16rpx; padding: 28rpx 24rpx;
      box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
      .action-icon { width: 56rpx; height: 56rpx; margin-bottom: 12rpx; }
      .action-label { font-size: 28rpx; font-weight: 600; color: #333; display: block; }
      .action-desc { font-size: 22rpx; color: #999; margin-top: 4rpx; display: block; }
    }
    .action-item.primary {
      background: linear-gradient(135deg, #E6F4FF, #BAE0FF);
      border: 2rpx solid #91CAFF;
    }
  }
}
.recent-section, .feature-section {
  margin: 0 24rpx 24rpx;
  .recent-card {
    background: #fff; border-radius: 16rpx; padding: 24rpx;
    display: flex; justify-content: space-between; align-items: center;
    box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
    .rc-no { font-size: 26rpx; color: #333; font-weight: 600; }
    .rc-device { font-size: 24rpx; color: #999; margin-top: 4rpx; display: block; }
    .rc-right { text-align: right; }
    .rc-time { font-size: 22rpx; color: #ccc; display: block; margin-top: 4rpx; }
  }
}
.rc-status {
  font-size: 24rpx; padding: 4rpx 12rpx; border-radius: 8rpx; font-weight: 500;
  &.pending { color: #FA8C16; background: #FFF7E6; }
  &.accepted, &.diagnosing, &.paid, &.repairing { color: #1677FF; background: #E6F4FF; }
  &.quoted, &.pending_review { color: #FA8C16; background: #FFF7E6; }
  &.completed { color: #52C41A; background: #F6FFED; }
  &.confirmed { color: #52C41A; background: #F6FFED; }
  &.cancelled { color: #999; background: #F5F5F5; }
}
.feature-list {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx;
  .feature-item {
    background: #fff; border-radius: 16rpx; padding: 24rpx;
    box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
    .fi-icon { font-size: 36rpx; display: block; margin-bottom: 8rpx; }
    .fi-title { font-size: 26rpx; font-weight: 600; color: #333; display: block; }
    .fi-desc { font-size: 22rpx; color: #999; margin-top: 6rpx; display: block; line-height: 1.5; }
  }
}
.recommend-section { margin: 0 24rpx 24rpx; }
.section-header { display: flex; justify-content: space-between; align-items: center; padding: 0 6rpx; margin-bottom: 8rpx; }
.section-more { font-size: 24rpx; color: #1677FF; }
.rec-scroll { white-space: nowrap; display: flex; gap: 16rpx; }
.rec-card { display: inline-block; width: 260rpx; background: #fff; border-radius: 16rpx; padding: 20rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06); white-space: normal; }
.rc-top { display: flex; justify-content: space-between; }
.rc-name { font-size: 28rpx; font-weight: 600; }
.rc-rating { font-size: 22rpx; color: #999; margin: 6rpx 0; display: block; }
.rc-skills { display: flex; flex-wrap: wrap; gap: 4rpx; margin-bottom: 6rpx; }
.rc-skill { font-size: 20rpx; padding: 2rpx 8rpx; background: #F0F5FF; color: #1677FF; border-radius: 4rpx; }
.rc-match { font-size: 20rpx; color: #52C41A; }
.login-tip { margin: 24rpx; padding: 28rpx 24rpx; background: linear-gradient(135deg,#E6F4FF,#BAE0FF); border-radius: 16rpx; display: flex; align-items: center; }
.lt-icon { font-size: 48rpx; margin-right: 16rpx; }
.lt-text { flex: 1; font-size: 28rpx; color: #1677FF; font-weight: 500; }
.lt-arrow { font-size: 36rpx; color: #1677FF; }
.safe-bottom { height: 100rpx; }
</style>
