<template>
  <view class="withdraw-page">
    <view class="header">
      <text class="label">可提现余额</text>
      <text class="balance">¥{{ wallet?.balance || '0.00' }}</text>
    </view>
    <view class="form-card">
      <view class="form-group">
        <text class="fg-label">提现金额</text>
        <input v-model.number="amount" type="digit" placeholder="请输入金额" class="fg-input" />
        <text class="fg-hint">最低提现 ¥{{ minAmount }}</text>
      </view>
      <view class="form-group">
        <text class="fg-label">提现方式</text>
        <picker :range="methods" @change="onMethodChange">
          <text class="fg-picker">{{ methods[methodIdx] }}</text>
        </picker>
      </view>
      <view class="form-group" v-if="methods[methodIdx] === '银行卡'">
        <text class="fg-label">开户银行</text>
        <input v-model="bankName" placeholder="如：招商银行" class="fg-input" />
        <text class="fg-label">银行账号</text>
        <input v-model="bankAccount" placeholder="请输入卡号" class="fg-input" />
        <text class="fg-label">开户人姓名</text>
        <input v-model="bankHolder" placeholder="请输入姓名" class="fg-input" />
      </view>
      <view class="form-group" v-if="methods[methodIdx] === '支付宝'">
        <text class="fg-label">支付宝账号</text>
        <input v-model="alipayAccount" placeholder="请输入支付宝账号" class="fg-input" />
      </view>
    </view>
    <view class="btn-area">
      <button class="btn-submit" @click="handleSubmit" :loading="submitting" :disabled="!amount || amount < minAmount">提交申请</button>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getWalletDashboard, applyWithdrawal } from '@/api/index';

const wallet = ref(null);
const amount = ref(0);
const methods = ['银行卡', '支付宝', '手动打款'];
const methodIdx = ref(0);
const bankName = ref('');
const bankAccount = ref('');
const bankHolder = ref('');
const alipayAccount = ref('');
const minAmount = ref(100);
const submitting = ref(false);

function onMethodChange(e) { methodIdx.value = e.detail.value; }

async function handleSubmit() {
  if (!amount.value || amount.value < minAmount.value) return;
  const method = ['bank', 'alipay', 'manual'][methodIdx.value];
  const accountInfo = method === 'bank' ? { bank_name: bankName.value, bank_account: bankAccount.value, bank_holder: bankHolder.value } : method === 'alipay' ? { alipay_account: alipayAccount.value } : {};
  submitting.value = true;
  try {
    await applyWithdrawal({ amount: amount.value, method, account_info: accountInfo });
    uni.showToast({ title: '提现申请已提交', icon: 'success' });
    setTimeout(() => uni.navigateBack(), 1000);
  } catch (e) { uni.showToast({ title: e.message || '申请失败', icon: 'none' }); }
  submitting.value = false;
}

onMounted(async () => {
  try { wallet.value = await getWalletDashboard(); } catch (e) { /* ignore */ }
});
</script>

<style lang="scss" scoped>
.withdraw-page { min-height: 100vh; background: #F5F6FA; }
.header { background: linear-gradient(135deg, #1677FF, #0958D9); padding: 50rpx 30rpx; color: #fff; text-align: center; }
.label { font-size: 26rpx; opacity: 0.7; }
.balance { font-size: 64rpx; font-weight: 800; display: block; margin-top: 8rpx; }
.form-card { background: #fff; margin: 24rpx; border-radius: 16rpx; padding: 24rpx; }
.form-group { margin-bottom: 24rpx; }
.fg-label { font-size: 26rpx; color: #666; margin-bottom: 8rpx; display: block; }
.fg-input { width: 100%; padding: 16rpx; background: #F5F6FA; border-radius: 8rpx; font-size: 28rpx; box-sizing: border-box; }
.fg-hint { font-size: 22rpx; color: #999; margin-top: 4rpx; display: block; }
.fg-picker { font-size: 28rpx; color: #1677FF; padding: 16rpx 0; display: block; }
.btn-area { margin: 24rpx; }
.btn-submit { width: 100%; padding: 28rpx; background: linear-gradient(135deg, #1677FF, #0958D9); color: #fff; border-radius: 12rpx; font-size: 30rpx; border: none; }
.btn-submit[disabled] { background: #CCC; }
</style>
