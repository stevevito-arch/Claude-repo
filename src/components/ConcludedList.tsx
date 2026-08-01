import type { ConcludedReadout } from '../types/trial'
import { formatDate } from '../lib/presentation'

const OUTCOME_COLOR: Record<ConcludedReadout['outcome'], string> = {
  Positive: 'var(--status-good)',
  Mixed: 'var(--status-warning)',
  'Negative / discontinued': 'var(--status-critical)',
}

export function ConcludedList({ readouts }: { readouts: ConcludedReadout[] }) {
  return (
    <div className="flex flex-col gap-2">
      {readouts.map((r) => (
        <div
          key={r.id}
          className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-card)' }}
        >
          <div>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                style={{ backgroundColor: OUTCOME_COLOR[r.outcome] }}
              >
                {r.outcome}
              </span>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {r.name}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {r.summary}
            </p>
            <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="mt-0.5 inline-block text-xs underline" style={{ color: 'var(--cat-blue)' }}>
              {r.sourceLabel}
            </a>
          </div>
          <div className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
            {formatDate(r.date)}
          </div>
        </div>
      ))}
    </div>
  )
}
