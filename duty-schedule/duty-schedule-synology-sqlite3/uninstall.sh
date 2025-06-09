#!/bin/bash

echo "🗑️ 卸载值班表管理系统..."

# 停止并删除容器
docker stop duty-schedule 2>/dev/null || true
docker rm duty-schedule 2>/dev/null || true

# 删除镜像
docker rmi duty-schedule:sqlite3-latest 2>/dev/null || true

echo "✅ 卸载完成"
echo "💡 数据目录保留在: /volume1/docker/duty-schedule/data"
echo "   如需完全删除，请手动删除该目录"
