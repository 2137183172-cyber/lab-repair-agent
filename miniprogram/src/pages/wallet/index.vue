<template>
  <view class="wallet-page">
    <view class="header">
      <text class="title">我的钱包</text>
      <text class="balance">¥{{ wallet?.balance || '0.00' }}</text>
      <text class="label">可用余额</text>
    </view>
    <view class="stats-row">
      <view class="stat"><text class="s-num">¥{{ wallet?.frozen_balance || '0.00' }}</text><text class="s-label">冻结中</text></view>
      <view class="stat"><text class="s-num">¥{{ wallet?.total_earned || '0.00' }}</text><text class="s-label">累计收入</text></view>
      <view class="stat"><text class="s-num">{{ wallet?.pending_count || 0 }}笔</text><text class="s-label">待结算</text></view>
    </view>
    <view class="actions">
      <button class="btn-withdraw" @click="goWithdraw" :disabled="!parseFloat(wallet?.balance||0)">提现</button>
    </view>
    <view class="bills">
      <text class="section-title">收支明细</text>
      <view v-if="bills.length === 0" class="empty">暂无收支记录</view>
      <view v-for="b in bills" :key="b.id" class="bill-item">
        <view class="bi-left">
          <text class="bi-desc">{{ b.description }}</text>
          <text class="bi-time">{{ b.created_at }}</text>
        </view>
        <text class="bi-amount" :class="{ plus: b.type === 'settlement' }">+¥{{ b.amount }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getWalletDashboard, getWalletBills } from '@/api/index';

const wallet = ref(null);
const bills = ref([]);

async function load() {
  try { wallet.value = await getWalletDashboard(); } catch (e) { /* ignore */ }
  try { const d = await getWalletBills(); bills.value = d.list || []; } catch (e) { /* ignore */ }
}

function goWithdraw() {
  uni.navigateTo({ url: '/pages/wallet/withdraw' });
}

onMounted(() => load());
</script>

<style lang="scss" scoped>
.wallet-page { min-height: 100vh; background: #F5F6FA; }
.header { background: linear-gradient(135deg, #1677FF, #0958D9); padding: 50rpx 30rpx; color: #fff; text-align: center; }
.title { font-size: 28rpx; opacity: 0.8; display: block; }
.balance { font-size: 72rpx; font-weight: 800; display: block; margin: 12rpx 0; }
.label { font-size: 24rpx; opacity: 0.7; }
.stats-row { display: flex; margin: 24rpx;
  .stat { flex: 1; background: #fff; border-radius: 12rpx; padding: 24rpx; text-align: center; margin: 0 8rpx; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04); }
  .s-num { font-size: 32rpx; font-weight: 600; color: #333; display: block; }
  .s-label { font-size: 22rpx; color: #999; margin-top: 4rpx; display: block; }
}
.actions { margin: 24rpx; }
.btn-withdraw { width: 100%; padding: 24rpx; background: linear-gradient(135deg, #52C41A, #389E0D); color: #fff; border-radius: 12rpx; font-size: 30rpx; border: none; }
.btn-withdraw[disabled] { background: #CCC; }
.section-title { font-size: 30rpx; font-weight: 600; padding: 0 30rpx; margin-bottom: 16rpx; display: block; }
.empty { text-align: center; padding: 60rpx; color: #999; }
.bills { margin: 0 24rpx; }
.bill-item { background: #fff; border-radius: 12rpx; padding: 20rpx 24rpx; margin-bottom: 8rpx; display: flex; justify-content: space-between; align-items: center; }
.bi-desc { font-size: 26rpx; color: #333; display: block; }
.bi-time { font-size: 22rpx; color: #CCC; }
.bi-amount { font-size: 30rpx; font-weight: 600; }
.bi-amount.plus { color: #52C41A; }
</style>
