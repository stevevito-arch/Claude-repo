import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { LiveTrialStatus, Trial } from '../types/trial'
import { Badge } from './Badge'
import { MODALITY_COLOR, PHASE_COLOR, formatDate, formatEnrollment } from '../lib/presentation'

interface TrialDetailProps {
  trial: Trial
  liveStatus?: LiveTrialStatus
  onClose: () => void
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {title}
      </h3>
      <div className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {children}
      </div>
    </section>
  )
}

export function TrialDetail({ trial, liveStatus, onClose }: TrialDetailProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l p-6"
        style={{ backgroundColor: 'var(--surface-card)', borderColor: 'var(--border-hairline)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-1.5">
              <Badge label={trial.phase} color={PHASE_COLOR[trial.phase]} variant="solid" />
              <Badge label={trial.modality} color={MODALITY_COLOR[trial.modality]} />
              <Badge label={liveStatus?.overallStatus ?? trial.status} color="var(--text-muted)" />
            </div>
            <h2 className="mt-2 text-lg font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
              {trial.name}
            </h2>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {trial.sponsor}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full border px-2.5 py-1 text-sm"
            style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }}
          >
            Close
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-5">
          <Section title="Population">{trial.population}</Section>

          <Section title="Background & modality">{trial.background}</Section>

          <Section title="Preclinical basis">{trial.preclinical}</Section>

          <Section title="Trial design">{trial.design}</Section>

          <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--gridline)' }}>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Primary endpoint
              </div>
              <div style={{ color: 'var(--text-primary)' }}>{trial.primaryEndpoint}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Enrollment target
              </div>
              <div style={{ color: 'var(--text-primary)' }}>
                {formatEnrollment(liveStatus?.enrollmentCount ?? trial.enrollmentTarget)}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Start date
              </div>
              <div style={{ color: 'var(--text-primary)' }}>{formatDate(trial.startDate)}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Est. primary completion
              </div>
              <div style={{ color: 'var(--text-primary)' }}>
                {formatDate(liveStatus?.primaryCompletionDate ?? trial.estimatedPrimaryCompletion)}
              </div>
            </div>
          </div>

          <Section title="Estimated timeframe for results">{trial.estimatedTimeframeNote}</Section>

          {trial.results.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Available results
              </h3>
              <ol className="mt-2 flex flex-col gap-3 border-l-2 pl-4" style={{ borderColor: 'var(--gridline)' }}>
                {trial.results.map((r, i) => (
                  <li key={i}>
                    <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(r.date)}
                    </div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {r.headline}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {r.detail}
                    </p>
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-block text-xs underline"
                      style={{ color: 'var(--cat-blue)' }}
                    >
                      {r.sourceLabel}
                    </a>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <Section title="Sources">
            <ul className="flex flex-col gap-1">
              {trial.nctId && (
                <li>
                  <a
                    href={`https://clinicaltrials.gov/study/${trial.nctId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline"
                    style={{ color: 'var(--cat-blue)' }}
                  >
                    {trial.nctId} on ClinicalTrials.gov
                  </a>
                </li>
              )}
              {trial.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: 'var(--cat-blue)' }}>
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              Curated content as of {trial.dataAsOf}. Status/enrollment above reflect a live ClinicalTrials.gov sync when available.
            </p>
          </Section>
        </div>
      </div>
    </div>
  )
}
