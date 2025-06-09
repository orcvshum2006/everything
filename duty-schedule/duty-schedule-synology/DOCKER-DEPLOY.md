# 群辉NAS Docker部署指南

## 前提条件

1. 群辉NAS已安装Docker套件
2. 确保有足够的存储空间
3. 具有管理员权限

## 部署步骤

### 方法一：使用Docker Compose（推荐）

1. **上传项目文件**
   - 将整个项目文件夹上传到群辉NAS
   - 建议放在 `/docker/duty-schedule/` 目录下

2. **SSH连接到群辉**
   ```bash
   ssh admin@your-nas-ip
   ```

3. **进入项目目录**
   ```bash
   cd /volume1/docker/duty-schedule
   ```

4. **构建并启动容器**
   ```bash
   docker-compose up -d --build
   ```

5. **查看运行状态**
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

### 方法二：使用群辉Docker图形界面

1. **构建镜像**
   - 打开群辉Docker套件
   - 点击"映像" → "新增" → "从文件添加"
   - 选择项目目录，Docker会自动查找Dockerfile

2. **创建容器**
   - 在"映像"标签页找到构建好的镜像
   - 点击"启动"
   - 配置以下设置：
     - **端口设置**: 本地端口8081 → 容器端口8081
     - **卷挂载**: 
       - 本地路径: `/docker/duty-schedule/data` → 容器路径: `/app/data`
       - 本地路径: `/docker/duty-schedule/logs` → 容器路径: `/app/logs`
     - **环境变量**:
       - `NODE_ENV=production`
       - `PORT=8081`

## 访问应用

部署成功后，通过以下地址访问：
```
http://your-nas-ip:8081
```

## 数据持久化

- 数据库文件存储在: `/docker/duty-schedule/data/`
- 应用日志存储在: `/docker/duty-schedule/logs/`
- 即使容器重启，数据也不会丢失

## 管理命令

### 查看日志
```bash
docker-compose logs -f duty-schedule
```

### 重启应用
```bash
docker-compose restart duty-schedule
```

### 停止应用
```bash
docker-compose down
```

### 更新应用
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 备份数据
```bash
# 备份数据库
cp data/duty-schedule.db data/duty-schedule-backup-$(date +%Y%m%d_%H%M%S).db

# 或者使用Docker命令
docker-compose exec duty-schedule npm run backup-db
```

## 故障排除

### 端口冲突
如果8081端口被占用，修改docker-compose.yml中的端口映射：
```yaml
ports:
  - "8080:8081"  # 使用8080端口访问
```

### 权限问题
确保数据目录有正确的权限：
```bash
sudo chown -R 1000:1000 /docker/duty-schedule/data
```

### 数据库初始化失败
```bash
# 删除数据库文件重新初始化
rm -f data/duty-schedule.db*
docker-compose restart duty-schedule
```

## 自动启动

在群辉Docker套件中，确保容器设置为"自动重启"，这样NAS重启后应用会自动启动。

## 安全建议

1. 使用反向代理（如Nginx Proxy Manager）
2. 配置SSL证书
3. 限制访问IP范围
4. 定期备份数据库 