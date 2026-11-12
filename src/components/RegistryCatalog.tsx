import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { RegistrySnapshot, RegistryStudy } from '../types/registry'
import { statusLabel } from '../lib/clinicalTrialsApi'
import { Badge } from './Badge'

const PAGE_SIZE = 40

const TYPE_OPTIONS = [
  { key: 'INTERVENTIONAL', label: 'Interventional trials' },
  { key: 'OBSERVATIONAL', label: 'Observational studies' },
  { key: 'EXPANDED_ACCESS', label: 'Expanded access' },
] as const

const PHASE_OPTIONS = ['Early Phase 1', 'Phase 1', 'Phase 1/2', 'Phase 2', 'Phase 2/3', 'Phase 3', 'Phase 4', 'No phase'] as const

// Ordinal ramp, same tokens as the curated cards: later phase = darker.
const PHASE_COLOR: Record<string, string> = {
  'Early Phase 1': 'var(--seq-250)',
  'Phase 1': 'var(--seq-250)',
  'Phase 1/2': 'var(--seq-350)',
  'Phase 2': 'var(--seq-450)',
  'Phase 2/3': 'var(--seq-550)',
  'Phase 3': 'var(--seq-650)',
  'Phase 4': 'var(--seq-650)',
}

// The two lightest ramp steps need dark text to stay readable.
const LIGHT_PHASES = new Set(['Early Phase 1', 'Phase 1', 'Phase 1/2'])
const DARK_INK = '#0d366b'

type StatusGroup ='Ongoing' | 'Completed' | 'Stopped early' | 'Status unknown'
const STATUS_GROUPS: StatusGroup[] = ['Ongoing', 'Completed', 'Stopped early', 'Status unknown']

function statusGroup(status: string): StatusGroup {
  if (['COMPLETED', 'APPROVED_FOR_MARKETING', 'NO_LONGER_AVAILABLE'].includes(status)) return 'Completed'
  if (['TERMINATED', 'WITHDRAWN', 'SUSPENDED'].includes(status)) return 'Stopped early'
  if (status === 'UNKNOWN') return 'Status unknown'
  return 'Ongoing'
}

const STATUS_GROUP_COLOR: Record<StatusGroup, string> = {
  Ongoing: 'var(--cat-blue)',
  Completed: 'var(--text-secondary)',
  'Stopped early': 'var(--status-critical)',
  'Status unknown': 'var(--text-muted)',
}

type SortKey = 'newest' | 'oldest' | 'enrollment'

function year(date: string | null): string {
  return date ? date.slice(0, 4) : '?'
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
      style={
        active
          ? { backgroundColor: 'var(--text-primary)', borderColor: 'var(--text-primary)', color: 'var(--surface-page)' }
          : { backgroundColor: 'transparent', borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }
      }
    >
      {children}
    </button>
  )
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-14 shrink-0 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      {children}
    </div>
  )
}

interface RegistryCatalogProps {
  featuredIds: Set<string>
  onOpenFeatured: (nctId: string) => void
}

