/**
 * Same-origin /api/generate-text proxy handler (for 9router "lucy" or other text/LLM models).
 * Used by Vite dev middleware and (later) Firebase Functions.
 * Never expose NINEROUTER_KEY to the browser.
 * Mirrors the text generation used for "Prepared texts" phase-1 before TTS batch.
 */
export interface GenerateTextRequest {
  model: string // e.g. "lucy"
  prompt: string
}

export async function handleGenerateTextProxy(
  reqBody: unknown,
  env: { NINEROUTER_URL?: string; NINEROUTER_KEY?: string }
): Promise<{ ok: boolean; status: number; contentType?: string; body: string | ArrayBuffer }> {
  const body = (reqBody || {}) as GenerateTextRequest
  if (!body.model || !body.prompt) {
    return { ok: false, status: 400, body: JSON.stringify({ error: 'model and prompt required' }) }
  }

  const upstreamBase = (env.NINEROUTER_URL || '').replace(/\/$/, '')
  // NINEROUTER_URL already includes /v1, so just append /chat/completions
  const upstream = `${upstreamBase}/chat/completions`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'chunks-mirror/1.0',
  }
  if (env.NINEROUTER_KEY) headers['Authorization'] = `Bearer ${env.NINEROUTER_KEY}`

  const upstreamBody = {
    model: body.model,
    messages: [{ role: 'user', content: body.prompt }],
  }

  const res = await fetch(upstream, {
    method: 'POST',
    headers,
    body: JSON.stringify(upstreamBody),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, status: res.status, body: JSON.stringify({ error: 'upstream', status: res.status, body: text.slice(0, 500) }) }
  }

  const ct = res.headers.get('content-type') || 'application/json'
  const buf = await res.arrayBuffer()
  return { ok: true, status: 200, contentType: ct, body: buf }
}
