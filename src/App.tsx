import { useEffect, useMemo, useState } from 'react'
import SettingsBar from './features/settings/SettingsBar'
import MirrorPage from './features/mirror/MirrorPage'
import LibraryPanel from './features/resources/LibraryPanel'
import type { RoomSettings, ChunksAwareResource } from './domain/types'
import { LocalJsonStorageAdapter } from './adapters/localJsonStorage'
import { buildPool } from './domain/selection'
import { voiceForLang, generateSpeech } from './adapters/tts'

type ThemeMode = 'dark' | 'light'

type LibraryItemLike = {
  id?: string
  category?: string
  sourceKind?: string
  language?: string
  level?: number
  form?: string
  textPrompt?: string
  soundPrompt?: string
  audioUrl?: string
  provider?: string
  approvalStatus?: string
}

type PreparedText = {
  tempId: string
  textPrompt: string
  language: string
  form: 'short' | 'medium' | 'long'
  level: 1 | 2 | 3
}

const DEFAULT_SETTINGS: RoomSettings = {
  mode: 'auto',
  oSeconds: 3,
  cSeconds: 3,
  category: '',
  language: '',
  level: '',
  sentenceForm: 'all',
  randomMix: false,
  endingCue: true,
}

const ALL_LANGS = ['vi', 'en', 'fr', 'zh', 'ja', 'ko', 'es', 'de', 'it', 'pt', 'ru', 'ar', 'hi', 'th', 'id', 'nl', 'tr', 'pl', 'sv', 'el', 'uk', 'ro', 'cs', 'fil']

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem('chunks-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isTextLangPair(value: unknown): value is { text: string; lang: string } {
  return typeof value === 'object'
    && value !== null
    && 'text' in value
    && typeof (value as { text?: unknown }).text === 'string'
    && 'lang' in value
    && typeof (value as { lang?: unknown }).lang === 'string'
}

function getLibraryItemKey(item: LibraryItemLike & { _staged?: boolean }) {
  return item.id || item.audioUrl || `${item.category || 'other'}-${item.language || 'xx'}-${item.textPrompt || item.soundPrompt || 'item'}`
}

