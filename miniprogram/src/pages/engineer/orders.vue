<template>
  <view class="eng-orders">
    <view class="tab-bar">
      <view class="tab" :class="{ active: type === 'pool' }" @click="type = 'pool'; loadData()">工单池</view>
      <view class="tab" :class="{ active: type === 'mine' }" @click="type = 'mine'; loadData()">我的工单</view>
      <view class="tab marketplace-tab" :class="{ active: type === 'marketplace' }" @click="goMarketplace()">需求广场</view>
    </view>

    <!-- 子状态筛选 -->
    <scroll-view scroll-x class="sub-tabs" v-if="type === 'mine'">
      <view v-for="t in subTabs" :key="t.value" class="sub-tab" :class="{ active: subStatus === t.value }"
            @click="subStatus = t.value; loadData()">{{ t.label }}</view>
    </scroll-view>

    <!-- 工单列表 -->
    <scroll-view scroll-y class="list" @scrolltolower="loadMore">
      <view v-for="o in orders" :key="o.id" class="order-card" @click="goDetail(o.id)">
        <view class="oc-header">
          <text class="oc-no">{{ o.order_no }}</text>
          <text class="oc-status" :class="o.status">{{ statusMap[o.status] }}</text>
        </view>
        <view class="oc-body">
          <text class="oc-device">{{ o.device?.name || '未指定' }}</text>
          <text class="oc-desc">{{ o.fault_desc }}</text>
          <text class="oc-addr">📍 {{ o.reporter?.company || o.address || '未知地址' }}</text>
        </view>
        <view class="oc-footer">
          <text class="oc-time">{{ formatTime(o.created_at) }}</text>
          <text class="oc-priority" :class="o.priority">{{ priorityMap[o.priority] }}</text>
        </view>

        <!-- 操作按钮 -->
        <view class="oc-actions" v-if="canAction(o)">
          <button v-if="type === 'pool' && o.status === 'pending'" size="mini" type="primary"
                  @click.stop="handleAccept(o.id)">接单</button>
          <button v-if="type === 'mine' && o.status === 'accepted'" size="mini"
                  @click.stop="goRepair(o.id)">开始诊断</button>
          <button v-if="type === 'mine' && o.status === 'diagnosing'" size="mini"
                  @click.stop="goRepair(o.id)">诊断/报价</button>
          <button v-if="type === 'mine' && o.status === 'quoted'" size="mini" type="warning"
                   @click.stop="goRepair(o.id)">查看报价</button>
          <button v-if="type === 'mine' && o.status === 'paid'" size="mini" type="primary"
                  @click.stop="goRepair(o.id)">开始维修</button>
          <button v-if="type === 'mine' && o.status === 'repairing'" size="mini" type="primary"
                  @click.stop="goRepair(o.id)">提交报告</button>
        </view>
      </view>
      <view v-if="orders.length === 0 && !loading" class="empty">暂无工单</view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { getOrderPool, getMyOrders, acceptOrder } from '@/api/index';

const type = ref('pool');
const subStatus = ref('');
const orders = ref([]);
const loading = ref(false);
const page = ref(1);
const total = ref(0);

const subTabs = [
  { label: '全部', value: '' }, { label: '待维修', value: 'accepted' },
  { label: '诊断中', value: 'diagnosing' }, { label: '待审批', value: 'quoted' },
  { label: '已支付', value: 'paid' }, { label: '维修中', value: 'repairing' }, { label: '待用户评价', value: 'pending_review' },
  { label: '已评价', value: 'confirmed' }
];

const statusMap = {
  pending:'待接单', accepted:'已接单', diagnosing:'诊断中', quoted:'待审批',
  paid:'已支付', repairing:'维修中', completed:'维修完成', pending_review:'待用户评价', confirmed:'已评价', cancelled:'已取消'
};
const priorityMap = { normal:'普通', urgent:'⚠紧急', critical:'🔴严重' };

function formatTime(d) { if(!d) return ''; const dt = new Date(d); return `${dt.getMonth()+1}/${dt.getDate()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`; }

