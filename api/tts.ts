import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const body = req.body || {}
  if (!body.model || !body.input) {
    res.status(400).json({ error: 'model and input required' })
    return
  }

  const upstream = `${(process.env.NINEROUTER_URL || '').replace(/\/$/, '')}/audio/speech`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'chunks-mirror/1.0',
  }
  if (process.env.NINEROUTER_KEY) headers['Authorization'] = `Bearer ${process.env.NINEROUTER_KEY}`

  try {
    const upstreamRes = await fetch(upstream, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: body.model, input: body.input }),
    })

    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => '')
      res.status(upstreamRes.status).json({ error: 'upstream', status: upstreamRes.status, body: text.slice(0, 500) })
      return
    }

    const ct = upstreamRes.headers.get('content-type') || 'audio/mpeg'
    const buf = Buffer.from(await upstreamRes.arrayBuffer())
    res.setHeader('Content-Type', ct)
    res.send(buf)
  } catch (e: unknown) {
    res.status(500).json({ error: 'proxy failure', message: String((e as Error)?.message || e) })
  }
}
