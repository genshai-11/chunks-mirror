const crypto = require('node:crypto')
const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const logger = require('firebase-functions/logger')
const admin = require('firebase-admin')

admin.initializeApp()

const ninerouterKey = defineSecret('NINEROUTER_KEY')
const ninerouterUrl = defineSecret('NINEROUTER_URL')
const adminSecret = defineSecret('ADMIN_SECRET')

function sendJson(res, status, payload) {
  res.status(status).set('Content-Type', 'application/json').send(JSON.stringify(payload))
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
  secrets: [ninerouterKey, ninerouterUrl, adminSecret],
}, async (req, res) => {
  const route = requestRoute(req)

  if (route === '/tts') return proxyTts(req, res)
  if (route === '/generate-text') return proxyGenerateText(req, res)
  if (route === '/list-models') return listModels(req, res)
  if (route === '/upload-audio') return uploadAudio(req, res)
  if (route === '/list-audio') return listAudio(req, res)
  if (route === '/delete-audio') return deleteAudio(req, res)
  if (route === '/admin-cleanup') return adminCleanup(req, res)

  sendJson(res, 404, { error: 'not found', route })
})
