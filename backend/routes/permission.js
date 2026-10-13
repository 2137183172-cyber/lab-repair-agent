const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { RolePermission } = require('../models');
const { success, fail } = require('../utils/response');

const ALL_MENUS = [
  { path: '/dashboard', label: '仪表盘', group: '业务运营' },
  { path: '/orders', label: '工单管理', group: '业务运营' },
  { path: '/broker-orders', label: '过程单管理', group: '业务运营' },
  { path: '/devices', label: '设备管理', group: '业务运营' },
  { path: '/customers', label: '客户管理', group: '业务运营' },
  { path: '/companies', label: '集团客户', group: '业务运营' },
  { path: '/calibrations', label: '校准管理', group: '质量合规' },
  { path: '/pm', label: '预防性维护', group: '质量合规' },
  { path: '/audit', label: '审计追踪', group: '质量合规' },
  { path: '/inventory', label: '备件库存', group: '资源管理' },
  { path: '/contracts', label: '服务合同', group: '资源管理' },
  { path: '/knowledge', label: '知识库', group: '资源管理' },
  { path: '/photos', label: '照片库', group: '资源管理' },
  { path: '/categories', label: '产品分类', group: '资源管理' },
  { path: '/users', label: '人员管理', group: '人员管理' },
  { path: '/engineers', label: '工程师管理', group: '人员管理' },
  { path: '/settlements', label: '结算管理', group: '财务结算' },
  { path: '/withdrawals', label: '提现管理', group: '财务结算' },
  { path: '/payments', label: '支付记录', group: '财务结算' },
  { path: '/commission', label: '平台配置', group: '财务结算' },
  { path: '/permissions', label: '权限配置', group: '系统配置' },
  { path: '/dictionaries', label: '数据字典', group: '系统配置' },
];

router.get('/menus', auth, async (req, res) => {
  res.json(success(ALL_MENUS));
});

router.get('/roles', auth, async (req, res) => {
  try {
    const perms = await RolePermission.findAll({ order: [['role', 'ASC'], ['menu_path', 'ASC']] });
    const result = {};
    perms.forEach(p => {
      if (!result[p.role]) result[p.role] = {};
      result[p.role][p.menu_path] = p.access;
    });
    res.json(success(result));
  } catch (err) {
    res.json(fail('获取失败'));
  }
});

router.get('/my', auth, async (req, res) => {
  try {
    const perms = await RolePermission.findAll({ where: { role: req.user.role } });
    const menuOrder = Object.fromEntries(ALL_MENUS.map((m, i) => [m.path, i]));
    const menus = perms
      .filter(p => p.access !== 'none')
      .map(p => {
        const menu = ALL_MENUS.find(m => m.path === p.menu_path);
        return {
          path: p.menu_path,
          access: p.access,
          label: menu?.label || p.menu_path,
          group: menu?.group || ''
        };
      })
      .sort((a, b) => (menuOrder[a.path] ?? 99) - (menuOrder[b.path] ?? 99));
    res.json(success(menus));
  } catch (err) {
    res.json(fail('获取失败'));
  }
});

router.put('/save', auth, requireRole('admin'), async (req, res) => {
  try {
    const { role, permissions } = req.body;
    if (!role || !permissions) return res.json(fail('参数错误'));

    for (const [menu_path, access] of Object.entries(permissions)) {
      await RolePermission.upsert({ role, menu_path, access });
    }
    res.json(success(null, '保存成功'));
  } catch (err) {
    console.error('[Perm Save]', err);
    res.json(fail('保存失败'));
  }
});

router.post('/seed', auth, requireRole('admin'), async (req, res) => {
  try {
    const defaultPerms = {
      admin: {
        '/dashboard': 'full', '/orders': 'full', '/broker-orders': 'full', '/devices': 'full',
        '/engineers': 'full', '/users': 'full', '/inventory': 'full', '/knowledge': 'full',
        '/contracts': 'full', '/companies': 'full', '/calibrations': 'full', '/pm': 'full',
        '/audit': 'full', '/permissions': 'full', '/dictionaries': 'full', '/photos': 'full',
        '/settlements': 'full', '/withdrawals': 'full', '/payments': 'full', '/commission': 'full',
        '/customers': 'full', '/categories': 'full'
      },
      manager: {
        '/dashboard': 'full', '/orders': 'full', '/broker-orders': 'full', '/devices': 'full',
        '/engineers': 'full', '/users': 'full', '/inventory': 'view', '/knowledge': 'full',
        '/contracts': 'full', '/companies': 'none', '/calibrations': 'none', '/pm': 'none',
        '/audit': 'none', '/settlements': 'full', '/withdrawals': 'full', '/payments': 'view',
        '/commission': 'none', '/customers': 'full', '/categories': 'view'
      },
      quality: {
        '/dashboard': 'full', '/orders': 'view', '/broker-orders': 'none', '/devices': 'view',
        '/engineers': 'none', '/users': 'none', '/inventory': 'none', '/knowledge': 'full',
        '/contracts': 'view', '/companies': 'none', '/calibrations': 'full', '/pm': 'full',
        '/audit': 'full'
      },
      engineer_lead: {
        '/dashboard': 'full', '/orders': 'full', '/broker-orders': 'view', '/devices': 'view',
        '/engineers': 'full', '/users': 'none', '/inventory': 'full', '/knowledge': 'full',
        '/contracts': 'none', '/companies': 'none', '/calibrations': 'view', '/pm': 'full',
        '/audit': 'none'
      },
      viewer: {
        '/dashboard': 'view', '/orders': 'view', '/broker-orders': 'none', '/devices': 'view',
        '/engineers': 'none', '/users': 'none', '/inventory': 'none', '/knowledge': 'view',
        '/contracts': 'none', '/companies': 'none', '/calibrations': 'none', '/pm': 'none',
        '/audit': 'none'
      },
    };
    for (const [role, perms] of Object.entries(defaultPerms)) {
      for (const [path, access] of Object.entries(perms)) {
        await RolePermission.upsert({ role, menu_path: path, access });
      }
    }
    res.json(success(null, '默认权限已初始化'));
  } catch (err) {
    res.json(fail('初始化失败'));
  }
});

module.exports = router;
