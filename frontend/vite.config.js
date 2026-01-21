import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 设置为相对路径，确保 Electron 打包后能正确加载资源
  build: {
    chunkSizeWarningLimit: 1000, // 提高警告阈值到 1000kB
    rollupOptions: {
      output: {
        // 分包配置，减小主包体积
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 将 lucide-react 等大型库单独打包
            if (id.includes('lucide-react')) return 'lucide-vendor';
            if (id.includes('framer-motion')) return 'motion-vendor';
            // 其他 node_modules 统一打包到 vendor
            return 'vendor';
          }
        }
      }
    }
  }
})
