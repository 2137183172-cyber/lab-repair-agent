const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { Dictionary } = require('../models');
const { success, fail, parsePagination } = require('../utils/response');

// GET /api/dictionary/groups — 所有字典组列表
router.get('/groups', auth, async (req, res) => {
  try {
    const items = await Dictionary.findAll({
      attributes: ['dimension', 'dict_group'],
      where: { status: 'active' },
      group: ['dimension', 'dict_group'],
      order: [['dimension', 'ASC'], ['dict_group', 'ASC']],
      raw: true
    });
    res.json(success(items));
  } catch (err) { res.json(fail('获取失败')); }
});

// GET /api/dictionary/list?group=brand&dimension=设备仪器&page=1&pageSize=20
router.get('/list', auth, async (req, res) => {
  try {
    const { group, dimension, page = 1, pageSize = 20 } = req.query;
    const { offset, limit } = parsePagination(req.query);
    const where = { status: 'active' };
    if (group) where.dict_group = group;
    if (dimension) where.dimension = dimension;
    const { count, rows } = await Dictionary.findAndCountAll({ where, order: [['sort_order', 'ASC'], ['id', 'ASC']], offset, limit });
    res.json(success({ list: rows, total: count, page: parseInt(page), pageSize: parseInt(pageSize) }));
  } catch (err) { res.json(fail('获取失败')); }
});

// GET /api/dictionary/all — 全部字典(按维度+组分组)
router.get('/all', auth, async (req, res) => {
  try {
    const items = await Dictionary.findAll({ where: { status: 'active' }, order: [['dimension', 'ASC'], ['dict_group', 'ASC'], ['sort_order', 'ASC']] });
    const result = {};
    items.forEach(item => {
      if (!result[item.dimension]) result[item.dimension] = {};
      if (!result[item.dimension][item.dict_group]) result[item.dimension][item.dict_group] = [];
      result[item.dimension][item.dict_group].push({ key: item.dict_key, value: item.dict_value, extra: item.extra });
    });
    res.json(success(result));
  } catch (err) { res.json(fail('获取失败')); }
});

// POST /api/dictionary/create
router.post('/create', auth, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { dimension, dict_group, dict_key, dict_value, sort_order, extra } = req.body;
    const item = await Dictionary.create({ dimension, dict_group, dict_key: dict_key || '', dict_value, sort_order: sort_order || 0, extra: extra || '', status: 'active' });
    res.json(success(item, '添加成功'));
  } catch (err) { console.error(err); res.json(fail('添加失败')); }
});

// PUT /api/dictionary/update/:id
router.put('/update/:id', auth, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const item = await Dictionary.findByPk(req.params.id);
    if (!item) return res.json(fail('不存在'));
    ['dimension', 'dict_group', 'dict_key', 'dict_value', 'sort_order', 'status', 'extra'].forEach(f => { if (req.body[f] !== undefined) item[f] = req.body[f]; });
    await item.save();
    res.json(success(item, '更新成功'));
  } catch (err) { res.json(fail('更新失败')); }
});

// DELETE /api/dictionary/delete/:id
router.delete('/delete/:id', auth, requireRole('admin'), async (req, res) => {
  try { await Dictionary.destroy({ where: { id: req.params.id } }); res.json(success(null, '已删除')); }
  catch (err) { res.json(fail('删除失败')); }
});

