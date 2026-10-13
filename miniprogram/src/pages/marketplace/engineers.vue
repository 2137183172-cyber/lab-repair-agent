<template>
  <view class="engineers-page">
    <view class="header"><text class="title">工程师大厅</text><text class="sub">推荐·收藏·排序·筛选</text></view>

    <!-- 排序Tab -->
    <scroll-view scroll-x class="sort-tabs">
      <view v-for="t in sortTabs" :key="t.value" class="sort-tab" :class="{ active: sort === t.value }" @click="switchSort(t.value)">{{ t.label }}</view>
    </scroll-view>

    <!-- 筛选 -->
    <view class="filter-row">
      <picker :range="regionOptions" @change="onRegionChange" class="filter-col">
        <text class="filter-pick">📍 {{ regionOptions[regionIdx] }}</text>
      </picker>
      <picker :range="typeOptions" @change="onTypeChange" class="filter-col">
        <text class="filter-pick">{{ typeOptions[typeIdx] }}</text>
      </picker>
      <input v-model="skill" placeholder="搜索技能" class="filter-input" @confirm="loadData" />
    </view>

    <view v-if="list.length === 0 && !loading" class="empty"><text>暂无工程师</text></view>

    <view v-for="eng in list" :key="eng.id" class="eng-card">
      <view class="ec-header">
        <text class="ec-name">{{ eng.name }}</text>
        <text class="ec-type" :class="eng.type">{{ eng.type === 'self_employed' ? '自营' : '认证' }}</text>
        <text class="ec-status" :class="eng.status">{{ eng.status === 'online' ? '在线' : eng.status === 'busy' ? '忙碌' : '离线' }}</text>
      </view>
      <view class="ec-rating">
        <text class="ec-score">⭐ {{ eng.rating }}</text>
        <text class="ec-good" v-if="eng.good_rate"> · {{ eng.good_rate }}%好评</text>
        <text class="ec-count" v-if="eng.review_count"> · {{ eng.review_count }}评</text>
        <text> · {{ eng.total_orders || 0 }}单</text>
        <text class="ec-match" v-if="eng.match_devices"> · 匹配{{ eng.match_devices }}台</text>
      </view>
      <view class="ec-dims" v-if="eng.rating_response">
        <text class="dim-item">响应{{ eng.rating_response }}</text>
        <text class="dim-item">技术{{ eng.rating_skill }}</text>
        <text class="dim-item">态度{{ eng.rating_attitude }}</text>
        <text class="dim-item">价格{{ eng.rating_price }}</text>
      </view>
      <view class="ec-skills" v-if="eng.skills && eng.skills.length">
        <text v-for="s in eng.skills" :key="s" class="skill-tag">{{ s }}</text>
      </view>
      <view class="ec-area" v-if="eng.service_area && eng.service_area.length">
        <text class="area-label">服务区域：</text><text>{{ (eng.service_area || []).join('、') }}</text>
      </view>
      <view class="ec-fav-btn" @click.stop="toggleFav(eng)">
        <text>{{ eng.is_favorited ? '⭐ 已收藏' : '☆ 收藏' }}</text>
      </view>
    </view>

    <view v-if="loading" class="loading">加载中...</view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getEngineerHall, addFavorite, removeFavorite } from '@/api/index';

const list = ref([]); const skill = ref(''); const loading = ref(false);
const sort = ref('recommend'); const typeIdx = ref(0);
const sortTabs = [
  { label: '🏆 推荐', value: 'recommend' }, { label: '⭐ 评分', value: 'rating' },
  { label: '📊 接单', value: 'orders' }, { label: '💬 评价', value: 'reviews' },
  { label: '⏱ 响应', value: 'response' }, { label: '⭐ 收藏', value: 'favorites' }
];
const typeOptions = ['全部类型', '自营', '认证'];
const regionOptions = ref(['全部区域', '北京', '天津', '上海', '广州', '深圳', '杭州', '南京', '成都', '武汉', '西安', '重庆', '苏州', '东莞', '河北', '山东', '河南']);
const regionIdx = ref(0);

function switchSort(val) { sort.value = val; loadData(); }
function onTypeChange(e) { typeIdx.value = e.detail.value; loadData(); }
function onRegionChange(e) { regionIdx.value = e.detail.value; loadData(); }

