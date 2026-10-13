const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const sequelize = require('./config/db');

// 路由模块
const userRoutes = require('./routes/user');
const engineerRoutes = require('./routes/engineer');
const deviceRoutes = require('./routes/device');
const orderRoutes = require('./routes/order');
const uploadRoutes = require('./routes/upload');
const statsRoutes = require('./routes/stats');
const adminRoutes = require('./routes/admin');
const inventoryRoutes = require('./routes/inventory');
const knowledgeRoutes = require('./routes/knowledge');
const contractRoutes = require('./routes/contract');
const companyRoutes = require('./routes/company');
const calibrationRoutes = require('./routes/calibration');
const pmRoutes = require('./routes/pm');
const auditRoutes = require('./routes/audit');
const permissionRoutes = require('./routes/permission');
const dictionaryRoutes = require('./routes/dictionary');
const quoteRoutes = require('./routes/quote');
const marketplaceRoutes = require('./routes/marketplace');
const paymentRoutes = require('./routes/payment');
const settlementRoutes = require('./routes/settlement');
const walletRoutes = require('./routes/wallet');
const settingsRoutes = require('./routes/settings');
const favoriteRoutes = require('./routes/favorite');
const subscriptionRoutes = require('./routes/subscription');
const brokerRoutes = require('./routes/broker');

const app = express();

// ======= 中间件 =======
const devCorsOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  const allowed = [
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
    /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
    /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
    /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/
  ].some((pattern) => pattern.test(origin));
  callback(allowed ? null : new Error(`CORS blocked origin: ${origin}`), allowed);
};

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://admin.your-domain.com', 'https://your-domain.com']
    : devCorsOrigin,
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ======= 速率限制 =======
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1分钟
  max: 100,                   // 最多100次请求
  message: { code: 429, message: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1分钟
  max: 10,                    // 登录接口最多10次
  message: { code: 429, message: '登录请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', generalLimiter);
app.use('/api/user/login', authLimiter);
app.use('/api/user/admin-login', authLimiter);
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ======= 静态文件 =======
app.use('/uploads', express.static('uploads'));

// ======= API路由 =======
app.use('/api/user', userRoutes);
app.use('/api/engineer', engineerRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/contract', contractRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/calibration', calibrationRoutes);
app.use('/api/pm', pmRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/permission', permissionRoutes);
app.use('/api/dictionary', dictionaryRoutes);
app.use('/api/quote', quoteRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/settlement', settlementRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/favorite', favoriteRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/broker', brokerRoutes);

// ======= 根路径 =======
app.get('/', (req, res) => {
  res.json({
    code: 200,
    name: '智荟华科仪器维修 API',
    version: 'v4.1',
    docs: '/api/health',
    apis: [
      'POST /api/user/login        - 微信登录',
      'GET  /api/user/profile      - 个人信息',
      'POST /api/order/create      - 创建工单',
      'GET  /api/order/list        - 工单列表(管理端)',
      'GET  /api/order/detail/:id  - 工单详情',
      'POST /api/device/create     - 添加设备',
      'GET  /api/device/list       - 设备列表',
      'POST /api/upload/image      - 上传图片',
      'GET  /api/stats/dashboard   - 数据仪表盘',
      'GET  /api/engineer/order-pool - 工单池',
    ]
  });
});

// ======= 健康检查 =======
app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: '智荟华科仪器维修 API v4.1', time: new Date() });
});

// ======= 404 =======
app.use((req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在' });
});

// ======= 全局错误处理 =======
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? '服务器内部错误'
    : (err.message || '服务器内部错误');
  res.status(status).json({ code: status, message });
});

// ======= 启动服务器 =======
const PORT = process.env.PORT || 3000;

// T+N 结算自动释放
async function autoReleaseSettlements() {
  const t = await sequelize.transaction();
  try {
    const { Settlement, Engineer, OrderLog } = require('./models');

    // 使用 SELECT ... FOR UPDATE 锁定待释放的结算记录，防止并发重复释放
    const held = await Settlement.findAll({
      where: { status: 'held', recipient_type: 'engineer' },
      lock: t.LOCK.UPDATE,
      transaction: t
    });

    let released = 0;
    for (const s of held) {
      const settleAt = new Date(s.settle_at).getTime();
      if (settleAt <= Date.now()) {
        s.status = 'released';
        s.released_at = new Date();
        await s.save({ transaction: t });

        const amount = parseFloat(s.engineer_amount);
        await sequelize.query(
          'UPDATE engineers SET balance = balance + :amount, frozen_balance = GREATEST(0, frozen_balance - :amount), total_earned = total_earned + :amount WHERE id = :id',
          { replacements: { amount, id: s.recipient_id }, type: sequelize.QueryTypes.UPDATE, transaction: t }
        );

        await OrderLog.create({
          order_id: s.order_id, operator_id: 0,
          operator_type: 'system', action: 'settlement_auto_released',
          detail: `T+N到期自动释放结算 ${s.settlement_no}，金额 ¥${amount}`
        }, { transaction: t });
        released++;
      }
    }

    await t.commit();
    if (released > 0) console.log(`[Scheduler] 自动释放 ${released} 笔冻结结算`);
  } catch (err) {
    await t.rollback();
    console.error('[Scheduler] 结算自动释放失败:', err.message);
  }
}

function startAutoReleaseScheduler() {
  // 启动后30秒首次运行（等模型同步完），之后每5分钟
  setTimeout(() => {
    autoReleaseSettlements();
    setInterval(autoReleaseSettlements, 5 * 60 * 1000);
  }, 30000);
}

async function start() {
  try {
    // 连接数据库
    await sequelize.authenticate();
    console.log('[DB] 数据库连接成功');

    // 同步模型（生产环境应使用migration）
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: false });
      console.log('[DB] 模型同步完成');
    }

    app.listen(PORT, () => {
      console.log(`[Server] 智荟华科仪器维修 API 已启动: http://localhost:${PORT}`);
      console.log(`[Server] 环境: ${process.env.NODE_ENV || 'development'}`);

      // 启动 T+N 结算自动释放定时任务（每5分钟检查一次）
      startAutoReleaseScheduler();
    });
  } catch (err) {
    console.error('[Error] 启动失败:', err);
    process.exit(1);
  }
}

start();
