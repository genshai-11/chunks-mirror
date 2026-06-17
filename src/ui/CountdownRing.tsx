// import React from 'react' // not needed with new JSX transform

interface CountdownRingProps {
  progress: number // 0 to 1 (how much time has passed)
  size?: number
  stroke?: number
  className?: string
  inverted?: boolean
}

export function CountdownRing({
  progress,
  size = 248,
  stroke = 4,
  className,
  inverted = false,
}: CountdownRingProps) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (inverted ? progress : 1 - progress)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={{ transform: 'rotate(-90deg)' }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--line)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        style={{ transition: 'stroke-dashoffset 80ms linear' }}
      />
    </svg>
  )
}
