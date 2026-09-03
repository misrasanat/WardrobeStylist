import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Runs the /api/*.js serverless functions inside the Vite dev server, so
// `npm run dev` alone gives a working local app (same files Netlify deploys
// in production — this plugin only applies to `vite dev`, not the build).
function localApiRoutes() {
  const routes = {
    '/api/analyze': () => import('./netlify/functions/analyze.js'),
    '/api/suggest': () => import('./netlify/functions/suggest.js'),
  }

  return {
    name: 'local-api-routes',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv('development', process.cwd(), '')
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value
      }

      server.middlewares.use(async (req, res, next) => {
        const importer = routes[req.url.split('?')[0]]
        if (!importer || req.method !== 'POST') return next()

        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', async () => {
          try {
            req.body = body ? JSON.parse(body) : {}
          } catch {
            req.body = {}
          }
          res.status = (code) => {
            res.statusCode = code
            return res
          }
          res.json = (payload) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(payload))
          }
          try {
            const mod = await importer()
            await mod.default(req, res)
          } catch (err) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: err.message }))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localApiRoutes()],
  server: {
    https: {
      key: './cert-key.pem',
      cert: './cert.pem',
    },
    host: true,
  },
})
