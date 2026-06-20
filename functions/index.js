const crypto = require('node:crypto')
const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const logger = require('firebase-functions/logger')
const admin = require('firebase-admin')

admin.initializeApp()

const ninerouterKey = defineSecret('NINEROUTER_KEY')
const ninerouterUrl = defineSecret('NINEROUTER_URL')
const adminSecret = defineSecret('ADMIN_SECRET')
const s2sSecret = defineSecret('S2S_SECRET')

function sendJson(res, status, payload) {
  res.status(status).set('Content-Type', 'application/json').send(JSON.stringify(payload))
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''))
  const right = Buffer.from(String(b || ''))
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function requireS2S(req, res) {
  const expected = s2sSecret.value() || process.env.S2S_SECRET
  const authorization = req.get('authorization') || ''
  const bearer = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : ''
  const provided = bearer || req.get('x-s2s-key') || req.query.s2sKey

  if (!expected || !provided || !safeEqual(provided, expected)) {
    sendJson(res, 401, { error: 'unauthorized' })
    return false
  }

  return true
}

function requireMethod(req, res, method) {
  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return false
  }
  if (req.method !== method) {
    sendJson(res, 405, { error: 'Method Not Allowed' })
    return false
  }
  return true
}

function requestRoute(req) {
  const pathname = new URL(req.url, `https://${req.headers.host || 'chunks-mirror.web.app'}`).pathname
  return pathname.replace(/^\/api/, '') || '/'
}

function bodyOf(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string' && req.body.length > 0) {
    try { return JSON.parse(req.body) } catch { return {} }
  }
  return {}
}

function upstreamBase() {
  return (ninerouterUrl.value() || process.env.NINEROUTER_URL || 'https://api.9router.com/v1').replace(/\/$/, '')
}

function upstreamHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'chunks-mirror/1.0',
  }
  const key = ninerouterKey.value() || process.env.NINEROUTER_KEY
  if (key) headers.Authorization = `Bearer ${key}`
  return headers
}

async function health(req, res) {
  if (!requireMethod(req, res, 'GET')) return
  sendJson(res, 200, {
    ok: true,
    service: 'chunks-mirror-api',
    runtime: 'firebase-functions-v2',
    region: 'asia-east1',
    time: new Date().toISOString(),
  })
}

async function s2sHealth(req, res) {
  if (!requireMethod(req, res, 'GET')) return
  if (!requireS2S(req, res)) return
  sendJson(res, 200, {
    ok: true,
    authenticated: true,
    service: 'chunks-mirror-s2s',
    bucket: configuredBucket().name,
    time: new Date().toISOString(),
  })
}

async function proxyTts(req, res) {
  if (!requireMethod(req, res, 'POST')) return
  const body = bodyOf(req)
  if (!body.model || !body.input) {
    sendJson(res, 400, { error: 'model and input required' })
    return
  }

  try {
    const upstreamRes = await fetch(`${upstreamBase()}/audio/speech`, {
      method: 'POST',
      headers: upstreamHeaders(),
      body: JSON.stringify({ model: body.model, input: body.input }),
    })

    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => '')
      sendJson(res, upstreamRes.status, { error: 'upstream', status: upstreamRes.status, body: text.slice(0, 500) })
      return
    }

    const ct = upstreamRes.headers.get('content-type') || 'audio/mpeg'
    const buf = Buffer.from(await upstreamRes.arrayBuffer())
    res.status(200).set('Content-Type', ct).send(buf)
  } catch (error) {
    logger.error('tts proxy failure', error)
    sendJson(res, 500, { error: 'proxy failure', message: String(error && error.message ? error.message : error) })
  }
}

