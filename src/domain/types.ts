// Pure domain types. No IO. Mirrors CONTEXT.md schema + Sentence Form extension.

export type SoundCategory =
  | 'speech'
  | 'music_snippet'
  | 'sfx_animal'
  | 'sfx_object'
  | 'sfx_nature'
  | 'sfx_human'
  | 'other'

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
}

export type InteractionMode = 'auto' | 'manual'

export interface RoomSettings {
  mode: InteractionMode
  oSeconds: number
  cSeconds: number
  playbackRate: number
  category?: SoundCategory | ''
  language?: string | ''
  level?: number | ''
  sentenceForm?: 'all' | SentenceForm
  randomMix: boolean
  endingCue: boolean
}

export type LoopPhase = 'idle' | 'preparing' | 'playingOriginal' | 'recordingCopy' | 'betweenItems' | 'waitingNext'

export interface MirrorAttempt {
  resourceId: string
  sourceAudioUrl?: string
  copyBlob?: Blob
  startedAt: number
  oDurationMs: number
  cDurationMs: number
}

export interface ResourceBank {
  resources: ChunksAwareResource[]
}
