#!/bin/bash

echo "🏗️  为群辉NAS重新构建Docker镜像..."

# 设置目标IP
TARGET_IP="192.168.3.10"
TARGET_PORT="8081"
NEW_API_URL="http://${TARGET_IP}:${TARGET_PORT}"

echo "🎯 目标API地址: $NEW_API_URL"

# 备份原始配置
if [ -f ".env.local" ]; then
    cp .env.local .env.local.backup
    echo "📋 已备份 .env.local"
fi

# 修改API URL配置
echo "🔧 修改API URL配置..."
if [ -f ".env.local" ]; then
    sed -i.tmp "s|VITE_API_URL=.*|VITE_API_URL=$NEW_API_URL|" .env.local
    echo "✅ 已更新 .env.local"
else
    echo "VITE_API_URL=$NEW_API_URL" > .env.local
    echo "✅ 已创建 .env.local"
fi

echo "📋 当前配置:"
cat .env.local

echo ""
echo "🔨 重新构建前端..."
npm run build

echo ""
echo "🐳 重新构建Docker镜像..."

# 创建专门的Dockerfile用于群辉部署
cat > Dockerfile.synology << 'DOCKERFILE'
# 多阶段构建 - 群辉NAS专用版本
FROM node:18-alpine AS frontend-builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN rm -rf backend
RUN npm run build

# 后端构建 - 使用sqlite3替代better-sqlite3
FROM node:18-alpine AS backend-builder

WORKDIR /app
RUN apk add --no-cache python3 make g++ sqlite-dev

# 复制修改后的package.json（移除better-sqlite3）
COPY backend/package*.json ./
RUN npm uninstall better-sqlite3 2>/dev/null || true
RUN npm install sqlite3 express cors dotenv fs-extra

# 最终镜像
FROM node:18-alpine

# 安装SQLite运行时
RUN apk add --no-cache sqlite

WORKDIR /app

# 复制后端依赖和代码
COPY --from=backend-builder /app/node_modules ./node_modules
COPY backend/ ./

# 复制构建好的前端文件
COPY --from=frontend-builder /app/dist ./public

# 创建SQLite3兼容的数据库初始化文件
RUN cat > database/init.js << 'INITJS'
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../data/duty-schedule.db');
const dataDir = path.dirname(DB_PATH);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ 数据库连接失败:', err);
  } else {
    console.log('✅ SQLite3 数据库连接成功');
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS duty_records (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    person_id TEXT,
    person_name TEXT,
    type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log('✅ 数据库表结构创建完成');
});

module.exports = db;
console.log('🎉 SQLite3数据库初始化完成');
INITJS

# 创建数据目录
RUN mkdir -p data database

# 设置权限
RUN chown -R node:node /app
USER node

EXPOSE 8081

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8081/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
DOCKERFILE

# 构建新镜像
echo "🏗️  构建群辉专用镜像..."
docker buildx build --platform linux/amd64 -f Dockerfile.synology -t duty-schedule:synology --load .

if [ $? -eq 0 ]; then
    echo "✅ 镜像构建成功！"
    
    # 导出镜像
    echo "📦 导出镜像..."
    docker save -o duty-schedule-synology-fixed.tar duty-schedule:synology
    
    # 检查镜像架构
    echo "🔍 验证镜像架构..."
    docker inspect duty-schedule:synology | grep '"Architecture"'
    
    echo ""
    echo "🎉 群辉专用镜像构建完成！"
    echo "📁 镜像文件: duty-schedule-synology-fixed.tar"
    echo "🌐 API地址: $NEW_API_URL"
    echo ""
    echo "📋 接下来的步骤:"
    echo "1. 将镜像文件上传到群辉"
    echo "2. 加载镜像: docker load -i duty-schedule-synology-fixed.tar"
    echo "3. 启动服务: docker-compose up -d"
    
else
    echo "❌ 镜像构建失败"
    exit 1
fi 