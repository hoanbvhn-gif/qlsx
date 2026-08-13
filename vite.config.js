import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

/**
 * Ghi dist/version.json moi lan build.
 * File nay RAT NHO va khong co ma bam trong ten, nen trinh duyet co the
 * hoi lai bat cu luc nao de biet may chu dang co ban nao.
 * Nho no ma app tu phat hien co ban moi, khong phai xoa cache thu cong.
 */
function ghiPhienBan(info) {
  return {
    name: 'ghi-phien-ban',
    closeBundle() {
      fs.mkdirSync('dist', { recursive: true })
      fs.writeFileSync('dist/version.json', JSON.stringify(info, null, 2))
    }
  }
}

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
    plugins: [
      react(),
      ghiPhienBan({
        build: env.VITE_BUILD_NO || 'local',
        commit: (env.VITE_COMMIT || '').slice(0, 7),
        time: new Date().toISOString()
      })
    ],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    build: { outDir: 'dist', sourcemap: false }
  }
})
