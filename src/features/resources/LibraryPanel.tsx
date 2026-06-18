import { useMemo, useState, type ReactNode } from 'react'
import type { SoundCategory } from '../../domain/types'

type LibraryItem = {
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
  _staged?: boolean
}

type LibraryForm = 'all' | 'short' | 'medium' | 'long'
type SourceFilter = 'all' | 'approved' | 'staged'

type DisplayItem = LibraryItem & {
  _key: string
  _text: string
  _form: Exclude<LibraryForm, 'all'>
  _staged?: boolean
}

interface LibraryPanelProps {
  resources: LibraryItem[]
  staged: LibraryItem[]
  filterCat: string
  filterLang: string
  onFilterCat: (category: string) => void
  onFilterLang: (language: string) => void
  onPlay: (url: string, label?: string) => void
  onDelete: (item: LibraryItem & { _staged?: boolean }) => void
  onBulkDelete: (items: Array<LibraryItem & { _staged?: boolean }>) => void
  onPromoteStaged: (items: Array<LibraryItem & { _staged?: boolean }>) => void
}

const CAT_LABEL: Record<string, string> = {
  speech: 'Speech',
  sfx_animal: 'Animal sound',
  sfx_object: 'Object SFX',
  sfx_nature: 'Nature SFX',
  sfx_human: 'Human SFX',
  music_snippet: 'Music',
  other: 'Other',
}

const CAT_ORDER: SoundCategory[] = ['speech', 'sfx_animal', 'sfx_object', 'sfx_nature', 'sfx_human', 'music_snippet', 'other']
const FORM_ORDER: LibraryForm[] = ['all', 'short', 'medium', 'long']
const SOURCE_ORDER: SourceFilter[] = ['all', 'approved', 'staged']
const SOURCE_LABEL: Record<SourceFilter, string> = { all: 'All', approved: 'Approved', staged: 'Staged' }

function estimateSyllables(text?: string): number {
  // Rough cross-language estimator: count vowel nuclei
  return ((text || '').toLowerCase().match(/[aáàâãäåæeéèêëiíìîïoóòôõöøuúùûüyýÿаеёиоуыэюяіїєАЕЁИОУЫЭЮЯІЇЄ]/g) || []).length || 1
}

function resolveForm(item: Pick<LibraryItem, 'form' | 'textPrompt' | 'soundPrompt'>): Exclude<LibraryForm, 'all'> {
  if (item.form === 'short' || item.form === 'medium' || item.form === 'long') return item.form
  const sc = estimateSyllables(item.textPrompt || item.soundPrompt)
  if (sc <= 4) return 'short'
  if (sc <= 10) return 'medium'
  return 'long'
}

function getItemText(item: Pick<LibraryItem, 'textPrompt' | 'soundPrompt'>) {
  return item.textPrompt || item.soundPrompt || '-'
}

function getItemKey(item: LibraryItem, index = 0) {
  return item.id || item.audioUrl || `${item.category || 'other'}-${item.language || 'xx'}-${getItemText(item)}-${index}`
}

function isRealValue(value?: string) {
  return !!value && value !== '—' && value !== '-'
}

function matchesQuery(item: DisplayItem, query: string) {
  if (!query) return true
  const haystack = [item._text, item.id, item.language, item.provider, item.category].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(query)
}