async function proxyGenerateText(req, res) {
  if (!requireMethod(req, res, 'POST')) return
  const body = bodyOf(req)
  if (!body.model || !body.prompt) {
    sendJson(res, 400, { error: 'model and prompt required' })
    return
  }

  try {
    const upstreamRes = await fetch(`${upstreamBase()}/chat/completions`, {
      method: 'POST',
      headers: upstreamHeaders(),
      body: JSON.stringify({
        model: body.model,
        messages: [{ role: 'user', content: body.prompt }],
      }),
    })

    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => '')
      sendJson(res, upstreamRes.status, { error: 'upstream', status: upstreamRes.status, body: text.slice(0, 500) })
      return
    }

    const ct = upstreamRes.headers.get('content-type') || 'application/json'
    const buf = Buffer.from(await upstreamRes.arrayBuffer())
    res.status(200).set('Content-Type', ct).send(buf)
  } catch (error) {
    logger.error('generate-text proxy failure', error)
    sendJson(res, 500, { error: 'proxy failure', message: String(error && error.message ? error.message : error) })
  }
}

async function listModels(req, res) {
  if (!requireMethod(req, res, 'GET')) return
  try {
    const upstreamRes = await fetch(`${upstreamBase()}/models`, { headers: upstreamHeaders() })
    if (!upstreamRes.ok) {
      sendJson(res, upstreamRes.status, { error: 'upstream error', status: upstreamRes.status })
      return
    }
    sendJson(res, 200, await upstreamRes.json())
  } catch (error) {
    logger.error('list-models proxy failure', error)
    sendJson(res, 500, { error: 'proxy failure', message: String(error && error.message ? error.message : error) })
  }
}

function configuredBucket() {
  return admin.storage().bucket(process.env.CHUNKS_AUDIO_BUCKET || 'chunks-mirror-audio-284566312743')
}

function extensionFor(contentType) {
  if (String(contentType).includes('webm')) return 'webm'
  if (String(contentType).includes('wav')) return 'wav'
  if (String(contentType).includes('ogg')) return 'ogg'
  return 'mp3'
}

function audioFormatFor(contentType) {
  if (String(contentType).includes('webm')) return 'webm'
  if (String(contentType).includes('wav')) return 'wav'
  if (String(contentType).includes('ogg')) return 'ogg'
  if (String(contentType).includes('mpeg') || String(contentType).includes('mp3')) return 'mp3'
  return 'webm'
}

function parseJsonObject(text) {
  const raw = String(text || '').trim()
  if (!raw) return {}
  try { return JSON.parse(raw) } catch {}
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) {
    try { return JSON.parse(fenced[1]) } catch {}
  }
  const first = raw.indexOf('{')
  const last = raw.lastIndexOf('}')
  if (first >= 0 && last > first) {
    try { return JSON.parse(raw.slice(first, last + 1)) } catch {}
  }
  return {}
}

function firstChatContent(payload) {
  const content = payload && payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content
  if (Array.isArray(content)) {
    return content.map((part) => typeof part === 'string' ? part : part.text || '').join('\n').trim()
  }
  return String(content || '').trim()
}

function parseChatCompletionResponse(text) {
  const raw = String(text || '').trim()
  if (!raw) return {}
  try { return JSON.parse(raw) } catch {}

  // Some 9router/model responses come back as Server-Sent Events:
  //   data: {"id":"...","choices":[...]}
  //   data: [DONE]
  const dataLines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== '[DONE]')

  for (let i = dataLines.length - 1; i >= 0; i -= 1) {
    try { return JSON.parse(dataLines[i]) } catch {}
  }

  throw new Error(`Could not parse 9router response: ${raw.slice(0, 300)}`)
}

async function chatCompletion({ model, messages, temperature = 0, responseFormat }) {
  const body = { model, messages, temperature }
  if (responseFormat) body.response_format = responseFormat

  const upstreamRes = await fetch(`${upstreamBase()}/chat/completions`, {
    method: 'POST',
    headers: upstreamHeaders(),
    body: JSON.stringify(body),
  })

  const text = await upstreamRes.text().catch(() => '')
  if (!upstreamRes.ok) {
    const error = new Error(`9router upstream ${upstreamRes.status}: ${text.slice(0, 500)}`)
    error.status = upstreamRes.status
    throw error
  }

  return parseChatCompletionResponse(text)
}

function downloadUrl(bucketName, pathname) {
  const encodedPath = String(pathname).split('/').map(encodeURIComponent).join('/')
  return `https://storage.googleapis.com/${bucketName}/${encodedPath}`
}

