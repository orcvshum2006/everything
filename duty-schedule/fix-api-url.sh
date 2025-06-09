#!/bin/bash

echo "🔧 修复前端API URL配置..."

# 查找.env.local文件
ENV_FILE=""
if [ -f ".env.local" ]; then
    ENV_FILE=".env.local"
elif [ -f "frontend/.env.local" ]; then
    ENV_FILE="frontend/.env.local"
elif [ -f ".env" ]; then
    ENV_FILE=".env"
else
    echo "❌ 找不到环境配置文件"
    exit 1
fi

echo "📁 找到配置文件: $ENV_FILE"

# 备份原文件
cp "$ENV_FILE" "${ENV_FILE}.backup"
echo "📋 已备份原配置文件到 ${ENV_FILE}.backup"

echo "📋 当前配置:"
grep -n "VITE_API_URL" "$ENV_FILE" || echo "未找到VITE_API_URL配置"

echo ""
echo "🎯 选择修复方案:"
echo "1. 修改为群辉NAS IP (192.168.3.10:8081)"
echo "2. 使用相对路径 (/api)"
echo "3. 使用动态主机 (window.location.origin)"
echo "4. 手动输入IP地址"

read -p "请选择方案 (1-4): " choice

case $choice in
    1)
        NEW_URL="http://192.168.3.10:8081"
        echo "🔄 设置为群辉NAS地址: $NEW_URL"
        ;;
    2)
        NEW_URL="/api"
        echo "🔄 设置为相对路径: $NEW_URL"
        echo "⚠️  注意: 需要配置后端支持相对路径"
        ;;
    3)
        NEW_URL=""
        echo "🔄 设置为动态主机检测"
        echo "⚠️  注意: 需要修改前端代码支持动态检测"
        ;;
    4)
        read -p "请输入新的API地址 (例: http://192.168.1.100:8081): " NEW_URL
        echo "🔄 设置为自定义地址: $NEW_URL"
        ;;
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac

if [ "$choice" = "3" ]; then
    # 方案3：创建动态配置
    cat > api-config.js << 'APICONFIG'
// 动态API配置
const getApiUrl = () => {
  // 开发环境
  if (import.meta.env.DEV) {
    return 'http://localhost:8081';
  }
  
  // 生产环境：使用当前主机
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:8081`;
};

export const API_BASE_URL = getApiUrl();
APICONFIG
    
    echo "✅ 已创建动态API配置文件: api-config.js"
    echo "📝 请在前端代码中使用: import { API_BASE_URL } from './api-config.js'"
    
else
    # 方案1,2,4：直接修改环境变量
    if grep -q "VITE_API_URL" "$ENV_FILE"; then
        # 替换现有配置
        sed -i.tmp "s|VITE_API_URL=.*|VITE_API_URL=$NEW_URL|" "$ENV_FILE"
    else
        # 添加新配置
        echo "VITE_API_URL=$NEW_URL" >> "$ENV_FILE"
    fi
    
    echo "✅ 已更新API URL配置"
fi

echo ""
echo "📋 新的配置:"
grep -n "VITE_API_URL" "$ENV_FILE" || echo "使用动态配置"

echo ""
echo "🔄 需要重新构建前端:"
echo "   npm run build"
echo ""
echo "📦 或者更新Docker镜像中的前端文件" 