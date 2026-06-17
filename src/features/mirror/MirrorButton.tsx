// import React from 'react' // not needed with new JSX transform

/**
 * Signature component — the main Mirror action button.
 * The real implementation + ring + phase labels live in MirrorPage for the ignition slice.
 * This file exists to satisfy the component registry in context/07-ui-system.md.
 */
export interface MirrorButtonProps {
  onClick: () => void
  phaseLabel: string
  countdown?: number
  recording?: boolean
  disabled?: boolean
}

export default function MirrorButton({ onClick, phaseLabel, countdown, recording, disabled }: MirrorButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn"
    >
      <span className="phase font-mono text-xs tracking-[0.22em] uppercase">{phaseLabel}</span>
      <span className="count font-mono text-4xl font-bold leading-none">{countdown ?? ''}</span>
      <span className="hint text-xs">
        {recording ? <span className="recdot inline-block w-2 h-2 rounded-full bg-[--accent] animate-pulse" /> : 'one button'}
      </span>
    </button>
  )
}
