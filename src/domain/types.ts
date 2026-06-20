// Pure domain types. No IO. Mirrors CONTEXT.md schema + Sentence Form extension.

export type SoundCategory =
  | 'speech'
  | 'music_snippet'
  | 'sfx_animal'
  | 'sfx_object'
  | 'sfx_nature'
  | 'sfx_human'
  | 'other'
  | 'ere'

export type SourceKind = 'tts' | 'text_to_sound' | 'imported'

export type ApprovalStatus = 'candidate' | 'license_checked' | 'approved_resource'

export type MseFocus = 'sound' | 'motion' | 'emotion' | 'mixed'

export type MirrorGoal = 'rhythm' | 'pitch' | 'energy' | 'timing' | 'prosody'

// Word-count definitions:
//   short:  2–4 words  — greetings, labels, ultra-concise expressions
//   medium: 5–14 words — natural conversational sentences (core MSE zone)
//   long:   15–25 words — expressive multi-clause sentences, prosodic challenge
export type SentenceForm = 'short' | 'medium' | 'long'

export interface ChunksAwareResource {
  id: string
  category: SoundCategory
  sourceKind: SourceKind
  audioUrl: string
  file?: string
  textPrompt?: string
  soundPrompt?: string
  label: string[]
  language?: string
  level: number
  form?: SentenceForm // NEW: short / long sentence form (filterable in Dynamic Settings)
  durationMs: number | null
  approvalStatus: ApprovalStatus
  license?: string
  provenanceUrl?: string
  attribution?: string
  provider?: string
  voiceId?: string
  createdAt: string
  mseFocus: MseFocus
  resistanceTag?: string
  lessonId?: string
  mirrorGoal?: MirrorGoal

  // ERE-specific imported lesson metadata. Kept optional so ERE can later split
  // into its own platform without changing current library resources.
  ereTopic?: number
  ereTopicTitle?: string
  erePart?: string
  ereType?: string
  ereUrlId?: string
  ereVietnameseText?: string
  ereAudioFilename?: string
}

// auto    — one tap runs G→O→C and auto-advances to the next item
// manual  — auto-runs each item, pauses between items (tap Next)
// offline  — self-paced: tap when ready to record C, tap to advance (gates are configurable)
// custom  — fully dynamic: every gate + cue boundary is user-toggleable
export type InteractionMode = 'auto' | 'manual' | 'offline' | 'custom'

export interface RoomSettings {
  mode: InteractionMode
  oSeconds: number
  cSeconds: number
  playbackRate: number
  category?: SoundCategory | ''
  language?: string | ''
  level?: number | ''
  sentenceForm?: 'all' | SentenceForm
  ereTopic?: number | ''
  erePart?: string | ''
  randomMix: boolean

  // ── Dynamic flow controls (driven by mode preset; editable in offline/custom) ──
  // true  → loop auto-advances to the next item after C
  // false → loop waits for a tap between items
  autoAdvance: boolean
  // true  → after O (and its cue) the loop waits for a tap before recording C
  gateBeforeCopy: boolean

  // ── Per-boundary ending sounds ──
  cueOnListen: boolean // play a cue when G ends / O is about to start ("listen")
  cueOnMirror: boolean // play a cue when O ends / C is about to start ("mirror") — classic ending cue
  cueOnEnd: boolean    // play a cue when C ends ("done", separates items)
}

export type LoopPhase =
  | 'idle'
  | 'preparing'
  | 'playingOriginal'
  | 'recordingCopy'
  | 'awaitingCopy'
  | 'betweenItems'
  | 'waitingNext'

export interface MirrorAttempt {
  resourceId: string
  resource?: ChunksAwareResource
  sourceAudioUrl?: string
  copyBlob?: Blob
  startedAt: number
  oDurationMs: number
  cDurationMs: number
}

export interface ResourceBank {
  resources: ChunksAwareResource[]
}
