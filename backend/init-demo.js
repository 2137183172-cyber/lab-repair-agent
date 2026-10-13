// Run only against a new, local demo database. No production data or default password.
require('dotenv').config();
const sequelize = require('./config/db');
const { User } = require('./models');
const bcrypt = require('bcryptjs');
async function main() {
  if (!['127.0.0.1', 'localhost'].includes(process.env.DB_HOST) || process.env.DB_NAME !== 'lab_repair_demo') throw new Error('Use localhost and the lab_repair_demo database.');
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) throw new Error('Set ADMIN_PASSWORD to at least 12 characters.');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('Set JWT_SECRET to at least 32 random characters.');
  await sequelize.authenticate();
  await sequelize.sync();
  await User.findOrCreate({ where: {openid: 'admin_admin'}, defaults: {name: 'Demo administrator', phone: '13000000000', role: 'admin', status: 'active', password_hash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12)} });
  console.log('Demo schema ready. Existing tables and accounts were not overwritten.');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => sequelize.close());
