import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { RegistryOutcome, RegistrySnapshot, RegistryStudy } from '../types/registry'
import { statusLabel } from '../lib/clinicalTrialsApi'
import { useFollowed } from '../lib/useFollowed'
import { buildIndex, matchesQuery, parseQuery } from '../lib/search'
import { targetSynonyms } from '../data/targets'
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

// Same colours the featured cards use for each modality; others stay neutral.
const MODALITY_BADGE_COLOR: Record<string, string> = {
  'Small molecule': 'var(--cat-blue)',
  'Antisense oligonucleotide': 'var(--cat-orange)',
  'Cell therapy': 'var(--cat-aqua)',
  Antibody: 'var(--cat-yellow)',
  'Gene therapy': 'var(--cat-magenta)',
  Peptide: 'var(--cat-green)',
}

// Outcome verdicts (scripts/fetch-registry.mjs, scripts/outcomes.json) grouped
// for the filter, in the order the chips appear.
const OUTCOME_GROUPS: [string, string[]][] = [
  ['Met primary endpoint', ['Met primary endpoint']],
  ['Missed or no benefit', ['Missed primary endpoint', 'No benefit shown', 'Stopped: no benefit']],
  ['Mixed or inconclusive', ['Mixed results', 'Inconclusive']],
  ['Stopped for safety', ['Stopped: safety']],
  ['Stopped for other reasons', ['Stopped: slow enrollment', 'Stopped: business or funding', 'Stopped: other reason', 'Stopped: reason not given', 'Withdrawn before enrolling', 'Suspended']],
  ['Results available, not summarised', ['Results posted, not yet summarised', 'Publication linked, not yet summarised']],
  ['No results available', ['No results posted', 'No results found']],
  ['Extension, safety or other', ['Extension or access study', 'Safety study', 'Not a treatment study']],
]
const OUTCOME_GROUP_OF = new Map(OUTCOME_GROUPS.flatMap(([group, verdicts]) => verdicts.map((v) => [v, group] as const)))

const VERDICT_COLOR: Record<string, string> = {
  'Met primary endpoint': 'var(--status-good)',
  'Missed or no benefit': 'var(--status-critical)',
  'Stopped for safety': 'var(--status-critical)',
  'Mixed or inconclusive': 'var(--cat-orange)',
  'Stopped for other reasons': 'var(--text-secondary)',
}

