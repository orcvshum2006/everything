#!/bin/bash

echo "🔍 检查Docker镜像架构..."

# 检查镜像是否存在
if docker images | grep -q "duty-schedule.*latest"; then
    echo "✅ 找到duty-schedule:latest镜像"
    
    # 检查架构
    ARCH=$(docker inspect duty-schedule:latest | grep '"Architecture"' | head -1 | sed 's/.*": "\(.*\)",/\1/')
    PLATFORM=$(docker inspect duty-schedule:latest | grep '"Os"' | head -1 | sed 's/.*": "\(.*\)",/\1/')
    
    echo "📋 镜像信息:"
    echo "  操作系统: $PLATFORM"
    echo "  架构: $ARCH"
    
    if [ "$ARCH" = "amd64" ]; then
        echo "✅ 镜像架构正确：amd64 (x86_64) - 适用于群辉NAS"
    else
        echo "⚠️  镜像架构: $ARCH - 可能不适用于群辉NAS"
        echo "💡 群辉NAS通常需要amd64 (x86_64)架构"
    fi
else
    echo "❌ 没有找到duty-schedule:latest镜像"
    echo "📋 当前可用镜像:"
    docker images
fi 