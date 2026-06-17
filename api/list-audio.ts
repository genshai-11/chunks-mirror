import type { VercelRequest, VercelResponse } from '@vercel/node'
import { list } from '@vercel/blob'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method Not Allowed' }); return }

  const { blobs } = await list({ prefix: 'audio/', limit: 1000 })
  const audioBlobs = blobs.filter(b => !b.pathname.endsWith('.meta.json'))

  const items = await Promise.all(audioBlobs.map(async (blob) => {
    const metaBlob = blobs.find(b => b.pathname === blob.pathname + '.meta.json')
    let metadata: Record<string, unknown> = {}
    if (metaBlob) {
      try {
        const r = await fetch(metaBlob.url)
        metadata = await r.json()
      } catch {}
    }
    return { url: blob.url, pathname: blob.pathname, uploadedAt: blob.uploadedAt, ...metadata }
  }))

  res.json({ items })
}
