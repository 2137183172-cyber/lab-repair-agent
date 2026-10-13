const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const { auth } = require('../middleware/auth');
const { User, Engineer, RepairOrder, Device } = require('../models');
const { success, fail } = require('../utils/response');
require('dotenv').config();

const ENGINEER_REQUIRED_LABELS = {
  name: '姓名',
  phone: '手机号',
  skills: '技能标签',
  service_area: '服务区域'
};

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return toArray(parsed);
    } catch (err) {
      // Fall through to delimiter parsing.
    }
    return text.split(/[,\uFF0C\u3001;\uFF1B]/).map(item => item.trim()).filter(Boolean);
  }
  return [];
}

function toCertifications(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    } catch (err) {
      // Fall through to simple text certificates.
    }
    return toArray(text).map(name => ({ name }));
  }
  return [];
}

function getMissingEngineerFields(profile = {}) {
  const missing = [];
  if (!String(profile.name || '').trim()) missing.push(ENGINEER_REQUIRED_LABELS.name);
  if (!String(profile.phone || '').trim()) missing.push(ENGINEER_REQUIRED_LABELS.phone);
  if (!toArray(profile.skills).length) missing.push(ENGINEER_REQUIRED_LABELS.skills);
  if (!toArray(profile.service_area).length) missing.push(ENGINEER_REQUIRED_LABELS.service_area);
  return missing;
}

function buildEngineerProfile(user, profile = {}, existing = null) {
  const skills = toArray(profile.skills);
  const serviceArea = toArray(profile.service_area);
  const certifications = toCertifications(profile.certifications);
  const type = ['self_employed', 'certified'].includes(profile.type) ? profile.type : (existing?.type || 'certified');

  return {
    user_id: user.id,
    name: String(profile.name || user.name || existing?.name || '工程师').trim(),
    phone: String(profile.phone || user.phone || existing?.phone || '待补充').trim(),
    email: profile.email !== undefined ? profile.email : (existing?.email || ''),
    avatar: profile.avatar !== undefined ? profile.avatar : (user.avatar || existing?.avatar || ''),
    employee_no: profile.employee_no !== undefined ? profile.employee_no : (existing?.employee_no || ''),
    type,
    skills: skills.length ? skills : (existing?.skills || ['仪器维修']),
    service_area: serviceArea.length ? serviceArea : (existing?.service_area || ['待补充']),
    certifications: certifications.length ? certifications : (existing?.certifications || [])
  };
}

async function syncEngineerProfile(user, profile = {}) {
  let engineer = await Engineer.findOne({ where: { user_id: user.id } });
  const engineerData = buildEngineerProfile(user, profile, engineer);

  if (!engineer) {
    engineer = await Engineer.create(engineerData);
  } else {
    await engineer.update(engineerData);
  }

  return engineer;
}

/**
 * POST /api/user/admin-login
 * 管理后台登录 — 用户名+密码验证（bcryptjs）
 * Body: { username, password }
 */
router.post('/admin-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.json(fail('用户名和密码不能为空'));

    // 通过 openid 查找（admin 用户 openid 格式为 'admin_' + username）
    const adminOpenid = 'admin_' + username.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '');
    const user = await User.findOne({ where: { openid: adminOpenid } });

    if (!user) return res.json(fail('用户名或密码错误'));
    if (user.status === 'disabled') return res.json(fail('账户已被禁用'));

    const adminRoles = ['admin', 'manager', 'quality', 'engineer_lead', 'viewer'];
    if (!adminRoles.includes(user.role)) return res.json(fail('无管理后台权限'));

    // bcryptjs 密码验证
    if (!user.password_hash) return res.json(fail('该账户未设置密码，请联系管理员重置'));

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.json(fail('用户名或密码错误'));

    // 更新登录时间
    user.last_login_at = new Date();
    await user.save();

    // 生成JWT
    const token = jwt.sign(
      { id: user.id, openid: user.openid, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json(success({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        company: user.company,
        role: user.role,
        avatar: user.avatar
      }
    }, '登录成功'));
  } catch (err) {
    console.error('[AdminLogin]', err);
    res.json(fail('登录失败'));
  }
});

