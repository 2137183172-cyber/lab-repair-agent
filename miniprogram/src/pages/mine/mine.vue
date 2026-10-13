<template>
  <view class="mine-page">
    <!-- 用户信息 -->
    <view class="header" @click="goLogin" v-if="!userStore.isLoggedIn">
      <image src="/static/icons/demo-lab.svg" class="avatar" mode="aspectFill" />
      <text class="login-btn">点击登录</text>
      <text class="demo-hint">演示账号</text>
    </view>
    <view class="header" v-else>
      <image :src="userStore.userInfo?.avatar || '/static/icons/demo-lab.svg'" class="avatar" mode="aspectFill" />
      <view class="user-detail">
        <text class="uname">{{ userStore.userInfo?.name }}</text>
        <text class="ucompany">{{ userStore.userInfo?.company || '未设置单位' }}</text>
      </view>
      <text class="edit-btn" @click="goEditProfile">编辑</text>
    </view>

    <!-- 统计 -->
    <view class="stats-row" v-if="userStore.isLoggedIn">
      <view class="stat-item" @click="goOrders('')"><text class="sn">{{ dashboard?.total_orders || 0 }}</text><text>全部工单</text></view>
      <view class="stat-item" @click="goOrders('pending')"><text class="sn warn">{{ dashboard?.pending_orders || 0 }}</text><text>进行中</text></view>
      <view class="stat-item" @click="goOrders('review')">
        <text class="sn review">{{ dashboard?.pending_review || 0 }}</text>
        <text>待评价</text>
      </view>
    </view>

    <!-- 菜单 -->
    <view class="menu-group">
      <view class="menu-title">我的服务</view>
      <view class="menu-item" @click="goOrders('review')">
        <text class="mi-icon">⭐</text><text>待评价</text>
        <text class="mi-badge" v-if="dashboard?.pending_review > 0">{{ dashboard.pending_review }}</text>
        <text class="mi-arrow">›</text>
      </view>
      <view class="menu-item" @click="goOrders('')">
        <text class="mi-icon">📋</text><text>全部工单</text><text class="mi-arrow">›</text>
      </view>
      <view class="menu-item" @click="goDevices">
        <text class="mi-icon">🔬</text><text>设备管理</text><text class="mi-arrow">›</text>
      </view>
      <view v-if="userStore.isEngineer" class="menu-item" @click="goEngineer">
        <text class="mi-icon">🔧</text><text>工程师工作台</text><text class="mi-arrow">›</text>
      </view>
    </view>

    <view class="menu-group">
      <view class="menu-title">更多</view>
      <view class="menu-item" @click="goKnowledge">
        <text class="mi-icon">📚</text><text>维修知识库</text><text class="mi-arrow">›</text>
      </view>
      <view class="menu-item" @click="contactService">
        <text class="mi-icon">💬</text><text>联系客服</text><text class="mi-sub">400-xxx-xxxx</text>
      </view>
      <view class="menu-item" @click="goAbout">
        <text class="mi-icon">ℹ️</text><text>关于智荟华科</text><text class="mi-arrow">›</text>
      </view>
    </view>

    <button v-if="userStore.isLoggedIn" class="logout-btn" @click="handleLogout">退出登录</button>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useUserStore } from '@/store/index';
import { getUserDashboard } from '@/api/index';

const userStore = useUserStore();
const dashboard = ref(null);

function goLogin() {
  uni.showActionSheet({
    title: '选择身份注册/登录',
    itemList: ['我是维修用户', '我是工程师', '演示账号(用户)', '演示账号(工程师)'],
    success: async (res) => {
      const tapIndex = res.tapIndex;
      let code, role, profile;
      if (tapIndex === 0) { // 维修用户
        code = 'new_user_' + Date.now();
        role = 'user';
        profile = { name: '新用户', role };
      } else if (tapIndex === 1) { // 工程师
        code = 'new_eng_' + Date.now();
        role = 'engineer';
        profile = {
          name: '新工程师',
          phone: '13000000000',
          role,
          type: 'certified',
          skills: ['离心机', 'PCR仪', '质谱仪'],
          service_area: ['本地']
        };
      } else if (tapIndex === 2) { // 演示用户
        code = 'demo';
        profile = { name: '演示用户' };
      } else { // 演示工程师
        code = 'eng_test';
        profile = {
          name: '张工程师',
          phone: '13000000000',
          role: 'engineer',
          type: 'certified',
          skills: ['离心机', 'PCR仪', '质谱仪'],
          service_area: ['本地']
        };
      }
      try {
        await userStore.login(code, profile);
        loadDashboard();
        uni.showToast({ title: '登录成功', icon: 'success' });
      } catch (e) {
        uni.showToast({ title: e.message || '登录失败', icon: 'none' });
      }
    }
  });
}

