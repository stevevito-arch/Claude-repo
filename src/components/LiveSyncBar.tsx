import type { LiveSyncState } from '../lib/useLiveTrialStatuses'

interface LiveSyncBarProps {
  state: LiveSyncState
  lastSyncedAt: Date | null
  onRefresh: () => void
  dataAsOf: string
}

export function LiveSyncBar({ state, lastSyncedAt, onRefresh, dataAsOf }: LiveSyncBarProps) {
  const dotColor = state === 'live' ? 'var(--status-good)' : state === 'loading' ? 'var(--status-warning)' : 'var(--text-muted)'

  const message =
    state === 'loading'
      ? 'Syncing live status from ClinicalTrials.gov…'
      : state === 'live'
        ? `Live status synced ${lastSyncedAt ? lastSyncedAt.toLocaleTimeString() : ''} — curated background/preclinical content as of ${dataAsOf}.`
        : `Live sync unavailable right now — showing curated snapshot as of ${dataAsOf}.`

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-xs"
      style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-card)' }}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: dotColor, animation: state === 'loading' ? 'pulse 1.5s ease-in-out infinite' : undefined }}
        />
        <span style={{ color: 'var(--text-secondary)' }}>{message}</span>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={state === 'loading'}
        className="rounded-full border px-3 py-1 font-medium disabled:opacity-50"
        style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-primary)' }}
      >
        Refresh live status
      </button>
    </div>
  )
}
