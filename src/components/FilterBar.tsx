import type { ReactNode } from 'react'
import type { Modality, TrialPhase, TrialStatus } from '../types/trial'
import { MODALITY_COLOR, MODALITY_ORDER, PHASE_ORDER, STATUS_ORDER } from '../lib/presentation'

interface FilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  activeModalities: Set<Modality>
  onToggleModality: (modality: Modality) => void
  activePhases: Set<TrialPhase>
  onTogglePhase: (phase: TrialPhase) => void
  activeStatuses: Set<TrialStatus>
  onToggleStatus: (status: TrialStatus) => void
  onReset: () => void
}

function Chip({ active, onClick, children, dotColor }: { active: boolean; onClick: () => void; children: ReactNode; dotColor?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
      style={
        active
          ? { backgroundColor: dotColor ?? 'var(--text-primary)', borderColor: dotColor ?? 'var(--text-primary)', color: 'white' }
          : { backgroundColor: 'transparent', borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }
      }
    >
      {dotColor && !active && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />}
      {children}
    </button>
  )
}

export function FilterBar(props: FilterBarProps) {
  const { search, onSearchChange, activeModalities, onToggleModality, activePhases, onTogglePhase, activeStatuses, onToggleStatus, onReset } = props
  const hasActiveFilters = activeModalities.size > 0 || activePhases.size > 0 || activeStatuses.size > 0 || search.length > 0

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4" style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-card)' }}>
      <div className="flex items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by trial name, sponsor, or target..."
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
          style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-card-raised)', color: 'var(--text-primary)' }}
        />
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="shrink-0 whitespace-nowrap text-xs font-medium underline"
            style={{ color: 'var(--text-secondary)' }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Phase
        </span>
        {PHASE_ORDER.map((phase) => (
          <Chip key={phase} active={activePhases.has(phase)} onClick={() => onTogglePhase(phase)}>
            {phase}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Modality
        </span>
        {MODALITY_ORDER.map((modality) => (
          <Chip key={modality} active={activeModalities.has(modality)} onClick={() => onToggleModality(modality)} dotColor={MODALITY_COLOR[modality]}>
            {modality}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Status
        </span>
        {STATUS_ORDER.map((status) => (
          <Chip key={status} active={activeStatuses.has(status)} onClick={() => onToggleStatus(status)}>
            {status}
          </Chip>
        ))}
      </div>
    </div>
  )
}
