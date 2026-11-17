import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { RegistryStudy } from '../types/registry'
import { statusLabel } from '../lib/clinicalTrialsApi'
import { Badge } from './Badge'
import {
  DARK_INK, LIGHT_PHASES, OUTCOME_GROUP_OF, PHASE_COLOR, STATUS_GROUP_COLOR, VERDICT_COLOR, statusGroup, year,
} from '../lib/registryPresentation'

// How far along a phase is, for ordering and the phase ladder.
const PHASE_RANK: Record<string, number> = {
  'Early Phase 1': 1, 'Phase 1': 1, 'Phase 1/2': 1.5, 'Phase 2': 2, 'Phase 2/3': 2.5, 'Phase 3': 3, 'Phase 4': 4,
}
const RANK_LABEL: Record<number, string> = { 1: 'Phase 1', 1.5: 'Phase 1/2', 2: 'Phase 2', 2.5: 'Phase 2/3', 3: 'Phase 3', 4: 'Phase 4' }
const ACTIVE = new Set(['RECRUITING', 'NOT_YET_RECRUITING', 'ACTIVE_NOT_RECRUITING', 'ENROLLING_BY_INVITATION', 'AVAILABLE'])
// A drug whose last ALS trial ended within this many years may simply be between trials.
const RECENT_YEARS = 2

type EndState = { kind: 'approved' | 'withdrawn' | 'ongoing' | 'pending' | 'stopped'; title: string; detail: string | null }

const END_COLOR: Record<EndState['kind'], string> = {
  approved: 'var(--status-good)',
  withdrawn: 'var(--status-critical)',
  ongoing: 'var(--cat-blue)',
  pending: 'var(--text-muted)',
  stopped: 'var(--status-critical)',
}

const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '')
// Platform trials (HEALEY, MAGNET, EXPERTS-ALS, MND-SMART...) test many drugs and run on after any one arm
// ends, so they don't show where one drug stands.
// A platform record that registers a single drug ("HEALEY ALS Platform Trial -
// Regimen G DNL343", MAGNET's lithium record) counts as that drug's own trial.
const isPlatform = (s: RegistryStudy) =>
  s.drugKeys.length >= 4 || (s.drugKeys.length > 1 && /platform|master protocol|multi-arm/i.test(s.title))
const EXTENSION = /extension|continuation|rollover|roll-over|long[- ]term|compassionate|expanded access/i
const endYear = (s: RegistryStudy) => Number(year(s.completion ?? s.primaryCompletion ?? s.start)) || 0

// Where the drug stands now, from its trials and (for approved drugs) the drug table.
function endStateOf(trials: RegistryStudy[], approval: { text: string; withdrawn?: boolean } | null): EndState {
  if (approval) return { kind: approval.withdrawn ? 'withdrawn' : 'approved', title: approval.text, detail: null }
  const own = trials.filter((t) => !isPlatform(t))
  if (own.length) trials = own
  const ran = trials.filter((t) => t.status !== 'WITHDRAWN')
  const active = trials.filter((t) => ACTIVE.has(t.status))
  if (active.length) {
    const top = active.reduce((a, b) => ((PHASE_RANK[b.phase ?? ''] ?? 0) > (PHASE_RANK[a.phase ?? ''] ?? 0) ? b : a))
    return {
      kind: 'ongoing',
      title: `${top.phase ?? 'A trial'} under way`,
      detail: `${statusLabel(top.status)}${top.start ? `, started ${year(top.start)}` : ''}.`,
    }
  }
  const furthest = Math.max(0, ...ran.map((t) => PHASE_RANK[t.phase ?? ''] ?? 0))
  const lastYear = Math.max(0, ...trials.map(endYear))
  // The drug's main trial at the furthest phase reached says why development ended, if anything does:
  // a researched outcome first, then a main trial over an extension, then the latest.
  const deciding = [...(ran.length ? ran : trials)]
    .filter((t) => !ran.length || (PHASE_RANK[t.phase ?? ''] ?? 0) === furthest)
    .sort((a, b) => Number(Boolean(b.outcome?.curated)) - Number(Boolean(a.outcome?.curated)) ||
      Number(EXTENSION.test(a.title)) - Number(EXTENSION.test(b.title)) || endYear(b) - endYear(a))[0]
  const what = deciding?.outcome
    ? `${deciding.outcome.verdict}${deciding.outcome.summary ? `. ${deciding.outcome.summary}` : '.'}`
    : deciding?.whyStopped ?? null
  const reason = deciding && what ? `${deciding.phase ?? 'Last'} trial ${deciding.id}: ${what}` : null
  if (!ran.length) {
    return { kind: 'stopped', title: 'Never started: its only registered trial was withdrawn before enrolling', detail: deciding?.whyStopped ?? null }
  }
  if (lastYear >= new Date().getFullYear() - RECENT_YEARS) {
    return { kind: 'pending', title: `Latest trial ended ${lastYear || 'recently'}; no next ALS trial registered yet`, detail: reason }
  }
  return {
    kind: 'stopped',
    title: `No ALS trial registered since ${lastYear || 'then'}: development in ALS appears to have stopped${furthest ? ` after ${RANK_LABEL[furthest] ?? 'Phase ' + furthest}` : ''}`,
    detail: reason,
  }
}

