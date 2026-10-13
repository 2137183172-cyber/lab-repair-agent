<template>
  <view class="eng-mine">
    <view class="header">
      <image :src="userStore.userInfo?.avatar || '/static/icons/demo-lab.svg'" class="avatar" mode="aspectFill" />
      <text class="name">🔧 {{ userStore.userInfo?.name }}</text>
      <text class="role">认证工程师</text>
    </view>

    <view class="stats-card">
      <view class="stat"><text class="sn">{{ stats?.completed_orders || 0 }}</text><text>累计完成</text></view>
      <view class="stat"><text class="sn">⭐ {{ stats?.rating || '5.0' }}</text><text>用户评分</text></view>
      <view class="stat"><text class="sn">¥{{ stats?.balance || 0 }}</text><text>账户余额</text></view>
    </view>

    <view class="menu-group">
      <view class="menu-item" @click="goSubscribe">
        <text>👑</text><text>升级订阅</text><text class="sub-text">VIP/SVIP</text><text class="arrow">›</text>
      </view>
      <view class="menu-item" @click="goWallet">
        <text>💰</text><text>我的钱包</text><text class="arrow">›</text>
      </view>
      <view class="menu-item" @click="goKnowledge">
        <text>📚</text><text>知识库</text><text class="arrow">›</text>
      </view>
      <view class="menu-item" @click="goSettings">
        <text>⚙️</text><text>服务范围设置</text><text class="arrow">›</text>
      </view>
    </view>

    <button class="switch-btn" @click="switchToUser">切换到用户模式</button>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useUserStore } from '@/store/index';
import { getEngineerStats } from '@/api/index';

const userStore = useUserStore();
const stats = ref({});

function switchToUser() { uni.switchTab({ url: '/pages/mine/mine' }); }
function goSubscribe() { uni.navigateTo({ url: '/pages/marketplace/subscribe' }); }
function goWallet() { uni.navigateTo({ url: '/pages/wallet/index' }); }
function goKnowledge() { uni.navigateTo({ url: '/pages/knowledge/list' }); }
function goSettings() { uni.navigateTo({ url: '/pages/mine/profile' }); }

onMounted(async () => {
  try { stats.value = await getEngineerStats(); } catch(e) { /* ignore */ }
});
</script>

<style lang="scss" scoped>
.eng-mine { min-height: 100vh; background: #F5F6FA; }
.header { background: linear-gradient(135deg, #1677FF, #0958D9); padding: 60rpx 30rpx; text-align: center; color: #fff; }
.avatar { width: 120rpx; height: 120rpx; border-radius: 50%; border: 4rpx solid rgba(255,255,255,0.5); margin-bottom: 16rpx; }
.name { font-size: 36rpx; font-weight: bold; display: block; }
.role { font-size: 24rpx; opacity: 0.85; }
.stats-card { display: flex; margin: -30rpx 24rpx 24rpx; background: #fff; border-radius: 16rpx; padding: 24rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.08); }
.stat { flex:1; text-align: center; font-size: 22rpx; color: #999; .sn { font-size: 38rpx; font-weight: bold; color: #1677FF; display: block; } }
.menu-group { background: #fff; border-radius: 16rpx; margin: 0 24rpx 24rpx; padding: 0 24rpx; }
.menu-item { display: flex; align-items: center; gap: 16rpx; padding: 28rpx 0; border-bottom: 1rpx solid #F5F5F5; font-size: 28rpx; .arrow { margin-left: auto; font-size: 32rpx; color: #CCC; } }
.menu-item:last-child { border: none; }
.switch-btn { margin: 40rpx 24rpx; background: #FFF; color: #1677FF; border: 2rpx solid #1677FF; border-radius: 12rpx; }
</style>
