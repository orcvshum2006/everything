# 值班表管理系统后端 📋

基于 **SQLite** 的高性能值班表管理系统后端API。

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产模式
npm run start
```

服务器将在 `http://localhost:3001` 启动

## 📊 数据库

- **类型**: SQLite
- **位置**: `data/duty-schedule.db`
- **特性**: ACID事务、外键约束、性能优化

## 🛠️ 脚本命令

```bash
npm run dev          # 开发模式（热重载）
npm run start        # 生产模式
npm run init-db      # 初始化数据库
npm run clean-db     # 清空并重建数据库
npm run backup-db    # 备份数据库
npm run migrate      # 数据迁移（如果有旧数据）
```

## 🔧 API接口

- `GET /api/health` - 健康检查
- `GET /api/duty-schedule` - 获取值班表数据
- `PUT /api/duty-schedule` - 更新值班表数据
- `POST /api/duty-records` - 添加排班记录
- `POST /api/swap-duties` - 换班操作
- `GET /api/stats` - 获取统计数据

## 📚 详细文档

查看 [README-SQLite.md](./README-SQLite.md) 获取完整的使用说明和故障排除指南。

## 🏗️ 技术栈

- **框架**: Express.js
- **数据库**: SQLite (better-sqlite3)
- **开发工具**: Nodemon
- **文件处理**: fs-extra

---

**🎯 企业级SQLite数据库，稳定可靠！** 