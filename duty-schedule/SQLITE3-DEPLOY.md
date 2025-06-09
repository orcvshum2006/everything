# 值班表管理系统 - SQLite3版本部署指南

## 🎯 解决方案

经过深度分析，**better-sqlite3** 在Docker容器中确实存在严重的架构兼容性问题，特别是在x86 NAS设备上。我们已经完全切换到 **sqlite3** 数据库模块，该模块具有更好的跨平台兼容性。

## 🔧 已解决的问题

### 1. Better-sqlite3 架构问题
- **问题**: better-sqlite3包含预编译的二进制文件，在Docker多架构构建中经常出现"Exec format error"
- **解决**: 完全移除better-sqlite3，使用sqlite3模块
- **优势**: sqlite3模块在Docker环境中兼容性更好，支持从源码编译

### 2. Python环境配置
- **问题**: node-gyp编译时缺少Python distutils模块
- **解决**: 在Dockerfile中安装完整的Python开发环境
- **配置**: python3, python3-dev, py3-setuptools, py3-pip

### 3. 原生模块编译
- **问题**: 预编译的原生模块架构不匹配
- **解决**: 强制从源码编译，确保目标架构兼容
- **环境变量**: 
  ```bash
  npm_config_build_from_source=true
  npm_config_target_platform=linux
  npm_config_target_arch=x64
  ```

## 📦 构建结果

```
镜像信息:
- 名称: duty-schedule:sqlite3-latest
- 大小: 241MB
- 架构: amd64/linux
- 文件: duty-schedule-sqlite3.tar.gz (82MB)
- 部署包: duty-schedule-synology-sqlite3.tar.gz (82MB)
```

## 🚀 部署步骤

### 方法1: 自动安装（推荐）

1. **上传部署包到群辉**
   ```bash
   # 上传 duty-schedule-synology-sqlite3.tar.gz 到群辉
   ```

2. **解压并安装**
   ```bash
   tar -xzf duty-schedule-synology-sqlite3.tar.gz
   cd duty-schedule-synology-sqlite3
   chmod +x install.sh
   ./install.sh
   ```

3. **访问系统**
   ```
   http://你的群辉IP:8081
   ```

### 方法2: 手动安装

1. **导入镜像**
   ```bash
   docker load -i duty-schedule-sqlite3.tar.gz
   ```

2. **启动容器**
   ```bash
   docker run -d \
     --name duty-schedule \
     --restart unless-stopped \
     -p 8081:8081 \
     -v /volume1/docker/duty-schedule/data:/app/data \
     duty-schedule:sqlite3-latest
   ```

## 🔄 数据库兼容性

### SQLite3 vs Better-sqlite3
```
特性对比:
├── API兼容性
│   ├── sqlite3: 异步API，更适合生产环境
│   └── better-sqlite3: 同步API，性能更高但兼容性差
├── Docker支持
│   ├── sqlite3: ✅ 完美支持多架构构建
│   └── better-sqlite3: ❌ 经常出现架构兼容问题
├── 原生模块
│   ├── sqlite3: ✅ 可从源码编译
│   └── better-sqlite3: ❌ 依赖预编译二进制文件
└── 稳定性
    ├── sqlite3: ✅ 成熟稳定，广泛使用
    └── better-sqlite3: ⚠️ 在容器环境中问题较多
```

### 迁移过程
系统已自动完成迁移:
- ✅ 数据库模式兼容
- ✅ API接口保持不变
- ✅ 前端无需修改
- ✅ 数据完整性保证

## 🛠️ 系统特性

### 核心功能
- ✅ 人员管理
- ✅ 自动排班算法
- ✅ 手动调整排班
- ✅ 换班申请系统
- ✅ 请假管理
- ✅ 实时同步
- ✅ 数据导出

### 技术栈
```
前端: React + TypeScript + Vite
后端: Node.js + Express
数据库: SQLite3
容器: Docker (x86_64)
部署: 群辉NAS Docker
```

## 📁 目录结构

```
群辉NAS目录:
/volume1/docker/duty-schedule/
├── data/
│   ├── duty-schedule.db      # 主数据库
│   ├── duty-schedule.db-wal  # 写前日志
│   └── duty-schedule.db-shm  # 共享内存
└── logs/                     # 日志文件（可选）
```

## 🔍 故障排除

### 常见问题

1. **容器无法启动**
   ```bash
   # 检查端口占用
   netstat -tlnp | grep 8081
   
   # 查看容器日志
   docker logs duty-schedule
   
   # 检查镜像架构
   docker inspect duty-schedule:sqlite3-latest --format='{{.Architecture}}'
   ```

2. **数据库错误**
   ```bash
   # 进入容器检查
   docker exec -it duty-schedule sh
   ls -la /app/data/
   
   # 重新初始化数据库
   docker exec -it duty-schedule rm -f /app/data/*
   docker restart duty-schedule
   ```

3. **架构不兼容**
   ```bash
   # 确认NAS架构
   uname -m  # 应该显示 x86_64
   
   # 确认Docker支持
   docker version
   ```

### 性能优化

1. **数据库优化**
   - 自动启用WAL模式
   - 索引优化
   - 定期备份

2. **容器优化**
   - 健康检查
   - 自动重启
   - 资源限制

## 📞 技术支持

### 验证安装
访问以下端点验证系统状态:
- 健康检查: `http://群辉IP:8081/api/health`
- 系统信息: `http://群辉IP:8081/api/duty-schedule`

### 管理命令
```bash
# 容器管理
docker ps | grep duty-schedule          # 查看状态
docker logs duty-schedule               # 查看日志
docker restart duty-schedule            # 重启服务
docker stop duty-schedule               # 停止服务

# 数据库管理
docker exec -it duty-schedule sqlite3 /app/data/duty-schedule.db
.tables                                 # 查看表结构
.quit                                   # 退出
```

## ✨ 升级说明

本版本相比之前的better-sqlite3版本:
- ✅ 解决了架构兼容性问题
- ✅ 提高了Docker环境稳定性
- ✅ 保持了完整的功能特性
- ✅ 无需重新配置数据

如果你之前使用better-sqlite3版本遇到问题，请使用这个SQLite3版本，它应该可以在你的x86 NAS上正常运行。 