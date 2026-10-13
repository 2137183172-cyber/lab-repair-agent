/**
 * 角色权限配置 - 智荟华科管理后台
 */
export const ROLES = {
  admin:           { label: '超级管理员', level: 100 },
  manager:         { label: '运营经理',   level: 80 },
  quality:         { label: '质量负责人', level: 60 },
  engineer_lead:   { label: '工程师组长', level: 50 },
  viewer:          { label: '只读用户',   level: 10 },
};

// 每个菜单项需要的权限: { menu: requiredRole }
// 角色 level >= requiredRole level 才能看到
export const MENU_PERMISSIONS = {
  '/dashboard':    { minLevel: 10,  label: '仪表盘',       icon: 'DataBoard' },
  '/orders':       { minLevel: 10,  label: '工单管理',     icon: 'Document' },
  '/devices':      { minLevel: 10,  label: '设备管理',     icon: 'Cpu' },
  '/engineers':    { minLevel: 50,  label: '工程师管理',   icon: 'UserFilled' },
  '/users':        { minLevel: 80,  label: '用户管理',     icon: 'Avatar' },
  '/inventory':    { minLevel: 50,  label: '备件库存',     icon: 'Box' },
  '/knowledge':    { minLevel: 10,  label: '知识库',       icon: 'Reading' },
  '/contracts':    { minLevel: 60,  label: '服务合同',     icon: 'Tickets' },
  '/companies':    { minLevel: 100, label: '集团客户',     icon: 'OfficeBuilding' },
  '/calibrations': { minLevel: 50,  label: '校准管理',     icon: 'SetUp' },
  '/pm':           { minLevel: 50,  label: '预防性维护',   icon: 'Tools' },
  '/audit':        { minLevel: 60,  label: '审计追踪',     icon: 'List' },
  '/categories':   { minLevel: 50,  label: '设备分类',     icon: 'Grid' },
  '/customers':    { minLevel: 50,  label: '客户管理',     icon: 'User' },
  '/permissions':  { minLevel: 100, label: '权限配置',     icon: 'Key' },
  '/dictionaries': { minLevel: 80,  label: '数据字典',     icon: 'Collection' },
  '/photos':       { minLevel: 50,  label: '照片库',       icon: 'Picture' },
  '/settlements':  { minLevel: 80,  label: '结算管理',     icon: 'Coin' },
  '/withdrawals':  { minLevel: 80,  label: '提现管理',     icon: 'Money' },
  '/payments':     { minLevel: 60,  label: '支付记录',     icon: 'Wallet' },
  '/commission':   { minLevel: 100, label: '平台配置',     icon: 'Setting' },
};

// 操作级权限
export const ACTION_PERMISSIONS = {
  'order.assign':    { minLevel: 50, label: '派单' },
  'order.cancel':    { minLevel: 50, label: '取消工单' },
  'user.disable':    { minLevel: 80, label: '禁用用户' },
  'user.create':     { minLevel: 100, label: '创建用户' },
  'company.create':  { minLevel: 100, label: '创建公司' },
  'inventory.inout': { minLevel: 50, label: '出入库' },
  'knowledge.publish': { minLevel: 50, label: '发布文章' },
  'contract.create': { minLevel: 60, label: '创建合同' },
  'calibration.manage': { minLevel: 50, label: '管理校准' },
  'pm.manage':       { minLevel: 50, label: '管理PM' },
  'export':          { minLevel: 50, label: '导出数据' },
};

export function getUserRole(userInfo) {
  return userInfo?.role || 'viewer';
}

export function getRoleLevel(role) {
  return ROLES[role]?.level || 0;
}

export function canAccess(role, minLevel) {
  return getRoleLevel(role) >= minLevel;
}

export function getVisibleMenus(role) {
  const level = getRoleLevel(role);
  return Object.entries(MENU_PERMISSIONS)
    .filter(([_, v]) => level >= v.minLevel)
    .map(([path, v]) => ({ path, ...v }));
}
