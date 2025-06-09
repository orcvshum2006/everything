#!/bin/bash

echo "🔧 修复 better-sqlite3 架构兼容性问题..."

# 检查是否在正确目录
if [ ! -f "docker-compose-synology.yml" ]; then
    echo "❌ 请在 duty-schedule-synology 目录下运行此脚本"
    exit 1
fi

echo "📋 当前解决方案选项："
echo "1. 使用纯JavaScript SQLite库 (sql.js)"
echo "2. 修改为使用 sqlite3 包"
echo "3. 使用文件数据库 (JSON)"
echo "4. 重新构建镜像 (需要网络)"

read -p "请选择方案 (1-4): " choice

case $choice in
    1)
        echo "🚀 方案1: 使用 sql.js (纯JavaScript)"
        
        # 创建新的docker-compose文件
        cat > docker-compose-sqljs.yml << 'EOF'
version: '3.8'
services:
  duty-schedule:
    image: node:18-alpine
    container_name: duty-schedule
    restart: unless-stopped
    ports:
      - "8081:8081"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./app-sqljs:/app
    environment:
      - NODE_ENV=production
      - PORT=8081
      - HOST=0.0.0.0
    command: sh -c "cd /app && npm install && npm start"
    networks:
      - duty-schedule-network
networks:
  duty-schedule-network:
    driver: bridge
EOF
        
        echo "✅ 已创建 sql.js 版本配置"
        echo "📝 接下来需要："
        echo "   1. 创建 app-sqljs 目录"
        echo "   2. 复制应用代码并修改数据库层"
        ;;
        
    2)
        echo "🚀 方案2: 修改容器使用 sqlite3"
        
        # 停止当前容器
        sudo /usr/local/bin/docker-compose -f docker-compose-synology.yml down 2>/dev/null || true
        
        # 创建临时修复脚本
        cat > temp-fix-sqlite3.sh << 'EOF'
#!/bin/sh
echo "在容器内安装 sqlite3..."
cd /app
npm uninstall better-sqlite3
npm install sqlite3
echo "修复完成"
EOF
        
        echo "✅ 临时修复脚本已创建"
        ;;
        
    3)
        echo "🚀 方案3: 使用JSON文件数据库"
        
        cat > docker-compose-json.yml << 'EOF'
version: '3.8'
services:
  duty-schedule:
    image: node:18-alpine
    container_name: duty-schedule
    restart: unless-stopped
    ports:
      - "8081:8081"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - PORT=8081
      - HOST=0.0.0.0
      - USE_JSON_DB=true
    command: sh -c "apk add --no-cache git && cd /tmp && git clone https://github.com/typicode/lowdb.git && cd /app && npm install lowdb && npm start"
    networks:
      - duty-schedule-network
networks:
  duty-schedule-network:
    driver: bridge
EOF
        
        echo "✅ JSON数据库版本已创建"
        ;;
        
    4)
        echo "🚀 方案4: 重新构建镜像"
        echo "需要网络连接下载依赖..."
        
        # 创建简化的Dockerfile
        cat > Dockerfile.simple << 'EOF'
FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache sqlite python3 make g++
COPY backend/package*.json ./
RUN npm install sqlite3 express cors dotenv fs-extra
COPY backend/ ./
COPY dist/ ./public/
EXPOSE 8081
CMD ["node", "server.js"]
EOF
        
        echo "✅ 简化Dockerfile已创建"
        ;;
        
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac

echo ""
echo "🎉 修复配置已准备完成！"
echo "📝 选择的方案: $choice" 