function wxLoginCode() {
  return new Promise((resolve) => {
    uni.login({ success: resolve, fail: () => resolve({ code: '' }) });
  });
}

async function loadDashboard() {
  try { dashboard.value = await getUserDashboard(); } catch (e) { /* ignore */ }
}

function goOrders(filter) {
  getApp().globalData.orderFilter = filter || '';
  uni.switchTab({ url: '/pages/orders/list' });
}
function goDevices() { uni.navigateTo({ url: '/pages/devices/list' }); }
function goEngineer() { uni.navigateTo({ url: '/pages/engineer/index' }); }
function goKnowledge() { uni.navigateTo({ url: '/pages/knowledge/list' }); }
function goEditProfile() { uni.navigateTo({ url: '/pages/mine/profile' }); }
function goAbout() { uni.showToast({ title: '智荟华科 v3.0.0\n生物仪器维修专家', icon: 'none' }); }
function contactService() { uni.makePhoneCall({ phoneNumber: '4000000000' }); }

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出吗？',
    success: (res) => {
      if (res.confirm) { userStore.logout(); dashboard.value = null; }
    }
  });
}

onMounted(() => { if (userStore.isLoggedIn) loadDashboard(); });
</script>

<style lang="scss" scoped>
.mine-page { min-height: 100vh; background: #F5F6FA; }
.header { background: #fff; padding: 40rpx 30rpx; display: flex; align-items: center; gap: 20rpx; margin-bottom: 24rpx; }
.avatar { width: 100rpx; height: 100rpx; border-radius: 50%; background: #EEE; }
.login-btn { font-size: 32rpx; color: #1677FF; }
.demo-hint { font-size: 22rpx; color: #999; margin-top: 4rpx; display: block; }
.user-detail { flex:1; .uname { font-size: 34rpx; font-weight: 600; display: block; } .ucompany { font-size: 24rpx; color: #999; } }
.edit-btn { font-size: 26rpx; color: #1677FF; padding: 8rpx 20rpx; border: 1rpx solid #1677FF; border-radius: 8rpx; }
.stats-row {
  display: flex; margin: 0 24rpx 24rpx; background: #fff; border-radius: 16rpx; padding: 24rpx;
  .stat-item { flex:1; text-align: center; font-size: 24rpx; color: #999; .sn { font-size: 40rpx; font-weight: bold; color: #1677FF; display: block; } .sn.warn { color: #FA8C16; } .sn.review { color: #FF4D4F; } }
}
.menu-group { background: #fff; border-radius: 16rpx; margin: 0 24rpx 24rpx; padding: 0 24rpx; overflow: hidden; }
.menu-title { font-size: 24rpx; color: #999; padding: 24rpx 0 12rpx; }
.menu-item { display: flex; align-items: center; padding: 24rpx 0; border-bottom: 1rpx solid #F5F5F5; font-size: 28rpx; color: #333; }
.mi-badge { background: #FF4D4F; color: #fff; font-size: 20rpx; padding: 2rpx 10rpx; border-radius: 20rpx; margin-left: 8rpx; }
.menu-item:last-child { border-bottom: none; }
.mi-icon { margin-right: 16rpx; font-size: 36rpx; }
.mi-arrow { margin-left: auto; font-size: 32rpx; color: #CCC; }
.mi-sub { margin-left: auto; font-size: 24rpx; color: #999; }
.logout-btn { margin: 40rpx 24rpx; background: #FFF; color: #FF4D4F; border: 2rpx solid #FF4D4F; border-radius: 12rpx; }
</style>
