<template>
  <view class="profile-page">
    <view class="card">
      <view class="form-item">
        <text class="label">姓名</text>
        <input v-model="form.name" placeholder="请输入姓名" class="input" />
      </view>
      <view class="form-item">
        <text class="label">手机号</text>
        <input v-model="form.phone" type="number" maxlength="11" placeholder="请输入手机号" class="input" />
      </view>
      <view class="form-item">
        <text class="label">单位/公司</text>
        <input v-model="form.company" placeholder="请输入单位名称" class="input" />
      </view>
      <view class="form-item">
        <text class="label">部门/实验室</text>
        <input v-model="form.department" placeholder="请输入部门" class="input" />
      </view>
    </view>

    <view class="card">
      <view class="form-item">
        <text class="label">常用地址</text>
        <textarea v-model="form.address" placeholder="请输入服务地址，报修时自动填充" class="textarea" />
      </view>
    </view>

    <button class="save-btn" @click="handleSave" :loading="saving">保存</button>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { updateUserProfile } from '@/api/index';
import { useUserStore } from '@/store/index';

const userStore = useUserStore();
const saving = ref(false);
const form = reactive({
  name: userStore.userInfo?.name || '',
  phone: userStore.userInfo?.phone || '',
  company: userStore.userInfo?.company || '',
  department: userStore.userInfo?.department || '',
  address: '',
});

async function handleSave() {
  if (!form.name) return uni.showToast({ title: '请输入姓名', icon: 'none' });
  saving.value = true;
  try {
    await updateUserProfile(form);
    userStore.userInfo = { ...userStore.userInfo, ...form };
    uni.showToast({ title: '保存成功', icon: 'success' });
    setTimeout(() => uni.navigateBack(), 800);
  } catch (e) {
    uni.showToast({ title: '保存失败', icon: 'none' });
  }
  saving.value = false;
}
</script>

<style lang="scss" scoped>
.profile-page { min-height: 100vh; background: #F5F6FA; padding: 24rpx; }
.card { background: #fff; border-radius: 16rpx; padding: 0 24rpx; margin-bottom: 24rpx; }
.form-item { display: flex; align-items: flex-start; padding: 24rpx 0; border-bottom: 1rpx solid #F5F5F5; }
.form-item:last-child { border-bottom: none; }
.label { width: 150rpx; font-size: 28rpx; color: #333; flex-shrink: 0; line-height: 44rpx; }
.input { flex: 1; font-size: 28rpx; color: #333; text-align: right; }
.textarea { flex: 1; font-size: 28rpx; color: #333; min-height: 80rpx; }
.save-btn { margin: 40rpx 0; background: #1677FF; color: #fff; border-radius: 12rpx; border: none; }
</style>
