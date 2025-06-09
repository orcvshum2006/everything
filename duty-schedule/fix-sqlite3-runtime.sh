#!/bin/bash

echo "🔧 运行时修复 better-sqlite3 架构问题..."

# 检查是否是x86架构
ARCH=$(uname -m)
echo "当前架构: $ARCH"

if [ "$ARCH" = "x86_64" ]; then
    echo "✅ 检测到 x86_64 架构，开始修复 better-sqlite3..."
    
    # 进入应用目录
    cd /app
    
    # 安装必要的构建工具
    apk add --no-cache python3 make g++ sqlite-dev py3-setuptools
    
    # 设置环境变量
    export npm_config_build_from_source=true
    export npm_config_target_arch=x64
    export npm_config_target_platform=linux
    export PYTHON=/usr/bin/python3
    
    # 重新安装 better-sqlite3
    echo "🔨 重新编译 better-sqlite3..."
    cd node_modules/better-sqlite3
    npm run build-release
    
    # 清理构建工具（可选，节省空间）
    apk del python3 make g++ py3-setuptools
    
    echo "✅ better-sqlite3 修复完成！"
else
    echo "⚠️  非 x86_64 架构，跳过修复"
fi

# 启动原应用
echo "🚀 启动应用..."
exec node server.js 