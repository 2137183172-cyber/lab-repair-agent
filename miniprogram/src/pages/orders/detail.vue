<template>
  <view class="detail-page" v-if="order">
    <!-- 状态横幅 -->
    <view class="status-banner" :class="order.status">
      <text class="sb-text">{{ statusMap[order.status] }}</text>
      <text class="sb-tip" v-if="order.status === 'quoted' && !order.is_public">工程师已提交报价，请审批</text>
      <text class="sb-tip" v-if="order.status === 'paid'">已支付，等待工程师开始维修</text>
    </view>

    <!-- 公开招标：查看竞标入口 -->
    <view class="bid-entry" v-if="order.is_public && ['pending','quoted'].includes(order.status)" @click="goBids">
      <text class="be-icon">🏪</text>
      <view class="be-info">
        <text class="be-title">公开招标中 — 查看竞标报价</text>
        <text class="be-desc">多位工程师已报价，点击对比选择</text>
      </view>
      <text class="be-arrow">›</text>
    </view>

    <!-- 工单信息 -->
    <view class="card">
      <text class="card-title">工单信息</text>
      <view class="info-row"><text class="ir-label">工单号</text><text class="ir-value">{{ order.order_no }}</text></view>
      <view class="info-row"><text class="ir-label">设备</text><text class="ir-value">{{ order.device?.name || '未指定' }}</text></view>
      <view class="info-row"><text class="ir-label">故障描述</text><text class="ir-value">{{ order.fault_desc }}</text></view>
      <view class="info-row"><text class="ir-label">紧急程度</text><text class="ir-value">{{ priorityMap[order.priority] }}</text></view>
      <view class="info-row"><text class="ir-label">提交时间</text><text class="ir-value">{{ order.created_at }}</text></view>
      <view v-if="order.scheduled_at" class="info-row"><text class="ir-label">预约时间</text><text class="ir-value">{{ order.scheduled_at }}</text></view>
    </view>

    <!-- 故障图片 -->
    <view class="card" v-if="order.fault_images && order.fault_images.length > 0">
      <text class="card-title">故障图片</text>
      <view class="img-row">
        <image v-for="(img, i) in order.fault_images" :key="i" :src="img" mode="aspectFill"
               class="detail-img" @click="previewImage(i)" />
      </view>
    </view>

    <!-- ===== 报价单（新） ===== -->
    <view class="card quote-card-wrapper" v-if="latestQuote">
      <text class="card-title">📋 维修报价单</text>
      <view class="quote-badge" :class="latestQuote.status">
        {{ quoteStatusMap[latestQuote.status] }}
      </view>

      <!-- 诊断 -->
      <view class="quote-section" v-if="latestQuote.diagnosis_summary">
        <text class="qs-label">🔍 诊断结果</text>
        <text class="qs-text">{{ latestQuote.diagnosis_summary }}</text>
      </view>

      <!-- 明细 -->
      <view class="quote-section">
        <text class="qs-label">💰 费用明细</text>
        <view v-for="(item, i) in latestQuote.items" :key="i" class="quote-item">
          <view class="qi-left">
            <text class="qi-name">{{ item.name }}</text>
            <text class="qi-spec" v-if="item.spec">{{ item.spec }}</text>
          </view>
          <view class="qi-right">
            <text class="qi-qty">×{{ item.qty }}</text>
            <text class="qi-price">¥{{ item.unit_price }}</text>
            <text class="qi-sub">= ¥{{ ((item.qty||0)*(item.unit_price||0)).toFixed(2) }}</text>
          </view>
        </view>
        <view class="quote-total">
          <text class="qt-label">报价合计</text>
          <text class="qt-price">¥{{ latestQuote.total_cost }}</text>
        </view>
      </view>

      <!-- 备注 -->
      <view class="quote-section" v-if="latestQuote.notes">
        <text class="qs-label">📝 备注</text>
        <text class="qs-text">{{ latestQuote.notes }}</text>
      </view>

      <view class="quote-meta">
        <text>报价单号：{{ latestQuote.quotation_no }}</text>
        <text v-if="latestQuote.valid_until">有效期至：{{ latestQuote.valid_until }}</text>
        <text v-if="latestQuote.revision > 1">版本：第{{ latestQuote.revision }}版</text>
      </view>

      <!-- 驳回原因 -->
      <view class="reject-reason" v-if="latestQuote.status === 'rejected' && latestQuote.reject_reason">
        <text class="rr-label">驳回原因：</text>
        <text>{{ latestQuote.reject_reason }}</text>
      </view>

      <!-- 审批按钮（仅待审批状态+报修人或管理员可见） -->
      <view class="approve-btns" v-if="latestQuote.status === 'submitted' && canApprove">
        <button class="btn-reject" @click="handleReject" :loading="actionLoading">❌ 拒绝</button>
        <button class="btn-approve" @click="handleApprove" :loading="actionLoading">✅ 同意报价</button>
      </view>

      <!-- 支付按钮（报价已审批+未支付+报修人可见） -->
      <view class="approve-btns" v-if="latestQuote.status === 'approved' && order.payment_status !== 'held' && isReporter">
        <button class="btn-pay" @click="goPay">💰 立即支付 ¥{{ latestQuote.total_cost }}</button>
      </view>
    </view>

    <!-- 工程师信息 -->
    <view class="card" v-if="order.engineer">
      <text class="card-title">维修工程师</text>
      <view class="engineer-row">
        <image :src="order.engineer.avatar || '/static/icons/demo-lab.svg'" class="eng-avatar" mode="aspectFill" />
        <view class="eng-info">
          <text class="eng-name">{{ order.engineer.name }}</text>
          <text class="eng-phone">{{ order.engineer.phone }}</text>
          <text class="eng-rating">⭐ {{ order.engineer.rating }}分</text>
        </view>
      </view>
    </view>

    <!-- 评价结果（已评价工单） -->
    <view class="card" v-if="order.status === 'confirmed'">
      <text class="card-title">我的评价</text>
      <view v-if="order.comment" class="info-row">
        <text>综合评分：{{ order.comment.rating }} / 5 分</text>
      </view>
      <view v-if="order.comment && order.comment.content" class="info-row">
        <text>{{ order.comment.content }}</text>
      </view>
      <view v-if="!order.comment" class="info-row">
        <text style="color:#999">暂无评价内容</text>
      </view>
    </view>

    <!-- 待评价提醒 -->
    <view class="card" v-if="(order.status === 'pending_review' || order.status === 'completed') && isReporter" style="background:#FFF7E6;border:1px solid #FA8C16">
      <text class="card-title" style="color:#FA8C16">📝 待评价</text>
      <view class="info-row">
        <text style="color:#FA8C16">工程师已完成维修，请及时评价服务</text>
      </view>
    </view>

    <!-- 维修记录（已完成工单） -->
    <view class="card" v-if="order.repair_record">
      <text class="card-title">维修记录</text>
      <view class="info-row"><text class="ir-label">故障原因</text><text class="ir-value">{{ order.repair_record.fault_cause }}</text></view>
      <view class="info-row"><text class="ir-label">处理方案</text><text class="ir-value">{{ order.repair_record.solution }}</text></view>
      <view class="info-row" v-if="order.repair_record.parts_used?.length">
        <text class="ir-label">更换配件</text>
        <text class="ir-value">
          <text v-for="p in order.repair_record.parts_used" :key="p.name">{{ p.name }} ×{{ p.qty }} </text>
        </text>
      </view>
      <view class="info-row"><text class="ir-label">费用</text><text class="ir-value price">¥{{ order.repair_record.total_cost }}</text></view>
      <!-- 维修前后对比图 -->
      <view v-if="order.repair_record.before_images?.length || order.repair_record.after_images?.length" class="compare-row">
        <view v-if="order.repair_record.before_images?.length">
          <text class="label-sm">维修前</text>
          <scroll-view scroll-x class="img-scroll">
            <image v-for="(img, i) in order.repair_record.before_images" :key="'b'+i" :src="img" mode="aspectFill"
                   class="compare-img" @click="previewCompare('before', i)" />
          </scroll-view>
        </view>
        <view v-if="order.repair_record.after_images?.length">
          <text class="label-sm">维修后</text>
          <scroll-view scroll-x class="img-scroll">
            <image v-for="(img, i) in order.repair_record.after_images" :key="'a'+i" :src="img" mode="aspectFill"
                   class="compare-img" @click="previewCompare('after', i)" />
          </scroll-view>
        </view>
      </view>
    </view>

    <!-- 进度时间轴 -->
    <view class="card">
      <text class="card-title">操作记录</text>
      <view class="timeline">
        <view v-for="log in order.logs" :key="log.id" class="tl-item">
          <view class="tl-dot"></view>
          <view class="tl-content">
            <text class="tl-action">{{ log.detail }}</text>
            <text class="tl-time">{{ log.created_at }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="action-bar" v-if="canAction">
      <!-- 待评价(新) 或 待验收(旧)：评价+提交 -->
      <template v-if="(order.status === 'pending_review' || order.status === 'completed') && isReporter">
        <view class="rating-section">
          <text class="rating-label">综合评价</text>
          <view class="stars">
            <text v-for="s in 5" :key="s" class="star" :class="{ active: rating >= s }" @click="rating = s">{{ rating >= s ? '★' : '☆' }}</text>
          </view>
          <view class="dim-ratings">
            <view class="dim-row">
              <text class="dim-label">响应速度</text>
              <view class="dim-stars"><text v-for="s in 5" :key="s" class="dim-star" :class="{ active: response_speed >= s }" @click="response_speed = s">{{ response_speed >= s ? '★' : '☆' }}</text></view>
            </view>
            <view class="dim-row">
              <text class="dim-label">技术水平</text>
              <view class="dim-stars"><text v-for="s in 5" :key="s" class="dim-star" :class="{ active: skill_level >= s }" @click="skill_level = s">{{ skill_level >= s ? '★' : '☆' }}</text></view>
            </view>
            <view class="dim-row">
              <text class="dim-label">服务态度</text>
              <view class="dim-stars"><text v-for="s in 5" :key="s" class="dim-star" :class="{ active: attitude >= s }" @click="attitude = s">{{ attitude >= s ? '★' : '☆' }}</text></view>
            </view>
            <view class="dim-row">
              <text class="dim-label">价格合理</text>
              <view class="dim-stars"><text v-for="s in 5" :key="s" class="dim-star" :class="{ active: price_fairness >= s }" @click="price_fairness = s">{{ price_fairness >= s ? '★' : '☆' }}</text></view>
            </view>
          </view>
          <textarea v-model="comment" placeholder="写下您的评价..." />
          <button type="primary" @click="confirmOrder" :loading="confirming">确认验收</button>
        </view>
      </template>
      <!-- 支付前可取消 -->
      <template v-if="['pending', 'accepted', 'diagnosing', 'quoted'].includes(order.status) && isReporter">
        <button class="btn-cancel" @click="handleCancel">取消工单</button>
      </template>
    </view>

    <view class="safe-bottom"></view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { getOrderDetail, cancelOrder, confirmOrder as confirmOrderApi, getOrderQuotes, approveQuote, rejectQuote, getBids } from '@/api/index';
import { useUserStore } from '@/store/index';

const userStore = useUserStore();
const order = ref(null);
const latestQuote = ref(null);
const rating = ref(5);
const response_speed = ref(5);
const skill_level = ref(5);
const attitude = ref(5);
const price_fairness = ref(5);
const comment = ref('');
const confirming = ref(false);
const actionLoading = ref(false);

const statusMap = {
  pending: '待接单', accepted: '已接单', diagnosing: '诊断中',
  quoted: '待审批/支付', paid: '已支付', repairing: '维修中', completed: '维修完成',
  pending_review: '待评价', confirmed: '已评价', cancelled: '已取消'
};
const quoteStatusMap = {
  draft: '草稿', submitted: '待审批', approved: '已通过', rejected: '已驳回'
};
const priorityMap = { normal: '普通', urgent: '⚠️ 紧急', critical: '🔴 严重' };

const isReporter = computed(() => order.value?.user_id === userStore.userInfo?.id);
const canApprove = computed(() => {
  if (!order.value || !latestQuote.value) return false;
  const isOwner = order.value.user_id === userStore.userInfo?.id;
  const isManager = ['manager', 'admin'].includes(userStore.userInfo?.role);
  return isOwner || isManager;
});
const canAction = computed(() => {
  if (!order.value) return false;
  const s = order.value.status;
  return isReporter.value && (s === 'pending_review' || s === 'completed' || ['pending', 'accepted', 'diagnosing', 'quoted'].includes(s));
});

async function loadDetail(id) {
  try {
    const data = await getOrderDetail(id);
    order.value = data.order || data;

    // 加载报价信息
    if (order.value?.quotations?.length) {
      latestQuote.value = order.value.quotations[0];
    } else if (['quoted', 'paid', 'diagnosing', 'repairing'].includes(order.value?.status)) {
      // 单独请求报价
      try {
        const quoteData = await getOrderQuotes(id);
        if (quoteData?.latest) latestQuote.value = quoteData.latest;
      } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore */ }
}

async function handleApprove() {
  uni.showModal({
    title: '确认同意报价',
    content: `同意报价 ¥${latestQuote.value.total_cost} 后将生成支付单，支付完成后工程师开始维修。确认吗？`,
    success: async (resp) => {
      if (!resp.confirm) return;
      actionLoading.value = true;
      try {
        await approveQuote(latestQuote.value.id, '', 'mock');
        uni.showToast({ title: '报价已通过', icon: 'success' });
        setTimeout(() => loadDetail(order.value.id), 500);
      } catch (e) { uni.showToast({ title: e.message || '操作失败', icon: 'none' }); }
      actionLoading.value = false;
    }
  });
}

async function handleReject() {
  uni.showModal({
    title: '驳回报价',
    content: '请简要说明驳回原因',
    editable: true,
    placeholderText: '如：价格太高、建议用国产配件...',
    success: async (resp) => {
      if (!resp.confirm) return;
      const reason = resp.content || '未填写原因';
      actionLoading.value = true;
      try {
        await rejectQuote(latestQuote.value.id, reason);
        uni.showToast({ title: '已驳回', icon: 'success' });
        setTimeout(() => loadDetail(order.value.id), 500);
      } catch (e) { uni.showToast({ title: e.message || '操作失败', icon: 'none' }); }
      actionLoading.value = false;
    }
  });
}

function goPay() { uni.navigateTo({ url: `/pages/payment/index?orderId=${order.value.id}` }); }

async function confirmOrder() {
  confirming.value = true;
  try {
    await confirmOrderApi(order.value.id, { rating: rating.value, content: comment.value, response_speed: response_speed.value, skill_level: skill_level.value, attitude: attitude.value, price_fairness: price_fairness.value });
    uni.showToast({ title: '验收成功', icon: 'success' });
    loadDetail(order.value.id);
  } catch (e) { uni.showToast({ title: e.message || '操作失败', icon: 'none' }); }
  finally { confirming.value = false; }
}

async function handleCancel() {
  uni.showModal({
    title: '确认取消',
    content: '确定要取消该工单吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await cancelOrder(order.value.id);
          uni.showToast({ title: '已取消', icon: 'success' });
          loadDetail(order.value.id);
        } catch (e) { uni.showToast({ title: '取消失败', icon: 'none' }); }
      }
    }
  });
}

