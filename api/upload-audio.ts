import type { VercelRequest, VercelResponse } from '@vercel/node'
import { put } from '@vercel/blob'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return }

  const { audioBase64, contentType = 'audio/mpeg', metadata } = req.body || {}
  if (!audioBase64) { res.status(400).json({ error: 'audioBase64 required' }); return }

  const ext = contentType.includes('webm') ? 'webm' : 'mp3'
  const pathname = `audio/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const buffer = Buffer.from(audioBase64, 'base64')
  const metaPathname = pathname + '.meta.json'

  const [blob, metaBlob] = await Promise.all([
    put(pathname, buffer, { access: 'public', contentType, addRandomSuffix: false }),
    put(metaPathname, JSON.stringify(metadata || {}), { access: 'public', contentType: 'application/json', addRandomSuffix: false }),
  ])

  res.json({ url: blob.url, pathname, metaUrl: metaBlob.url })
}
