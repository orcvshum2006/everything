#!/bin/bash

echo "🔨 手动构建x86 NAS镜像..."

# 询问用户使用哪个Dockerfile
echo "请选择Dockerfile版本:"
echo "1. Dockerfile.x86-improved (Node.js 18 优化版) - 推荐"
echo "2. Dockerfile.x86-v20 (Node.js 20版本)"
echo "3. Dockerfile (原始版本)"

read -p "请输入选择 (1-3): " choice

case $choice in
    1)
        DOCKERFILE="Dockerfile.x86-improved"
        TAG="duty-schedule:x86-nas"
        ;;
    2)
        DOCKERFILE="Dockerfile.x86-v20"
        TAG="duty-schedule:x86-nas-v20"
        ;;
    3)
        DOCKERFILE="Dockerfile"
        TAG="duty-schedule:x86-nas-original"
        ;;
    *)
        echo "默认使用 Dockerfile.x86-improved"
        DOCKERFILE="Dockerfile.x86-improved"
        TAG="duty-schedule:x86-nas"
        ;;
esac

echo "🏗️  使用 $DOCKERFILE 构建镜像 $TAG"

# 构建镜像
docker build --platform linux/amd64 -f $DOCKERFILE -t $TAG .

if [ $? -eq 0 ]; then
    echo "✅ 镜像构建成功！"
    
    # 导出镜像
    TAR_FILE="${TAG//[:\\/]/-}.tar"
    echo "📦 导出镜像为 $TAR_FILE"
    docker save -o $TAR_FILE $TAG
    
    echo "🎉 构建完成！"
    echo "📁 镜像文件: $TAR_FILE"
    
else
    echo "❌ 构建失败！"
    exit 1
fi
