import type { VercelRequest, VercelResponse } from '@vercel/node'
import { del } from '@vercel/blob'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return }
  const { url } = req.body || {}
  if (!url) { res.status(400).json({ error: 'url required' }); return }
  // Delete the audio file; meta blob cleanup is best-effort
  await del(url).catch(() => {})
  res.json({ ok: true })
}