export default function LibraryPanel({
  resources,
  staged,
  filterCat,
  filterLang,
  onFilterCat,
  onFilterLang,
  onPlay,
  onDelete,
  onBulkDelete,
  onPromoteStaged,
}: LibraryPanelProps) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [formFilter, setFormFilter] = useState<LibraryForm>('all')
  const [query, setQuery] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [pageSize, setPageSize] = useState(24)

  const all = useMemo<DisplayItem[]>(() => ([
    ...resources,
    ...staged.map((item) => ({ ...item, _staged: true })),
  ].map((item, index) => ({
    ...item,
    _key: getItemKey(item, index),
    _text: getItemText(item),
    _form: resolveForm(item),
  }))), [resources, staged])

  const cats = useMemo(() => CAT_ORDER.filter((cat) => all.some((item) => item.category === cat)), [all])
  const langs = useMemo(() => Array.from(new Set(all.map((item) => item.language).filter((lang): lang is string => isRealValue(lang)))).sort(), [all])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return all.filter((item) => {
      if (sourceFilter === 'approved' && item._staged) return false
      if (sourceFilter === 'staged' && !item._staged) return false
      if (filterCat && item.category !== filterCat) return false
      if (filterLang && item.language !== filterLang) return false
      if (formFilter !== 'all' && item._form !== formFilter) return false
      return matchesQuery(item, normalizedQuery)
    })
  }, [all, filterCat, filterLang, formFilter, query, sourceFilter])

  const visible = filtered.slice(0, pageSize)
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys])
  const selectedItems = useMemo(() => all.filter((item) => selectedSet.has(item._key)), [all, selectedSet])
  const selectedStaged = selectedItems.filter((item) => item._staged)
  const visibleStaged = visible.filter((item) => item._staged)

  function toggleSelection(key: string) {
    setSelectedKeys((current) => current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key])
  }

  function resetFilters() {
    setSourceFilter('all')
    setFormFilter('all')
    setQuery('')
    onFilterCat('')
    onFilterLang('')
  }

  return (
    <section className="rounded-[18px] border border-[--line] bg-[--bg-elev]">
      <div className="border-b border-[--line] px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[--accent]">Sound Library</div>
            <h2 className="mt-1 text-xl tracking-[-0.03em] text-[--fg]">Manage playable resources</h2>
          </div>
          <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted]">
            <Badge>{resources.length} approved</Badge>
            <Badge>{staged.length} staged</Badge>
            <Badge>{filtered.length} visible</Badge>
            <Badge>{selectedItems.length} selected</Badge>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="block space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted]">Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search prompt, animal, language, provider"
              className="w-full rounded-[10px] border border-[--line] bg-[--bg] px-3 py-2 text-sm text-[--fg] outline-none focus:border-[--accent]"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => setSelectedKeys(visible.map((item) => item._key))} disabled={visible.length === 0}>Select visible</ActionButton>
            <ActionButton onClick={() => setSelectedKeys([])} disabled={selectedItems.length === 0}>Clear selection</ActionButton>
            <ActionButton tone="danger" onClick={() => onBulkDelete(selectedItems)} disabled={selectedItems.length === 0}>Delete selected</ActionButton>
          </div>
        </div>

        <div className="rounded-[14px] border border-[--line] bg-[--bg] p-3">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted]">Import staged to real library</div>
          <div className="flex flex-wrap gap-2">
            <ActionButton tone="success" onClick={() => onPromoteStaged(selectedStaged)} disabled={selectedStaged.length === 0}>Import selected staged</ActionButton>
            <ActionButton tone="success" onClick={() => onPromoteStaged(visibleStaged)} disabled={visibleStaged.length === 0}>Import visible staged</ActionButton>
            <span className="self-center font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted]">{visibleStaged.length} staged visible</span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Select label="Source" value={sourceFilter} onChange={(value) => setSourceFilter(value as SourceFilter)} options={SOURCE_ORDER.map((value) => ({ value, label: SOURCE_LABEL[value] }))} />
          <Select label="Category" value={filterCat} onChange={onFilterCat} options={[{ value: '', label: 'All' }, ...cats.map((cat) => ({ value: cat, label: CAT_LABEL[cat] || cat }))]} />
          <Select label="Language" value={filterLang} onChange={onFilterLang} options={[{ value: '', label: 'All' }, ...langs.map((lang) => ({ value: lang, label: lang }))]} />
          <Select label="Form" value={formFilter} onChange={(value) => setFormFilter(value as LibraryForm)} options={FORM_ORDER.map((value) => ({ value, label: value }))} />
          <label className="block space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted]">Limit</span>
            <input type="number" min={6} max={120} value={pageSize} onChange={(event) => setPageSize(Math.max(6, Math.min(120, Number(event.target.value) || 24)))} className="w-full rounded-[10px] border border-[--line] bg-[--bg] px-3 py-2 text-sm text-[--fg] outline-none focus:border-[--accent]" />
          </label>
        </div>

        <div className="flex justify-end">
          <ActionButton onClick={resetFilters}>Reset filters</ActionButton>
        </div>
      </div>

      <div className="border-t border-[--line]">
        {visible.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[--fg-muted]">No resources match the current filters.</div>
        ) : (
          <div className="divide-y divide-[--line]">
            {visible.map((item) => (
              <ResourceRow
                key={item._key}
                item={item}
                selected={selectedSet.has(item._key)}
                onToggleSelect={() => toggleSelection(item._key)}
                onPlay={onPlay}
                onDelete={onDelete}
                onPromoteStaged={onPromoteStaged}
              />
            ))}
          </div>
        )}
      </div>

      {filtered.length > visible.length && (
        <div className="border-t border-[--line] px-4 py-3 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted]">
          Showing {visible.length} of {filtered.length}. Increase limit to see more.
        </div>
      )}
    </section>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block space-y-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-[10px] border border-[--line] bg-[--bg] px-3 py-2 text-sm text-[--fg] outline-none focus:border-[--accent]">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function ActionButton({ children, onClick, disabled, tone = 'default' }: { children: ReactNode; onClick: () => void; disabled?: boolean; tone?: 'default' | 'danger' | 'success' }) {
  const toneClass = tone === 'danger'
    ? 'border-[--accent] text-[--accent] hover:bg-[--accent] hover:text-[--fg]'
    : tone === 'success'
      ? 'border-emerald-400/50 text-emerald-300 hover:bg-emerald-400 hover:text-black'
      : 'border-[--line] text-[--fg-muted] hover:border-[--fg] hover:text-[--fg]'

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`rounded-[999px] border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-all active:scale-[0.98] disabled:opacity-30 ${toneClass}`}>
      {children}
    </button>
  )
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-[999px] border border-[--line] px-3 py-1">{children}</span>
}

