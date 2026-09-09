import { defineConfig } from 'vite'

// base: './' 让构建产物使用相对路径 (./assets/...)。
// 这样无论托管在 GitHub Pages 项目子路径 (用户名.github.io/仓库名/)、
// 还是任意静态服务器根目录，资源都能正确加载；也支持本地用
// `python3 -m http.server` 起服务直接预览，无需把 base 写死成绝对路径。
export default defineConfig({
  base: './',
})
