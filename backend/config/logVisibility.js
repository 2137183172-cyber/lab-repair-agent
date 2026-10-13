/**
 * 操作日志可见级别
 * 0 = 所有人(用户/工程师/管理员)
 * 1 = 工程师及以上
 * 2 = 经理及以上
 * 3 = 仅管理员
 */
const LOG_VISIBILITY = {
  // 用户操作 - 所有人可见
  created: 0,
  cancelled: 0,
  confirmed: 0,
  // 工程师操作 - 工程师及以上
  accepted: 1,
  diagnosing: 1,
  started: 1,
  completed: 1,
  bid: 1,
  // 报价相关
  quote_approved: 1,
  quote_rejected: 1,
  quote_draft: 1,
  quoted: 1,
  bid_selected: 1,
  // 管理操作 - 经理及以上
  assigned: 2,
  payment_created: 2,
  paid: 2,
  // 敏感操作 - 仅管理员
  refund: 3,
  settlement_released: 3,
  offline_paid: 3,
};

/**
 * 获取用户角色的可见级别
 */
function getRoleLevel(role) {
  const levels = { user: 0, engineer: 1, engineer_lead: 1, quality: 2, manager: 2, admin: 3 };
  return levels[role] || 0;
}

module.exports = { LOG_VISIBILITY, getRoleLevel };
