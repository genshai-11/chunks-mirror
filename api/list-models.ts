import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const base = (process.env.NINEROUTER_URL || '').replace(/\/$/, '')
  if (!base) {
    res.status(503).json({ error: 'NINEROUTER_URL not configured' })
    return
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.NINEROUTER_KEY) headers['Authorization'] = `Bearer ${process.env.NINEROUTER_KEY}`

  try {
    const upstream = await fetch(`${base}/models`, { headers })
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'upstream error', status: upstream.status })
      return
    }
    const data = await upstream.json()
    res.json(data)
  } catch (e: unknown) {
    res.status(500).json({ error: 'proxy failure', message: String((e as Error)?.message || e) })
  }
}
