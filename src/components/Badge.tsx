interface BadgeProps {
  label: string
  color: string
  variant?: 'solid' | 'outline'
  /** Text color for the solid variant; defaults to white, which is unreadable on light fills. */
  textColor?: string
}

export function Badge({ label, color, variant = 'outline', textColor = '#ffffff' }: BadgeProps) {
  if (variant === 'solid') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
        style={{ backgroundColor: color, color: textColor }}
      >
        {label}
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
      style={{ borderColor: color, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
