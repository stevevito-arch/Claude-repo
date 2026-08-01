interface BadgeProps {
  label: string
  color: string
  variant?: 'solid' | 'outline'
}

export function Badge({ label, color, variant = 'outline' }: BadgeProps) {
  if (variant === 'solid') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white"
        style={{ backgroundColor: color }}
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
