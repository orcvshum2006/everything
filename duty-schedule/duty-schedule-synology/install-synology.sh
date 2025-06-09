#!/bin/bash

# 群辉NAS安装脚本

set -e

echo "🚀 开始在群辉NAS上安装值班表系统..."

# 检查Docker是否可用
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先在群辉套件中心安装Docker"
    exit 1
fi

# 加载Docker镜像
DOCKER_IMAGE="duty-schedule-latest.tar"
if [ -f "${DOCKER_IMAGE}" ]; then
    echo "📦 正在加载Docker镜像..."
    docker load -i "${DOCKER_IMAGE}"
    echo "✅ Docker镜像加载成功！"
else
    echo "❌ 找不到Docker镜像文件: ${DOCKER_IMAGE}"
    exit 1
fi

# 创建数据目录
echo "📁 创建数据目录..."
mkdir -p data
mkdir -p logs

# 启动服务
echo "🏃 启动容器..."
docker-compose -f docker-compose-synology.yml up -d

echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
if docker-compose -f docker-compose-synology.yml ps | grep -q "Up"; then
    echo "✅ 服务启动成功！"
    echo ""
    echo "🌐 访问地址: http://$(hostname -I | awk '{print $1}'):8081"
    echo "📊 健康检查: http://$(hostname -I | awk '{print $1}'):8081/api/health"
    echo ""
    echo "📋 管理命令:"
    echo "  查看日志: docker-compose -f docker-compose-synology.yml logs -f"
    echo "  重启服务: docker-compose -f docker-compose-synology.yml restart"
    echo "  停止服务: docker-compose -f docker-compose-synology.yml down"
else
    echo "❌ 服务启动失败，请查看日志："
    docker-compose -f docker-compose-synology.yml logs
    exit 1
fi