export function RegistryCatalog({ featuredIds, onOpenFeatured }: RegistryCatalogProps) {
  const [snapshot, setSnapshot] = useState<RegistrySnapshot | null>(null)
  const [loadError, setLoadError] = useState(false)

  const [search, setSearch] = useState('')
  const [types, setTypes] = useState<Set<string>>(new Set(['INTERVENTIONAL']))
  const [phases, setPhases] = useState<Set<string>>(new Set())
  const [groups, setGroups] = useState<Set<StatusGroup>>(new Set())
  const [resultsOnly, setResultsOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('newest')
  const [visible, setVisible] = useState(PAGE_SIZE)

  useEffect(() => {
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}data/als-registry.json`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json() as Promise<RegistrySnapshot>
      })
      .then((data) => {
        if (!cancelled) setSnapshot(data)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const indexed = useMemo(
    () =>
      (snapshot?.studies ?? []).map((s) => ({
        study: s,
        group: statusGroup(s.status),
        haystack: [s.id, s.title, s.acronym, s.sponsor, ...s.interventions, ...(s.aliases ?? []), ...(s.drugNotes ?? []).map((n) => n.what)]
          .join(' ')
          .toLowerCase(),
      })),
    [snapshot],
  )

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const { study } of indexed) counts[study.type] = (counts[study.type] ?? 0) + 1
    return counts
  }, [indexed])

  const filtered = useMemo(() => {
    const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const rows = indexed.filter(({ study, group, haystack }) => {
      if (types.size > 0 && !types.has(study.type)) return false
      if (phases.size > 0 && !phases.has(study.phase ?? 'No phase')) return false
      if (groups.size > 0 && !groups.has(group)) return false
      if (resultsOnly && !study.hasResults) return false
      return terms.every((t) => haystack.includes(t))
    })
    const byStart = (a: RegistryStudy, b: RegistryStudy) => (a.start ?? '').localeCompare(b.start ?? '')
    rows.sort((a, b) => {
      if (sort === 'enrollment') return (b.study.enrollment ?? -1) - (a.study.enrollment ?? -1)
      if (sort === 'oldest') {
        // Studies with no start date go last either way.
        if (!a.study.start || !b.study.start) return a.study.start ? -1 : b.study.start ? 1 : 0
        return byStart(a.study, b.study)
      }
      return byStart(b.study, a.study)
    })
    return rows.map((r) => r.study)
  }, [indexed, search, types, phases, groups, resultsOnly, sort])

  // Any change to what is shown starts the list from the top again.
  useEffect(() => setVisible(PAGE_SIZE), [search, types, phases, groups, resultsOnly, sort])

  const hasFilters = search.length > 0 || phases.size > 0 || groups.size > 0 || resultsOnly || !(types.size === 1 && types.has('INTERVENTIONAL'))

  if (loadError) {
    return (
      <div className="rounded-xl border p-8 text-center text-sm" style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-secondary)' }}>
        The registry catalog couldn’t be loaded. Check your connection and reload the page.
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div className="rounded-xl border p-8 text-center text-sm" style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-muted)' }}>
        Loading the registry catalog…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-3xl text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Every ALS study registered on ClinicalTrials.gov — {snapshot.studies.length.toLocaleString()} in total, as of{' '}
        {new Date(snapshot.generatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}. These
        entries are the registry’s own records, not curated summaries. Coverage before about 2000 is thin, and trials registered
        only in other countries’ registries (EU, Australia, China, Japan and others) are not included.
      </p>

      <div className="flex flex-col gap-3 rounded-xl border p-4" style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-card)' }}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by drug name or code, target, sponsor, or NCT ID…"
            aria-label="Search registered studies"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
            style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-card-raised)', color: 'var(--text-primary)' }}
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort studies"
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-card-raised)', color: 'var(--text-primary)' }}
          >
            <option value="newest">Newest start first</option>
            <option value="oldest">Oldest start first</option>
            <option value="enrollment">Largest enrollment first</option>
          </select>
        </div>

        <ChipRow label="Type">
          {TYPE_OPTIONS.map((t) => (
            <Chip key={t.key} active={types.has(t.key)} onClick={() => setTypes((prev) => toggle(prev, t.key))}>
              {t.label} · {(typeCounts[t.key] ?? 0).toLocaleString()}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow label="Phase">
          {PHASE_OPTIONS.map((p) => (
            <Chip key={p} active={phases.has(p)} onClick={() => setPhases((prev) => toggle(prev, p))}>
              {p}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow label="Status">
          {STATUS_GROUPS.map((g) => (
            <Chip key={g} active={groups.has(g)} onClick={() => setGroups((prev) => toggle(prev, g))}>
              {g}
            </Chip>
          ))}
          <Chip active={resultsOnly} onClick={() => setResultsOnly((v) => !v)}>
            Results posted
          </Chip>
        </ChipRow>
      </div>

      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span>
          Showing {Math.min(visible, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()} studies
        </span>
        {hasFilters && (
          <button
            type="button"
            className="underline"
            onClick={() => {
              setSearch('')
              setTypes(new Set(['INTERVENTIONAL']))
              setPhases(new Set())
              setGroups(new Set())
              setResultsOnly(false)
            }}
          >
            Reset filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border p-8 text-center text-sm" style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-muted)' }}>
          No studies match the current filters.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.slice(0, visible).map((s) => (
            <StudyRow key={s.id} study={s} featured={featuredIds.has(s.id)} onOpenFeatured={() => onOpenFeatured(s.id)} />
          ))}
        </ul>
      )}

      {visible < filtered.length && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="self-center rounded-full border px-4 py-2 text-sm font-medium"
          style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-primary)' }}
        >
          Show {Math.min(PAGE_SIZE, filtered.length - visible)} more
        </button>
      )}
    </div>
  )
}

function StudyRow({ study, featured, onOpenFeatured }: { study: RegistryStudy; featured: boolean; onOpenFeatured: () => void }) {
  const group = statusGroup(study.status)
  const end = study.completion ?? study.primaryCompletion
  // Registry "other names" not already shown in a curated note above.
  const curatedNames = new Set((study.drugNotes ?? []).flatMap((n) => n.names.map((x) => x.toLowerCase())))
  const otherNames = (study.aliases ?? []).filter((a) => !curatedNames.has(a.toLowerCase()))
  const meta = [
    study.sponsor,
    study.enrollment != null ? `${study.enrollment.toLocaleString()} ${study.enrollmentActual ? 'enrolled' : 'planned'}` : null,
    study.countries.length === 1 ? study.countries[0] : study.countries.length > 1 ? `${study.countries.length} countries` : null,
  ].filter(Boolean)

  return (
    <li className="rounded-lg border p-3" style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-card)' }}>
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {study.phase && (
            <Badge
              label={study.phase}
              color={PHASE_COLOR[study.phase] ?? 'var(--seq-450)'}
              variant="solid"
              textColor={LIGHT_PHASES.has(study.phase) ? DARK_INK : undefined}
            />
          )}
          <Badge label={statusLabel(study.status)} color={STATUS_GROUP_COLOR[group]} />
          {study.type !== 'INTERVENTIONAL' && <Badge label={study.type === 'OBSERVATIONAL' ? 'Observational' : 'Expanded access'} color="var(--text-muted)" />}
          {study.hasResults && <Badge label="Results posted" color="var(--status-good)" />}
          {featured && (
            <button type="button" onClick={onOpenFeatured} className="rounded-full">
              <Badge label="Featured · open summary" color="var(--cat-violet)" />
            </button>
          )}
        </div>
        <div className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {!study.start
            ? 'Dates not reported'
            : end
              ? `${year(study.start)} – ${year(end)}`
              : group === 'Ongoing'
                ? `${year(study.start)} – ongoing`
                : `Started ${year(study.start)}`}
        </div>
      </div>

      <a
        href={`https://clinicaltrials.gov/study/${study.id}`}
        target="_blank"
        rel="noreferrer"
        className="mt-1.5 block text-sm font-medium leading-snug hover:underline"
        style={{ color: 'var(--text-primary)' }}
      >
        {study.title}
        {study.acronym && <span style={{ color: 'var(--text-secondary)' }}> ({study.acronym})</span>}
      </a>

      <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        <span className="font-mono">{study.id}</span>
        {meta.length > 0 && <> · {meta.join(' · ')}</>}
      </p>
      {study.interventions.length > 0 && (
        <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--text-muted)' }}>Intervention: </span>
          {study.interventions.join(', ')}
        </p>
      )}
      {(study.drugNotes ?? []).map((note) => (
        <p key={note.codes[0]} className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {note.codes[0]}
            {note.names.length > 0 && ` = ${note.names.join(', ')}`}
          </span>
          {': '}
          {note.what}.{' '}
          <a href={note.source} target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--cat-blue)' }}>
            Source
          </a>
        </p>
      ))}
      {otherNames.length > 0 && (
        <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--text-muted)' }}>Also listed as: </span>
          {otherNames.join(', ')}
        </p>
      )}
      {study.whyStopped && group === 'Stopped early' && (
        <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--text-muted)' }}>Why stopped: </span>
          {study.whyStopped}
        </p>
      )}
    </li>
  )
}
