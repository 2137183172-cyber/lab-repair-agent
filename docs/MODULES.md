# 可展示工程模块

## 业务状态与执行边界

- 输入：已认证角色、工单当前状态、报价及付款相关记录。
- 设计：工程师建档、支付后开修、完工待验收，以及协调方状态。
- 输出：业务状态和操作记录。
- 源码：[order.js](../backend/routes/order.js)、[user.js](../backend/routes/user.js)、[broker.js](../backend/routes/broker.js)、[auth.js](../backend/middleware/auth.js)。
- 边界：源码存在不等于状态机完整正确；统一工具接口、并发与幂等验证尚待建设。公开版没有验证真实支付链路。

## 工程师匹配与竞标

- 输入：工单需求、技能、服务区域、工程师与报价。
- 设计：规则评分、竞标记录、选标及角色可见性。
- 输出：候选、分项匹配信息和报价选择结果。
- 源码：[marketplace.js](../backend/routes/marketplace.js)、[EngineerBid.js](../backend/models/EngineerBid.js)、[Quotation.js](../backend/models/Quotation.js)。
- 边界：当前是规则与业务流程实现；没有证实匹配效果优于人工，没有自动 LLM 选标。

## 配套工程

管理端和 uni-app 为不同角色提供操作入口；Sequelize 模型表达工单、设备、报价与相关业务对象。前端构建已验证，数据库完整业务链路仍待独立环境验证。

这些模块共同构成未来 Agent 工具层的基础，不作为已实现的多 Agent 系统宣传。
