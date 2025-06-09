#!/bin/bash

echo "🔧 修复Docker容器中的API IP地址..."

# 设置新的IP
OLD_IP="192.168.3.122"
NEW_IP="192.168.3.10"
CONTAINER_NAME="duty-schedule"

echo "🎯 将 $OLD_IP 替换为 $NEW_IP"

# 检查容器是否运行
if ! sudo /usr/local/bin/docker ps | grep -q $CONTAINER_NAME; then
    echo "❌ 容器 $CONTAINER_NAME 未运行"
    echo "📋 启动容器:"
    sudo /usr/local/bin/docker start $CONTAINER_NAME
    sleep 3
fi

echo "🔍 在容器中查找需要替换的文件..."

# 进入容器执行替换操作
sudo /usr/local/bin/docker exec $CONTAINER_NAME sh -c "
echo '📁 查找包含旧IP的文件...'
find /app -type f \( -name '*.js' -o -name '*.html' -o -name '*.json' \) -exec grep -l '$OLD_IP' {} \; 2>/dev/null || echo '未找到包含旧IP的文件'

echo '🔄 执行IP替换...'
# 替换所有JS文件中的IP
find /app -name '*.js' -type f -exec sed -i 's/$OLD_IP/$NEW_IP/g' {} \; 2>/dev/null

# 替换所有HTML文件中的IP
find /app -name '*.html' -type f -exec sed -i 's/$OLD_IP/$NEW_IP/g' {} \; 2>/dev/null

# 替换配置文件中的IP
find /app -name '*.json' -type f -exec sed -i 's/$OLD_IP/$NEW_IP/g' {} \; 2>/dev/null

# 检查.env文件
if [ -f '/app/.env' ]; then
    sed -i 's/$OLD_IP/$NEW_IP/g' /app/.env
    echo '✅ 已更新 .env 文件'
fi

if [ -f '/app/.env.local' ]; then
    sed -i 's/$OLD_IP/$NEW_IP/g' /app/.env.local
    echo '✅ 已更新 .env.local 文件'
fi

echo '🔍 验证替换结果...'
echo '找到的新IP地址:'
find /app -type f \( -name '*.js' -o -name '*.html' -o -name '*.json' \) -exec grep -l '$NEW_IP' {} \; 2>/dev/null | head -5

echo '✅ IP替换完成'
"

if [ $? -eq 0 ]; then
    echo "✅ IP地址替换成功"
    
    echo "🔄 重启容器以应用更改..."
    sudo /usr/local/bin/docker restart $CONTAINER_NAME
    
    echo "⏳ 等待容器启动..."
    sleep 5
    
    echo "🔍 检查容器状态..."
    sudo /usr/local/bin/docker ps | grep $CONTAINER_NAME
    
    echo "📋 查看容器日志..."
    sudo /usr/local/bin/docker logs --tail 10 $CONTAINER_NAME
    
    echo ""
    echo "🎉 修复完成！"
    echo "🌐 新的API地址: http://$NEW_IP:8081"
    echo "🔗 访问应用: http://$NEW_IP:8081"
    
else
    echo "❌ IP替换失败"
    exit 1
fi 