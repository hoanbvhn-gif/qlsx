import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// GitHub Pages phuc vu app tai https://<user>.github.io/<repo>/
// => base phai la '/<repo>/'. Doi VITE_BASE trong .env neu ten repo khac.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: env.VITE_BASE || '/qlsx/',
    // Dau moc phien ban — de biet web dang chay ban nao
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __BUILD_NO__: JSON.stringify(env.VITE_BUILD_NO || 'local'),
      __COMMIT__: JSON.stringify((env.VITE_COMMIT || '').slice(0, 7))
    },
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    build: { outDir: 'dist', sourcemap: false }
  }
})
