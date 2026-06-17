import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleGenerateTextProxy } from './generate-text'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const result = await handleGenerateTextProxy(req.body, {
    NINEROUTER_URL: process.env.NINEROUTER_URL,
    NINEROUTER_KEY: process.env.NINEROUTER_KEY,
  })

  res.status(result.status)
  if (result.contentType) res.setHeader('Content-Type', result.contentType)

  if (result.body instanceof ArrayBuffer) {
    res.send(Buffer.from(result.body))
  } else {
    res.send(result.body)
  }
}
