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

// 模拟better-sqlite3的同步API
const dbPrepare = (sql) => {
  return {
    run: (...params) => {
      try {
        const stmt = db.prepare(sql);
        return stmt.run(...params);
      } catch (error) {
        // 同步运行，抛出错误
        throw error;
      }
    },
    get: (...params) => {
      try {
        const stmt = db.prepare(sql);
        return stmt.get(...params);
      } catch (error) {
        throw error;
      }
    },
    all: (...params) => {
      try {
        const stmt = db.prepare(sql);
        return stmt.all(...params);
      } catch (error) {
        throw error;
      }
    }
  };
};

// 创建表结构
const createTables = () => {
  // 人员表
  db.run(`
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
  db.run(`
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
  db.run(`
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
  db.run(`
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
  db.run(`
    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 排班规则表（存储JSON）
  db.run(`
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
};

// 创建索引以提高查询性能
const createIndexes = () => {
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_duty_records_date ON duty_records (date);
    CREATE INDEX IF NOT EXISTS idx_duty_records_person_id ON duty_records (person_id);
    CREATE INDEX IF NOT EXISTS idx_duty_records_type ON duty_records (type);
    CREATE INDEX IF NOT EXISTS idx_people_active ON people (is_active);
    CREATE INDEX IF NOT EXISTS idx_people_order ON people (order_index);
    CREATE INDEX IF NOT EXISTS idx_swap_requests_status ON swap_requests (status);
    CREATE INDEX IF NOT EXISTS idx_leave_records_person ON leave_records (person_id);
    CREATE INDEX IF NOT EXISTS idx_leave_records_dates ON leave_records (start_date, end_date);
  `);

  console.log('✅ 数据库索引创建成功');
};

// 插入默认配置
const insertDefaultConfig = () => {
  const configs = [
    { key: 'start_date', value: new Date().toISOString().split('T')[0] },
    { key: 'last_updated', value: new Date().toISOString() },
    { key: 'version', value: '2.0.0' }
  ];

  const insertConfig = dbPrepare(`
    INSERT OR IGNORE INTO system_config (key, value) VALUES (?, ?)
  `);

  for (const config of configs) {
    insertConfig.run(config.key, config.value);
  }

  // 插入默认排班规则
  db.run(`
    INSERT OR IGNORE INTO duty_rules (id) VALUES (1)
  `);

  console.log('✅ 默认配置插入成功');
};

// 数据库迁移 - 处理schema变更
const migrateDatabase = () => {
  try {
    // 检查是否需要迁移duty_records表
    const tableInfo = db.get(`
      PRAGMA table_info(duty_records)
    `);
    
    if (tableInfo && tableInfo.notnull === 1) {
      console.log('🔄 检测到duty_records表需要迁移，正在更新schema...');
      
      // 备份现有数据
      db.run(`
        CREATE TABLE IF NOT EXISTS duty_records_backup AS 
        SELECT * FROM duty_records
      `);
      
      // 删除原表
      db.run('DROP TABLE duty_records');
      
      // 重新创建表（使用新的schema）
      db.run(`
        CREATE TABLE duty_records (
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
      
      // 恢复数据
      db.run(`
        INSERT INTO duty_records 
        SELECT * FROM duty_records_backup
      `);
      
      // 删除备份表
      db.run('DROP TABLE duty_records_backup');
      
      console.log('✅ duty_records表迁移完成');
    }
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    throw error;
  }
};

// 初始化数据库
const initDatabase = () => {
  try {
    console.log('🔧 正在初始化SQLite数据库...');
    createTables();
    createIndexes();
    insertDefaultConfig();
    migrateDatabase();
    console.log('🎉 SQLite数据库初始化完成！');
    console.log(`📁 数据库文件位置: ${DB_PATH}`);
    return db;
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  }
};

// 关闭数据库连接
const closeDatabase = () => {
  if (db) {
    db.close();
    console.log('📴 数据库连接已关闭');
  }
};

// 导出数据库实例和工具函数
module.exports = {
  initDatabase,
  closeDatabase,
  db,
  DB_PATH
};

// 如果直接运行此文件，则初始化数据库
if (require.main === module) {
  initDatabase();
} 