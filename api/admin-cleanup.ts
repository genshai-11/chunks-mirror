import type { VercelRequest, VercelResponse } from '@vercel/node'
import { list, del } from '@vercel/blob'

// One-time cleanup endpoint — delete after use
// Deletes all blobs EXCEPT those with category = sfx_animal
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = req.headers['x-admin-secret'] || req.query.secret
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    res.status(403).json({ error: 'forbidden' })
    return
  }

  const keepCategory = (req.query.keep as string) || 'sfx_animal'
  const dryRun = req.query.dry === '1'

  let cursor: string | undefined
  const toDelete: string[] = []
  const kept: string[] = []

  // Page through all blobs
  do {
    const result = await list({ prefix: 'audio/', limit: 1000, cursor })
    cursor = result.cursor

    const audioBlobs = result.blobs.filter(b => !b.pathname.endsWith('.meta.json'))
    const metaBlobs = result.blobs.filter(b => b.pathname.endsWith('.meta.json'))

    for (const blob of audioBlobs) {
      const metaBlob = metaBlobs.find(m => m.pathname === blob.pathname + '.meta.json')
      let category = 'unknown'
      if (metaBlob) {
        try {
          const r = await fetch(metaBlob.url)
          const meta = await r.json()
          category = meta.category || 'unknown'
        } catch {}
      }

      if (category === keepCategory) {
        kept.push(blob.pathname)
      } else {
        toDelete.push(blob.url)
        // also collect meta url
        if (metaBlob) toDelete.push(metaBlob.url)
      }
    }
  } while (cursor)

  if (dryRun) {
    res.json({ dryRun: true, wouldDelete: toDelete.length, wouldKeep: kept.length, keepCategory })
    return
  }

  // Delete in batches of 20
  let deleted = 0
  for (let i = 0; i < toDelete.length; i += 20) {
    const batch = toDelete.slice(i, i + 20)
    await Promise.all(batch.map(url => del(url).catch(() => {})))
    deleted += batch.length
  }

  res.json({ deleted, kept: kept.length, keepCategory })
}
