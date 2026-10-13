<template>
  <view class="bids-page">
    <view class="header" v-if="orderInfo">
      <text class="h-no">{{ orderInfo.order_no }}</text>
      <text class="h-desc">{{ orderInfo.order_no }} — 共 {{ bids.length }} 份报价</text>
    </view>
    <view v-if="bids.length === 0 && !loading" class="empty"><text>暂无竞标报价</text></view>
    <view v-for="b in sortedBids" :key="b.bid_id" class="bid-card" :class="{ 'won': b.is_selected, 'lost': b.status === 'lost' && !b.is_selected }">
      <view class="bc-header">
        <view class="bc-engineer">
          <text class="bc-name">{{ b.engineer?.name }}</text>
          <text class="bc-type">{{ b.engineer?.type === 'self_employed' ? '自营' : '认证' }}</text>
        </view>
        <view class="bc-rating">⭐ {{ b.engineer?.rating }} · {{ b.completion_rate }}% 完成率</view>
      </view>
      <view class="bc-diag" v-if="b.quotation?.diagnosis_summary">
        <text class="bc-label">诊断：</text>{{ b.quotation.diagnosis_summary }}
      </view>
      <view class="bc-items">
        <view v-for="(item,i) in (b.quotation?.items||[])" :key="i" class="bci-row">
          <text class="bci-name">{{ item.name }}</text>
          <text class="bci-qty">×{{ item.qty }}</text>
          <text class="bci-price">¥{{ item.unit_price }}</text>
        </view>
      </view>
      <view class="bc-total">
        <text class="bct-label">报价合计</text>
        <text class="bct-price">¥{{ b.quotation?.total_cost }}</text>
      </view>
      <view class="bc-notes" v-if="b.quotation?.notes">
        <text class="bc-label">备注：</text>{{ b.quotation.notes }}
      </view>
      <view class="bc-status" :class="b.status">
        <text v-if="b.is_selected">✅ 已中标</text>
        <text v-else-if="b.status === 'lost'">未中标</text>
      </view>
      <button v-if="canSelect && !orderInfo?.selected_quotation_id && b.status === 'bidding'" class="btn-select" @click="handleSelect(b)" :loading="selecting">✅ 选择此方案</button>
    </view>
    <view class="safe-bottom"></view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { getBids, selectWinner } from '@/api/index';

const orderId = ref('');
const orderInfo = ref(null);
const bids = ref([]);
const selecting = ref(false);
const loading = ref(false);

const sortedBids = computed(() =>
  [...bids.value].sort((a, b) => {
    if (a.is_selected) return -1;
    if (b.is_selected) return 1;
    return (a.quotation?.total_cost || 0) - (b.quotation?.total_cost || 0);
  })
);

const canSelect = computed(() => orderInfo.value && !orderInfo.value.selected_quotation_id);

async function loadBids() {
  loading.value = true;
  try {
    const data = await getBids(orderId.value);
    orderInfo.value = data;
    bids.value = data.list || [];
  } catch (e) { /* ignore */ }
  loading.value = false;
}

async function handleSelect(bid) {
  uni.showModal({
    title: '确认选标',
    content: `选择 ${bid.engineer?.name} 的报价 ¥${bid.quotation?.total_cost}？选定后不可更改。`,
    success: async (resp) => {
      if (!resp.confirm) return;
      selecting.value = true;
      try {
        await selectWinner(orderId.value, bid.quotation.id);
        uni.showToast({ title: '已选定，请完成支付', icon: 'success' });
        loadBids();
      } catch (e) { uni.showToast({ title: e.message || '操作失败', icon: 'none' }); }
      selecting.value = false;
    }
  });
}

onLoad((options) => {
  orderId.value = options.orderId || '';
  if (orderId.value) loadBids();
});
</script>

<style lang="scss" scoped>
.bids-page { min-height: 100vh; background: #F5F6FA; }
.header { background: linear-gradient(135deg, #1677FF, #0958D9); padding: 30rpx; color: #fff;
  .h-no { font-size: 32rpx; font-weight: bold; display: block; }
  .h-desc { font-size: 24rpx; opacity: 0.7; }
}
.empty { text-align: center; padding: 100rpx 0; color: #999; }
.bid-card { background: #fff; margin: 16rpx 24rpx; border-radius: 16rpx; padding: 24rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06); position: relative; }
.bid-card.won { border: 2rpx solid #52C41A; }
.bid-card.lost { opacity: 0.6; }
.bc-header { display: flex; justify-content: space-between; margin-bottom: 12rpx; }
.bc-engineer { display: flex; align-items: center; gap: 8rpx; }
.bc-name { font-size: 30rpx; font-weight: 600; }
.bc-type { font-size: 20rpx; padding: 2rpx 10rpx; background: #E6F4FF; color: #1677FF; border-radius: 4rpx; }
.bc-rating { font-size: 24rpx; color: #999; }
.bc-diag { font-size: 24rpx; color: #666; margin-bottom: 12rpx; line-height: 1.5; }
.bc-label { color: #999; }
.bc-items { margin-bottom: 12rpx; }
.bci-row { display: flex; align-items: center; padding: 6rpx 0; font-size: 24rpx; }
.bci-name { flex: 1; color: #333; }
.bci-qty { color: #999; margin: 0 8rpx; }
.bci-price { color: #1677FF; }
.bc-total { display: flex; justify-content: space-between; padding-top: 12rpx; border-top: 1rpx solid #F0F0F0; }
.bct-label { font-size: 28rpx; font-weight: 600; }
.bct-price { font-size: 36rpx; font-weight: 600; color: #FF4D4F; }
.bc-notes { font-size: 24rpx; color: #999; margin-top: 8rpx; }
.bc-status { margin-top: 12rpx; padding: 8rpx 0; font-size: 26rpx; }
.bc-status.won { color: #52C41A; }
.bc-status.lost { color: #999; }
.btn-select { width: 100%; margin-top: 16rpx; background: linear-gradient(135deg, #52C41A, #389E0D); color: #fff; border-radius: 12rpx; padding: 20rpx; font-size: 28rpx; border: none; }
.safe-bottom { height: 60rpx; }
</style>