async function saveJson(file, payload) {
  await file.save(JSON.stringify(payload || {}), {
    resumable: false,
    metadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'private, max-age=0, no-store',
    },
  })
}

async function tokenForFile(file) {
  const [metadata] = await file.getMetadata()
  const token = metadata.metadata && metadata.metadata.firebaseStorageDownloadTokens
  if (token) return token
  const freshToken = crypto.randomUUID()
  await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: freshToken } })
  return freshToken
}

async function uploadAudio(req, res) {
  if (!requireMethod(req, res, 'POST')) return
  const body = bodyOf(req)
  const { audioBase64, contentType = 'audio/mpeg', metadata = {} } = body
  if (!audioBase64) {
    sendJson(res, 400, { error: 'audioBase64 required' })
    return
  }

  try {
    const bucket = configuredBucket()
    const ext = extensionFor(contentType)
    const pathname = `audio/${Date.now()}-${crypto.randomUUID()}.${ext}`
    const token = crypto.randomUUID()
    const buffer = Buffer.from(audioBase64, 'base64')
    const audioFile = bucket.file(pathname)
    const metaPathname = `${pathname}.meta.json`
    const metaFile = bucket.file(metaPathname)

    await Promise.all([
      audioFile.save(buffer, {
        resumable: false,
        metadata: {
          contentType,
          cacheControl: 'public, max-age=31536000, immutable',
          metadata: { firebaseStorageDownloadTokens: token },
        },
      }),
      saveJson(metaFile, metadata),
    ])

    sendJson(res, 200, {
      url: downloadUrl(bucket.name, pathname),
      pathname,
      storagePath: pathname,
      metaPathname,
    })
  } catch (error) {
    logger.error('upload-audio failure', error)
    sendJson(res, 500, { error: 'upload failure', message: String(error && error.message ? error.message : error) })
  }
}

async function listAudio(req, res) {
  if (!requireMethod(req, res, 'GET')) return
  try {
    const bucket = configuredBucket()
    const [files] = await bucket.getFiles({ prefix: 'audio/' })
    const audioFiles = files.filter((file) => !file.name.endsWith('.meta.json'))
    const metaByName = new Map(files.filter((file) => file.name.endsWith('.meta.json')).map((file) => [file.name, file]))

    const items = await Promise.all(audioFiles.map(async (file) => {
      let metadata = {}
      const metaFile = metaByName.get(`${file.name}.meta.json`)
      if (metaFile) {
        try {
          const [contents] = await metaFile.download()
          metadata = JSON.parse(contents.toString('utf8'))
        } catch (error) {
          logger.warn('Could not read metadata sidecar', { file: metaFile.name, error: String(error && error.message ? error.message : error) })
        }
      }
      await tokenForFile(file).catch(() => undefined)
      const [fileMetadata] = await file.getMetadata()
      return {
        url: downloadUrl(bucket.name, file.name),
        pathname: file.name,
        storagePath: file.name,
        uploadedAt: fileMetadata.timeCreated,
        ...metadata,
      }
    }))

    sendJson(res, 200, { items })
  } catch (error) {
    logger.error('list-audio failure', error)
    sendJson(res, 500, { error: 'list failure', message: String(error && error.message ? error.message : error) })
  }
}

function pathFromUrl(url) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'storage.googleapis.com') {
      const parts = parsed.pathname.split('/').filter(Boolean)
      return parts.length >= 2 ? decodeURIComponent(parts.slice(1).join('/')) : ''
    }

    const marker = '/o/'
    const index = parsed.pathname.indexOf(marker)
    if (index === -1) return ''
    return decodeURIComponent(parsed.pathname.slice(index + marker.length))
  } catch {
    return ''
  }
}

async function transcribeEreAudio({ audioBase64, contentType }) {
  const model = process.env.ERE_STT_MODEL || 'gemini/gemini-2.5-flash-lite'
  const payload = await chatCompletion({
    model,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Transcribe this learner English speaking audio. Return strict JSON only: {"transcript":"..."}. If speech is unclear, return the best short transcript.',
        },
        {
          type: 'input_audio',
          input_audio: {
            data: audioBase64,
            format: audioFormatFor(contentType),
          },
        },
      ],
    }],
    temperature: 0,
    responseFormat: { type: 'json_object' },
  })

  const parsed = parseJsonObject(firstChatContent(payload))
  return String(parsed.transcript || '').trim()
}