/**
 * POST /api/user/login
 * 微信登录（仅限小程序端 user/engineer 角色）
 * Body: { code }
 */
router.post('/login', async (req, res) => {
  try {
    const {
      code,
      name,
      phone,
      company,
      role,
      avatar,
      email,
      employee_no,
      type,
      skills,
      service_area,
      certifications
    } = req.body;
    const loginProfile = { name, phone, company, role, avatar, email, employee_no, type, skills, service_area, certifications };
    if (!code) return res.json(fail('缺少登录凭证code'));

    let openid, unionid;

    // 开发模式：使用模拟 openid (绕过微信API)
    if (process.env.WX_APPID === 'your_appid' || process.env.NODE_ENV === 'development') {
      openid = 'dev_' + code.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);
      unionid = '';
      console.log('[DEV] 模拟登录 openid:', openid);
    } else {
      // 调用微信接口获取openid
      const wxRes = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
        params: {
          appid: process.env.WX_APPID,
          secret: process.env.WX_SECRET,
          js_code: code,
          grant_type: 'authorization_code'
        }
      });

      const wxData = wxRes.data;
      if (wxData.errcode) {
        return res.json(fail(`微信登录失败: ${wxData.errmsg}`));
      }
      openid = wxData.openid;
      unionid = wxData.unionid || '';
    }

    // 查找或创建用户
    let user = await User.findOne({ where: { openid } });
    // 开发模式：仅允许 user 和 engineer 角色通过小程序登录（管理员/经理必须用 admin-login）
    const userRole = role || 'user'; // 注册时选择身份：user(维修用户)或engineer(工程师)
    if (!['user', 'engineer'].includes(userRole)) {
      return res.json(fail('管理员账号请使用后台管理系统登录'));
    }

    const demoOpenids = ['dev_demo','dev_eng_test','dev_eng_li','dev_eng_wang'];
    const wantsEngineer = userRole === 'engineer' || user?.role === 'engineer';
    const isNewEngineer = !user && userRole === 'engineer';
    const isPromotingEngineer = !!user && user.role === 'user' && userRole === 'engineer';
    if ((isNewEngineer || isPromotingEngineer) && !demoOpenids.includes(openid)) {
      const requiredProfile = isPromotingEngineer
        ? { ...loginProfile, name: name || user.name, phone: phone || user.phone }
        : loginProfile;
      const missing = getMissingEngineerFields(requiredProfile);
      if (missing.length) return res.json(fail(`工程师注册缺少必填项：${missing.join('、')}`));
    }

    if (!user) {
      // 预置演示账号直接激活，开发环境新用户也直接激活
      const isDemo = demoOpenids.includes(openid) || process.env.NODE_ENV === 'development';
      user = await User.create({
        openid,
        unionid: unionid || '',
        name: name || '微信用户',
        phone: phone || '',
        company: company || '',
        avatar: avatar || '',
        role: userRole,
        status: isDemo ? 'active' : 'pending',
        last_login_at: new Date()
      });
    } else {
      // 更新登录信息和资料
      if (name) user.name = name;
      if (phone) user.phone = phone;
      if (company) user.company = company;
      if (avatar) user.avatar = avatar;
      if (user.role === 'user' && userRole === 'engineer') user.role = 'engineer';
      if (unionid) user.unionid = unionid;
      user.last_login_at = new Date();
      // 开发环境下，自动激活 pending 状态的用户
      if (process.env.NODE_ENV === 'development' && user.status === 'pending') {
        user.status = 'active';
      }
      await user.save();
    }

    const engineerProfile = (wantsEngineer || user.role === 'engineer') && user.status !== 'disabled'
      ? await syncEngineerProfile(user, loginProfile)
      : null;

    if (user.status === 'pending') {
      return res.json(fail('账户审核中，请联系管理员审核'));
    }
    if (user.status === 'disabled') {
      return res.json(fail('账户已被禁用，请联系管理员'));
    }

    // 生成JWT
    const token = jwt.sign(
      { id: user.id, openid: user.openid, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json(success({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        company: user.company,
        role: user.role,
        avatar: user.avatar
      },
      engineer_profile: engineerProfile
    }, '登录成功'));
  } catch (err) {
    console.error('[Login]', err);
    res.json(fail('登录失败'));
  }
});