interface DevelopmentTimelineProps {
  /** The trial the timeline was opened from. */
  study: RegistryStudy
  studiesByDrug: Map<string, RegistryStudy[]>
  /** Full details of a trial, as in the catalog. */
  renderStudy: (study: RegistryStudy) => ReactNode
  onClose: () => void
}

export function DevelopmentTimeline({ study, studiesByDrug, renderStudy, onClose }: DevelopmentTimelineProps) {
  const [drugKey, setDrugKey] = useState(study.drugKeys[0]?.key ?? '')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const drug = study.drugKeys.find((d) => d.key === drugKey) ?? study.drugKeys[0]
  const trials = useMemo(
    () => [...(studiesByDrug.get(drugKey) ?? [study])].sort((a, b) => (a.start ?? '9999').localeCompare(b.start ?? '9999')),
    [studiesByDrug, drugKey, study],
  )
  const approval = trials.flatMap((t) => t.drugKeys).find((d) => d.key === drugKey && d.approval)?.approval ?? null
  const end = endStateOf(trials, approval)
  const furthest = Math.max(0, ...trials.filter((t) => t.status !== 'WITHDRAWN').map((t) => PHASE_RANK[t.phase ?? ''] ?? 0))
  // What the drug is, from the opened trial's drug lines when they cover it.
  const info = drug
    ? study.drugs.find((d) => norm(d.label).includes(norm(drug.label)) || norm(drug.label).includes(norm(d.label))) ??
      (study.drugs.length === 1 ? study.drugs[0] : undefined)
    : undefined
  const years = trials.map((t) => t.start).filter(Boolean).map((d) => year(d))

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeline-heading"
        className="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l p-4 sm:p-6"
        style={{ backgroundColor: 'var(--surface-page)', borderColor: 'var(--border-hairline)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Development timeline
            </div>
            <h2 id="timeline-heading" className="mt-1 text-lg font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
              {drug?.label ?? 'This drug'}
              {info && info.names.length > 0 && <span style={{ color: 'var(--text-secondary)' }}> = {info.names.join(', ')}</span>}
            </h2>
            {info && (
              <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {info.targets.join(', ')} · {info.modality}
                {info.what && <> · {info.what}</>}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border px-2.5 py-1 text-sm"
            style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }}
          >
            Close
          </button>
        </div>

        {study.drugKeys.length > 1 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Drug">
            <span className="mr-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              This trial tests:
            </span>
            {study.drugKeys.map((d) => (
              <button
                key={d.key}
                type="button"
                aria-pressed={d.key === drugKey}
                onClick={() => {
                  setDrugKey(d.key)
                  setExpanded(new Set())
                }}
                className="rounded-full border px-3 py-1 text-xs font-medium"
                style={
                  d.key === drugKey
                    ? { backgroundColor: 'var(--text-primary)', borderColor: 'var(--text-primary)', color: 'var(--surface-page)' }
                    : { borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }
                }
              >
                {d.label.length > 30 ? `${d.label.slice(0, 27)}…` : d.label}
              </button>
            ))}
          </div>
        )}

        {/* Phase ladder: how far the drug has got in ALS. */}
        <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label="Phases reached">
          {[1, 2, 3].map((step) => {
            const done = furthest >= step
            const partly = !done && furthest >= step - 0.5
            return (
              <li
                key={step}
                className="rounded-md border px-2 py-1.5 text-center text-xs font-medium"
                style={{
                  backgroundColor: done ? PHASE_COLOR[`Phase ${step}`] : 'transparent',
                  borderColor: done || partly ? PHASE_COLOR[`Phase ${step}`] : 'var(--border-hairline)',
                  borderStyle: partly ? 'dashed' : 'solid',
                  color: done ? (step === 1 ? DARK_INK : '#ffffff') : partly ? 'var(--text-secondary)' : 'var(--text-muted)',
                }}
              >
                Phase {step}
              </li>
            )
          })}
          <li
            className="rounded-md border px-2 py-1.5 text-center text-xs font-medium"
            style={{
              backgroundColor: approval && !approval.withdrawn ? 'var(--status-good)' : 'transparent',
              borderColor: approval ? (approval.withdrawn ? 'var(--status-critical)' : 'var(--status-good)') : 'var(--border-hairline)',
              color: approval ? (approval.withdrawn ? 'var(--status-critical)' : '#ffffff') : 'var(--text-muted)',
            }}
          >
            {approval?.withdrawn ? 'Withdrawn' : 'Approved'}
          </li>
        </ol>
        <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {trials.length} ALS {trials.length === 1 ? 'trial' : 'trials'}
          {years.length > 0 && <>, {years[0] === years[years.length - 1] ? years[0] : `${years[0]}–${years[years.length - 1]}`}</>}. Tap a
          trial to see its full details.
        </p>

        <ol className="relative mt-4 flex flex-col gap-3 border-l-2 pl-5" style={{ borderColor: 'var(--gridline)' }}>
          {trials.map((t) => {
            const isOpen = expanded.has(t.id)
            const group = t.outcome ? OUTCOME_GROUP_OF.get(t.outcome.verdict) : undefined
            return (
              <li key={t.id} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute top-3.5 h-3 w-3 rounded-full border-2"
                  style={{
                    left: -27,
                    backgroundColor: t.phase ? PHASE_COLOR[t.phase] ?? 'var(--seq-450)' : 'var(--surface-page)',
                    borderColor: t.id === study.id ? 'var(--text-primary)' : 'var(--surface-page)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => toggle(t.id)}
                  aria-expanded={isOpen}
                  className="w-full rounded-lg border p-2.5 text-left"
                  style={{
                    borderColor: t.id === study.id ? 'var(--text-primary)' : 'var(--border-hairline)',
                    backgroundColor: 'var(--surface-card)',
                  }}
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {t.start ? year(t.start) : '—'}
                    </span>
                    {t.phase && (
                      <Badge
                        label={t.phase}
                        color={PHASE_COLOR[t.phase] ?? 'var(--seq-450)'}
                        variant="solid"
                        textColor={LIGHT_PHASES.has(t.phase) ? DARK_INK : undefined}
                      />
                    )}
                    <Badge label={statusLabel(t.status)} color={STATUS_GROUP_COLOR[statusGroup(t.status)]} />
                    {t.outcome && group && VERDICT_COLOR[group] && <Badge label={t.outcome.verdict} color={VERDICT_COLOR[group]} />}
                    {isPlatform(t) && <Badge label="Platform trial" color="var(--text-muted)" />}
                    {t.id === study.id && (
                      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        · this trial
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-sm font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                    {t.title}
                    {t.acronym && !t.title.includes(t.acronym) && <span style={{ color: 'var(--text-secondary)' }}> ({t.acronym})</span>}
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span>
                      <span className="font-mono">{t.id}</span>
                      {t.sponsor && <> · {t.sponsor}</>}
                    </span>
                    <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>
                      {isOpen ? 'Hide details ▴' : 'Details ▾'}
                    </span>
                  </span>
                </button>
                {isOpen && <ul className="mt-2 flex flex-col gap-2">{renderStudy(t)}</ul>}
              </li>
            )
          })}

          {/* Where the drug stands now. */}
          <li className="relative">
            <span
              aria-hidden="true"
              className="absolute top-3 h-3 w-3"
              style={{ left: -27, backgroundColor: END_COLOR[end.kind], borderRadius: end.kind === 'ongoing' ? '9999px' : 2 }}
            />
            <div className="rounded-lg border p-2.5" style={{ borderColor: END_COLOR[end.kind], borderStyle: end.kind === 'pending' ? 'dashed' : 'solid' }}>
              <div className="text-sm font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                {end.title}
              </div>
              {end.detail && (
                <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {end.detail}
                </p>
              )}
            </div>
          </li>
        </ol>

        <p className="mt-6 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Built from ALS trials registered on ClinicalTrials.gov, ISRCTN and the EU registers, matching the drug by its names and
          codes. A drug may have continued under another name, outside these registries or in another disease; “appears to have
          stopped” means only that no later ALS trial is registered. Trials of the same drug by different groups appear together;
          platform trials, which test several drugs at once, are shown but don’t decide where a drug stands.
        </p>
      </div>
    </div>
  )
}
