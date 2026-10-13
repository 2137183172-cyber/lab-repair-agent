<script>
import { getApiBaseUrl } from '@/api/index';

export default {
  globalData: {
    apiBase: getApiBaseUrl(),
    orderFilter: ''
  },
  onLaunch() {
    console.log('[智荟华科] 小程序启动 v4.1');
    console.log('[智荟华科] API Base:', getApiBaseUrl());
    const token = uni.getStorageSync('zhhk_token');
    if (!token) {
      console.log('[智荟华科] 未登录，请前往“我的”页面登录');
    }
  },
  onShow() {
    this.globalData.apiBase = getApiBaseUrl();
  },
  onHide() {}
};
</script>

<style>
page {
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
  font-size: 28rpx;
  color: #333;
  background: #f5f6fa;
}

button {
  border-radius: 12rpx;
}
</style>