/**
 * GET /api/user/profile
 * 获取个人信息
 */
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'openid', 'name', 'phone', 'company', 'department', 'avatar', 'role', 'created_at']
    });
    if (!user) return res.json(fail('用户不存在'));
    res.json(success(user));
  } catch (err) {
    res.json(fail('获取失败'));
  }
});

/**
 * PUT /api/user/profile
 * 更新个人信息
 */
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, phone, company, department, address, avatar } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.json(fail('用户不存在'));

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (company !== undefined) user.company = company;
    if (department !== undefined) user.department = department;
    if (address !== undefined) user.address = address;
    if (avatar !== undefined) user.avatar = avatar;
    await user.save();

    res.json(success(user, '更新成功'));
  } catch (err) {
    res.json(fail('更新失败'));
  }
});

/**
 * GET /api/user/orders
 * 获取我的报修工单列表
 * Query: ?status=&page=&pageSize=
 */
router.get('/orders', auth, async (req, res) => {
  try {
    const { status, page = 1, pageSize = 10 } = req.query;
    const where = { user_id: req.user.id };
    // 支持待评价筛选（兼容旧 completed 和新 pending_review 状态）
    if (status === 'review') {
      where.status = ['completed', 'pending_review'];
    } else if (status && status.includes(',')) {
      where.status = status.split(',');
    } else if (status) {
      where.status = status;
    }

    const { count, rows } = await RepairOrder.findAndCountAll({
      where,
      include: [
        { model: require('../models/Device'), as: 'device', attributes: ['id', 'name', 'model', 'brand'] },
        { model: require('../models/Engineer'), as: 'engineer', attributes: ['id', 'name', 'phone', 'rating'] }
      ],
      order: [['created_at', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: parseInt(pageSize)
    });

    res.json(success({ list: rows, total: count, page: parseInt(page), pageSize: parseInt(pageSize) }));
  } catch (err) {
    console.error('[User Orders]', err);
    res.json(fail('获取失败'));
  }
});

/**
 * GET /api/user/dashboard
 * 个人首页数据概览
 */
router.get('/dashboard', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [deviceCount, pendingOrders, totalOrders, pendingReview, confirmedOrders, recentOrder] = await Promise.all([
      Device.count({ where: { user_id: userId, status: 'normal' } }),
      RepairOrder.count({ where: { user_id: userId, status: ['pending', 'accepted', 'diagnosing', 'quoted', 'paid', 'repairing'] } }),
      RepairOrder.count({ where: { user_id: userId } }),
      RepairOrder.count({ where: { user_id: userId, status: ['completed', 'pending_review'] } }),
      RepairOrder.count({ where: { user_id: userId, status: 'confirmed' } }),
      RepairOrder.findOne({
        where: { user_id: userId },
        order: [['created_at', 'DESC']],
        include: [
          { model: Device, as: 'device', attributes: ['id', 'name'] }
        ]
      })
    ]);

    res.json(success({
      device_count: deviceCount,
      pending_orders: pendingOrders,
      total_orders: totalOrders,
      pending_review: pendingReview,
      confirmed_orders: confirmedOrders,
      recent_order: recentOrder
    }));
  } catch (err) {
    res.json(fail('获取失败'));
  }
});

module.exports = router;
