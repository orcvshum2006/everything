const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');
const { promisify } = require('util');

// 数据库文件路径
const DB_PATH = path.join(__dirname, '../data/duty-schedule.db');

// 确保数据目录存在
fs.ensureDirSync(path.dirname(DB_PATH));

// 创建数据库连接
const db = new sqlite3.Database(DB_PATH);

// 将sqlite3方法转换为Promise
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

// 启用外键约束支持
db.run('PRAGMA foreign_keys = ON');
console.log('✅ 外键约束已启用');

// 创建表结构
const createTables = async () => {
  try {
    // 人员表
    await dbRun(`
      CREATE TABLE IF NOT EXISTS people (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        email TEXT,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 排班记录表
    await dbRun(`
      CREATE TABLE IF NOT EXISTS duty_records (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        person_id TEXT,
        person_name TEXT,
        type TEXT NOT NULL CHECK (type IN ('auto', 'manual', 'swap', 'replacement', 'suspended')),
        original_person_id TEXT,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        FOREIGN KEY (person_id) REFERENCES people (id) ON DELETE CASCADE
      )
    `);

    // 换班申请表
    await dbRun(`
      CREATE TABLE IF NOT EXISTS swap_requests (
        id TEXT PRIMARY KEY,
        from_person_id TEXT NOT NULL,
        to_person_id TEXT NOT NULL,
        from_date TEXT NOT NULL,
        to_date TEXT NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        approved_at DATETIME,
        FOREIGN KEY (from_person_id) REFERENCES people (id) ON DELETE CASCADE,
        FOREIGN KEY (to_person_id) REFERENCES people (id) ON DELETE CASCADE
      )
    `);

    // 请假记录表
    await dbRun(`
      CREATE TABLE IF NOT EXISTS leave_records (
        id TEXT PRIMARY KEY,
        person_id TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        reason TEXT,
        type TEXT NOT NULL DEFAULT 'other' CHECK (type IN ('sick', 'vacation', 'personal', 'other')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (person_id) REFERENCES people (id) ON DELETE CASCADE
      )
    `);

    // 系统配置表
    await dbRun(`
      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 排班规则表（存储JSON）
    await dbRun(`
      CREATE TABLE IF NOT EXISTS duty_rules (
        id INTEGER PRIMARY KEY DEFAULT 1,
        max_consecutive_days INTEGER DEFAULT 3,
        min_rest_days INTEGER DEFAULT 1,
        exclude_weekends BOOLEAN DEFAULT 0,
        exclude_holidays BOOLEAN DEFAULT 0,
        fairness_weight REAL DEFAULT 0.8,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ 数据库表结构创建成功');
  } catch (error) {
    console.error('❌ 创建表结构失败:', error);
    throw error;
  }
};

// 创建索引以提高查询性能
const createIndexes = async () => {
  try {
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_duty_records_date ON duty_records (date)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_duty_records_person_id ON duty_records (person_id)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_duty_records_type ON duty_records (type)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_people_active ON people (is_active)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_people_order ON people (order_index)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_swap_requests_status ON swap_requests (status)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_leave_records_person ON leave_records (person_id)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_leave_records_dates ON leave_records (start_date, end_date)`);

    console.log('✅ 数据库索引创建成功');
  } catch (error) {
    console.error('❌ 创建索引失败:', error);
    throw error;
  }
};

// 插入默认配置
const insertDefaultConfig = async () => {
  try {
    const configs = [
      { key: 'start_date', value: new Date().toISOString().split('T')[0] },
      { key: 'last_updated', value: new Date().toISOString() },
      { key: 'version', value: '2.0.0' }
    ];

    for (const config of configs) {
      await dbRun(
        `INSERT OR IGNORE INTO system_config (key, value) VALUES (?, ?)`,
        [config.key, config.value]
      );
    }

    // 插入默认排班规则
    await dbRun(`INSERT OR IGNORE INTO duty_rules (id) VALUES (1)`);

    console.log('✅ 默认配置插入成功');
  } catch (error) {
    console.error('❌ 插入默认配置失败:', error);
    throw error;
  }
};

// 初始化数据库
const initDatabase = async () => {
  try {
    console.log('🚀 开始初始化数据库...');
    await createTables();
    await createIndexes();
    await insertDefaultConfig();
    console.log('✅ 数据库初始化完成');
    return db;
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  }
};

// 关闭数据库连接
const closeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        console.error('❌ 关闭数据库失败:', err);
        reject(err);
      } else {
        console.log('✅ 数据库连接已关闭');
        resolve();
      }
    });
  });
};

// 导出数据库连接和操作函数
module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll,
  initDatabase,
  closeDatabase
};

// 如果直接运行此文件，则初始化数据库
if (require.main === module) {
  initDatabase()
    .then(() => {
      console.log('🎉 数据库初始化脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 数据库初始化失败:', error);
      process.exit(1);
    });
} 