async function loadData() {
  loading.value = true;
  try {
    const params = { sort: sort.value };
    if (skill.value) params.skill = skill.value;
    if (regionIdx.value > 0) params.region = regionOptions.value[regionIdx.value];
    if (typeIdx.value === 1) params.type = 'self_employed';
    if (typeIdx.value === 2) params.type = 'certified';
    if (sort.value === 'favorites') params.favorites = '1';
    const data = await getEngineerHall(params);
    list.value = data.list || [];
  } catch (e) { /* ignore */ }
  loading.value = false;
}

async function toggleFav(eng) {
  try {
    if (eng.is_favorited) {
      await removeFavorite(eng.id);
      eng.is_favorited = false;
      uni.showToast({ title: '已取消收藏', icon: 'none' });
    } else {
      await addFavorite(eng.id);
      eng.is_favorited = true;
      uni.showToast({ title: '已收藏', icon: 'none' });
    }
  } catch (e) { uni.showToast({ title: '操作失败', icon: 'none' }); }
}

onMounted(() => loadData());
</script>

<style lang="scss" scoped>
.engineers-page { min-height: 100vh; background: #F5F6FA; }
.header { background: linear-gradient(135deg, #1677FF, #0958D9); padding: 40rpx 30rpx 30rpx; color: #fff; }
.title { font-size: 40rpx; font-weight: bold; display: block; }
.sub { font-size: 24rpx; opacity: 0.7; }
.sort-tabs { white-space: nowrap; padding: 16rpx 24rpx; display: flex; gap: 12rpx; }
.sort-tab { display: inline-block; font-size: 24rpx; padding: 10rpx 20rpx; border-radius: 20rpx; background: #fff; color: #666; }
.sort-tab.active { background: #1677FF; color: #fff; font-weight: 600; }
.filter-row { display: flex; gap: 12rpx; margin: 0 24rpx 16rpx; align-items: center; }
.filter-col { flex-shrink: 0; }
.filter-input { flex: 1; padding: 14rpx 16rpx; background: #fff; border-radius: 10rpx; font-size: 26rpx; }
.filter-pick { font-size: 24rpx; color: #1677FF; padding: 14rpx 12rpx; background: #fff; border-radius: 10rpx; display: block; white-space: nowrap; }
.empty { text-align: center; padding: 100rpx; color: #999; }
.eng-card { background: #fff; margin: 16rpx 24rpx; border-radius: 16rpx; padding: 24rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06); position: relative; }
.ec-header { display: flex; align-items: center; gap: 8rpx; margin-bottom: 8rpx; }
.ec-name { font-size: 30rpx; font-weight: 600; }
.ec-type { font-size: 20rpx; padding: 2rpx 10rpx; border-radius: 4rpx; }
.ec-type.self_employed { background: #E6F4FF; color: #1677FF; }
.ec-type.certified { background: #F6FFED; color: #52C41A; }
.ec-status { font-size: 20rpx; padding: 2rpx 10rpx; border-radius: 4rpx; margin-left: auto; }
.ec-status.online { background: #F6FFED; color: #52C41A; }
.ec-status.busy { background: #FFF7E6; color: #FA8C16; }
.ec-rating { font-size: 24rpx; color: #999; margin-bottom: 4rpx; display: flex; align-items: center; flex-wrap: wrap; }
.ec-score { font-weight: 600; color: #FA8C16; } .ec-good { color: #52C41A; } .ec-count { color: #999; } .ec-match { color: #52C41A; font-weight: 500; }
.ec-dims { display: flex; gap: 16rpx; margin-bottom: 8rpx; padding: 8rpx 12rpx; background: #F8FAFC; border-radius: 8rpx; }
.dim-item { font-size: 22rpx; color: #666; }
.ec-skills { display: flex; flex-wrap: wrap; gap: 8rpx; margin-bottom: 8rpx; }
.skill-tag { font-size: 22rpx; padding: 4rpx 12rpx; background: #F0F5FF; color: #1677FF; border-radius: 6rpx; }
.ec-area { font-size: 24rpx; color: #999; }
.ec-fav-btn { position: absolute; right: 20rpx; bottom: 20rpx; font-size: 24rpx; color: #FA8C16; padding: 6rpx 12rpx; }
.loading { text-align: center; padding: 40rpx; color: #999; }
</style>
