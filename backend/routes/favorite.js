const router = require('express').Router();
const { auth } = require('../middleware/auth');
const sequelize = require('../config/db');
const { success, fail, parsePagination } = require('../utils/response');

// ===== 收藏工程师 =====
router.post('/:engineerId', auth, async (req, res) => {
  try {
    const { engineerId } = req.params;
    const [result] = await sequelize.query(
      'INSERT IGNORE INTO favorites (user_id, engineer_id, created_at) VALUES (?, ?, NOW())',
      { replacements: [req.user.id, parseInt(engineerId)], type: sequelize.QueryTypes.INSERT }
    );
    res.json(success({ favorited: true }, '已收藏'));
  } catch (err) {
    res.json(fail('收藏失败'));
  }
});

// ===== 取消收藏 =====
router.delete('/:engineerId', auth, async (req, res) => {
  try {
    await sequelize.query(
      'DELETE FROM favorites WHERE user_id = ? AND engineer_id = ?',
      { replacements: [req.user.id, parseInt(req.params.engineerId)], type: sequelize.QueryTypes.DELETE }
    );
    res.json(success({ favorited: false }, '已取消收藏'));
  } catch (err) {
    res.json(fail('取消失败'));
  }
});

// ===== 我的收藏列表 =====
router.get('/list', auth, async (req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT f.id, f.engineer_id, f.created_at, e.name, e.type, e.skills, e.service_area,
              e.rating, e.rating_response, e.rating_skill, e.rating_attitude, e.rating_price,
              e.good_rate, e.review_count, e.total_orders, e.completed_orders, e.status
       FROM favorites f JOIN engineers e ON f.engineer_id = e.id
       WHERE f.user_id = ? ORDER BY f.created_at DESC`,
      { replacements: [req.user.id], type: sequelize.QueryTypes.SELECT }
    );
    res.json(success(rows));
  } catch (err) {
    res.json(fail('获取失败'));
  }
});

module.exports = router;
