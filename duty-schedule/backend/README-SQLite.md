# 值班表管理系统 - SQLite版本 📋

## 🎉 系统说明

值班表管理系统现已**完全切换到SQLite数据库**！享受更稳定、更高性能的数据管理体验。

### 系统优势

- **🔒 数据安全**：SQLite提供ACID事务保证，数据更安全
- **⚡ 性能提升**：SQL查询和索引优化，操作更快速
- **🔍 数据完整性**：外键约束和数据类型检查
- **📊 便于扩展**：支持复杂查询和数据分析
- **💾 可靠存储**：企业级数据库引擎

## 🚀 快速启动

### 开发模式（推荐）
```bash
npm run dev
```

### 生产模式
```bash
npm run start
```

## 📁 数据库文件

- **SQLite数据库**: `backend/data/duty-schedule.db`
- **数据库日志**: `backend/data/duty-schedule.db-wal`
- **共享内存**: `backend/data/duty-schedule.db-shm`

## 🛠️ 数据库管理

### 基本操作
```bash
# 初始化数据库
npm run init-db

# 清空并重建数据库
npm run clean-db

# 备份数据库
npm run backup-db
```

### 数据迁移（如果有旧数据）
```bash
npm run migrate
```

## 📊 数据库结构

### 数据表

- **people** - 人员信息
  - id, name, order_index, is_active, email, phone
- **duty_records** - 排班记录
  - id, date, person_id, person_name, type, reason
- **swap_requests** - 换班申请
  - id, from_person_id, to_person_id, from_date, to_date, status
- **leave_records** - 请假记录
  - id, person_id, start_date, end_date, reason, type
- **system_config** - 系统配置
  - key, value, updated_at
- **duty_rules** - 排班规则
  - max_consecutive_days, min_rest_days, exclude_weekends等

### 性能优化

- **索引**: 日期、人员、类型等关键字段已建立索引
- **WAL模式**: 启用写前日志，提高并发性能
- **外键约束**: 保证数据一致性

## 🔧 API接口

```
GET  /api/duty-schedule      - 获取值班表数据
PUT  /api/duty-schedule      - 更新值班表数据
POST /api/duty-records       - 添加排班记录
POST /api/swap-duties        - 换班操作
POST /api/generate-schedule  - 生成自动排班
GET  /api/stats              - 获取统计数据
GET  /api/health             - 健康检查
```

## 🔍 数据查看工具

### 命令行工具

```bash
# 连接数据库
sqlite3 data/duty-schedule.db

# 常用查询
.tables                              # 查看所有表
.schema people                       # 查看表结构
SELECT * FROM people;                # 查看人员
SELECT * FROM duty_records ORDER BY date; # 查看排班记录
.exit                               # 退出
```

### 图形化工具（推荐）

- **[DB Browser for SQLite](https://sqlitebrowser.org/)** - 免费开源
- **[SQLiteStudio](https://sqlitestudio.pl/)** - 功能丰富
- **[DBeaver](https://dbeaver.io/)** - 专业数据库工具

## 🛠️ 故障排除

### 服务器启动问题
```bash
# 检查端口占用
lsof -i :3001

# 清理进程
pkill -f "node server.js"

# 重新启动
npm run dev
```

### 数据库锁定问题
```bash
# 检查是否有进程占用数据库
lsof data/duty-schedule.db

# 重启服务
npm run dev
```

### 数据库损坏恢复
```bash
# 检查数据库完整性
sqlite3 data/duty-schedule.db "PRAGMA integrity_check;"

# 清空并重建
npm run clean-db
```

### 性能优化
```bash
# 分析查询性能
sqlite3 data/duty-schedule.db "EXPLAIN QUERY PLAN SELECT * FROM duty_records WHERE date = '2025-06-04';"

# 重建索引
sqlite3 data/duty-schedule.db "REINDEX;"

# 清理数据库
sqlite3 data/duty-schedule.db "VACUUM;"
```

## 📊 监控与维护

### 数据库统计
```bash
# 数据库大小
ls -lh data/duty-schedule.db

# 表记录数
sqlite3 data/duty-schedule.db "SELECT 
  'people' as table_name, COUNT(*) as records FROM people
  UNION ALL SELECT 'duty_records', COUNT(*) FROM duty_records
  UNION ALL SELECT 'swap_requests', COUNT(*) FROM swap_requests;"
```

### 定期维护
```bash
# 每周备份（建议设置定时任务）
npm run backup-db

# 每月清理（清理WAL文件）
sqlite3 data/duty-schedule.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

## 🚀 部署建议

### 生产环境
- 设置定期数据库备份
- 监控数据库文件大小
- 配置日志轮转
- 使用进程管理器（如PM2）

### Docker部署
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## 📞 技术支持

### 日志查看
```bash
# 应用日志
npm run dev  # 查看实时日志

# 系统日志
journalctl -u your-service-name -f
```

### 常见问题
1. **端口被占用**: 修改PORT环境变量
2. **权限问题**: 确保data目录可写
3. **数据库锁定**: 重启应用服务

---

**🎊 您的值班表系统现已完全运行在企业级SQLite数据库上！** 