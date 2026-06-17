/**
 * Same-origin /api/tts proxy handler.
 * Used by Vite dev middleware and (later) Firebase Functions.
 * Never expose NINEROUTER_KEY to the browser.
 */
export interface TtsRequest {
  model: string
  input: string
}

export async function handleTtsProxy(reqBody: unknown, env: { NINEROUTER_URL?: string; NINEROUTER_KEY?: string }): Promise<{ ok: boolean; status: number; contentType?: string; body: ArrayBuffer | string }> {
  const body = (reqBody || {}) as TtsRequest
  if (!body.model || !body.input) {
    return { ok: false, status: 400, body: JSON.stringify({ error: 'model and input required' }) }
  }

  const upstream = `${(env.NINEROUTER_URL || '').replace(/\/$/, '')}/audio/speech`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'chunks-mirror/1.0',
  }
  if (env.NINEROUTER_KEY) headers['Authorization'] = `Bearer ${env.NINEROUTER_KEY}`

  const res = await fetch(upstream, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: body.model, input: body.input }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, status: res.status, body: JSON.stringify({ error: 'upstream', status: res.status, body: text.slice(0, 500) }) }
  }

  const ct = res.headers.get('content-type') || 'audio/mpeg'
  const buf = await res.arrayBuffer()
  return { ok: true, status: 200, contentType: ct, body: buf }
}
