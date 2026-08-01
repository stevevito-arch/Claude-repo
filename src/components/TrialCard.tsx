import type { LiveTrialStatus, Trial } from '../types/trial'
import { Badge } from './Badge'
import { MODALITY_COLOR, PHASE_COLOR, formatDate } from '../lib/presentation'

interface TrialCardProps {
  trial: Trial
  liveStatus?: LiveTrialStatus
  onSelect: () => void
}

export function TrialCard({ trial, liveStatus, onSelect }: TrialCardProps) {
  const displayStatus = liveStatus?.overallStatus ?? trial.status
  const displayCompletion = liveStatus?.primaryCompletionDate ?? trial.estimatedPrimaryCompletion

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex h-full flex-col gap-3 rounded-xl border p-4 text-left transition-shadow hover:shadow-md"
      style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-card)' }}
    >
      <div className="flex flex-wrap gap-1.5">
        <Badge label={trial.phase} color={PHASE_COLOR[trial.phase]} variant="solid" />
        <Badge label={trial.modality} color={MODALITY_COLOR[trial.modality]} />
        <Badge label={displayStatus} color="var(--text-muted)" />
        {liveStatus && <Badge label="Live-synced" color="var(--status-good)" />}
      </div>

      <div>
        <h3 className="text-sm font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
          {trial.shortName}
        </h3>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {trial.sponsor}
        </p>
      </div>

      <p className="line-clamp-3 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {trial.background}
      </p>

      <div className="mt-auto flex items-center justify-between border-t pt-2 text-xs" style={{ borderColor: 'var(--gridline)' }}>
        <span style={{ color: 'var(--text-muted)' }}>Est. primary completion</span>
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
          {formatDate(displayCompletion)}
        </span>
      </div>
    </button>
  )
}
