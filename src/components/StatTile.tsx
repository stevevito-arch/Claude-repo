interface StatTileProps {
  label: string
  value: string | number
  detail?: string
}

export function StatTile({ label, value, detail }: StatTileProps) {
  return (
    <div
      className="flex-1 rounded-xl border p-4"
      style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-card)' }}
    >
      <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </div>
      {detail && (
        <div className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {detail}
        </div>
      )}
    </div>
  )
}
