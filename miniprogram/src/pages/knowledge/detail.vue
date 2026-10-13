<template>
  <view class="detail-page" v-if="article">
    <text class="d-title">{{ article.title }}</text>
    <view class="d-meta">
      <text class="d-category" v-if="article.category">{{ article.category }}</text>
      <text class="d-date">{{ formatDate(article.created_at) }}</text>
      <text class="d-views">👁 {{ article.view_count }}</text>
    </view>
    <view class="d-tags" v-if="article.tags && article.tags.length">
      <text v-for="t in (typeof article.tags==='string'?JSON.parse(article.tags):article.tags)" :key="t" class="tag">{{ t }}</text>
    </view>
    <view class="d-content">
      <rich-text :nodes="article.content || '<p>暂无内容</p>'" />
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { BASE_URL, getToken } from '@/api/index';

const article = ref(null);

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`;
}

onLoad(async (options) => {
  if (!options.id) return;
  try {
    const res = await uni.request({
      url: `${BASE_URL}/knowledge/detail/${options.id}`,
      header: { Authorization: `Bearer ${getToken()}` }
    });
    if (res.data.code === 200) article.value = res.data.data;
  } catch (e) { /* ignore */ }
});
</script>

<style lang="scss" scoped>
.detail-page { min-height: 100vh; background: #fff; padding: 24rpx; }
.d-title { font-size: 36rpx; font-weight: bold; color: #333; display: block; margin-bottom: 16rpx; }
.d-meta { display: flex; gap: 20rpx; font-size: 24rpx; color: #999; margin-bottom: 16rpx; }
.d-category { color: #1677FF; }
.d-tags { display: flex; flex-wrap: wrap; gap: 12rpx; margin-bottom: 24rpx; }
.tag { font-size: 22rpx; color: #1677FF; background: #E6F4FF; padding: 4rpx 16rpx; border-radius: 8rpx; }
.d-content { font-size: 28rpx; line-height: 1.8; color: #333; }
</style>
