import type { ChunksAwareResource } from '../domain/types'

export type EreEvaluationResult = {
  attemptId: string
  transcript: string
  passed: boolean
  score: number
  feedback: string
}

function learnerId() {
  const key = 'chunks-ere-learner-id'
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const generated = `local-${crypto.randomUUID()}`
  window.localStorage.setItem(key, generated)
  return generated
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = String(reader.result || '')
      resolve(value.includes(',') ? value.split(',').pop() || '' : value)
    }
    reader.onerror = () => reject(reader.error || new Error('Could not read recording'))
    reader.readAsDataURL(blob)
  })
}

export async function evaluateEreAttempt(resource: ChunksAwareResource, copyBlob: Blob): Promise<EreEvaluationResult> {
  const audioBase64 = await blobToBase64(copyBlob)
  const response = await fetch('/api/ere/evaluate-attempt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resourceId: resource.id,
      sourceText: resource.textPrompt || '',
      ereTopic: resource.ereTopic,
      erePart: resource.erePart,
      audioBase64,
      contentType: copyBlob.type || 'audio/webm',
      learnerId: learnerId(),
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `ERE evaluation failed (${response.status})`)
  }

  return payload as EreEvaluationResult
}
