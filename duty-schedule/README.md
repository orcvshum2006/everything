# 🗑️ 值班表管理系统

一个基于 React + Express 的值班表管理应用，支持多用户同步的倒垃圾值日安排。

## ✨ 功能特性

- 📋 **今日值班突出显示** - 一目了然查看今天轮到谁值班
- 👥 **人员管理** - 轻松添加、删除、调整值班人员顺序  
- 📅 **日期设置** - 自定义值班开始日期
- 📊 **值班预览** - 查看未来一周的值班安排
- 🔄 **实时同步** - 所有用户看到的数据保持一致
- 📱 **响应式设计** - 支持桌面和移动端访问
- 💾 **数据持久化** - 服务器端存储，数据不丢失

## 🚀 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn

### 本地开发

1. **启动后端服务**

```bash
cd duty-schedule/backend
npm install
npm run dev
```

后端服务将在 `http://localhost:3001` 启动

2. **启动前端应用** 

```bash
cd duty-schedule
npm install
npm run dev
```

前端应用将在 `http://localhost:5173` 启动

3. **访问应用**

打开浏览器访问 `http://localhost:5173` 即可使用

## 🚀 部署配置

### 环境变量配置

项目支持灵活的环境变量配置，适应不同的部署场景：

#### 前端配置
```bash
# 复制示例文件
cp .env.example .env.local

# 编辑配置
VITE_API_URL=你的API地址
```

#### 后端配置  
```bash
# 在 backend/ 目录下
PORT=3001          # 服务器端口
HOST=0.0.0.0       # 绑定地址
```

### 部署方式

#### 1. 本地开发
```bash
./deploy.sh dev
```

#### 2. 生产环境构建
```bash
# 设置API地址并构建
VITE_API_URL=https://api.yourdomain.com npm run build

# 或使用部署脚本
./deploy.sh prod
```

#### 3. 自定义部署
```bash
# 前端：自定义API地址
VITE_API_URL=http://your-server:8080 npm run build

# 后端：自定义端口和绑定地址
PORT=8080 HOST=127.0.0.1 npm start
```

### 部署示例

**Nginx + 后端同服务器**
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # 前端静态文件
    location / {
        root /path/to/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # API代理
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**分离部署**
```bash
# 前端部署到 CDN/静态服务器
VITE_API_URL=https://api.yourdomain.com npm run build

# 后端部署到独立服务器
PORT=3001 HOST=0.0.0.0 npm start
```

## 📁 项目结构

```
duty-schedule/
├── backend/                 # 后端 API 服务
│   ├── server.js           # Express 服务器
│   ├── package.json        # 后端依赖
│   └── data/              # 数据存储目录
├── src/                    # 前端源码
│   ├── components/         # React 组件
│   ├── hooks/             # 自定义 Hooks
│   ├── services/          # API 服务
│   ├── types/             # TypeScript 类型定义
│   └── utils/             # 工具函数
├── dist/                   # 前端构建产物
└── DEPLOYMENT.md          # 部署指南
```

## 🔧 API 接口

### 获取值班表数据
```
GET /api/duty-schedule
```

### 更新值班表数据
```
PUT /api/duty-schedule
Content-Type: application/json

{
  "people": [
    {"id": "1", "name": "张三", "order": 1},
    {"id": "2", "name": "李四", "order": 2}
  ],
  "startDate": "2025-06-03"
}
```

### 健康检查
```
GET /api/health
```

## 🎯 使用说明

1. **添加值班人员**
   - 在"人员管理"区域输入姓名，点击"添加"

2. **调整值班顺序**
   - 使用"↑"和"↓"按钮调整人员在值班列表中的顺序

3. **设置开始日期**
   - 在"日期设置"区域选择值班轮替的开始日期

4. **查看值班安排**
   - 主页顶部显示今日值班人员
   - 右侧"未来一周值班安排"显示接下来的排班

## 🔄 数据同步

系统采用服务器端存储，所有数据变更会实时同步到所有客户端：

- ✅ 添加/删除人员后，所有用户立即看到更新
- ✅ 调整值班顺序后，排班自动重新计算
- ✅ 修改开始日期后，所有用户的值班安排同步更新

## 🛠️ 技术栈

### 前端
- React 18
- TypeScript
- CSS Modules
- Vite

### 后端  
- Node.js
- Express.js
- fs-extra (文件操作)
- CORS (跨域支持)

## 📦 部署

详细的部署指南请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)

支持以下部署方式：
- 单服务器部署 (PM2 + Nginx)
- Docker 容器化部署
- 云服务部署 (Vercel + Railway)

## 🐛 故障排除

### 前端无法连接后端
1. 确认后端服务已启动在 3001 端口
2. 检查防火墙设置
3. 验证 API_URL 环境变量配置

### 数据无法保存
1. 检查后端 data 目录写入权限
2. 确认磁盘空间充足
3. 查看后端服务日志

## 📝 开发计划

- [ ] 支持值班备注功能
- [ ] 添加值班提醒通知
- [ ] 支持导出值班表
- [ ] 添加值班历史记录
- [ ] 支持多个值班组管理

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## �� 许可证

ISC License
