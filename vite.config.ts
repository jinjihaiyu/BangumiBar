import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import path from 'path'

// 设置页的版本号原来是写死的字符串，会和 package.json 脱节，这里在构建时注入。
const { version } = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version)
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  base: './'
})
