<template>
  <div class="dict-page">
    <el-card shadow="never">
      <div class="toolbar">
        <el-select v-model="activeDimension" placeholder="选择维度" style="width:160px" @change="loadData">
          <el-option v-for="d in dimensions" :key="d" :label="d" :value="d" />
        </el-select>
        <el-select v-model="activeGroup" placeholder="选择字典组" style="width:200px;margin-left:12px" @change="loadData">
          <el-option v-for="g in groups" :key="g.dict_group" :label="`${g.dict_group} (${g.label})`" :value="g.dict_group" />
        </el-select>
        <el-button type="primary" style="margin-left:12px" @click="openAdd">+ 添加字典项</el-button>
        <el-button type="warning" style="margin-left:8px" @click="doSeed">🔄 初始化默认字典</el-button>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-top:16px">
      <el-table :data="items" stripe v-loading="loading">
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="dimension" label="维度" width="100" />
        <el-table-column prop="dict_group" label="字典组" width="130" />
        <el-table-column prop="dict_key" label="键(key)" width="150" />
        <el-table-column prop="dict_value" label="值(value)" min-width="200" />
        <el-table-column prop="extra" label="扩展信息" width="150" show-overflow-tooltip />
        <el-table-column prop="sort_order" label="排序" width="70" />
        <el-table-column prop="status" label="状态" width="70">
          <template #default="{row}"><el-tag :type="row.status==='active'?'success':'info'" size="small">{{ row.status==='active'?'启用':'停用' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{row}">
            <el-button size="small" type="primary" link @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total"
          layout="total, prev, pager, next" @current-change="loadData" />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editForm.id ? '编辑字典项' : '添加字典项'" width="500px">
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="维度">
          <el-select v-model="editForm.dimension" style="width:100%">
            <el-option v-for="d in dimensions" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="字典组">
          <el-input v-model="editForm.dict_group" placeholder="如: brand, skill, area" />
        </el-form-item>
        <el-form-item label="键(key)"><el-input v-model="editForm.dict_key" placeholder="英文标识" /></el-form-item>
        <el-form-item label="值(value)"><el-input v-model="editForm.dict_value" placeholder="中文显示值" /></el-form-item>
        <el-form-item label="扩展信息"><el-input v-model="editForm.extra" placeholder="规格说明等" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="排序"><el-input-number v-model="editForm.sort_order" :min="0" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="状态">
            <el-radio-group v-model="editForm.status"><el-radio value="active">启用</el-radio><el-radio value="inactive">停用</el-radio></el-radio-group>
          </el-form-item></el-col>
        </el-row>
      </el-form>
      <template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button type="primary" @click="saveEdit" :loading="saving">保存</el-button></template>
    </el-dialog>

    <!-- 字典组说明 -->
    <el-card shadow="never" style="margin-top:16px" v-if="!activeDimension">
      <template #header>📖 4大维度字典组说明</template>
      <el-table :data="groupInfo" size="small" border>
        <el-table-column prop="dimension" label="维度" width="100" />
        <el-table-column prop="group" label="字典组" width="150" />
        <el-table-column prop="label" label="名称" width="150" />
        <el-table-column prop="desc" label="用途说明" />
        <el-table-column prop="count" label="条数" width="60" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'; import { ElMessage, ElMessageBox } from 'element-plus'; import api from '@/api';

