#!/bin/bash

# 值班表系统 Docker 构建部署脚本
# 适用于群辉NAS和其他Docker环境

set -e

echo "🚀 开始构建值班表系统 Docker 镜像..."

# 检查Docker是否可用
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装或不在PATH中"
    exit 1
fi

# 检查docker-compose是否可用
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose未安装或不在PATH中"
    exit 1
fi

echo "✅ Docker环境检查通过"

# 创建数据目录
echo "📁 创建数据目录..."
mkdir -p data
mkdir -p logs

echo "🔨 构建Docker镜像..."
docker-compose build

echo "🏃 启动容器..."
docker-compose up -d

echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
if docker-compose ps | grep -q "Up"; then
    echo "✅ 服务启动成功！"
    echo ""
    echo "🌐 访问地址: http://localhost:8081"
    echo "📊 健康检查: http://localhost:8081/api/health"
    echo ""
    echo "📋 管理命令:"
    echo "  查看日志: docker-compose logs -f"
    echo "  重启服务: docker-compose restart"
    echo "  停止服务: docker-compose down"
    echo ""
    echo "📂 数据目录:"
    echo "  数据库: ./data/"
    echo "  日志: ./logs/"
else
    echo "❌ 服务启动失败，请查看日志："
    docker-compose logs
    exit 1
fi 