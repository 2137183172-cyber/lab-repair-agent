<template>
  <view class="qd-page">
    <view class="header"><text class="title">报价单详情</text></view>
    <view v-if="quote" class="card">
      <view class="info-row"><text class="label">报价单号</text><text>{{ quote.quotation_no }}</text></view>
      <view class="info-row"><text class="label">状态</text>
        <text class="status" :class="quote.status">{{ {'draft':'草稿','submitted':'待审批','approved':'已通过','rejected':'已驳回'}[quote.status] }}</text>
      </view>
      <view class="info-row" v-if="quote.diagnosis_summary"><text class="label">诊断</text><text>{{ quote.diagnosis_summary }}</text></view>
      <view class="items-section" v-if="quote.items">
        <text class="section-label">费用明细</text>
        <view v-for="(item,i) in quote.items" :key="i" class="item-row">
          <text class="item-name">{{ item.name }}</text>
          <text class="item-qty">×{{ item.qty }}</text>
          <text class="item-price">¥{{ item.unit_price }}</text>
          <text class="item-sub">= ¥{{ ((item.qty||0)*(item.unit_price||0)).toFixed(2) }}</text>
        </view>
        <view class="total-row"><text>合计</text><text class="total-price">¥{{ quote.total_cost }}</text></view>
      </view>
      <view class="info-row" v-if="quote.notes"><text class="label">备注</text><text>{{ quote.notes }}</text></view>
      <view class="info-row" v-if="quote.valid_until"><text class="label">有效期</text><text>{{ quote.valid_until }}</text></view>
      <view class="info-row" v-if="quote.creator"><text class="label">创建人</text><text>{{ quote.creator.name }}</text></view>
      <view class="info-row" v-if="quote.approver"><text class="label">审批人</text><text>{{ quote.approver.name }}</text></view>
      <view class="reject-box" v-if="quote.status === 'rejected' && quote.reject_reason">
        <text class="reject-label">驳回原因</text><text>{{ quote.reject_reason }}</text>
      </view>
    </view>
    <view v-else class="empty"><text>加载中...</text></view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { getQuoteDetail } from '@/api/index';

const quote = ref(null);

onLoad(async (options) => {
  if (options.id) {
    try { quote.value = await getQuoteDetail(options.id); } catch (e) { /* ignore */ }
  }
});
</script>

<style lang="scss" scoped>
.qd-page { min-height: 100vh; background: #F5F6FA; }
.header { background: linear-gradient(135deg, #1677FF, #0958D9); padding: 30rpx; color: #fff; }
.title { font-size: 36rpx; font-weight: bold; }
.card { background: #fff; margin: 24rpx; border-radius: 16rpx; padding: 24rpx; }
.info-row { display: flex; padding: 12rpx 0; border-bottom: 1rpx solid #F5F5F5; font-size: 26rpx; }
.label { width: 140rpx; color: #999; flex-shrink: 0; }
.status { font-weight: 600; }
.status.submitted { color: #FA8C16; }
.status.approved { color: #52C41A; }
.status.rejected { color: #FF4D4F; }
.section-label { font-size: 28rpx; font-weight: 600; margin: 12rpx 0 8rpx; display: block; }
.item-row { display: flex; align-items: center; padding: 6rpx 0; font-size: 24rpx; }
.item-name { flex: 1; }
.item-qty { color: #999; margin: 0 8rpx; }
.item-price { color: #1677FF; }
.item-sub { color: #333; }
.total-row { display: flex; justify-content: space-between; padding-top: 12rpx; margin-top: 4rpx; border-top: 2rpx solid #FFE58F; font-size: 28rpx; }
.total-price { color: #FF4D4F; font-weight: 600; font-size: 36rpx; }
.reject-box { background: #FFF1F0; border-radius: 8rpx; padding: 16rpx; margin-top: 12rpx; }
.reject-label { display: block; font-weight: 600; color: #FF4D4F; font-size: 24rpx; }
.empty { text-align: center; padding: 100rpx; color: #999; }
</style>