async function compareEreMeaning({ sourceText, transcript }) {
  const model = process.env.ERE_COMPARE_MODEL || 'lucy'
  const payload = await chatCompletion({
    model,
    messages: [{
      role: 'user',
      content: `You are evaluating an English speaking practice attempt.\n\nOriginal English sentence:\n${sourceText}\n\nLearner transcript:\n${transcript}\n\nDecide whether the learner preserved the core meaning. Exact word-for-word matching is NOT required. Minor grammar or wording differences are okay if the main idea remains.\n\nReturn strict JSON only with this shape:\n{\n  "passed": true,\n  "score": 0.0,\n  "feedback": "one short learner-friendly sentence",\n  "meaningSummary": "short summary of preserved/missing meaning"\n}`,
    }],
    temperature: 0,
    responseFormat: { type: 'json_object' },
  })

  const parsed = parseJsonObject(firstChatContent(payload))
  const score = Number(parsed.score)
  return {
    passed: Boolean(parsed.passed),
    score: Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0,
    feedback: String(parsed.feedback || 'Meaning comparison completed.'),
    meaningSummary: String(parsed.meaningSummary || ''),
  }
}

async function evaluateEreAttempt(req, res) {
  if (!requireMethod(req, res, 'POST')) return
  const body = bodyOf(req)
  const {
    resourceId,
    sourceText,
    ereTopic,
    erePart,
    audioBase64,
    contentType = 'audio/webm',
    learnerId = 'anonymous',
  } = body

  if (!resourceId || !sourceText || !audioBase64) {
    sendJson(res, 400, { error: 'resourceId, sourceText and audioBase64 required' })
    return
  }

  if (String(audioBase64).length > 4_000_000) {
    sendJson(res, 413, { error: 'recording too large' })
    return
  }

  try {
    const attemptId = `ere-${Date.now()}-${crypto.randomUUID()}`
    const safeLearnerId = String(learnerId).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'anonymous'
    const ext = extensionFor(contentType)
    const recordingPath = `attempts/ere/${safeLearnerId}/${attemptId}.${ext}`
    const jsonPath = `attempts/ere/${safeLearnerId}/${attemptId}.json`
    const bucket = configuredBucket()
    const recordingBuffer = Buffer.from(String(audioBase64), 'base64')

    const transcript = await transcribeEreAudio({ audioBase64, contentType })
    const comparison = await compareEreMeaning({ sourceText, transcript })

    const attempt = {
      attemptId,
      learnerId: safeLearnerId,
      resourceId,
      sourceText,
      transcript,
      passed: comparison.passed,
      score: comparison.score,
      feedback: comparison.feedback,
      meaningSummary: comparison.meaningSummary,
      ereTopic: typeof ereTopic === 'number' ? ereTopic : Number(ereTopic) || null,
      erePart: erePart || '',
      createdAt: new Date().toISOString(),
      recordingPath,
    }

    await Promise.all([
      bucket.file(recordingPath).save(recordingBuffer, {
        resumable: false,
        metadata: {
          contentType,
          cacheControl: 'private, max-age=0, no-store',
        },
      }),
      saveJson(bucket.file(jsonPath), attempt),
    ])

    sendJson(res, 200, {
      attemptId,
      transcript,
      passed: attempt.passed,
      score: attempt.score,
      feedback: attempt.feedback,
    })
  } catch (error) {
    logger.error('ere evaluate failure', error)
    sendJson(res, error.status || 500, { error: 'ere evaluation failure', message: String(error && error.message ? error.message : error) })
  }
}

