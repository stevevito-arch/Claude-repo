import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { RegistryDosing, RegistryOutcome, RegistrySnapshot, RegistryStudy } from '../types/registry'
import { statusLabel } from '../lib/clinicalTrialsApi'
import { useFollowed } from '../lib/useFollowed'
import { buildIndex, matchesQuery, parseQuery } from '../lib/search'
import { MECHANISMS, PATHWAYS, pathwayOf, targetSynonyms } from '../data/targets'
import { Badge } from './Badge'
import { DevelopmentTimeline } from './DevelopmentTimeline'
import {
  DARK_INK, LIGHT_PHASES, OUTCOME_GROUPS, OUTCOME_GROUP_OF, PHASE_COLOR, STATUS_GROUPS, STATUS_GROUP_COLOR, VERDICT_COLOR, statusGroup, year,
} from '../lib/registryPresentation'
import type { StatusGroup } from '../lib/registryPresentation'

const PAGE_SIZE = 40

const TYPE_OPTIONS = [
  { key: 'INTERVENTIONAL', label: 'Interventional trials' },
  { key: 'OBSERVATIONAL', label: 'Observational studies' },
  { key: 'EXPANDED_ACCESS', label: 'Expanded access' },
] as const

const PHASE_OPTIONS = ['Early Phase 1', 'Phase 1', 'Phase 1/2', 'Phase 2', 'Phase 2/3', 'Phase 3', 'Phase 4', 'No phase'] as const

// Same colours the featured cards use for each modality; others stay neutral.
const MODALITY_BADGE_COLOR: Record<string, string> = {
  'Small molecule': 'var(--cat-blue)',
  'Antisense oligonucleotide': 'var(--cat-orange)',
  'Cell therapy': 'var(--cat-aqua)',
  Antibody: 'var(--cat-yellow)',
  'Gene therapy': 'var(--cat-magenta)',
  Peptide: 'var(--cat-green)',
}

// What a study is mainly for, set by scripts/fetch-registry.mjs. The catalog
// opens on trials aimed at slowing the disease itself.
const FOCUS_OPTIONS = [
  'Slowing ALS progression',
  'Symptom management',
  'Supportive care',
  'Diagnostics & biomarkers',
  'Natural history & other research',
  'Other-disease studies',
]
const DEFAULT_FOCUS = 'Slowing ALS progression'

// Set by scripts/fetch-registry.mjs for drugs the drug table doesn't cover yet.
const UNCLASSIFIED = 'Not yet classified'

type SortKey = 'newest' | 'oldest' | 'enrollment'

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

interface ChipProps {
  active: boolean
  onClick: () => void
  children: ReactNode
  count?: number
  dot?: string
}

function Chip({ active, onClick, children, count, dot }: ChipProps) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`chip${count === 0 ? ' is-empty' : ''}`}>
      {dot && <span className="chip-dot" style={{ backgroundColor: dot }} aria-hidden />}
      {children}
      {count !== undefined && <span className="chip-count">{count.toLocaleString()}</span>}
    </button>
  )
}

