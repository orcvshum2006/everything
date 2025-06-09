# 值班表管理系统 - 群辉NAS部署包（SQLite3版本）

## 🎯 安装说明

1. 将此文件夹上传到群辉NAS
2. 通过SSH连接群辉，进入文件夹
3. 运行安装脚本：
   ```bash
   chmod +x install.sh
   ./install.sh
   ```

## 🌐 访问系统

安装完成后，通过浏览器访问：
- 地址：`http://你的群辉IP:8081`
- 系统会自动初始化SQLite数据库

## 🔧 系统特性

- ✅ 使用SQLite3数据库，兼容性更好
- ✅ 针对x86_64架构优化
- ✅ 数据持久化存储
- ✅ 自动重启策略
- ✅ 完整的Web管理界面

## 📁 目录结构

```
/volume1/docker/duty-schedule/
├── data/                    # 数据目录
│   └── duty-schedule.db    # SQLite数据库文件
```

## 🛠️ 管理命令

```bash
# 查看容器状态
docker ps | grep duty-schedule

# 查看运行日志
docker logs duty-schedule

# 重启容器
docker restart duty-schedule

# 停止容器
docker stop duty-schedule

# 进入容器
docker exec -it duty-schedule sh
```

## 🔄 升级系统

1. 停止当前容器：`docker stop duty-schedule`
2. 删除容器：`docker rm duty-schedule`
3. 导入新镜像
4. 重新运行install.sh

## 🗑️ 卸载系统

```bash
chmod +x uninstall.sh
./uninstall.sh
```

## 🆘 故障排除

### 容器无法启动
1. 检查端口是否被占用：`netstat -tlnp | grep 8081`
2. 查看容器日志：`docker logs duty-schedule`
3. 检查数据目录权限：`ls -la /volume1/docker/duty-schedule/`

### 数据库问题
1. 进入容器：`docker exec -it duty-schedule sh`
2. 检查数据库文件：`ls -la /app/data/`
3. 重新初始化：`rm -f /app/data/* && docker restart duty-schedule`

## 📞 技术支持

如遇问题，请检查：
1. 群辉Docker套件是否正常运行
2. 系统是否为x86_64架构
3. 端口8081是否被其他服务占用
