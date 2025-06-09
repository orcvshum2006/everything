#!/bin/bash

# 值班表系统部署脚本
# 使用方法：
# ./deploy.sh dev          # 开发环境
# ./deploy.sh prod         # 生产环境
# ./deploy.sh custom       # 自定义环境

set -e

ENVIRONMENT=${1:-dev}

echo "🚀 开始部署值班表系统 (环境: $ENVIRONMENT)"

case $ENVIRONMENT in
  "dev")
    echo "📍 开发环境部署"
    echo "前端: http://localhost:5173"
    echo "后端: http://localhost:3001"
    
    # 启动后端 (后台运行)
    echo "🔧 启动后端服务..."
    cd backend
    npm install
    PORT=3001 HOST=0.0.0.0 npm start &
    BACKEND_PID=$!
    cd ..
    
    # 启动前端
    echo "🎨 启动前端服务..."
    npm install
    npm run dev
    ;;
    
  "prod")
    echo "🌐 生产环境构建"
    echo "请确保已设置正确的 VITE_API_URL 环境变量"
    echo "示例: VITE_API_URL=https://api.yourdomain.com npm run build"
    
    # 构建前端
    npm install
    npm run build
    
    echo "✅ 前端构建完成，文件在 dist/ 目录"
    echo "📁 请将 dist/ 目录部署到 web 服务器"
    echo "🔧 后端请参考 README.md 中的部署说明"
    ;;
    
  "custom")
    echo "⚙️  自定义部署"
    echo "请手动设置环境变量："
    echo "前端: VITE_API_URL=你的API地址"
    echo "后端: PORT=端口号 HOST=绑定地址"
    echo ""
    echo "示例："
    echo "VITE_API_URL=https://api.example.com npm run build"
    echo "PORT=8080 HOST=0.0.0.0 npm start"
    ;;
    
  *)
    echo "❌ 未知环境: $ENVIRONMENT"
    echo "支持的环境: dev, prod, custom"
    exit 1
    ;;
esac 