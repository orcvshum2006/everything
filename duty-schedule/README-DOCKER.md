# 值班表系统 Docker 部署

这是一个基于 React + Node.js + SQLite 的值班表管理系统，已经完全容器化，可以轻松部署到群辉NAS或任何支持Docker的环境中。

## 🚀 快速启动

### 方法一：一键脚本部署
```bash
./docker-build.sh
```

### 方法二：手动部署
```bash
# 1. 构建并启动
docker-compose up -d --build

# 2. 查看状态
docker-compose ps
docker-compose logs -f
```

## 🌐 访问应用

启动成功后，通过浏览器访问：
```
http://localhost:8081
```

在群辉NAS上：
```
http://your-nas-ip:8081
```

## 📁 文件说明

- `Dockerfile` - Docker镜像构建文件
- `docker-compose.yml` - Docker Compose配置
- `docker-build.sh` - 一键构建部署脚本
- `DOCKER-DEPLOY.md` - 详细部署指南（包含群辉NAS具体操作）

## 🔧 管理命令

```bash
# 查看运行状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 更新应用
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 💾 数据持久化

- 数据库文件：`./data/duty-schedule.db`
- 应用日志：`./logs/`
- 容器重启数据不会丢失

## 🛠️ 故障排除

1. **端口冲突**：修改 `docker-compose.yml` 中的端口映射
2. **权限问题**：确保 `data` 目录有写权限
3. **查看详细日志**：`docker-compose logs duty-schedule`

## 📖 更多文档

详细的群辉NAS部署指南请查看：[DOCKER-DEPLOY.md](./DOCKER-DEPLOY.md) 