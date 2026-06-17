import { defineConfig, loadEnv, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Same-origin /api/tts proxy plugin for dev.
// 9router key never leaves the server (Vite dev process). Prod: Firebase Functions.
function apiProxyPlugin(): Plugin {
  return {
    name: 'chunks-api-proxy',
    configureServer(server) {
      server.middlewares.use('/api/tts', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        try {
          const chunks: Uint8Array[] = []
          for await (const chunk of req) chunks.push(chunk)
          const bodyStr = Buffer.concat(chunks as any).toString('utf8')
          const body = JSON.parse(bodyStr || '{}')

          if (!body.model || !body.input) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'model and input required' }))
            return
          }

          const env = loadEnv('', process.cwd(), '')
          const upstreamBase = (env.NINEROUTER_URL || '').replace(/\/$/, '')
          const upstream = `${upstreamBase}/audio/speech`

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'chunks-mirror/1.0',
          }
          if (env.NINEROUTER_KEY) headers['Authorization'] = `Bearer ${env.NINEROUTER_KEY}`

          const upstreamRes = await fetch(upstream, {
            method: 'POST',
            headers,
            body: JSON.stringify({ model: body.model, input: body.input }),
          })

          if (!upstreamRes.ok) {
            const text = await upstreamRes.text().catch(() => '')
            res.statusCode = upstreamRes.status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'upstream', status: upstreamRes.status, body: text.slice(0, 500) }))
            return
          }

          const ct = upstreamRes.headers.get('content-type') || 'audio/mpeg'
          res.setHeader('Content-Type', ct)
          const buf = Buffer.from(await upstreamRes.arrayBuffer())
          res.end(buf)
        } catch (e: any) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'proxy failure', message: String(e?.message || e) }))
        }
      })

      // New proxy for generating sentence texts using 9router (e.g. model "lucy")
      // No mock data. Real call to 9router text/LLM endpoint.
      server.middlewares.use('/api/generate-text', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        try {
          const chunks: Uint8Array[] = []
          for await (const chunk of req) chunks.push(chunk)
          const bodyStr = Buffer.concat(chunks as any).toString('utf8')
          const body = JSON.parse(bodyStr || '{}')

          if (!body.model || !body.prompt) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'model and prompt required' }))
            return
          }

          const env = loadEnv('', process.cwd(), '')
          const upstreamBase = (env.NINEROUTER_URL || '').replace(/\/$/, '')
          // NINEROUTER_URL already includes /v1, so just append /chat/completions
          const upstream = `${upstreamBase}/chat/completions`

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'chunks-mirror/1.0',
          }
          if (env.NINEROUTER_KEY) headers['Authorization'] = `Bearer ${env.NINEROUTER_KEY}`

          const upstreamBody = {
            model: body.model,  // e.g. "lucy"
            messages: [{ role: 'user', content: body.prompt }],
            // Add max_tokens or other params if supported by the model
          }

          const upstreamRes = await fetch(upstream, {
            method: 'POST',
            headers,
            body: JSON.stringify(upstreamBody),
          })

          if (!upstreamRes.ok) {
            const text = await upstreamRes.text().catch(() => '')
            res.statusCode = upstreamRes.status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'upstream', status: upstreamRes.status, body: text.slice(0, 500) }))
            return
          }

          const ct = upstreamRes.headers.get('content-type') || 'application/json'
          res.setHeader('Content-Type', ct)
          const buf = Buffer.from(await upstreamRes.arrayBuffer())
          res.end(buf)
        } catch (e: any) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'proxy failure', message: String(e?.message || e) }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Safe to log non-secret presence for dev
  if (!env.NINEROUTER_URL) {
    // eslint-disable-next-line no-console
    console.warn('[chunks] NINEROUTER_URL not set in .env.local — /api/tts will fail until provided.')
  } // eslint-disable-line @typescript-eslint/no-explicit-any -- vite middleware req/res are intentionally loose here

  return {
    plugins: [react(), apiProxyPlugin()],
    server: { port: 5173 },
    build: { outDir: 'dist' },
  }
})

