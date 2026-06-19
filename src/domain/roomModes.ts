import type { InteractionMode, RoomSettings } from './types'

export const INTERACTION_MODES: InteractionMode[] = ['auto', 'manual', 'offline', 'custom']

export const MODE_META: Record<InteractionMode, { label: string; hint: string }> = {
  auto: { label: 'Auto', hint: 'One tap runs the whole loop and rolls into the next item.' },
  manual: { label: 'Manual', hint: 'Each item runs, then waits for you to tap Next.' },
  offline: { label: 'Offline', hint: 'Self-paced — tap when ready to mirror, tap to advance.' },
  custom: { label: 'Custom', hint: 'Dynamic — toggle every gate and ending sound below.' },
}

// Modes that expose the dynamic flow + cue toggles. Auto/manual are fixed presets.
export function modeIsDynamic(mode: InteractionMode): boolean {
  return mode === 'offline' || mode === 'custom'
}

type FlowFlags = Pick<
  RoomSettings,
  'autoAdvance' | 'gateBeforeCopy' | 'cueOnListen' | 'cueOnMirror' | 'cueOnEnd'
>

const MODE_PRESETS: Record<Exclude<InteractionMode, 'custom'>, FlowFlags> = {
  auto: { autoAdvance: true, gateBeforeCopy: false, cueOnListen: false, cueOnMirror: true, cueOnEnd: false },
  manual: { autoAdvance: false, gateBeforeCopy: false, cueOnListen: false, cueOnMirror: true, cueOnEnd: false },
  offline: { autoAdvance: false, gateBeforeCopy: true, cueOnListen: false, cueOnMirror: true, cueOnEnd: true },
}

// Switching mode applies its flow preset. Custom keeps whatever flags are already set
// so the learner's dynamic configuration is preserved across mode toggles.
export function applyMode(settings: RoomSettings, mode: InteractionMode): RoomSettings {
  if (mode === 'custom') return { ...settings, mode }
  return { ...settings, mode, ...MODE_PRESETS[mode] }
}
