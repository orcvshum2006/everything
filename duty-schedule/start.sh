#!/bin/bash

echo "🚀 启动智能值班管理系统..."

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 请在 duty-schedule 目录下运行此脚本"
    exit 1
fi

# 启动后端服务器
echo "📡 启动后端API服务器 (端口3001)..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

# 等待后端启动
echo "⏳ 等待后端服务器启动..."
sleep 3

# 检查后端是否启动成功
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ 后端服务器启动成功"
else
    echo "❌ 后端服务器启动失败"
    kill $BACKEND_PID
    exit 1
fi

# 启动前端服务器
echo "🎨 启动前端开发服务器 (端口5173)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "🎉 应用启动完成！"
echo ""
echo "📱 前端地址:"
echo "   • http://localhost:5173/"
echo "   • http://127.0.0.1:5173/"
echo ""
echo "🔧 后端API:"
echo "   • http://localhost:3001/"
echo ""
echo "⏹️  停止服务: Ctrl+C"
echo ""

# 等待用户中断
wait 