async function deleteAudio(req, res) {
  if (!requireMethod(req, res, 'POST')) return
  const body = bodyOf(req)
  const storagePath = body.storagePath || body.pathname || pathFromUrl(body.url || '')
  if (!storagePath || !String(storagePath).startsWith('audio/') || String(storagePath).endsWith('.meta.json')) {
    sendJson(res, 400, { error: 'valid audio storagePath or url required' })
    return
  }

  try {
    const bucket = configuredBucket()
    await Promise.all([
      bucket.file(storagePath).delete({ ignoreNotFound: true }),
      bucket.file(`${storagePath}.meta.json`).delete({ ignoreNotFound: true }),
    ])
    sendJson(res, 200, { ok: true })
  } catch (error) {
    logger.error('delete-audio failure', error)
    sendJson(res, 500, { error: 'delete failure', message: String(error && error.message ? error.message : error) })
  }
}

async function s2sListAudio(req, res) {
  if (!requireMethod(req, res, 'GET')) return
  if (!requireS2S(req, res)) return
  return listAudio(req, res)
}

async function s2sUploadAudio(req, res) {
  if (!requireMethod(req, res, 'POST')) return
  if (!requireS2S(req, res)) return
  return uploadAudio(req, res)
}

async function s2sDeleteAudio(req, res) {
  if (!requireMethod(req, res, 'POST')) return
  if (!requireS2S(req, res)) return
  return deleteAudio(req, res)
}

async function adminCleanup(req, res) {
  const secret = req.get('x-admin-secret') || req.query.secret
  const expected = adminSecret.value() || process.env.ADMIN_SECRET
  if (!expected || secret !== expected) {
    sendJson(res, 403, { error: 'forbidden' })
    return
  }

  const keepCategory = String(req.query.keep || 'sfx_animal')
  const dryRun = req.query.dry === '1'

  try {
    const bucket = configuredBucket()
    const [files] = await bucket.getFiles({ prefix: 'audio/' })
    const audioFiles = files.filter((file) => !file.name.endsWith('.meta.json'))
    const metaByName = new Map(files.filter((file) => file.name.endsWith('.meta.json')).map((file) => [file.name, file]))
    const toDelete = []
    const kept = []

    for (const file of audioFiles) {
      let category = 'unknown'
      const metaFile = metaByName.get(`${file.name}.meta.json`)
      if (metaFile) {
        try {
          const [contents] = await metaFile.download()
          const meta = JSON.parse(contents.toString('utf8'))
          category = meta.category || category
        } catch {}
      }
      if (category === keepCategory) {
        kept.push(file.name)
      } else {
        toDelete.push(file.name)
        if (metaFile) toDelete.push(metaFile.name)
      }
    }

    if (!dryRun) {
      await Promise.all(toDelete.map((path) => bucket.file(path).delete({ ignoreNotFound: true }).catch(() => undefined)))
    }

    sendJson(res, 200, { dryRun, deleted: dryRun ? 0 : toDelete.length, wouldDelete: toDelete.length, kept: kept.length, keepCategory })
  } catch (error) {
    logger.error('admin-cleanup failure', error)
    sendJson(res, 500, { error: 'cleanup failure', message: String(error && error.message ? error.message : error) })
  }
}

exports.api = onRequest({
  region: 'asia-east1',
  memory: '512MiB',
  timeoutSeconds: 120,
  maxInstances: 5,
  secrets: [ninerouterKey, ninerouterUrl, adminSecret, s2sSecret],
}, async (req, res) => {
  const route = requestRoute(req)

  if (route === '/health') return health(req, res)
  if (route === '/s2s/health') return s2sHealth(req, res)
  if (route === '/s2s/list-audio') return s2sListAudio(req, res)
  if (route === '/s2s/upload-audio') return s2sUploadAudio(req, res)
  if (route === '/s2s/delete-audio') return s2sDeleteAudio(req, res)

  if (route === '/tts') return proxyTts(req, res)
  if (route === '/generate-text') return proxyGenerateText(req, res)
  if (route === '/list-models') return listModels(req, res)
  if (route === '/upload-audio') return uploadAudio(req, res)
  if (route === '/list-audio') return listAudio(req, res)
  if (route === '/ere/evaluate-attempt') return evaluateEreAttempt(req, res)
  if (route === '/delete-audio') return deleteAudio(req, res)
  if (route === '/admin-cleanup') return adminCleanup(req, res)

  sendJson(res, 404, { error: 'not found', route })
})
