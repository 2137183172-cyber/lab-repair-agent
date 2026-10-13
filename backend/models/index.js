/**
 * 模型关联关系定义 - 智荟华科仪器维修平台 v4.0
 */
const User = require('./User');
const Engineer = require('./Engineer');
const DeviceCategory = require('./DeviceCategory');
const Device = require('./Device');
const RepairOrder = require('./RepairOrder');
const RepairRecord = require('./RepairRecord');
const OrderComment = require('./OrderComment');
const OrderLog = require('./OrderLog');
const Notification = require('./Notification');
const MaintenanceRecord = require('./MaintenanceRecord');
const PartsInventory = require('./PartsInventory');
const KnowledgeArticle = require('./KnowledgeArticle');
const ServiceContract = require('./ServiceContract');
const Company = require('./Company');
const Calibration = require('./Calibration');
const { PMPlan, PMRecord } = require('./PreventiveMaintenance');
const { AuditLog, ESignature } = require('./AuditLog');
const RolePermission = require('./RolePermission');
const Dictionary = require('./Dictionary');
const UploadFile = require('./UploadFile');
const Quotation = require('./Quotation');
const Payment = require('./Payment');
const Settlement = require('./Settlement');
const Withdrawal = require('./Withdrawal');
const EngineerBid = require('./EngineerBid');
const PlatformSetting = require('./PlatformSetting');
const StockTransaction = require('./StockTransaction');

// =====  公司 ↔ 用户 =====
Company.hasMany(User, { foreignKey: 'company_id', as: 'users' });
User.belongsTo(Company, { foreignKey: 'company_id', as: 'tenant' });

// =====  公司 ↔ 设备 =====
Company.hasMany(Device, { foreignKey: 'company_id', as: 'devices' });
Device.belongsTo(Company, { foreignKey: 'company_id', as: 'tenant' });

// =====  公司 ↔ 工单 =====
Company.hasMany(RepairOrder, { foreignKey: 'company_id', as: 'orders' });
RepairOrder.belongsTo(Company, { foreignKey: 'company_id', as: 'tenant' });

// =====  用户 ↔ 设备 =====
User.hasMany(Device, { foreignKey: 'user_id', as: 'devices' });
Device.belongsTo(User, { foreignKey: 'user_id', as: 'owner' });

// =====  用户 ↔ 工单 =====
User.hasMany(RepairOrder, { foreignKey: 'user_id', as: 'repair_orders' });
RepairOrder.belongsTo(User, { foreignKey: 'user_id', as: 'reporter' });

// =====  设备 ↔ 工单 =====
Device.hasMany(RepairOrder, { foreignKey: 'device_id', as: 'repair_orders' });
RepairOrder.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

// =====  工程师 ↔ 工单 =====
Engineer.hasMany(RepairOrder, { foreignKey: 'engineer_id', as: 'orders' });
RepairOrder.belongsTo(Engineer, { foreignKey: 'engineer_id', as: 'engineer' });

// =====  工单 ↔ 维修记录 =====
RepairOrder.hasOne(RepairRecord, { foreignKey: 'order_id', as: 'repair_record' });
RepairRecord.belongsTo(RepairOrder, { foreignKey: 'order_id', as: 'order' });

// =====  工单 ↔ 评价 =====
RepairOrder.hasOne(OrderComment, { foreignKey: 'order_id', as: 'comment' });
OrderComment.belongsTo(RepairOrder, { foreignKey: 'order_id', as: 'order' });

// =====  工单 ↔ 操作日志 =====
RepairOrder.hasMany(OrderLog, { foreignKey: 'order_id', as: 'logs' });
OrderLog.belongsTo(RepairOrder, { foreignKey: 'order_id', as: 'order' });

// =====  设备 ↔ 分类 =====
DeviceCategory.hasMany(Device, { foreignKey: 'category_id', as: 'devices' });
Device.belongsTo(DeviceCategory, { foreignKey: 'category_id', as: 'category' });

// =====  分类 ↔ PM模板 =====
DeviceCategory.hasMany(PMPlan, { foreignKey: 'instrument_type', as: 'pm_templates' });
PMPlan.belongsTo(DeviceCategory, { foreignKey: 'instrument_type', as: 'instrument_category' });

// =====  用户 ↔ 通知 =====
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// =====  设备 ↔ 保养/巡检记录 =====
Device.hasMany(MaintenanceRecord, { foreignKey: 'device_id', as: 'maintenance_records' });
MaintenanceRecord.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