function goBids() {
  uni.navigateTo({ url: '/pages/marketplace/bids?orderId=' + order.value.id });
}
function previewImage(i) {
  uni.previewImage({ urls: order.value.fault_images, current: order.value.fault_images[i] });
}
function previewCompare(type, i) {
  const images = type === 'before' ? order.value.repair_record.before_images : order.value.repair_record.after_images;
  uni.previewImage({ urls: images, current: images[i] });
}

onLoad((options) => { if (options.id) loadDetail(options.id); });
</script>

<style lang="scss" scoped>
.detail-page { min-height: 100vh; background: #F5F6FA; padding-bottom: 120rpx; }
.status-banner { padding: 24rpx; text-align: center; font-size: 28rpx; font-weight: bold; }
.status-banner.pending { background: #FFF7E6; color: #FA8C16; }
.status-banner.accepted, .status-banner.paid, .status-banner.repairing, .status-banner.diagnosing { background: #E6F4FF; color: #1677FF; }
.status-banner.quoted { background: #FFF7E6; color: #FA8C16; }
.status-banner.completed { background: #FFF7E6; color: #FA8C16; }
.status-banner.confirmed { background: #F6FFED; color: #52C41A; }
.status-banner.cancelled { background: #F5F5F5; color: #999; }
.sb-tip { display: block; font-size: 24rpx; font-weight: normal; margin-top: 4rpx; opacity: 0.8; }
.bid-entry { margin: 16rpx 24rpx; display: flex; align-items: center; padding: 28rpx 24rpx; background: linear-gradient(135deg,#FFF7E6,#FFE7BA); border: 2rpx solid #FFA940; border-radius: 16rpx; }
.bid-entry:active { opacity: 0.8; }
.be-icon { font-size: 48rpx; margin-right: 20rpx; }
.be-info { flex: 1; }
.be-title { font-size: 28rpx; font-weight: 600; color: #D46B08; display: block; }
.be-desc { font-size: 22rpx; color: #FA8C16; }
.be-arrow { font-size: 36rpx; color: #FA8C16; }
.card {
  background: #fff; border-radius: 16rpx; padding: 24rpx; margin: 16rpx 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
  .card-title { font-size: 30rpx; font-weight: bold; color: #333; margin-bottom: 16rpx; display: block; }
}
.info-row { display: flex; padding: 12rpx 0; border-bottom: 1rpx solid #F5F5F5; }
.ir-label { width: 140rpx; font-size: 26rpx; color: #999; flex-shrink: 0; }
.ir-value { font-size: 26rpx; color: #333; flex:1; word-break: break-all; }
.ir-value.price { color: #FF4D4F; font-weight: bold; }
.img-row { display: flex; flex-wrap: wrap; gap: 16rpx; }
.detail-img { width: 200rpx; height: 200rpx; border-radius: 12rpx; }
.engineer-row { display: flex; align-items: center; gap: 16rpx; }
.eng-avatar { width: 80rpx; height: 80rpx; border-radius: 50%; background: #EEE; }
.eng-info { .eng-name { font-size: 28rpx; font-weight: 600; display: block; } .eng-phone { font-size: 24rpx; color:#999; } .eng-rating { font-size: 24rpx; color:#FA8C16; } }
.compare-row { margin-top: 16rpx; }
.label-sm { font-size: 24rpx; color: #999; display: block; margin-bottom: 8rpx; }
.img-scroll { white-space: nowrap; margin-bottom: 16rpx; }
.compare-img { width: 200rpx; height: 200rpx; border-radius: 12rpx; display: inline-block; margin-right: 16rpx; }
.timeline { padding-left: 16rpx; }
.tl-item { display: flex; padding-bottom: 24rpx; position: relative; }
.tl-dot { width: 16rpx; height: 16rpx; border-radius: 50%; background: #1677FF; margin-top: 6rpx; margin-right: 20rpx; flex-shrink: 0; }
.tl-item::after { content: ''; position: absolute; left: 7rpx; top: 24rpx; width: 2rpx; height: calc(100% - 8rpx); background: #E8E8E8; }
.tl-item:last-child::after { display: none; }
.tl-action { font-size: 26rpx; color: #333; display: block; }
.tl-time { font-size: 22rpx; color: #CCC; }

// Quote Card
.quote-card-wrapper { position: relative; border: 2rpx solid #FFE58F; }
.quote-badge { position: absolute; top: 24rpx; right: 24rpx; font-size: 22rpx; padding: 4rpx 12rpx; border-radius: 6rpx; }
.quote-badge.submitted, .quote-badge.draft { background: #FFF7E6; color: #FA8C16; }
.quote-badge.approved { background: #F6FFED; color: #52C41A; }
.quote-badge.rejected { background: #FFF1F0; color: #FF4D4F; }
.quote-section { margin-bottom: 20rpx; }
.qs-label { font-size: 26rpx; font-weight: 600; color: #333; display: block; margin-bottom: 8rpx; }
.qs-text { font-size: 26rpx; color: #666; line-height: 1.6; }
.quote-item { display: flex; justify-content: space-between; align-items: center; padding: 10rpx 0; border-bottom: 1rpx solid #F5F5F5; }
.qi-left { flex: 1; display: flex; flex-direction: column; }
.qi-name { font-size: 26rpx; color: #333; }
.qi-spec { font-size: 22rpx; color: #999; }
.qi-right { display: flex; align-items: center; gap: 8rpx; font-size: 24rpx; }
.qi-qty { color: #999; }
.qi-price { color: #1677FF; }
.qi-sub { color: #333; min-width: 100rpx; text-align: right; }
.quote-total { display: flex; justify-content: space-between; padding-top: 16rpx; border-top: 2rpx solid #FFE58F; margin-top: 4rpx; }
.qt-label { font-size: 28rpx; font-weight: 600; }
.qt-price { font-size: 36rpx; font-weight: 600; color: #FF4D4F; }
.quote-meta { display: flex; flex-direction: column; font-size: 22rpx; color: #CCC; gap: 4rpx; margin-top: 16rpx; }
.reject-reason { background: #FFF1F0; border-radius: 8rpx; padding: 12rpx 16rpx; margin-top: 12rpx; font-size: 24rpx; color: #FF4D4F; }
.rr-label { font-weight: 600; }
.approve-btns { display: flex; gap: 16rpx; margin-top: 24rpx; padding-top: 24rpx; border-top: 1rpx solid #F0F0F0; }
.btn-reject { flex: 1; padding: 20rpx; background: #FFF; border: 2rpx solid #FF4D4F; color: #FF4D4F; border-radius: 12rpx; font-size: 28rpx; }
.btn-approve { flex: 1; padding: 20rpx; background: linear-gradient(135deg, #52C41A, #389E0D); color: #fff; border-radius: 12rpx; font-size: 28rpx; border: none; }
.btn-pay { flex: 1; padding: 24rpx; background: linear-gradient(135deg, #FF4D4F, #F5222D); color: #fff; border-radius: 12rpx; font-size: 30rpx; font-weight: bold; border: none; }
/* 评价展示 */
.rating-display { padding: 8rpx 0; }
.rd-stars { display: block; margin-bottom: 8rpx; }
.rd-star { font-size: 36rpx; color: #E8E8E8; margin-right: 4rpx; }
.rd-star.active { color: #FAAD14; }
.rd-content { font-size: 28rpx; color: #333; line-height: 1.6; display: block; margin-bottom: 12rpx; }
.rd-dims { display: flex; flex-wrap: wrap; gap: 8rpx 24rpx; }
.rd-dim { font-size: 22rpx; color: #FAAD14; }
.rd-empty { font-size: 26rpx; color: #999; padding: 16rpx 0; }

.action-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; padding: 24rpx; box-shadow: 0 -2rpx 12rpx rgba(0,0,0,0.06); }
.rating-section { .rating-label { font-size: 28rpx; font-weight: 600; } .stars { margin: 12rpx 0; } .star { font-size: 44rpx; color: #DDD; margin-right: 8rpx; &.active { color: #FAAD14; } } .dim-ratings { margin: 8rpx 0 16rpx; } .dim-row { display: flex; align-items: center; justify-content: space-between; padding: 6rpx 0; } .dim-label { font-size: 26rpx; color: #666; } .dim-star { font-size: 32rpx; color: #DDD; margin-left: 4rpx; &.active { color: #FAAD14; } } textarea { width: 100%; height: 100rpx; border: 2rpx solid #EEE; border-radius: 12rpx; padding: 12rpx; margin-bottom: 16rpx; font-size: 26rpx; } }
.btn-cancel { background: #FFF; border: 2rpx solid #FF4D4F; color: #FF4D4F; border-radius: 12rpx; }
.safe-bottom { height: 120rpx; }
</style>
