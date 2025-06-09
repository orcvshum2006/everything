import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // 绑定到所有网络接口，允许通过 localhost、127.0.0.1 和 IP 地址访问
    port: 5173       // 修改这里来改变前端开发服务器端口
  }
})