const dimensions = ['设备仪器', '业务运营', '组织人员', '质量合规'];
const activeDimension = ref(''); const activeGroup = ref(''); const loading = ref(false);
const items = ref([]); const groups = ref([]);
const groupInfo = ref([
  { dimension:'设备仪器', group:'brand', label:'仪器品牌', desc:'设备品牌下拉选择: Thermo Fisher, Agilent, Waters...', count:0 },
  { dimension:'设备仪器', group:'lab_type', label:'实验室类型', desc:'实验室分类: 分子生物/细胞/分析/质谱/微生物...', count:0 },
  { dimension:'设备仪器', group:'calibration_standard', label:'校准标准', desc:'校准依据: JJF 1101, JJF 1527, ISO 17025...', count:0 },
  { dimension:'业务运营', group:'knowledge_category', label:'知识分类', desc:'知识库文章分类: 故障诊断/保养/安全/校准...', count:0 },
  { dimension:'业务运营', group:'fault_keyword', label:'常见故障', desc:'故障关键词: 噪音大/温度异常/转速不稳...', count:0 },
  { dimension:'业务运营', group:'contract_type_label', label:'合同类型', desc:'维保/校准/全包/按次...', count:0 },
  { dimension:'组织人员', group:'industry', label:'行业', desc:'客户行业: 制药/生物技术/CRO/体外诊断...', count:0 },
  { dimension:'组织人员', group:'service_area', label:'服务区域', desc:'工程师服务城市列表: 36个主要城市', count:0 },
  { dimension:'组织人员', group:'skill_tag', label:'技能标签', desc:'工程师技能: 离心机/PCR/质谱/色谱...', count:0 },
  { dimension:'组织人员', group:'certification', label:'资质证书', desc:'工程师资质: ISO/CNAS/CMA/CE...', count:0 },
  { dimension:'组织人员', group:'department', label:'部门', desc:'客户部门: 质量管理部/检验科/研发部...', count:0 },
  { dimension:'质量合规', group:'maintenance_type', label:'维护类型', desc:'保养巡检类型: 日常/季度/年度/预防性...', count:0 },
  { dimension:'质量合规', group:'inspection_item', label:'检查项目', desc:'巡检项目清单: 外观/功能/电气安全...', count:0 },
  { dimension:'质量合规', group:'part_category', label:'备件分类', desc:'备件分类: 轴承/密封件/传感器/灯管...', count:0 },
  { dimension:'质量合规', group:'part_unit', label:'计量单位', desc:'备件单位: 个/套/根/米/桶/瓶...', count:0 },
]);

const dialogVisible = ref(false); const saving = ref(false);
const page = ref(1); const pageSize = ref(20); const total = ref(0);
const editForm = reactive({ dimension:'设备仪器', dict_group:'', dict_key:'', dict_value:'', sort_order:0, status:'active', extra:'' });

async function loadData() {
  loading.value = true;
  try {
    const params = { page: page.value, pageSize: pageSize.value };
    if (activeDimension.value) params.dimension = activeDimension.value;
    if (activeGroup.value) params.group = activeGroup.value;
    const r = await api.get('/dictionary/list', { params });
    items.value = r.data?.list || r.data?.list || r.data?.data || r.data || [];
    total.value = r.data?.data?.total || r.data?.total || items.value.length;
    // Load groups for dimension
    const g = await api.get('/dictionary/groups');
    groups.value = (g.data || g.data || []).filter(x => !activeDimension.value || x.dimension === activeDimension.value);
  } catch (e) { ElMessage.error('加载失败'); }
  loading.value = false;
}

function openAdd() { Object.assign(editForm, { id:null, dimension:activeDimension.value||'设备仪器', dict_group:activeGroup.value||'', dict_key:'', dict_value:'', sort_order:0, status:'active', extra:'' }); dialogVisible.value = true; }
function openEdit(row) { Object.assign(editForm, { ...row }); dialogVisible.value = true; }
async function saveEdit() {
  saving.value = true;
  try {
    if (editForm.id) await api.put('/dictionary/update/' + editForm.id, editForm);
    else await api.post('/dictionary/create', editForm);
    ElMessage.success('已保存'); dialogVisible.value = false; loadData();
  } catch (e) { ElMessage.error('保存失败'); }
  saving.value = false;
}
async function handleDelete(row) {
  try { await ElMessageBox.confirm('确定删除？','提示',{type:'warning'}); await api.delete('/dictionary/delete/'+row.id); ElMessage.success('已删除'); loadData(); } catch(e){}
}
async function doSeed() {
  try { await ElMessageBox.confirm('将用默认数据覆盖现有字典？','初始化',{type:'warning'}); await api.post('/dictionary/seed'); ElMessage.success('初始化完成'); loadData(); } catch(e){}
}

onMounted(loadData);
</script>
<style scoped>.toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px}</style>
