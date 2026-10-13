<template>
  <view class="knowledge-page">
    <view class="search-bar">
      <input v-model="keyword" placeholder="搜索维修知识..." @confirm="loadData" class="search-input" />
    </view>

    <scroll-view scroll-y class="list" @scrolltolower="loadMore">
      <view v-for="a in articles" :key="a.id" class="article-card" @click="goDetail(a.id)">
        <image v-if="a.cover_image" :src="a.cover_image" mode="aspectFill" class="ac-cover" />
        <view class="ac-body">
          <text class="ac-title">{{ a.title }}</text>
          <text class="ac-summary">{{ a.summary || '暂无摘要' }}</text>
          <view class="ac-meta">
            <text class="ac-category" v-if="a.category">{{ a.category }}</text>
            <text class="ac-views">👁 {{ a.view_count }}</text>
            <text class="ac-date">{{ formatDate(a.created_at) }}</text>
          </view>
        </view>
      </view>
      <view v-if="articles.length === 0 && !loading" class="empty">暂无文章</view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { BASE_URL, getToken } from '@/api/index';

const articles = ref([]);
const keyword = ref('');
const loading = ref(false);
const page = ref(1);
const total = ref(0);

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`;
}

async function loadData() {
  page.value = 1; articles.value = []; loading.value = true;
  await fetchArticles();
  loading.value = false;
}

async function fetchArticles() {
  try {
    const res = await uni.request({
      url: `${BASE_URL}/knowledge/list?page=${page.value}&pageSize=20&keyword=${keyword.value}`,
      header: { Authorization: `Bearer ${getToken()}` }
    });
    const data = res.data;
    if (data.code === 200) {
      articles.value = page.value === 1 ? (data.data.list || []) : [...articles.value, ...(data.data.list || [])];
      total.value = data.data.total || 0;
    }
  } catch (e) { /* ignore */ }
}

async function loadMore() {
  if (loading.value || articles.value.length >= total.value) return;
  page.value++; loading.value = true;
  await fetchArticles();
  loading.value = false;
}

function goDetail(id) {
  uni.navigateTo({ url: `/pages/knowledge/detail?id=${id}` });
}

onShow(() => { if (articles.value.length === 0) loadData(); });
</script>

<style lang="scss" scoped>
.knowledge-page { min-height: 100vh; background: #F5F6FA; }
.search-bar { padding: 20rpx 24rpx; background: #fff; }
.search-input { background: #F5F6FA; border-radius: 32rpx; padding: 16rpx 24rpx; font-size: 28rpx; }
.list { padding: 24rpx; }
.article-card { background: #fff; border-radius: 16rpx; margin-bottom: 16rpx; overflow: hidden; display: flex; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04); }
.ac-cover { width: 180rpx; height: 180rpx; flex-shrink: 0; }
.ac-body { flex: 1; padding: 20rpx; display: flex; flex-direction: column; }
.ac-title { font-size: 28rpx; font-weight: 600; color: #333; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ac-summary { font-size: 24rpx; color: #999; margin-top: 8rpx; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; flex: 1; }
.ac-meta { display: flex; gap: 16rpx; margin-top: 12rpx; font-size: 22rpx; color: #BBB; }
.ac-category { color: #1677FF; background: #E6F4FF; padding: 2rpx 12rpx; border-radius: 4rpx; }
.empty { text-align: center; padding: 120rpx 0; color: #999; }
</style>