function ResourceRow({ item, selected, onToggleSelect, onPlay, onDelete, onPromoteStaged }: {
  item: DisplayItem
  selected: boolean
  onToggleSelect: () => void
  onPlay: (url: string, label?: string) => void
  onDelete: (item: LibraryItem & { _staged?: boolean }) => void
  onPromoteStaged: (items: Array<LibraryItem & { _staged?: boolean }>) => void
}) {
  return (
    <div className={`grid gap-3 px-4 py-3 md:grid-cols-[auto_auto_minmax(0,1fr)_160px_auto] md:items-center ${selected ? 'bg-[--accent]/10' : 'hover:bg-white/[0.02]'}`}>
      <input type="checkbox" checked={selected} onChange={onToggleSelect} aria-label={`Select ${item._text}`} style={{ accentColor: 'var(--accent)' }} />
      <button type="button" onClick={() => item.audioUrl && onPlay(item.audioUrl, item.id)} disabled={!item.audioUrl} className="flex h-9 w-9 items-center justify-center rounded-full border border-[--line] text-[--fg-muted] hover:border-[--accent] hover:text-[--fg] disabled:opacity-30" title="Play">
        <svg width="8" height="9" viewBox="0 0 7 8" fill="currentColor"><path d="M0 0 L7 4 L0 8 Z" /></svg>
      </button>
      <div className="min-w-0">
        <div className="flex flex-wrap gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[--fg-muted]">
          <span className="text-[--accent]">{item.language || item.category || 'sound'}</span>
          <span>{item._staged ? 'staged' : 'approved'}</span>
          <span>{CAT_LABEL[item.category || ''] || item.category}</span>
          <span>{item._form}</span>
          <span>L{item.level ?? '?'}</span>
        </div>
        <div className="mt-1 truncate text-sm text-[--fg]">{item._text}</div>
      </div>
      <div className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[--fg-muted]">{(item.provider || 'local').replace('edge-tts/', '')}</div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        {item._staged && <ActionButton tone="success" onClick={() => onPromoteStaged([item])}>Import</ActionButton>}
        <ActionButton onClick={onToggleSelect}>{selected ? 'Selected' : 'Select'}</ActionButton>
        <ActionButton tone="danger" onClick={() => onDelete(item)}>Delete</ActionButton>
      </div>
    </div>
  )
}