// Set by scripts/fetch-registry.mjs for drugs the drug table doesn't cover yet.
const UNCLASSIFIED = 'Not yet classified'

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
  const [modalities, setModalities] = useState<Set<string>>(new Set())
  const [target, setTarget] = useState('')
  const [outcomes, setOutcomes] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<SortKey>('newest')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const { followed, toggleFollow } = useFollowed()
  const followedSet = useMemo(() => new Set(followed), [followed])

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
        index: buildIndex([
          s.id, s.title, s.acronym, s.sponsor, ...s.interventions, ...s.aliases, ...s.targets, ...s.modalities,
          ...s.targets.flatMap(targetSynonyms),
          ...s.drugs.flatMap((d) => [...d.names, d.what]),
          s.outcome?.verdict, s.outcome?.summary,
        ]),
      })),
    [snapshot],
  )

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const { study } of indexed) counts[study.type] = (counts[study.type] ?? 0) + 1
    return counts
  }, [indexed])

  // Counts for the modality chips and the target picker, most common first.
  const facetCounts = useMemo(() => {
    const byOutcome = new Map<string, number>()
    const byModality = new Map<string, number>()
    const byTarget = new Map<string, number>()
    // Count only studies of the selected types, so the numbers match the list.
    for (const { study } of indexed) {
      if (types.size > 0 && !types.has(study.type)) continue
      for (const m of study.modalities) byModality.set(m, (byModality.get(m) ?? 0) + 1)
      for (const t of study.targets) byTarget.set(t, (byTarget.get(t) ?? 0) + 1)
      const group = study.outcome && OUTCOME_GROUP_OF.get(study.outcome.verdict)
      if (group) byOutcome.set(group, (byOutcome.get(group) ?? 0) + 1)
    }
    const sorted = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    // "Not yet classified" goes last so it reads as a gap, not a category.
    const mods = sorted(byModality).filter(([k]) => k !== UNCLASSIFIED)
    if (byModality.has(UNCLASSIFIED)) mods.push([UNCLASSIFIED, byModality.get(UNCLASSIFIED)!])
    const outcomeCounts = OUTCOME_GROUPS.map(([g]) => [g, byOutcome.get(g) ?? 0] as const).filter(([, n]) => n > 0)
    return { modalities: mods, targets: sorted(byTarget), outcomes: outcomeCounts }
  }, [indexed, types])

  const filtered = useMemo(() => {
    const terms = parseQuery(search)
    const rows = indexed.filter(({ study, group, index }) => {
      if (types.size > 0 && !types.has(study.type)) return false
      if (phases.size > 0 && !phases.has(study.phase ?? 'No phase')) return false
      if (groups.size > 0 && !groups.has(group)) return false
      if (resultsOnly && !study.hasResults) return false
      if (modalities.size > 0 && !study.modalities.some((m) => modalities.has(m))) return false
      if (target && !study.targets.includes(target)) return false
      if (outcomes.size > 0 && !(study.outcome && outcomes.has(OUTCOME_GROUP_OF.get(study.outcome.verdict) ?? ''))) return false
      return matchesQuery(index, terms)
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
  }, [indexed, search, types, phases, groups, resultsOnly, modalities, target, outcomes, sort])

  // Followed studies are pinned above the filters whatever the filters say,
  // so the list below leaves them out rather than showing them twice.
  const pinned = useMemo(() => {
    const byId = new Map(indexed.map(({ study }) => [study.id, study]))
    return followed.map((id) => byId.get(id)).filter((s): s is RegistryStudy => s !== undefined)
  }, [indexed, followed])
  const unpinned = useMemo(() => filtered.filter((s) => !followedSet.has(s.id)), [filtered, followedSet])
  const pinnedMatches = filtered.length - unpinned.length

  // Any change to what is shown starts the list from the top again.
  useEffect(() => setVisible(PAGE_SIZE), [search, types, phases, groups, resultsOnly, modalities, target, outcomes, sort])

  const hasFilters =
    search.length > 0 || phases.size > 0 || groups.size > 0 || resultsOnly || modalities.size > 0 || target !== '' || outcomes.size > 0 ||
    !(types.size === 1 && types.has('INTERVENTIONAL'))

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

      {pinned.length > 0 ? (
        <section aria-labelledby="following-heading" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 id="following-heading" className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Following · {pinned.length}
            </h2>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Saved in this browser only
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {pinned.map((s) => (
              <StudyRow
                key={s.id}
                study={s}
                featured={featuredIds.has(s.id)}
                onOpenFeatured={() => onOpenFeatured(s.id)}
                followed
                onToggleFollow={() => toggleFollow(s.id)}
              />
            ))}
          </ul>
        </section>
      ) : (
        <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          <StarIcon filled={false} />
          Tap Follow on any study to pin it to the top of this page.
        </p>
      )}

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
        <ChipRow label="Outcome">
          {facetCounts.outcomes.map(([o, n]) => (
            <Chip key={o} active={outcomes.has(o)} onClick={() => setOutcomes((prev) => toggle(prev, o))}>
              {o} · {n}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow label="Modality">
          {facetCounts.modalities.map(([m, n]) => (
            <Chip key={m} active={modalities.has(m)} onClick={() => setModalities((prev) => toggle(prev, m))}>
              {m} · {n}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow label="Target">
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label="Filter by therapy target"
            className="min-w-0 max-w-full rounded-lg border px-3 py-1.5 text-xs"
            style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-card-raised)', color: 'var(--text-primary)' }}
          >
            <option value="">Any target</option>
            {facetCounts.targets.map(([t, n]) => (
              <option key={t} value={t}>
                {t} ({n})
              </option>
            ))}
          </select>
        </ChipRow>
      </div>

      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span>
          Showing {Math.min(visible, unpinned.length).toLocaleString()} of {unpinned.length.toLocaleString()} studies
          {pinnedMatches > 0 && ` (plus ${pinnedMatches} you follow, pinned above)`}
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
              setModalities(new Set())
              setTarget('')
              setOutcomes(new Set())
            }}
          >
            Reset filters
          </button>
        )}
      </div>

      {unpinned.length === 0 ? (
        <div className="rounded-xl border p-8 text-center text-sm" style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-muted)' }}>
          {pinnedMatches > 0 ? 'The only matching studies are ones you follow, pinned above.' : 'No studies match the current filters.'}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {unpinned.slice(0, visible).map((s) => (
            <StudyRow
              key={s.id}
              study={s}
              featured={featuredIds.has(s.id)}
              onOpenFeatured={() => onOpenFeatured(s.id)}
              followed={false}
              onToggleFollow={() => toggleFollow(s.id)}
            />
          ))}
        </ul>
      )}

      {visible < unpinned.length && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="self-center rounded-full border px-4 py-2 text-sm font-medium"
          style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-primary)' }}
        >
          Show {Math.min(PAGE_SIZE, unpinned.length - visible)} more
        </button>
      )}
    </div>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" className="shrink-0">
      <path
        d="M10 1.8l2.47 5.2 5.7.68-4.2 3.9 1.1 5.63L10 14.4l-5.07 2.8 1.1-5.63-4.2-3.9 5.7-.68z"
        fill={filled ? 'var(--cat-yellow)' : 'none'}
        stroke={filled ? 'var(--cat-yellow)' : 'currentColor'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface StudyRowProps {
  study: RegistryStudy
  featured: boolean
  onOpenFeatured: () => void
  followed: boolean
  onToggleFollow: () => void
}

function StudyRow({ study, featured, onOpenFeatured, followed, onToggleFollow }: StudyRowProps) {
  const group = statusGroup(study.status)
  const end = study.completion ?? study.primaryCompletion
  // Registry "other names" not already shown on a drug line below.
  const shownNames = new Set(study.drugs.flatMap((d) => d.names.map((x) => x.toLowerCase())))
  const otherNames = study.aliases.filter((a) => !shownNames.has(a.toLowerCase()))
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
          {study.modalities.map((m) => (
            <Badge key={m} label={m} color={m === UNCLASSIFIED ? 'var(--text-muted)' : (MODALITY_BADGE_COLOR[m] ?? 'var(--text-secondary)')} />
          ))}
          {study.hasResults && <Badge label="Results posted" color="var(--status-good)" />}
          {featured && (
            <button type="button" onClick={onOpenFeatured} className="rounded-full">
              <Badge label="Featured · open summary" color="var(--cat-violet)" />
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
          <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {!study.start
              ? 'Dates not reported'
              : end
                ? `${year(study.start)} – ${year(end)}`
                : group === 'Ongoing'
                  ? `${year(study.start)} – ongoing`
                  : `Started ${year(study.start)}`}
          </span>
          <button
            type="button"
            onClick={onToggleFollow}
            aria-pressed={followed}
            aria-label={followed ? `Unfollow ${study.id}` : `Follow ${study.id}`}
            className="inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-medium"
            style={{
              borderColor: followed ? 'var(--cat-yellow)' : 'var(--border-hairline)',
              color: followed ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            <StarIcon filled={followed} />
            {followed ? 'Following' : 'Follow'}
          </button>
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
      {study.drugs.map((drug) => (
        <div key={drug.label} className="mt-1.5 flex flex-col gap-0.5 text-xs leading-relaxed sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {drug.label.length > 60 ? `${drug.label.slice(0, 57)}…` : drug.label}
            {drug.names.length > 0 && <span style={{ color: 'var(--text-secondary)' }}> = {drug.names.join(', ')}</span>}
          </span>
          <span>
            <span style={{ color: 'var(--text-muted)' }}>Target: </span>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {drug.targets.join(', ')}
            </span>
            <span style={{ color: 'var(--text-muted)' }}> · {drug.modality}</span>
            {drug.what && <span style={{ color: 'var(--text-secondary)' }}> · {drug.what}</span>}
            {drug.source && (
              <>
                {' · '}
                <a href={drug.source} target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--cat-blue)' }}>
                  Source
                </a>
              </>
            )}
          </span>
        </div>
      ))}
      {otherNames.length > 0 && (
        <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--text-muted)' }}>Also listed as: </span>
          {otherNames.join(', ')}
        </p>
      )}
      {study.outcome && <OutcomeLine study={study} outcome={study.outcome} />}
      {study.publications.length > 0 && (
        <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--text-muted)' }}>Results published: </span>
          {study.publications.map((pub, i) => (
            <span key={pub.pmid}>
              {i > 0 && '; '}
              <a
                href={`https://pubmed.ncbi.nlm.nih.gov/${pub.pmid}/`}
                target="_blank"
                rel="noreferrer"
                title={pub.citation}
                className="underline"
                style={{ color: 'var(--cat-blue)' }}
              >
                {pub.citation.length > 90 ? `${pub.citation.slice(0, 87)}…` : pub.citation || `PubMed ${pub.pmid}`}
              </a>
            </span>
          ))}
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

function OutcomeLine({ study, outcome }: { study: RegistryStudy; outcome: RegistryOutcome }) {
  const group = OUTCOME_GROUP_OF.get(outcome.verdict) ?? ''
  const showResultsLink = !outcome.curated && study.hasResults
  return (
    <div className="mt-1.5 flex flex-col gap-1 text-xs leading-relaxed sm:flex-row sm:items-baseline sm:gap-2">
      <span className="flex shrink-0 items-center gap-1.5">
        <span style={{ color: 'var(--text-muted)' }}>Outcome:</span>
        <Badge label={outcome.verdict} color={VERDICT_COLOR[group] ?? 'var(--text-muted)'} />
      </span>
      {(outcome.summary || outcome.source || showResultsLink) && (
        <span style={{ color: 'var(--text-secondary)' }}>
          {outcome.summary}
          {outcome.source && (
            <>
              {' '}
              <a href={outcome.source} target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--cat-blue)' }}>
                Source
              </a>
            </>
          )}
          {showResultsLink && (
            <a
              href={`https://clinicaltrials.gov/study/${study.id}?tab=results`}
              target="_blank"
              rel="noreferrer"
              className="underline"
              style={{ color: 'var(--cat-blue)' }}
            >
              View posted results
            </a>
          )}
        </span>
      )}
    </div>
  )
}
