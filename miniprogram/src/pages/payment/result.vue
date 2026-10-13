<template>
  <view class="result-page">
    <view class="icon-box" :class="{ success: isSuccess, fail: !isSuccess }">
      <text class="icon">{{ isSuccess ? '✅' : '❌' }}</text>
    </view>
    <text class="title">{{ isSuccess ? '支付成功' : '支付失败' }}</text>
    <text class="desc" v-if="isSuccess">维修工程师将尽快与您联系</text>
    <text class="amount">¥{{ amount }}</text>
    <text class="no">支付单号: {{ paymentNo }}</text>
    <view class="btn-area">
      <button class="btn" @click="goOrders">查看工单</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';

const isSuccess = ref(true);
const amount = ref(0);
const paymentNo = ref('');

function goOrders() { uni.switchTab({ url: '/pages/orders/list' }); }

onLoad((options) => {
  isSuccess.value = options.success === '1';
  amount.value = parseFloat(options.amount) || 0;
  paymentNo.value = options.paymentNo || '';
});
</script>

<style lang="scss" scoped>
.result-page { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fff; padding: 40rpx; }
.icon-box { width: 160rpx; height: 160rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 32rpx; }
.icon-box.success { background: #F6FFED; }
.icon-box.fail { background: #FFF1F0; }
.icon { font-size: 72rpx; }
.title { font-size: 40rpx; font-weight: bold; margin-bottom: 12rpx; }
.desc { font-size: 26rpx; color: #999; margin-bottom: 24rpx; }
.amount { font-size: 56rpx; font-weight: 800; color: #333; }
.no { font-size: 22rpx; color: #CCC; margin-top: 8rpx; }
.btn-area { margin-top: 80rpx; width: 100%; }
.btn { width: 80%; padding: 24rpx; background: #1677FF; color: #fff; border-radius: 12rpx; font-size: 28rpx; border: none; }
</style>
