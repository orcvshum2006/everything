#!/bin/bash

echo "🚀 群辉NAS值班表管理系统安装脚本（SQLite3版本）"
echo "==============================================="

# 检查Docker是否可用
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker未安装或不可用"
    echo "请先在群辉套件中心安装Docker套件"
    exit 1
fi

# 导入镜像
echo "📥 导入Docker镜像..."
if docker load -i duty-schedule-sqlite3.tar.gz; then
    echo "✅ 镜像导入成功"
else
    echo "❌ 镜像导入失败"
    exit 1
fi

# 停止并删除旧容器（如果存在）
echo "🛑 清理旧容器..."
docker stop duty-schedule 2>/dev/null || true
docker rm duty-schedule 2>/dev/null || true

# 创建数据目录
echo "📁 创建数据目录..."
mkdir -p /volume1/docker/duty-schedule/data

# 启动新容器
echo "🚀 启动容器..."
docker run -d \
  --name duty-schedule \
  --restart unless-stopped \
  -p 8081:8081 \
  -v /volume1/docker/duty-schedule/data:/app/data \
  duty-schedule:sqlite3-latest

# 检查容器状态
echo "🔍 检查容器状态..."
sleep 5
if docker ps | grep duty-schedule > /dev/null; then
    echo "✅ 容器启动成功!"
    echo ""
    echo "🌐 访问地址: http://你的群辉IP:8081"
    echo "📁 数据目录: /volume1/docker/duty-schedule/data"
    echo ""
    echo "📚 管理命令:"
    echo "  查看日志: docker logs duty-schedule"
    echo "  重启容器: docker restart duty-schedule"
    echo "  停止容器: docker stop duty-schedule"
else
    echo "❌ 容器启动失败，请检查日志:"
    docker logs duty-schedule
    exit 1
fi
