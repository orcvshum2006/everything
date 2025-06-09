#!/bin/bash

echo "🚀 启动简化版值班表系统 (内存数据库)"

# 停止现有容器
sudo /usr/local/bin/docker-compose -f docker-compose-synology.yml down 2>/dev/null || true

# 运行简化版本
sudo /usr/local/bin/docker run -d \
  --name duty-schedule-simple \
  --restart unless-stopped \
  -p 8081:8081 \
  -v /volume1/docker/duty-schedule-synology/data:/app/data \
  -e NODE_ENV=production \
  -e USE_MEMORY_DB=true \
  node:18-alpine \
  sh -c "
    echo '🔧 安装基础依赖...'
    apk add --no-cache sqlite
    
    echo '📦 创建简化应用...'
    mkdir -p /app
    cd /app
    
    cat > package.json << 'PKGJSON'
{
  \"name\": \"duty-schedule-simple\",
  \"version\": \"1.0.0\",
  \"dependencies\": {
    \"express\": \"^4.18.2\",
    \"cors\": \"^2.8.5\"
  }
}
PKGJSON

    npm install
    
    cat > server.js << 'SERVERJS'
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8081;

// 简单的内存数据存储
let people = [
  { id: '1', name: '张三', order_index: 1, is_active: true },
  { id: '2', name: '李四', order_index: 2, is_active: true },
  { id: '3', name: '王五', order_index: 3, is_active: true }
];

let dutyRecords = [];

app.use(cors());
app.use(express.json());
app.use(express.static('/app/public'));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '简化版值班系统运行中' });
});

// 获取人员列表
app.get('/api/people', (req, res) => {
  res.json(people.filter(p => p.is_active));
});

// 获取排班记录
app.get('/api/duty-records', (req, res) => {
  res.json(dutyRecords);
});

// 添加排班记录
app.post('/api/duty-records', (req, res) => {
  const record = {
    id: Date.now().toString(),
    ...req.body,
    created_at: new Date().toISOString()
  };
  dutyRecords.push(record);
  res.json(record);
});

// 根路径返回简单页面
app.get('/', (req, res) => {
  res.send(\`
    <html>
      <head><title>值班表系统</title></head>
      <body>
        <h1>🎉 值班表系统已启动！</h1>
        <p>这是一个简化版本，使用内存数据库。</p>
        <h2>API端点:</h2>
        <ul>
          <li><a href=\"/api/health\">/api/health</a> - 健康检查</li>
          <li><a href=\"/api/people\">/api/people</a> - 人员列表</li>
          <li><a href=\"/api/duty-records\">/api/duty-records</a> - 排班记录</li>
        </ul>
        <p><strong>注意:</strong> 这是临时方案，数据存储在内存中，重启后会丢失。</p>
      </body>
    </html>
  \`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`✅ 简化版值班表系统启动成功! 端口: \${PORT}\`);
  console.log(\`🌐 访问地址: http://localhost:\${PORT}\`);
});
SERVERJS

    echo '🚀 启动应用...'
    node server.js
  "

echo "✅ 简化版启动完成!"
echo "🌐 访问地址: http://192.168.3.10:8081"
echo "📋 查看状态: sudo /usr/local/bin/docker logs duty-schedule-simple" 