// POST /api/dictionary/seed — 初始化所有字典数据
router.post('/seed', auth, requireRole('admin'), async (req, res) => {
  try {
    const data = [
      // ====== 设备仪器 ======
      { dimension:'设备仪器', group:'brand', items: ['Thermo Fisher','Agilent','Waters','Bio-Rad','BD Biosciences','Applied Biosystems','Beckman Coulter','Eppendorf','BioTek','TOMY','AB Sciex','Shimadzu','PerkinElmer','Roche','Illumina','Qiagen','Bruker','JEOL','Hitachi','Olympus','Nikon','Zeiss','Leica','GE Healthcare','Millipore','Sartorius','Mettler Toledo','Anton Paar','Malvern Panalytical'] },
      { dimension:'设备仪器', group:'lab_type', items: ['分子生物学实验室','细胞培养室','分析实验室','质谱实验室','免疫实验室','微生物实验室','蛋白纯化实验室','样本库','准备室','洁净室'] },
      { dimension:'设备仪器', group:'warranty_status', items: ['在保','即将到期','已过期','延保中'] },
      { dimension:'设备仪器', group:'calibration_standard', items: ['JJF 1101-2019','JJF 1527-2015','JJG 705-2014','JJF 1665-2017','JJF 1164-2018','JJG 119-2018','JJG 178-2007','JJG 646-2006','ISO 17025','GB/T 27025'] },

      // ====== 业务运营 ======
      { dimension:'业务运营', group:'knowledge_category', items: ['故障诊断','日常保养','安全须知','校准方法','使用技巧','选购指南','法规解读','案例分析'] },
      { dimension:'业务运营', group:'fault_keyword', items: ['噪音大','温度异常','转速不稳','压力波动','基线漂移','灵敏度下降','重复性差','漏液','报警','无法启动','显示异常','数据丢失','通信故障','制冷失效','真空度不足'] },
      { dimension:'业务运营', group:'contract_type_label', items: ['年度维保合同','校准服务合同','全包服务合同','按次服务合同','设备租赁合同'] },
      { dimension:'业务运营', group:'order_priority', items: ['普通','紧急','严重'] },

      // ====== 组织人员 ======
      { dimension:'组织人员', group:'industry', items: ['制药','生物技术','CRO','体外诊断','学术科研','政府检测','食品检测','环境检测','法医鉴定','畜牧兽医'] },
      { dimension:'组织人员', group:'service_area', items: ['北京','上海','广州','深圳','天津','重庆','杭州','南京','武汉','成都','西安','苏州','青岛','大连','厦门','长沙','郑州','合肥','济南','沈阳','昆明','福州','石家庄','哈尔滨','长春','太原','南昌','南宁','贵阳','兰州','海口','乌鲁木齐','呼和浩特','银川','西宁','拉萨'] },
      { dimension:'组织人员', group:'skill_tag', items: ['离心机','PCR仪','测序仪','质谱仪','色谱仪','光谱仪','酶标仪','显微镜','培养箱','生物安全柜','超低温冰箱','移液器','凝胶成像','核酸提取仪','流式细胞仪','发酵罐','纯水系统','灭菌器','液相色谱','气相色谱','液质联用','气质联用','离子色谱','毛细管电泳','NGS测序','数字PCR','高内涵筛选'] },
      { dimension:'组织人员', group:'certification', items: ['ISO 9001','ISO 13485','ISO 17025','CNAS认可','CMA认证','GMP认证','GSP认证','CE认证','FDA注册','工程师资格证','特种设备操作证','电工证','制冷与空调作业证'] },
      { dimension:'组织人员', group:'department', items: ['质量管理部','研发部','生产部','检验科','病理科','中心实验室','药学部','设备科','科研处'] },

      // ====== 质量合规 ======
      { dimension:'质量合规', group:'maintenance_type', items: ['日常保养','季度保养','年度保养','预防性维护','纠正性维护','安装调试','性能验证','校准检定','巡检','大修'] },
      { dimension:'质量合规', group:'inspection_item', items: ['外观检查','功能测试','性能验证','电气安全','机械安全','清洁消毒','耗材更换','软件升级','校准核查','泄漏检测'] },
      { dimension:'质量合规', group:'calibration_method', items: ['内部校准','外部送检','现场校准','远程校准','自检','比对校准'] },
      { dimension:'质量合规', group:'part_category', items: ['轴承','密封件','过滤器','传感器','灯管','色谱柱','管路','耗材','标准品','润滑油','电路板','电源模块','泵','阀门','电机'] },
      { dimension:'质量合规', group:'part_unit', items: ['个','套','根','米','桶','瓶','盒','箱','卷','袋','支','片','台','卷'] },
    ];

    let count = 0;
    for (const group of data) {
      for (let i = 0; i < group.items.length; i++) {
        const key = group.items[i].replace(/[^a-zA-Z0-9一-龥]/g, '_').toLowerCase().substring(0, 30);
        await Dictionary.upsert({
          dimension: group.dimension,
          dict_group: group.group,
          dict_key: key,
          dict_value: group.items[i],
          sort_order: i + 1
        }, { conflictFields: ['dimension', 'dict_group', 'dict_value'] });
        count++;
      }
    }
    res.json(success({ count }, `已初始化 ${count} 条字典数据`));
  } catch (err) { console.error(err); res.json(fail('初始化失败: ' + err.message)); }
});

module.exports = router;