// =====  用户 ↔ 服务合同 =====
User.hasMany(ServiceContract, { foreignKey: 'user_id', as: 'contracts' });
ServiceContract.belongsTo(User, { foreignKey: 'user_id', as: 'client' });

// =====  设备 ↔ 校准记录 =====
Device.hasMany(Calibration, { foreignKey: 'device_id', as: 'calibrations' });
Calibration.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

// =====  设备 ↔ PM =====
Device.hasMany(PMPlan, { foreignKey: 'device_id', as: 'pm_plans' });
PMPlan.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });
Device.hasMany(PMRecord, { foreignKey: 'device_id', as: 'pm_records' });
PMRecord.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });
PMPlan.hasMany(PMRecord, { foreignKey: 'plan_id', as: 'records' });
PMRecord.belongsTo(PMPlan, { foreignKey: 'plan_id', as: 'plan' });

// =====  审计日志 & 电子签名 =====
User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'audit_logs' });
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'operator' });
User.hasMany(ESignature, { foreignKey: 'user_id', as: 'signatures' });
ESignature.belongsTo(User, { foreignKey: 'user_id', as: 'signer' });

// =====  工单 ↔ 报价单 =====
RepairOrder.hasMany(Quotation, { foreignKey: 'order_id', as: 'quotations' });
Quotation.belongsTo(RepairOrder, { foreignKey: 'order_id', as: 'order' });

// =====  用户 ↔ 报价单（创建人） =====
User.hasMany(Quotation, { foreignKey: 'created_by', as: 'created_quotations' });
Quotation.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// =====  用户 ↔ 报价单（审批人） =====
User.hasMany(Quotation, { foreignKey: 'approved_by', as: 'approved_quotations' });
Quotation.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });

// =====  工单 ↔ 支付 =====
RepairOrder.hasMany(Payment, { foreignKey: 'order_id', as: 'payments' });
Payment.belongsTo(RepairOrder, { foreignKey: 'order_id', as: 'order' });
Payment.belongsTo(Quotation, { foreignKey: 'quotation_id', as: 'quotation' });

// =====  支付 ↔ 结算 =====
Payment.hasMany(Settlement, { foreignKey: 'payment_id', as: 'settlements' });
Settlement.belongsTo(Payment, { foreignKey: 'payment_id', as: 'payment' });

// =====  工程师 ↔ 结算 =====
Engineer.hasMany(Settlement, { foreignKey: 'recipient_id', as: 'settlements' });
Settlement.belongsTo(Engineer, { foreignKey: 'recipient_id', as: 'recipient' });

// =====  工程师 ↔ 提现 =====
Engineer.hasMany(Withdrawal, { foreignKey: 'engineer_id', as: 'withdrawals' });
Withdrawal.belongsTo(Engineer, { foreignKey: 'engineer_id', as: 'engineer' });

// =====  工单 ↔ 竞标 =====
RepairOrder.hasMany(EngineerBid, { foreignKey: 'order_id', as: 'bids' });
EngineerBid.belongsTo(RepairOrder, { foreignKey: 'order_id', as: 'order' });

// =====  工程师 ↔ 竞标 =====
Engineer.hasMany(EngineerBid, { foreignKey: 'engineer_id', as: 'bids' });
EngineerBid.belongsTo(Engineer, { foreignKey: 'engineer_id', as: 'engineer' });

// =====  配件 ↔ 库存流水 =====
PartsInventory.hasMany(StockTransaction, { foreignKey: 'part_id', as: 'transactions' });
StockTransaction.belongsTo(PartsInventory, { foreignKey: 'part_id', as: 'part' });

// =====  报价单 ↔ 竞标 =====
Quotation.hasOne(EngineerBid, { foreignKey: 'quotation_id', as: 'bid' });
EngineerBid.belongsTo(Quotation, { foreignKey: 'quotation_id', as: 'quotation' });

module.exports = {
  User, Engineer, DeviceCategory, Device,
  RepairOrder, RepairRecord, OrderComment, OrderLog,
  Notification, MaintenanceRecord, PartsInventory, KnowledgeArticle,
  ServiceContract, Company, Calibration, PMPlan, PMRecord, AuditLog, ESignature,
  RolePermission, Dictionary, UploadFile, Quotation,
  Payment, Settlement, Withdrawal, EngineerBid, PlatformSetting, StockTransaction
};
