<template>
  <view class="add-page">
    <view class="form-item"><text class="label">设备名称 <text class="required">*</text></text>
      <input v-model="form.name" placeholder="如: Eppendorf 5424R 离心机" /></view>
    <view class="form-item"><text class="label">品牌</text>
      <input v-model="form.brand" placeholder="如: Eppendorf" /></view>
    <view class="form-item"><text class="label">型号</text>
      <input v-model="form.model" placeholder="设备型号" /></view>
    <view class="form-item"><text class="label">分类</text>
      <view class="picker-val" @click="showCatPicker = true">
        {{ form.category_id ? (categoryMap[form.category_id] || '请选择设备分类') : '请选择设备分类' }}
        <text class="picker-arrow">▼</text>
      </view></view>
    <view class="form-item"><text class="label">序列号</text>
      <input v-model="form.serial_no" placeholder="机身序列号" /></view>
    <view class="form-item"><text class="label">资产编号</text>
      <input v-model="form.asset_no" placeholder="单位资产编号" /></view>
    <view class="form-item"><text class="label">实验室</text>
      <input v-model="form.lab_name" placeholder="所在实验室名称" /></view>
    <view class="form-item"><text class="label">房间号</text>
      <input v-model="form.lab_room" placeholder="如: B201" /></view>
    <view class="form-item"><text class="label">详细位置</text>
      <input v-model="form.location" placeholder="如: 3楼东侧实验区" /></view>
    <view class="form-item"><text class="label">采购日期</text>
      <picker mode="date" @change="e=>form.purchase_date=e.detail.value"><view class="picker-val">{{ form.purchase_date || '选择日期' }}</view></picker></view>
    <view class="form-item"><text class="label">保修开始</text>
      <picker mode="date" @change="e=>form.warranty_start=e.detail.value"><view class="picker-val">{{ form.warranty_start || '选择日期' }}</view></picker></view>
    <view class="form-item"><text class="label">保修截止</text>
      <picker mode="date" @change="e=>form.warranty_end=e.detail.value"><view class="picker-val">{{ form.warranty_end || '选择日期' }}</view></picker></view>
    <view class="form-item"><text class="label">备注</text>
      <textarea v-model="form.notes" placeholder="其他说明" /></view>

    <button type="primary" @click="submit" :loading="submitting">{{ isEdit ? '保存修改' : '添加设备' }}</button>

    <!-- 分类搜索弹窗 -->
    <view class="cat-overlay" v-if="showCatPicker" @click="showCatPicker = false">
      <view class="cat-popup" @click.stop>
        <view class="cat-header">
          <text class="cat-title">选择设备分类</text>
          <text class="cat-close" @click="showCatPicker = false">✕</text>
        </view>
        <view class="cat-search">
          <input v-model="catKeyword" placeholder="搜索分类..." @input="filterCats" />
        </view>
        <scroll-view scroll-y class="cat-list">
          <view v-for="c in filteredCats" :key="c.id" class="cat-item"
                :class="{ active: c.id === selectedCatId }"
                @click="selectCat(c)">
            <text :style="{paddingLeft: (c._level*20)+'px'}">{{ c._level > 0 ? '└ ' : '' }}{{ c.name }}</text>
            <text v-if="c.id === selectedCatId" class="cat-check">✓</text>
          </view>
          <view v-if="filteredCats.length === 0" class="cat-empty">无匹配分类</view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { getCategories, createDevice, updateDevice, getDeviceDetail } from '@/api/index';

const isEdit = ref(false);
const categories = ref([]);
const categoryNames = ref({});
const submitting = ref(false);

const form = reactive({
  name: '', brand: '', model: '', category_id: null, serial_no: '', asset_no: '',
  lab_name: '', lab_room: '', location: '', purchase_date: '', warranty_start: '', warranty_end: '', notes: ''
});

// 搜索式分类选择器
const showCatPicker = ref(false);
const catKeyword = ref('');
const selectedCatId = ref(null);
const filteredCats = ref([]);
const categoryMap = ref({});

