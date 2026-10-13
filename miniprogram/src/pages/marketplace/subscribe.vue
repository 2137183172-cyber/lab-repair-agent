<template>
  <view class="sub-page">
    <view class="header"><text class="title">升级订阅</text><text class="sub">解锁更多需求广场浏览</text></view>

    <!-- 当前套餐 -->
    <view class="current-plan" v-if="plans">
      <text class="cp-label">当前套餐</text>
      <text class="cp-name">{{ plans.current_plan === 'free' ? '免费版' : plans.current_plan === 'vip' ? 'VIP版' : 'SVIP版' }}</text>
      <text class="cp-expire" v-if="plans.expires_at">到期: {{ plans.expires_at?.split('T')[0] }}</text>
    </view>

    <!-- 套餐卡片 -->
    <view class="plan-cards" v-if="plans">
      <view v-for="p in plans.plans" :key="p.key" class="plan-card" :class="{ current: p.is_current, highlight: p.key === 'vip' }">
        <view class="pc-header">
          <text class="pc-name">{{ p.name }}</text>
          <text class="pc-badge" v-if="p.is_current">当前</text>
          <text class="pc-badge recommend" v-if="p.key === 'vip'">推荐</text>
        </view>
        <text class="pc-views">每日 {{ p.daily_views }} 条</text>
        <view class="pc-prices" v-if="p.key !== 'free'">
          <view class="price-row" @click="buyPlan(p.key, 'monthly')">
            <text class="pr-label">月付</text>
            <text class="pr-price">¥{{ p.price_monthly }}<text class="pr-unit">/月</text></text>
            <text class="pr-btn">订阅</text>
          </view>
          <view class="price-row yearly" @click="buyPlan(p.key, 'yearly')">
            <text class="pr-label">年付</text>
            <text class="pr-price">¥{{ p.price_yearly }}<text class="pr-unit">/年</text></text>
            <text class="pr-discount">省¥{{ p.price_monthly * 12 - p.price_yearly }}</text>
            <text class="pr-btn">订阅</text>
          </view>
        </view>
        <view v-else class="pc-free">永久免费</view>
      </view>
    </view>

    <!-- 订阅历史 -->
    <view class="history" v-if="history.length > 0">
      <text class="section-title">订阅记录</text>
      <view v-for="h in history" :key="h.id" class="h-item">
        <text class="h-plan">{{ h.plan === 'vip' ? 'VIP版' : 'SVIP版' }} · {{ h.period === 'yearly' ? '年付' : '月付' }}</text>
        <text class="h-amount">¥{{ h.amount }}</text>
        <text class="h-time">{{ h.created_at?.split('T')[0] }}</text>
      </view>
    </view>

    <view class="note">
      <text>• 订阅后即时生效，到期自动降级免费版</text>
      <text>• 年付享8.3折优惠</text>
      <text>• 当前为模拟支付（测试模式）</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getSubscriptionPlans, subscribePlan, getSubscriptionHistory } from '@/api/index';

const plans = ref(null);
const history = ref([]);

async function buyPlan(plan, period) {
  const names = { vip: 'VIP版', svip: 'SVIP版' };
  const periods = { monthly: '月付', yearly: '年付' };
  uni.showModal({
    title: '确认订阅',
    content: `${names[plan]} · ${periods[period]}，确认订阅？`,
    success: async (res) => {
      if (!res.confirm) return;
      try {
        const result = await subscribePlan(plan, period);
        uni.showToast({ title: result.message || '订阅成功！', icon: 'success' });
        setTimeout(() => uni.navigateBack(), 1000);
      } catch (e) {
        uni.showToast({ title: e.message || '订阅失败', icon: 'none' });
      }
    }
  });
}

onMounted(async () => {
  try { plans.value = await getSubscriptionPlans(); } catch (e) { /* ignore */ }
  try { const r = await getSubscriptionHistory(); history.value = r || []; } catch (e) { /* ignore */ }
});
</script>

<style lang="scss" scoped>
.sub-page { min-height: 100vh; background: #F5F6FA; padding-bottom: 40rpx; }
.header { background: linear-gradient(135deg, #1677FF, #0958D9); padding: 40rpx 30rpx 30rpx; color: #fff; }
.title { font-size: 40rpx; font-weight: bold; display: block; }
.sub { font-size: 24rpx; opacity: 0.7; }
.current-plan { margin: 24rpx; padding: 20rpx 24rpx; background: #fff; border-radius: 16rpx; display: flex; align-items: center; gap: 12rpx; }
.cp-label { font-size: 26rpx; color: #999; }
.cp-name { font-size: 28rpx; font-weight: 600; color: #1677FF; }
.cp-expire { margin-left: auto; font-size: 22rpx; color: #999; }
.plan-cards { margin: 0 24rpx; display: flex; flex-direction: column; gap: 16rpx; }
.plan-card { background: #fff; border-radius: 16rpx; padding: 24rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06); }
.plan-card.highlight { border: 2rpx solid #1677FF; }
.plan-card.current { opacity: 0.7; }
.pc-header { display: flex; align-items: center; gap: 8rpx; margin-bottom: 8rpx; }
.pc-name { font-size: 32rpx; font-weight: 700; }
.pc-badge { font-size: 20rpx; padding: 2rpx 10rpx; background: #E6F4FF; color: #1677FF; border-radius: 4rpx; }
.pc-badge.recommend { background: #FFF1B8; color: #D46B08; }
.pc-views { font-size: 26rpx; color: #666; margin-bottom: 12rpx; display: block; }
.pc-prices { border-top: 1rpx solid #F0F0F0; padding-top: 12rpx; }
.price-row { display: flex; align-items: center; padding: 12rpx 0; border-bottom: 1rpx solid #F8F8F8; }
.price-row.yearly { background: #FFFBE6; margin: 0 -12rpx; padding: 12rpx; border-radius: 8rpx; }
.pr-label { font-size: 24rpx; color: #999; width: 60rpx; }
.pr-price { font-size: 36rpx; font-weight: 700; color: #FF4D4F; }
.pr-unit { font-size: 22rpx; font-weight: normal; color: #999; }
.pr-discount { font-size: 20rpx; color: #FA8C16; flex: 1; text-align: right; margin-right: 12rpx; }
.pr-btn { font-size: 24rpx; padding: 8rpx 24rpx; background: #1677FF; color: #fff; border-radius: 8rpx; }
.pc-free { font-size: 26rpx; color: #52C41A; text-align: center; padding: 12rpx 0; }
.history { margin: 24rpx; }
.section-title { font-size: 28rpx; font-weight: 600; margin-bottom: 12rpx; display: block; }
.h-item { background: #fff; border-radius: 12rpx; padding: 16rpx 20rpx; margin-bottom: 8rpx; display: flex; align-items: center; font-size: 24rpx; }
.h-plan { color: #1677FF; }
.h-amount { flex: 1; text-align: center; color: #FF4D4F; font-weight: 600; }
.h-time { color: #CCC; }
.note { margin: 24rpx; padding: 20rpx; background: #F8FAFC; border-radius: 12rpx; }
.note text { display: block; font-size: 22rpx; color: #999; line-height: 1.8; }
</style>
