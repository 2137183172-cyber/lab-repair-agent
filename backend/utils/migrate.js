/**
 * 数据库迁移工具
 * 用法: node utils/migrate.js
 * 按顺序执行所有SQL文件：init.sql + 迁移文件
 */
const fs = require('fs');
const path = require('path');
const sequelize = require('../config/db');

async function migrate() {
  const sqlDir = path.join(__dirname, '..', 'sql');

  if (!fs.existsSync(sqlDir)) {
    console.error('[Migrate] sql 目录不存在');
    process.exit(1);
  }

  // 收集所有 .sql 文件并按名称排序（init.sql 优先，然后按文件名）
  const sqlFiles = fs.readdirSync(sqlDir)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => {
      // init.sql 始终第一个
      if (a === 'init.sql') return -1;
      if (b === 'init.sql') return 1;
      return a.localeCompare(b);
    });

  if (sqlFiles.length === 0) {
    console.error('[Migrate] sql 目录下没有 .sql 文件');
    process.exit(1);
  }

  console.log(`[Migrate] 发现 ${sqlFiles.length} 个迁移文件: ${sqlFiles.join(', ')}`);

  try {
    await sequelize.authenticate();
    console.log('[Migrate] 数据库连接成功');

    for (const file of sqlFiles) {
      const filePath = path.join(sqlDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      // 按分号分割，过滤空语句和纯注释行
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && s !== '');

      console.log(`\n[Migrate] 执行 ${file} (${statements.length} 条语句):`);
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        try {
          await sequelize.query(stmt);
          const preview = stmt.substring(0, 60).replace(/\n/g, ' ');
          console.log(`  [${i + 1}/${statements.length}] ${preview}... ✓`);
        } catch (err) {
          // 忽略表已存在、重复键等可安全跳过的错误
          if (err.original && (err.original.errno === 1050 || err.original.errno === 1062 || err.original.errno === 1060 || err.original.errno === 1061)) {
            console.log(`  [${i + 1}/${statements.length}] (已存在，跳过)`);
          } else {
            console.warn(`  [${i + 1}/${statements.length}] 警告: ${err.message}`);
          }
        }
      }
    }

    console.log('\n[Migrate] 数据库迁移完成');
  } catch (err) {
    console.error('[Migrate] 失败:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