// Label in its own column so wrapped chips line up under the first one.
function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[4.75rem_1fr] sm:gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider sm:pt-[0.45rem]" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <div className="flex min-w-0 flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>
      <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
  const [focuses, setFocuses] = useState<Set<string>>(new Set([DEFAULT_FOCUS]))
  const [phases, setPhases] = useState<Set<string>>(new Set())
  const [groups, setGroups] = useState<Set<StatusGroup>>(new Set())
  const [resultsOnly, setResultsOnly] = useState(false)
  const [modalities, setModalities] = useState<Set<string>>(new Set())
  // "p:<pathway>" for a whole pathway, "t:<target>" for one target, or "" for any.
  const [target, setTarget] = useState('')
  const [outcomes, setOutcomes] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<SortKey>('newest')
  const [moreOpen, setMoreOpen] = useState(false)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const { followed, toggleFollow } = useFollowed()
  // The trial whose drug's development timeline is open, if any.
  const [timelineStudy, setTimelineStudy] = useState<RegistryStudy | null>(null)
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
          s.outcome?.verdict, s.outcome?.summary, s.focus,
        ]),
      })),
    [snapshot],
  )

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const { study } of indexed) {
      if (focuses.size === 0 || focuses.has(study.focus)) counts[study.type] = (counts[study.type] ?? 0) + 1
    }
    return counts
  }, [indexed, focuses])

  // Counts for the modality chips and the target picker, most common first.
  const facetCounts = useMemo(() => {
    const byFocus = new Map<string, number>()
    const byOutcome = new Map<string, number>()
    const byModality = new Map<string, number>()
    const byTarget = new Map<string, number>()
    const byPathway = new Map<string, number>()
    const byPhase = new Map<string, number>()
    const byStatus = new Map<string, number>()
    // Count only studies of the selected types and focus, so the numbers match the list.
    for (const { study } of indexed) {
      if (types.size > 0 && !types.has(study.type)) continue
      byFocus.set(study.focus, (byFocus.get(study.focus) ?? 0) + 1)
      if (focuses.size > 0 && !focuses.has(study.focus)) continue
      const phase = study.phase ?? 'No phase'
      byPhase.set(phase, (byPhase.get(phase) ?? 0) + 1)
      const status = statusGroup(study.status)
      byStatus.set(status, (byStatus.get(status) ?? 0) + 1)
      if (study.hasResults) byStatus.set('results', (byStatus.get('results') ?? 0) + 1)
      for (const m of study.modalities) byModality.set(m, (byModality.get(m) ?? 0) + 1)
      for (const t of study.targets) byTarget.set(t, (byTarget.get(t) ?? 0) + 1)
      for (const p of new Set(study.targets.map(pathwayOf))) byPathway.set(p, (byPathway.get(p) ?? 0) + 1)
      const group = study.outcome && OUTCOME_GROUP_OF.get(study.outcome.verdict)
      if (group) byOutcome.set(group, (byOutcome.get(group) ?? 0) + 1)
    }
    const sorted = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    // "Not yet classified" goes last so it reads as a gap, not a category.
    const mods = sorted(byModality).filter(([k]) => k !== UNCLASSIFIED)
    if (byModality.has(UNCLASSIFIED)) mods.push([UNCLASSIFIED, byModality.get(UNCLASSIFIED)!])
    const outcomeCounts = OUTCOME_GROUPS.map(([g]) => [g, byOutcome.get(g) ?? 0] as const).filter(([, n]) => n > 0)
    const focusCounts = FOCUS_OPTIONS.map((f) => [f, byFocus.get(f) ?? 0] as const).filter(([, n]) => n > 0)
    // Targets grouped under their pathways, pathways in a fixed order, targets by count.
    const targetGroups = PATHWAYS.map((p) => ({
      pathway: p,
      count: byPathway.get(p) ?? 0,
      targets: sorted(byTarget).filter(([t]) => pathwayOf(t) === p),
    })).filter((g) => g.targets.length > 0)
    return { focuses: focusCounts, modalities: mods, targetGroups, outcomes: outcomeCounts, phases: byPhase, statuses: byStatus }
  }, [indexed, types, focuses])

  const filtered = useMemo(() => {
    const terms = parseQuery(search)
    const rows = indexed.filter(({ study, group, index }) => {
      if (types.size > 0 && !types.has(study.type)) return false
      if (focuses.size > 0 && !focuses.has(study.focus)) return false
      if (phases.size > 0 && !phases.has(study.phase ?? 'No phase')) return false
      if (groups.size > 0 && !groups.has(group)) return false
      if (resultsOnly && !study.hasResults) return false
      if (modalities.size > 0 && !study.modalities.some((m) => modalities.has(m))) return false
      if (target.startsWith('t:') && !study.targets.includes(target.slice(2))) return false
      if (target.startsWith('p:') && !study.targets.some((t) => pathwayOf(t) === target.slice(2))) return false
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
  }, [indexed, search, types, focuses, phases, groups, resultsOnly, modalities, target, outcomes, sort])

  // Every trial of each drug, for development timelines.
  const studiesByDrug = useMemo(() => {
    const map = new Map<string, RegistryStudy[]>()
    for (const st of snapshot?.studies ?? []) for (const { key } of st.drugKeys) {
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(st)
    }
    return map
  }, [snapshot])
  const timelineFor = (st: RegistryStudy) =>
    st.drugKeys.length
      ? { label: st.drugKeys[0].label, count: studiesByDrug.get(st.drugKeys[0].key)?.length ?? 1, onOpen: () => setTimelineStudy(st) }
      : undefined

  // Followed studies are pinned above the filters whatever the filters say,
  // so the list below leaves them out rather than showing them twice.
  const pinned = useMemo(() => {
    const byId = new Map(indexed.map(({ study }) => [study.id, study]))
    return followed.map((id) => byId.get(id)).filter((s): s is RegistryStudy => s !== undefined)
  }, [indexed, followed])
  const unpinned = useMemo(() => filtered.filter((s) => !followedSet.has(s.id)), [filtered, followedSet])
  const pinnedMatches = filtered.length - unpinned.length

  // Any change to what is shown starts the list from the top again.
  useEffect(() => setVisible(PAGE_SIZE), [search, types, focuses, phases, groups, resultsOnly, modalities, target, outcomes, sort])

  const hasFilters =
    search.length > 0 || phases.size > 0 || groups.size > 0 || resultsOnly || modalities.size > 0 || target !== '' || outcomes.size > 0 ||
    !(types.size === 1 && types.has('INTERVENTIONAL')) ||
    !(focuses.size === 1 && focuses.has(DEFAULT_FOCUS))
  const moreActive = outcomes.size + modalities.size + (target ? 1 : 0)

  const otherRegistries = snapshot ? snapshot.studies.filter((st) => st.registry !== 'ClinicalTrials.gov').length : 0

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
        Every ALS study registered on ClinicalTrials.gov, plus ALS trials found only in the UK’s ISRCTN registry or the EU’s
        trial registers (CTIS and the older EU Clinical Trials Register) — {snapshot.studies.length.toLocaleString()} in total
        {otherRegistries > 0 && <>, {otherRegistries.toLocaleString()} of them from outside ClinicalTrials.gov</>}, as of{' '}
        {new Date(snapshot.generatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}. It opens on
        trials aimed at slowing ALS itself; use Focus to see symptom, supportive-care, diagnostic and other studies. These
        entries are the registries’ own records, not curated summaries. Coverage before about 2000 is thin, and trials registered
        only in other countries’ registries (Australia, China, Japan and others) are not included yet.
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
                timeline={timelineFor(s)}
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

      <div className="flex flex-col gap-4 rounded-xl border p-4 sm:p-5" style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-card)' }}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
              <circle cx="7" cy="7" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search drug, target, sponsor or trial ID…"
              aria-label="Search registered studies"
              className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2"
              style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-card-raised)', color: 'var(--text-primary)' }}
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort studies"
            className="rounded-lg border px-3 py-2.5 text-sm sm:w-56"
            style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-card-raised)', color: 'var(--text-primary)' }}
          >
            <option value="newest">Newest start first</option>
            <option value="oldest">Oldest start first</option>
            <option value="enrollment">Largest enrollment first</option>
          </select>
        </div>

        <div className="flex flex-col gap-3">
          <ChipRow label="Focus">
            {facetCounts.focuses.map(([f, n]) => (
              <Chip key={f} active={focuses.has(f)} count={n} onClick={() => setFocuses((prev) => toggle(prev, f))}>
                {f}
              </Chip>
            ))}
          </ChipRow>
          <ChipRow label="Type">
            {TYPE_OPTIONS.map((t) => (
              <Chip key={t.key} active={types.has(t.key)} count={typeCounts[t.key] ?? 0} onClick={() => setTypes((prev) => toggle(prev, t.key))}>
                {t.label}
              </Chip>
            ))}
          </ChipRow>
          <ChipRow label="Phase">
            {PHASE_OPTIONS.map((p) => (
              <Chip
                key={p}
                active={phases.has(p)}
                count={facetCounts.phases.get(p) ?? 0}
                dot={PHASE_COLOR[p] ?? 'var(--text-muted)'}
                onClick={() => setPhases((prev) => toggle(prev, p))}
              >
                {p}
              </Chip>
            ))}
          </ChipRow>
          <ChipRow label="Status">
            {STATUS_GROUPS.map((g) => (
              <Chip
                key={g}
                active={groups.has(g)}
                count={facetCounts.statuses.get(g) ?? 0}
                dot={STATUS_GROUP_COLOR[g]}
                onClick={() => setGroups((prev) => toggle(prev, g))}
              >
                {g}
              </Chip>
            ))}
            <Chip active={resultsOnly} count={facetCounts.statuses.get('results') ?? 0} onClick={() => setResultsOnly((v) => !v)}>
              Results posted
            </Chip>
          </ChipRow>
        </div>

        <div className="flex flex-col gap-3 border-t pt-3" style={{ borderColor: 'var(--border-hairline)' }}>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className="flex items-center gap-2 self-start text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Chevron open={moreOpen} />
            More filters
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Outcome, modality, target</span>
            {moreActive > 0 && (
              <span className="rounded-full px-1.5 text-[11px] tabular-nums" style={{ backgroundColor: 'color-mix(in srgb, var(--cat-blue) 20%, transparent)', color: 'var(--text-primary)' }}>
                {moreActive} active
              </span>
            )}
          </button>
          {moreOpen && (
            <>
              <ChipRow label="Outcome">
                {facetCounts.outcomes.map(([o, n]) => (
                  <Chip
                    key={o}
                    active={outcomes.has(o)}
                    count={n}
                    dot={VERDICT_COLOR[o] ?? 'var(--text-muted)'}
                    onClick={() => setOutcomes((prev) => toggle(prev, o))}
                  >
                    {o}
                  </Chip>
                ))}
              </ChipRow>
              <ChipRow label="Modality">
                {facetCounts.modalities.map(([m, n]) => (
                  <Chip key={m} active={modalities.has(m)} count={n} onClick={() => setModalities((prev) => toggle(prev, m))}>
                    {m}
                  </Chip>
                ))}
              </ChipRow>
              <ChipRow label="Target">
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  aria-label="Filter by therapy target or pathway"
                  className="w-full min-w-0 rounded-lg border px-3 py-1.5 text-xs sm:w-80"
                  style={{
                    borderColor: target ? 'color-mix(in srgb, var(--cat-blue) 75%, transparent)' : 'var(--border-hairline)',
                    backgroundColor: target ? 'color-mix(in srgb, var(--cat-blue) 16%, var(--surface-card-raised))' : 'var(--surface-card-raised)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">Any target</option>
                  {facetCounts.targetGroups.map((g) => (
                    <optgroup key={g.pathway} label={g.pathway}>
                      <option value={`p:${g.pathway}`}>
                        All {g.pathway.toLowerCase()} ({g.count})
                      </option>
                      {g.targets.map(([t, n]) => (
                        <option key={t} value={`t:${t}`}>
                          {t} ({n})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </ChipRow>
            </>
          )}
        </div>
      </div>

      <div className="flex min-h-7 items-center justify-between gap-3 px-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span>
          Showing <strong className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{Math.min(visible, unpinned.length).toLocaleString()}</strong> of{' '}
          <strong className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{unpinned.length.toLocaleString()}</strong> studies
          {pinnedMatches > 0 && ` (plus ${pinnedMatches} you follow, pinned above)`}
        </span>
        {hasFilters && (
          <button
            type="button"
            className="chip shrink-0"
            onClick={() => {
              setSearch('')
              setTypes(new Set(['INTERVENTIONAL']))
              setFocuses(new Set([DEFAULT_FOCUS]))
              setPhases(new Set())
              setGroups(new Set())
              setResultsOnly(false)
              setModalities(new Set())
              setTarget('')
              setOutcomes(new Set())
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <path d="m2 2 6 6M8 2 2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
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
              timeline={timelineFor(s)}
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

      {timelineStudy && (
        <DevelopmentTimeline
          key={timelineStudy.id}
          study={timelineStudy}
          studiesByDrug={studiesByDrug}
          onClose={() => setTimelineStudy(null)}
          renderStudy={(st, { lead, tail, onCollapse, highlighted }) => (
            <StudyRow
              as="div"
              lead={lead}
              tail={tail}
              onCollapse={onCollapse}
              highlighted={highlighted}
              study={st}
              featured={featuredIds.has(st.id)}
              onOpenFeatured={() => onOpenFeatured(st.id)}
              followed={followedSet.has(st.id)}
              onToggleFollow={() => toggleFollow(st.id)}
            />
          )}
        />
      )}
    </div>
  )
}

// The doses, frequency and route a study gives a drug, folded away under its drug line.
function DoseDetails({ dosing }: { dosing: RegistryDosing }) {
  const [open, setOpen] = useState(false)
  const panel = useId()
  // "Single dose; every 2 weeks": only the first item keeps its capital.
  const list = (items: string[]) => items.map((x, i) => (i ? x.charAt(0).toLowerCase() + x.slice(1) : x)).join('; ')
  const rows: [string, string][] = [
    ['Dose levels', dosing.doses.join('; ')],
    ['Frequency', list(dosing.frequency)],
    ['Route', list(dosing.route)],
  ]
  return (
    <div className="mt-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panel}
        className="inline-flex min-h-6 items-center gap-1 text-xs font-medium"
        style={{ color: 'var(--cat-blue)' }}
      >
        <Chevron open={open} />
        Dose details
      </button>
      {open && (
        <div
          id={panel}
          className="mt-1 rounded-md border p-2.5 text-xs leading-relaxed"
          style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--surface-card-raised)' }}
        >
          <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1">
            {rows.map(([label, value]) => (
              <Fragment key={label}>
                <dt style={{ color: 'var(--text-muted)' }}>{label}</dt>
                <dd className="m-0" style={{ color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {value || 'Not stated'}
                </dd>
              </Fragment>
            ))}
          </dl>
          {dosing.passages.length > 0 && (
            <div className="mt-2.5 border-t pt-2" style={{ borderColor: 'var(--border-hairline)' }}>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Registry wording
              </p>
              <ul className="flex flex-col gap-1.5">
                {dosing.passages.map((p) => (
                  <li key={`${p.label}|${p.text}`} style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {p.label}:
                    </span>{' '}
                    {p.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Read automatically from the registry’s descriptions, so check it against the wording above.
          </p>
        </div>
      )}
    </div>
  )
}

// Folds an opened timeline entry back to its summary. It takes focus when it
// appears, since the summary button that opened it is gone.
function CollapseButton({ onClick }: { onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => ref.current?.focus({ preventScroll: true }), [])
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-expanded={true}
      className="inline-flex min-h-8 items-center rounded-full px-2 text-xs"
      style={{ color: 'var(--text-muted)' }}
    >
      Hide details ▴
    </button>
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
  /** Opens the development timeline of the trial's (first) drug. */
  timeline?: { label: string; count: number; onOpen: () => void }
  /** In the development timeline: rendered as a plain block, with the
   *  timeline's own markers first and a control to fold it back up. */
  as?: 'li' | 'div'
  lead?: ReactNode
  tail?: ReactNode
  onCollapse?: () => void
  highlighted?: boolean
}

function StudyRow({ study, featured, onOpenFeatured, followed, onToggleFollow, timeline, as: Tag = 'li', lead, tail, onCollapse, highlighted }: StudyRowProps) {
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
    <Tag
      className="rounded-lg border p-3"
      style={{ borderColor: highlighted ? 'var(--text-primary)' : 'var(--border-hairline)', backgroundColor: 'var(--surface-card)' }}
    >
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {lead}
          {study.phase && (
            <Badge
              label={study.phase}
              color={PHASE_COLOR[study.phase] ?? 'var(--seq-450)'}
              variant="solid"
              textColor={LIGHT_PHASES.has(study.phase) ? DARK_INK : undefined}
            />
          )}
          <Badge label={statusLabel(study.status)} color={STATUS_GROUP_COLOR[group]} />
          {study.focus !== DEFAULT_FOCUS && <Badge label={study.focus} color="var(--text-muted)" />}
          {study.registry !== 'ClinicalTrials.gov' && <Badge label={study.registry} color="var(--cat-violet)" />}
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
          {tail}
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
          {onCollapse && <CollapseButton onClick={onCollapse} />}
        </div>
      </div>

      <a
        href={study.url}
        target="_blank"
        rel="noreferrer"
        className="mt-1.5 block text-sm font-medium leading-snug hover:underline"
        style={{ color: 'var(--text-primary)' }}
      >
        {study.title}
        {study.acronym && !study.title.includes(study.acronym) && <span style={{ color: 'var(--text-secondary)' }}> ({study.acronym})</span>}
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
        <div key={drug.label} className="mt-1.5">
          <div className="flex flex-col gap-0.5 text-xs leading-relaxed sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {drug.label.length > 60 ? `${drug.label.slice(0, 57)}…` : drug.label}
              {drug.names.length > 0 && <span style={{ color: 'var(--text-secondary)' }}> = {drug.names.join(', ')}</span>}
            </span>
            <span>
              {/* Molecules the drug acts on are "Target"; broad processes are "Mechanism". */}
              {[
                ['Target', drug.targets.filter((t) => !MECHANISMS.has(t))],
                ['Mechanism', drug.targets.filter((t) => MECHANISMS.has(t))],
              ]
                .filter(([, list]) => list.length > 0)
                .map(([kind, list], i) => (
                  <span key={kind as string}>
                    {i > 0 && <span style={{ color: 'var(--text-muted)' }}> · </span>}
                    <span style={{ color: 'var(--text-muted)' }}>{kind}: </span>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {(list as string[]).join(', ')}
                    </span>
                  </span>
                ))}
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
          {drug.dosing && <DoseDetails dosing={drug.dosing} />}
        </div>
      ))}
      {study.laterDevelopment.map((dev) => (
        <p key={dev.drug} className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            Furthest phase in ALS{study.laterDevelopment.length > 1 && ` (${dev.drug.length > 40 ? `${dev.drug.slice(0, 37)}…` : dev.drug})`}:{' '}
          </span>
          {dev.phase && dev.id ? (
            <>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {dev.phase}
              </span>
              {' · '}
              <a
                href={dev.url ?? `https://clinicaltrials.gov/study/${dev.id}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono underline"
                style={{ color: 'var(--cat-blue)' }}
              >
                {dev.id}
              </a>{' '}
              ({[dev.start ? `started ${year(dev.start)}` : null, dev.status ? statusLabel(dev.status).toLowerCase() : null].filter(Boolean).join(', ')})
            </>
          ) : (
            'this trial; no later-phase ALS trial registered'
          )}
        </p>
      ))}
      {timeline && (
        <button
          type="button"
          onClick={timeline.onOpen}
          className="mt-1.5 inline-flex min-h-8 items-center gap-1 text-left text-xs font-medium underline"
          style={{ color: 'var(--cat-blue)' }}
        >
          Development timeline of {timeline.label.length > 40 ? `${timeline.label.slice(0, 37)}…` : timeline.label} · {timeline.count} ALS{' '}
          {timeline.count === 1 ? 'trial' : 'trials'} →
        </button>
      )}
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
                href={pub.url ?? `https://pubmed.ncbi.nlm.nih.gov/${pub.pmid}/`}
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
    </Tag>
  )
}

function OutcomeLine({ study, outcome }: { study: RegistryStudy; outcome: RegistryOutcome }) {
  const group = OUTCOME_GROUP_OF.get(outcome.verdict) ?? ''
  const showResultsLink = !outcome.curated && Boolean(study.resultsUrl)
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
              href={study.resultsUrl ?? study.url}
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
