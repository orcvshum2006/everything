# 值班表系统部署指南

## 项目结构

```
duty-schedule/
├── backend/          # 后端 API 服务
│   ├── server.js     # Express 服务器
│   ├── package.json  # 后端依赖
│   └── data/         # 数据存储目录（自动创建）
├── src/              # 前端源码
├── dist/             # 前端构建产物
└── package.json      # 前端依赖
```

## 本地开发

### 1. 启动后端服务

```bash
cd duty-schedule/backend
npm install
npm run dev
```

后端服务将在 `http://localhost:3001` 启动

### 2. 启动前端服务

```bash
cd duty-schedule
npm install
npm run dev
```

前端服务将在 `http://localhost:5174` 启动

## 生产部署

### 方案一：单服务器部署

#### 1. 服务器准备
- Ubuntu/CentOS 服务器
- Node.js 18+ 
- Nginx
- PM2 (进程管理)

#### 2. 安装依赖

```bash
# 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 PM2
sudo npm install -g pm2

# 安装 Nginx
sudo apt update
sudo apt install nginx
```

#### 3. 部署后端

```bash
# 上传代码到服务器
scp -r duty-schedule/ user@your-server:/var/www/

# 登录服务器
ssh user@your-server

# 进入项目目录
cd /var/www/duty-schedule/backend

# 安装依赖
npm install --production

# 使用 PM2 启动后端服务
pm2 start server.js --name "duty-schedule-api"

# 设置开机自启
pm2 startup
pm2 save
```

#### 4. 构建和部署前端

```bash
# 在本地构建前端
cd duty-schedule
npm run build

# 上传构建产物到服务器
scp -r dist/ user@your-server:/var/www/duty-schedule/

# 或者在服务器上构建
cd /var/www/duty-schedule
npm install
npm run build
```

#### 5. 配置 Nginx

创建 Nginx 配置文件：

```bash
sudo nano /etc/nginx/sites-available/duty-schedule
```

配置内容：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名

    # 前端静态文件
    location / {
        root /var/www/duty-schedule/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/duty-schedule /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 方案二：Docker 部署

#### 1. 创建 Dockerfile（后端）

```dockerfile
# duty-schedule/backend/Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3001
CMD ["npm", "start"]
```

#### 2. 创建 Dockerfile（前端）

```dockerfile
# duty-schedule/Dockerfile
FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 3. 创建 docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    volumes:
      - ./backend/data:/app/data
    restart: unless-stopped

  frontend:
    build: .
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
```

#### 4. 部署

```bash
# 构建并启动
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 方案三：云服务部署

#### Vercel (前端) + Railway (后端)

1. **后端部署到 Railway:**
   - 连接 GitHub 仓库
   - 选择 backend 目录
   - 自动部署

2. **前端部署到 Vercel:**
   - 连接 GitHub 仓库
   - 设置环境变量 `VITE_API_URL`
   - 自动构建部署

## 环境变量配置

### 前端环境变量

创建 `.env` 文件：

```bash
# 开发环境
VITE_API_URL=http://localhost:3001

# 生产环境
VITE_API_URL=https://your-api-domain.com
```

### 后端环境变量

```bash
# 端口配置
PORT=3001

# 数据存储路径（可选）
DATA_PATH=/path/to/data
```

## 数据备份

```bash
# 备份数据文件
cp backend/data/duty-schedule.json backup/duty-schedule-$(date +%Y%m%d).json

# 定时备份（crontab）
0 2 * * * cp /var/www/duty-schedule/backend/data/duty-schedule.json /backup/duty-schedule-$(date +\%Y\%m\%d).json
```

## 监控和维护

### 1. PM2 监控

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs

# 重启服务
pm2 restart duty-schedule-api
```

### 2. Nginx 日志

```bash
# 访问日志
sudo tail -f /var/log/nginx/access.log

# 错误日志
sudo tail -f /var/log/nginx/error.log
```

### 3. 系统监控

```bash
# 安装监控工具
sudo apt install htop

# 查看系统资源
htop
```

## 故障排除

### 常见问题

1. **前端无法连接后端**
   - 检查 API URL 配置
   - 确认后端服务是否启动
   - 检查防火墙设置

2. **数据无法保存**
   - 检查数据目录权限
   - 确认磁盘空间充足

3. **服务无法启动**
   - 检查端口占用
   - 查看错误日志
   - 确认依赖安装完整

### 日志调试

```bash
# 后端日志
pm2 logs duty-schedule-api

# Nginx 错误日志
sudo tail -f /var/log/nginx/error.log

# 系统日志
sudo journalctl -u nginx -f
```

## 安全建议

1. **使用 HTTPS**
2. **设置防火墙规则**
3. **定期更新系统和依赖**
4. **配置访问控制**
5. **定期备份数据**

## 性能优化

1. **启用 Gzip 压缩**
2. **配置缓存策略**
3. **使用 CDN 加速静态资源**
4. **监控服务器资源使用** 