export default function App() {
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_SETTINGS)
  const [resources, setResources] = useState<ChunksAwareResource[]>([])
  const [tab, setTab] = useState<'mirror' | 'resources'>('mirror')
  const [log, setLog] = useState('')
  const [staged, setStaged] = useState<ChunksAwareResource[]>([])
  const [promotedResources, setPromotedResources] = useState<ChunksAwareResource[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      return JSON.parse(window.localStorage.getItem('chunks-library-promoted') || '[]') as ChunksAwareResource[]
    } catch {
      return []
    }
  })

  const [batchLevel, setBatchLevel] = useState<1 | 2 | 3>(2)
  const [batchForm, setBatchForm] = useState<'short' | 'medium' | 'long'>('medium')
  const [batchSelectedLangs, setBatchSelectedLangs] = useState<string[]>(['vi', 'en', 'fr', 'zh', 'ja', 'ko'])
  const [batchQty, setBatchQty] = useState(30)
  const [autoVoice, setAutoVoice] = useState(true)
  const [batchModel, setBatchModel] = useState('el/eleven_multilingual_v2')

  const [preparedTexts, setPreparedTexts] = useState<PreparedText[]>([])
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; message: string } | null>(null)
  const [genBusy, setGenBusy] = useState(false)
  const [preparedSelection, setPreparedSelection] = useState<string[]>([])

  const [libFilterCat, setLibFilterCat] = useState('')
  const [libFilterLang, setLibFilterLang] = useState('')

  const [theme] = useState<ThemeMode>(() => getInitialTheme())
  const [deletedResourceIds, setDeletedResourceIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      return JSON.parse(window.localStorage.getItem('chunks-library-deleted') || '[]') as string[]
    } catch {
      return []
    }
  })

  useEffect(() => {
    const adapter = new LocalJsonStorageAdapter()
    adapter.loadResources()
      .then((items) => {
        const merged = [...items, ...promotedResources]
        const deduped = merged.filter((item, index, arr) => index === arr.findIndex((entry) => entry.id === item.id))
        setResources(deduped.filter((item) => !item.id || !deletedResourceIds.includes(item.id)))
      })
      .catch(() => setResources(promotedResources.filter((item) => !item.id || !deletedResourceIds.includes(item.id))))
  }, [deletedResourceIds, promotedResources])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem('chunks-theme', theme)
  }, [theme])

  useEffect(() => {
    window.localStorage.setItem('chunks-library-deleted', JSON.stringify(deletedResourceIds))
  }, [deletedResourceIds])

  useEffect(() => {
    window.localStorage.setItem('chunks-library-promoted', JSON.stringify(promotedResources))
  }, [promotedResources])

  useEffect(() => {
    const valid = new Set(preparedTexts.map((item) => item.tempId))
    setPreparedSelection((current) => current.filter((id) => valid.has(id)))
  }, [preparedTexts])

  const availableLangs = useMemo(() => {
    const langSet = new Set(resources.map((resource) => resource.language).filter(Boolean) as string[])
    return Array.from(langSet).sort()
  }, [resources])

  const pool = useMemo(() => buildPool(resources, settings), [resources, settings])
  const preparedSelectedSet = useMemo(() => new Set(preparedSelection), [preparedSelection])
  const preparedLanguageCount = useMemo(() => new Set(preparedTexts.map((item) => item.language)).size, [preparedTexts])
  async function playAudio(url: string, label = '') {
    try {
      await new Audio(url).play()
      if (label) setLog(`Playing ${label}`)
    } catch (error: unknown) {
      setLog(`Play failed: ${errorMessage(error)}`)
    }
  }

  async function audioUrlToPersistableUrl(url: string): Promise<string> {
    if (!url.startsWith('blob:')) return url
    const blob = await fetch(url).then((res) => res.blob())
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error || new Error('Could not persist staged audio'))
      reader.readAsDataURL(blob)
    })
  }

  async function promoteStagedItems(items: Array<LibraryItemLike & { _staged?: boolean }>) {
    const stagedItems = items.filter((item) => item._staged)
    const uniqueItems = stagedItems.filter((item, index, arr) => index === arr.findIndex((entry) => getLibraryItemKey(entry) === getLibraryItemKey(item)))
    if (uniqueItems.length === 0) {
      setLog('Select staged items before importing to library.')
      return
    }

    const preview = uniqueItems
      .slice(0, 3)
      .map((item) => `• ${item.language || 'xx'} · ${item.textPrompt || item.soundPrompt || item.id || 'staged item'}`)
      .join('\n')

    if (!window.confirm(`Import ${uniqueItems.length} staged item${uniqueItems.length === 1 ? '' : 's'} into the real library?\n${preview}${uniqueItems.length > 3 ? '\n…' : ''}`)) return

    try {
      const now = Date.now()
      const promoted = await Promise.all(uniqueItems.map(async (item, index) => {
        const audioUrl = item.audioUrl ? await audioUrlToPersistableUrl(item.audioUrl) : ''
        return {
          id: item.id?.startsWith('lib-') ? item.id : `lib-${item.id || now + index}`,
          category: (item.category || 'speech') as ChunksAwareResource['category'],
          sourceKind: (item.sourceKind || 'imported') as ChunksAwareResource['sourceKind'],
          audioUrl,
          textPrompt: item.textPrompt,
          soundPrompt: item.soundPrompt,
          label: Array.isArray((item as ChunksAwareResource).label) ? (item as ChunksAwareResource).label : ['promoted'],
          language: item.language,
          level: item.level || 1,
          form: item.form as ChunksAwareResource['form'],
          durationMs: null,
          approvalStatus: 'approved_resource' as const,
          license: (item as ChunksAwareResource).license || 'local promoted staged audio',
          provenanceUrl: (item as ChunksAwareResource).provenanceUrl || '',
          attribution: (item as ChunksAwareResource).attribution || '',
          provider: item.provider || 'local-promoted',
          voiceId: (item as ChunksAwareResource).voiceId || item.provider || '',
          createdAt: new Date().toISOString().slice(0, 10),
          mseFocus: (item as ChunksAwareResource).mseFocus || 'sound',
          resistanceTag: (item as ChunksAwareResource).resistanceTag || 'promoted',
          lessonId: (item as ChunksAwareResource).lessonId || 'promoted-library',
          mirrorGoal: (item as ChunksAwareResource).mirrorGoal || 'prosody',
        } satisfies ChunksAwareResource
      }))

      const promotedKeys = new Set(uniqueItems.map((item) => getLibraryItemKey(item)))
      setPromotedResources((current) => {
        const merged = [...current, ...promoted]
        return merged.filter((item, index, arr) => index === arr.findIndex((entry) => entry.id === item.id))
      })
      setStaged((current) => current.filter((entry) => !promotedKeys.has(getLibraryItemKey({ ...entry, _staged: true }))))
      setLog(`${promoted.length} staged item${promoted.length === 1 ? '' : 's'} imported into library.`)
    } catch (error: unknown) {
      setLog(`Import staged failed: ${errorMessage(error)}`)
    }
  }

  function deletePreparedTexts(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids))
    if (uniqueIds.length === 0) return

    const preview = preparedTexts
      .filter((item) => uniqueIds.includes(item.tempId))
      .slice(0, 3)
      .map((item) => `• ${item.language} · ${item.textPrompt}`)
      .join('\n')

    const confirmMessage = uniqueIds.length === 1
      ? `Remove this prepared text?\n${preview}`
      : `Remove ${uniqueIds.length} prepared texts?\n${preview}${uniqueIds.length > 3 ? '\n…' : ''}`

    if (!window.confirm(confirmMessage)) return

    setPreparedTexts((current) => current.filter((item) => !uniqueIds.includes(item.tempId)))
    setPreparedSelection((current) => current.filter((id) => !uniqueIds.includes(id)))
    setBatchProgress(null)
    setLog(uniqueIds.length === 1 ? 'Prepared text removed.' : `${uniqueIds.length} prepared texts removed.`)
  }

  function deleteLibraryItems(items: Array<LibraryItemLike & { _staged?: boolean }>) {
    const uniqueItems = items.filter((item, index, arr) => index === arr.findIndex((entry) => getLibraryItemKey(entry) === getLibraryItemKey(item)))
    if (uniqueItems.length === 0) return

    const preview = uniqueItems
      .slice(0, 3)
      .map((item) => `• ${item.language || 'xx'} · ${item.textPrompt || item.soundPrompt || item.id || 'item'}`)
      .join('\n')

    const confirmMessage = uniqueItems.length === 1
      ? `Delete this library item?\n${preview}`
      : `Delete ${uniqueItems.length} library items?\n${preview}${uniqueItems.length > 3 ? '\n…' : ''}`

    if (!window.confirm(confirmMessage)) return

    const stagedKeys = new Set(uniqueItems.filter((item) => item._staged).map(getLibraryItemKey))
    const approvedKeys = new Set(uniqueItems.filter((item) => !item._staged).map(getLibraryItemKey))
    const deleteIds = uniqueItems.map((item) => item.id).filter((id): id is string => Boolean(id))

    if (stagedKeys.size > 0) {
      setStaged((current) => current.filter((entry) => !stagedKeys.has(getLibraryItemKey({ ...entry, _staged: true }))))
    }

    if (approvedKeys.size > 0) {
      setResources((current) => current.filter((entry) => !approvedKeys.has(getLibraryItemKey(entry))))
      setPromotedResources((current) => current.filter((entry) => !approvedKeys.has(getLibraryItemKey(entry))))
    }

    if (deleteIds.length > 0) {
      setDeletedResourceIds((current) => Array.from(new Set([...current, ...deleteIds])))
    }

    setLog(uniqueItems.length === 1 ? 'Library item deleted.' : `${uniqueItems.length} library items deleted.`)
  }

  function deleteLibraryItem(item: LibraryItemLike & { _staged?: boolean }) {
    deleteLibraryItems([item])
  }

  async function generateTextsReal() {
    if (batchSelectedLangs.length === 0) {
      setLog('Select at least one language first')
      return
    }

    setGenBusy(true)
    try {
      const FORM_SPEC: Record<string, string> = {
        short: '2-4 words STRICTLY (greetings, labels, exclamations; never exceed 4 words)',
        medium: '5-14 words STRICTLY (natural daily conversation; never below 5 or above 14)',
        long: '15-25 words STRICTLY (expressive multi-clause sentences; never below 15 or above 25)',
      }
      const LEVEL_SPEC: Record<number, string> = {
        1: 'simple daily expressions, familiar vocabulary, one idea per sentence',
        2: 'natural conversation, small structural variation, everyday topics',
        3: 'emotionally expressive or complex sentences, prosodic challenge',
      }

      const prompt =
        `Generate exactly ${batchQty} unique, natural, spoken-style sentences for sound-first language mirroring (MSE ear training).\n`
        + 'Purpose: rhythm, prosody, intonation practice - NOT grammar drills.\n\n'
        + `Form: ${batchForm} - ${FORM_SPEC[batchForm]}\n`
        + `Level: ${batchLevel} - ${LEVEL_SPEC[batchLevel]}\n\n`
        + `Mix these languages with equal random distribution: ${batchSelectedLangs.join(', ')}\n\n`
        + 'CRITICAL: Count words carefully. Every sentence MUST respect the word-count rule above.\n'
        + 'Output ONLY a valid JSON array, no markdown, no explanation:\n'
        + '[{"text":"sentence here","lang":"ISO-639-1-code"}, ...]'

      const res = await fetch('/api/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'lucy', prompt }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `generate-text failed (${res.status})`)
      }

      const data = await res.json()
      const content: string = data.choices?.[0]?.message?.content || data.text || data.content || ''

      let items: Array<{ text: string; lang: string }> = []
      try {
        const match = content.match(/\[[\s\S]*\]/)
        if (match) {
          const parsed = JSON.parse(match[0])
          if (Array.isArray(parsed)) {
            items = parsed.filter(isTextLangPair)
          }
        }
        if (items.length === 0) throw new Error('no structured items')
      } catch {
        const lines = content.split(/[\n\r]+/).map((entry: string) => entry.trim()).filter((entry: string) => entry.length > 4)
        items = lines.slice(0, batchQty).map((text: string, index: number) => ({
          text,
          lang: batchSelectedLangs[index % batchSelectedLangs.length],
        }))
      }

      const now = Date.now()
      const result = items.slice(0, batchQty).map((item, index) => ({
        tempId: `pt-${now}-${index}`,
        textPrompt: item.text,
        language: batchSelectedLangs.includes(item.lang) ? item.lang : batchSelectedLangs[index % batchSelectedLangs.length],
        form: batchForm,
        level: batchLevel,
      }))

      setPreparedTexts(result)
      setBatchProgress(null)
      setLog(`✓ ${result.length} texts from 9router. Review list, remove any unwanted, then run TTS.`)
    } catch (error: unknown) {
      setLog(`Generate text failed: ${errorMessage(error)}`)
    } finally {
      setGenBusy(false)
    }
  }

  async function runBatchTTS() {
    if (!window.confirm(`Run TTS for ${preparedTexts.length} items?\n${autoVoice ? 'Mode: auto voice (edge-tts per language)' : `Model: ${batchModel}`}`)) return

    setBatchProgress({ current: 0, total: preparedTexts.length, message: 'Starting…' })
    let ok = 0

    for (let index = 0; index < preparedTexts.length; index += 1) {
      const prepared = preparedTexts[index]
      const model = autoVoice ? voiceForLang(prepared.language) : batchModel
      setBatchProgress({
        current: index + 1,
        total: preparedTexts.length,
        message: `${index + 1}/${preparedTexts.length} · ${prepared.language} · ${model.replace('edge-tts/', '')}`,
      })

      try {
        const blob = await generateSpeech({ model, input: prepared.textPrompt })
        const url = URL.createObjectURL(blob)
        setStaged((current) => [...current, {
          id: `b${Date.now()}${index}`,
          category: 'speech',
          sourceKind: 'tts',
          audioUrl: url,
          textPrompt: prepared.textPrompt,
          label: ['batch', prepared.language],
          language: prepared.language,
          level: prepared.level,
          form: prepared.form,
          durationMs: null,
          approvalStatus: 'candidate',
          provider: model,
          voiceId: model,
          createdAt: new Date().toISOString().slice(0, 10),
          mseFocus: 'sound',
          mirrorGoal: 'prosody',
        }])
        ok += 1
      } catch {
        // Individual failures are skipped so the batch can continue.
      }

      await new Promise((resolve) => setTimeout(resolve, 40))
    }

    setBatchProgress({ current: preparedTexts.length, total: preparedTexts.length, message: `Done - ${ok}/${preparedTexts.length} generated` })
    setLog(`Batch TTS done. ${ok} new clips in staged (play ▶ in Library tab).`)
  }

  return (
    <div className="min-h-[100dvh] bg-[--bg] text-[--fg]">
      <nav className="fixed right-4 top-4 z-30 flex items-center gap-1 rounded-[999px] border border-[--line-strong] bg-[#0C0C0E]/90 p-1 backdrop-blur">
        {(['mirror', 'resources'] as const).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`rounded-[999px] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] transition-all active:scale-[0.98] ${
              tab === item ? 'bg-[--accent] text-white' : 'text-[--fg-muted] hover:text-white'
            }`}
          >
            {item === 'mirror' ? 'Training Arena' : 'Library Setup'}
          </button>
        ))}
      </nav>

      {tab === 'mirror' && (
        <MirrorPage settings={settings} pool={pool} onLog={setLog} />
      )}

      {tab === 'resources' && (
        <main className="min-h-[100dvh] bg-[--bg] px-4 py-20 text-[--fg] md:px-6 lg:px-8">
          <div className="mx-auto max-w-[1200px] space-y-6">
            <header className="border-b border-[--line] pb-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[--accent]">Library Setup</div>
              <h1 className="mt-2 max-w-[12ch] text-4xl tracking-[-0.06em] text-white md:text-5xl md:leading-none">Prepare sounds before the loop.</h1>
              <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-[--fg-muted]">
                Generation and library management stay outside Mirror Room. No synthesis runs inside the live play/copy loop.
              </p>
            </header>

            <SettingsBar settings={settings} onChange={setSettings} availableLangs={availableLangs} />

            <section className="rounded-[28px] border border-[--line] bg-[--bg-elev] p-5 md:p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[--accent]">Generate text and audio</div>
                  <h2 className="mt-2 text-2xl tracking-[-0.04em] text-white">Phase 1 prepares text. Phase 2 turns it into staged speech.</h2>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted]">
                  {resources.length} approved · {staged.length} staged · {pool.length} in pool
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <label className="space-y-2">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted]">Level</span>
                  <select value={batchLevel} onChange={(e) => setBatchLevel(Number(e.target.value) as 1 | 2 | 3)} className="w-full rounded-[14px] border border-[--line] bg-[--bg] px-3 py-3 font-mono text-sm text-white outline-none focus:border-[--accent]">
                    <option value={1}>Level 1</option>
                    <option value={2}>Level 2</option>
                    <option value={3}>Level 3</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted]">Form</span>
                  <select value={batchForm} onChange={(e) => setBatchForm(e.target.value as 'short' | 'medium' | 'long')} className="w-full rounded-[14px] border border-[--line] bg-[--bg] px-3 py-3 font-mono text-sm text-white outline-none focus:border-[--accent]">
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted]">Quantity</span>
                  <input type="number" min={1} max={200} value={batchQty} onChange={(e) => setBatchQty(Math.max(1, Math.min(200, parseInt(e.target.value, 10) || 10)))} className="w-full rounded-[14px] border border-[--line] bg-[--bg] px-3 py-3 font-mono text-sm text-white outline-none focus:border-[--accent]" />
                </label>

                <label className="space-y-2">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted]">Voice</span>
                  <select value={autoVoice ? 'auto' : 'custom'} onChange={(e) => setAutoVoice(e.target.value === 'auto')} className="w-full rounded-[14px] border border-[--line] bg-[--bg] px-3 py-3 font-mono text-sm text-white outline-none focus:border-[--accent]">
                    <option value="auto">Auto voice</option>
                    <option value="custom">Custom model</option>
                  </select>
                </label>
              </div>

              {!autoVoice && <input value={batchModel} onChange={(e) => setBatchModel(e.target.value)} className="mt-3 w-full rounded-[14px] border border-[--line] bg-[--bg] px-3 py-3 font-mono text-sm text-white outline-none focus:border-[--accent]" placeholder="el/eleven_multilingual_v2" />}

              <div className="mt-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted]">{batchSelectedLangs.length} languages selected</span>
                  <div className="flex gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted]">
                    <button onClick={() => setBatchSelectedLangs(['vi', 'en', 'fr', 'zh', 'ja', 'ko'])} className="hover:text-white">Top 6</button>
                    <button onClick={() => setBatchSelectedLangs(ALL_LANGS)} className="hover:text-white">All</button>
                    <button onClick={() => setBatchSelectedLangs([])} className="hover:text-white">Clear</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ALL_LANGS.map((lang) => {
                    const active = batchSelectedLangs.includes(lang)
                    return <button key={lang} onClick={() => setBatchSelectedLangs((current) => active ? current.filter((entry) => entry !== lang) : [...current, lang])} className={`rounded-[999px] border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-all active:scale-[0.98] ${active ? 'border-[--accent] bg-[--accent] text-white' : 'border-[--line] text-[--fg-muted] hover:text-white'}`}>{lang}</button>
                  })}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[--line] pt-5">
                <button onClick={generateTextsReal} disabled={genBusy || batchSelectedLangs.length === 0} className="rounded-[999px] bg-[--accent] px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-white transition-all hover:bg-[--accent-press] active:scale-[0.98] disabled:opacity-40">{genBusy ? 'Generating' : 'Generate texts'}</button>
                {preparedTexts.length > 0 && <button onClick={() => deletePreparedTexts(preparedTexts.map((item) => item.tempId))} className="rounded-[999px] border border-[--line] px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[--fg-muted] transition-all hover:border-[--accent] hover:text-[--accent] active:scale-[0.98]">Clear prepared</button>}
              </div>
            </section>

            {preparedTexts.length > 0 && (
              <section className="rounded-[28px] border border-[--line] bg-[--bg-elev] p-5 md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[--accent]">Prepared texts</div>
                    <div className="mt-1 text-sm text-[--fg-muted]">{preparedTexts.length} queued · {preparedLanguageCount} languages · {preparedSelection.length} selected</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setPreparedSelection(preparedTexts.map((item) => item.tempId))} className="rounded-[999px] border border-[--line] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted] hover:text-white">Select all</button>
                    <button onClick={() => setPreparedSelection([])} className="rounded-[999px] border border-[--line] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted] hover:text-white">Clear</button>
                    <button onClick={() => deletePreparedTexts(preparedSelection)} disabled={preparedSelection.length === 0} className="rounded-[999px] bg-[--accent] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white disabled:opacity-30">Remove selected</button>
                  </div>
                </div>
                <div className="mt-4 max-h-72 overflow-auto rounded-[18px] border border-[--line] bg-[--bg]">
                  {preparedTexts.map((item) => {
                    const selected = preparedSelectedSet.has(item.tempId)
                    return (
                      <div key={item.tempId} className={`grid gap-3 border-b border-[--line] px-3 py-3 last:border-b-0 md:grid-cols-[auto_60px_60px_minmax(0,1fr)_auto] md:items-center ${selected ? 'bg-[--accent]/10' : ''}`}>
                        <input type="checkbox" checked={selected} onChange={() => setPreparedSelection((current) => current.includes(item.tempId) ? current.filter((id) => id !== item.tempId) : [...current, item.tempId])} style={{ accentColor: 'var(--accent)' }} />
                        <span className="font-mono text-[10px] uppercase text-[--accent]">{item.language}</span>
                        <span className="font-mono text-[10px] uppercase text-[--fg-muted]">{item.form}</span>
                        <span className="text-sm text-white">{item.textPrompt}</span>
                        <button onClick={() => deletePreparedTexts([item.tempId])} className="font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted] hover:text-[--accent]">Remove</button>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button onClick={runBatchTTS} className="rounded-[999px] bg-white px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-black transition-all hover:bg-[--accent] hover:text-white active:scale-[0.98]">Run TTS ({preparedTexts.length})</button>
                  {batchProgress && <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted]">{batchProgress.message}</span>}
                </div>
              </section>
            )}

            <LibraryPanel resources={resources} staged={staged} filterCat={libFilterCat} filterLang={libFilterLang} onFilterCat={setLibFilterCat} onFilterLang={setLibFilterLang} onPlay={playAudio} onDelete={deleteLibraryItem} onBulkDelete={deleteLibraryItems} onPromoteStaged={promoteStagedItems} />

            {log && <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted]">{log}</div>}
          </div>
        </main>
      )}
    </div>
  )
}
