<template>
  <view class="payment-page">
    <view class="header"><text class="title">确认支付</text></view>
    <view class="card" v-if="order">
      <text class="card-title">工单 {{ order.order_no }}</text>
      <view class="info-row"><text class="label">金额</text><text class="amount">¥{{ amount }}</text></view>
      <view class="info-row"><text class="label">支付方式</text><text class="value">模拟支付（测试）</text></view>
    </view>
    <view class="tip">
      <text>• 资金将由平台托管，维修验收后释放给工程师</text>
      <text>• 平台佣金 {{ commissionRate }}%，工程师到账 ¥{{ (amount * (1 - commissionRate/100)).toFixed(2) }}</text>
    </view>
    <view class="btn-area">
      <button class="btn-pay" @click="handlePay" :loading="paying">💰 立即支付 ¥{{ amount }}</button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { getOrderDetail, createPayment, executePayment, getPaymentStatus } from '@/api/index';

const order = ref(null);
const orderId = ref('');
const paymentNo = ref('');
const amount = ref(0);
const commissionRate = ref(15);
const paying = ref(false);

async function loadOrder() {
  try {
    const data = await getOrderDetail(orderId.value);
    order.value = data.order || data;
    // Get amount from selected or approved quote
    const quotes = order.value?.quotations || [];
    const selected = quotes.find(q => q.status === 'approved');
    if (selected) amount.value = parseFloat(selected.total_cost) || 0;
    const paymentData = await getPaymentStatus(orderId.value);
    const pendingPayment = paymentData?.latest?.status === 'pending'
      ? paymentData.latest
      : (paymentData?.list || []).find(p => p.status === 'pending');
    if (pendingPayment) {
      paymentNo.value = pendingPayment.payment_no;
      amount.value = parseFloat(pendingPayment.amount) || amount.value;
    }
  } catch (e) { /* ignore */ }
}

async function handlePay() {
  paying.value = true;
  try {
    // Step 1: Reuse existing pending payment or create one.
    if (!paymentNo.value) {
      const pay = await createPayment({ order_id: orderId.value });
      paymentNo.value = pay.payment_no;
    }
    // Step 2: Execute payment
    const result = await executePayment(paymentNo.value);
    uni.showToast({ title: '支付成功！', icon: 'success' });
    setTimeout(() => {
      uni.redirectTo({ url: `/pages/payment/result?success=1&amount=${result.amount}&paymentNo=${result.payment_no}` });
    }, 800);
  } catch (e) { uni.showToast({ title: e.message || '支付失败', icon: 'none' }); }
  paying.value = false;
}

onLoad((options) => {
  orderId.value = options.orderId || '';
  if (orderId.value) loadOrder();
});
</script>

<style lang="scss" scoped>
.payment-page { min-height: 100vh; background: #F5F6FA; }
.header { background: linear-gradient(135deg, #1677FF, #0958D9); padding: 40rpx 30rpx; color: #fff;
  .title { font-size: 40rpx; font-weight: bold; }
}
.card { background: #fff; margin: 24rpx; border-radius: 16rpx; padding: 24rpx; }
.card-title { font-size: 30rpx; font-weight: 600; margin-bottom: 16rpx; display: block; }
.info-row { display: flex; justify-content: space-between; padding: 12rpx 0; font-size: 28rpx; }
.amount { font-size: 48rpx; font-weight: 700; color: #FF4D4F; }
.label { color: #999; }
.tip { margin: 24rpx; padding: 20rpx; background: #FFF7E6; border-radius: 12rpx; }
.tip text { display: block; font-size: 24rpx; color: #666; line-height: 1.8; }
.btn-area { margin: 24rpx; }
.btn-pay { width: 100%; padding: 28rpx; background: linear-gradient(135deg, #FF4D4F, #F5222D); color: #fff; border-radius: 16rpx; font-size: 32rpx; font-weight: bold; border: none; }
</style>
