import { defineConfig, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { installMaplePet } from './server/maplePet.js'

function maplePetInstaller() {
  return {
    name: 'maple-pet-installer',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/install-maple-pet', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.end()
          return
        }

        try {
          const chunks: Buffer[] = []
          for await (const chunk of request) {
            chunks.push(Buffer.from(chunk))
          }

          const result = await installMaplePet(
            JSON.parse(Buffer.concat(chunks).toString('utf8')),
          )
          response.setHeader('Content-Type', 'application/json')
          response.end(
            JSON.stringify({
              message: '설치되었습니다. Codex 설정에서 Pets를 새로고침해 주세요.',
              ...result,
            }),
          )
        } catch (error) {
          response.statusCode = 500
          response.setHeader('Content-Type', 'application/json')
          response.end(
            JSON.stringify({
              message: error instanceof Error ? error.message : '설치에 실패했습니다.',
            }),
          )
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), maplePetInstaller()],
  server: {
    port: 5173,
    strictPort: true,
  },
})