function flattenTree(tree, level=0) {
  const result = [];
  tree.forEach(c => {
    result.push({id:c.id, name:c.name, parent_id:c.parent_id, _level:level});
    if (c.children?.length) result.push(...flattenTree(c.children, level+1));
  });
  return result;
}

function filterCats() {
  const kw = catKeyword.value.toLowerCase();
  filteredCats.value = categories.value.filter(c => !kw || c.name.toLowerCase().includes(kw));
}

function selectCat(c) {
  selectedCatId.value = c.id;
  form.category_id = c.id;
  setTimeout(() => showCatPicker.value = false, 200);
}

function onDateChange(e) { form.warranty_end = e.detail.value; }

async function init() {
  try {
    const cats = await getCategories();
    categories.value = flattenTree(cats);
    categories.value.forEach(c => { categoryMap.value[c.id] = c.name; });
    filteredCats.value = [...categories.value];
  } catch (e) { /* ignore */ }
}

async function submit() {
  if (!form.name.trim()) return uni.showToast({ title: '请输入设备名称', icon: 'none' });
  submitting.value = true;
  try {
    if (isEdit.value) {
      await updateDevice(form.id, form);
      uni.showToast({ title: '保存成功', icon: 'success' });
    } else {
      await createDevice(form);
      uni.showToast({ title: '添加成功，二维码已生成', icon: 'success' });
    }
    setTimeout(() => uni.navigateBack(), 1500);
  } catch (e) { uni.showToast({ title: e.message || '操作失败', icon: 'none' }); }
  finally { submitting.value = false; }
}

onLoad(async (options) => {
  await init();
  if (options.id) {
    isEdit.value = true;
    try {
      const device = await getDeviceDetail(options.id);
      Object.assign(form, device.device);
      form.id = device.device.id;
    } catch (e) { /* ignore */ }
  }
});
</script>

<style lang="scss" scoped>
.add-page { min-height: 100vh; background: #F5F6FA; padding: 24rpx; }
.form-item { margin-bottom: 20rpx; }
.label { font-size: 28rpx; color: #333; margin-bottom: 8rpx; display: block; font-weight: 500; }
.required { color: #FF4D4F; }
input, textarea { width: 100%; height: 80rpx; background: #fff; border-radius: 12rpx; padding: 0 20rpx; font-size: 28rpx; box-sizing: border-box; }
textarea { height: 140rpx; padding: 16rpx 20rpx; }
.picker-val { width: 100%; height: 80rpx; background: #fff; border-radius: 12rpx; padding: 0 20rpx; font-size: 28rpx; color: #999; line-height: 80rpx; }
button { margin-top: 40rpx; border-radius: 12rpx; }
.picker-arrow { float: right; color: #999; font-size: 24rpx; }
.cat-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 999; display: flex; align-items: flex-end; }
.cat-popup { background: #fff; border-radius: 24rpx 24rpx 0 0; width: 100%; max-height: 70vh; display: flex; flex-direction: column; }
.cat-header { display: flex; justify-content: space-between; align-items: center; padding: 24rpx 30rpx; border-bottom: 1rpx solid #F0F0F0; }
.cat-title { font-size: 30rpx; font-weight: 600; }
.cat-close { font-size: 36rpx; color: #999; padding: 8rpx; }
.cat-search { padding: 16rpx 24rpx; }
.cat-search input { width: 100%; height: 72rpx; background: #F5F6FA; border-radius: 36rpx; padding: 0 28rpx; font-size: 26rpx; }
.cat-list { flex: 1; overflow-y: auto; padding: 0 8rpx 40rpx; }
.cat-item { display: flex; justify-content: space-between; align-items: center; padding: 22rpx 24rpx; font-size: 28rpx; border-bottom: 1rpx solid #F8F8F8; }
.cat-item.active { background: #E6F4FF; color: #1677FF; }
.cat-check { color: #1677FF; font-weight: 600; font-size: 30rpx; }
.cat-empty { text-align: center; padding: 60rpx; color: #CCC; }
</style>