function canAction(o) {
  if (type.value === 'pool') return o.status === 'pending';
  return ['accepted', 'diagnosing', 'quoted', 'paid', 'repairing'].includes(o.status);
}

async function loadData() {
  page.value = 1; orders.value = []; loading.value = true;
  try {
    const fn = type.value === 'pool' ? getOrderPool : getMyOrders;
    const res = await fn({ status: subStatus.value, page: 1, pageSize: 10 });
    orders.value = res.list || [];
    total.value = res.total;
  } catch (e) { /* ignore */ }
  finally { loading.value = false; }
}

async function loadMore() {
  if (loading.value || orders.value.length >= total.value) return;
  page.value++; loading.value = true;
  const fn = type.value === 'pool' ? getOrderPool : getMyOrders;
  const res = await fn({ status: subStatus.value, page: page.value, pageSize: 10 });
  orders.value.push(...(res.list || []));
  loading.value = false;
}

async function handleAccept(id) {
  try { await acceptOrder(id); uni.showToast({ title:'接单成功', icon:'success' }); loadData(); }
  catch(e) { uni.showToast({ title:e.message, icon:'none' }); }
}

function goDetail(id) { uni.navigateTo({ url: `/pages/orders/detail?id=${id}` }); }
function goRepair(id) { uni.navigateTo({ url: `/pages/engineer/repair?id=${id}` }); }
function goMarketplace() { uni.navigateTo({ url: '/pages/marketplace/index' }); }

import { onShow } from '@dcloudio/uni-app';
onShow(() => { if (type.value !== 'marketplace') loadData(); });
</script>

<style lang="scss" scoped>
.eng-orders { min-height: 100vh; background: #F5F6FA; }
.tab-bar { display: flex; background: #fff; .tab { flex:1; text-align: center; padding: 24rpx; font-size: 28rpx; color: #999; border-bottom: 4rpx solid transparent; &.active { color: #1677FF; border-color: #1677FF; font-weight: 600; } } }
.sub-tabs { white-space: nowrap; background: #fff; padding: 16rpx 24rpx; border-bottom: 1rpx solid #EEE; }
.sub-tab { display: inline-block; padding: 8rpx 24rpx; margin-right: 12rpx; border-radius: 20rpx; font-size: 24rpx; color: #666; background: #F5F5F5; &.active { background: #1677FF; color: #fff; } }
.list { padding: 24rpx; }
.order-card {
  background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
  .oc-header { display: flex; justify-content: space-between; margin-bottom: 8rpx; }
  .oc-no { font-weight: 600; font-size: 26rpx; }
  .oc-device { font-size: 28rpx; color: #333; font-weight: 500; display: block; }
  .oc-desc { font-size: 24rpx; color: #999; display: -webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow: hidden; }
  .oc-addr { font-size: 22rpx; color: #999; margin-top: 4rpx; display: block; }
  .oc-footer { display: flex; justify-content: space-between; margin-top: 12rpx; }
  .oc-time { font-size: 22rpx; color: #CCC; }
  .oc-priority { font-size: 22rpx; color: #999; &.urgent { color: #FA8C16; } &.critical { color: #FF4D4F; } }
  .oc-actions { margin-top: 16rpx; display: flex; justify-content: flex-end; gap: 12rpx; }
}
.oc-status { font-size: 24rpx; padding: 6rpx 16rpx; border-radius: 8rpx; }
.oc-status.pending { background:#FFF7E6; color:#FA8C16; }
.oc-status.accepted { background:#E6F4FF; color:#1677FF; }
.oc-status.diagnosing { background:#F0F5FF; color:#2F54EB; }
.oc-status.quoted { background:#FFF7E6; color:#D48806; }
.oc-status.paid, .oc-status.repairing { background:#E6F4FF; color:#1677FF; }
.oc-status.completed, .oc-status.pending_review, .oc-status.confirmed { background:#F6FFED; color:#52C41A; }
.oc-status.cancelled { background:#F5F5F5; color:#999; }
.empty { text-align:center; padding:120rpx 0; color:#999; }
</style>
