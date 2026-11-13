import { useEffect, useMemo, useState } from 'react'
import { trials, concludedReadouts, DATA_AS_OF } from './data/trials'
import type { Modality, Trial, TrialPhase, TrialStatus } from './types/trial'
import { useLiveTrialStatuses } from './lib/useLiveTrialStatuses'
import { StatTile } from './components/StatTile'
import { FilterBar } from './components/FilterBar'
import { TrialCard } from './components/TrialCard'
import { TrialDetail } from './components/TrialDetail'
import { LiveSyncBar } from './components/LiveSyncBar'
import { ConcludedList } from './components/ConcludedList'
import { RegistryCatalog } from './components/RegistryCatalog'
import { buildIndex, matchesQuery, parseQuery } from './lib/search'
import { targetSynonyms } from './data/targets'

type View = 'featured' | 'all'

// The catalog is the landing page; "#featured" opens the curated view. Old
// "#all" links still land on the catalog.
function viewFromHash(): View {
  return window.location.hash === '#featured' ? 'featured' : 'all'
}

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

function App() {
  const [search, setSearch] = useState('')
  const [activeModalities, setActiveModalities] = useState<Set<Modality>>(new Set())
  const [activePhases, setActivePhases] = useState<Set<TrialPhase>>(new Set())
  const [activeStatuses, setActiveStatuses] = useState<Set<TrialStatus>>(new Set())
  const [selectedTrial, setSelectedTrial] = useState<Trial | null>(null)
  const [view, setView] = useState<View>(viewFromHash)

  useEffect(() => {
    const onHash = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const showView = (next: View) => {
    // Keeps the view in the URL so it survives reloads and can be shared,
    // without adding a history entry per tab click.
    history.replaceState(null, '', next === 'featured' ? '#featured' : window.location.pathname + window.location.search)
    setView(next)
  }

  const nctIds = useMemo(() => trials.map((t) => t.nctId).filter((id): id is string => Boolean(id)), [])
  const featuredIds = useMemo(() => new Set(nctIds), [nctIds])
  const { statuses: liveStatuses, state: syncState, lastSyncedAt, refresh } = useLiveTrialStatuses(nctIds)

  const trialIndex = useMemo(
    () => new Map(trials.map((t) => [t.id, buildIndex([t.name, t.sponsor, t.target, t.modality, t.nctId, ...targetSynonyms(t.target)])])),
    [],
  )

  const filteredTrials = useMemo(() => {
    const terms = parseQuery(search)
    return trials.filter((trial) => {
      if (activeModalities.size > 0 && !activeModalities.has(trial.modality)) return false
      if (activePhases.size > 0 && !activePhases.has(trial.phase)) return false
      const effectiveStatus = liveStatuses[trial.nctId ?? '']?.overallStatus ?? trial.status
      if (activeStatuses.size > 0 && !activeStatuses.has(effectiveStatus as TrialStatus)) return false
      return matchesQuery(trialIndex.get(trial.id)!, terms)
    })
  }, [search, activeModalities, activePhases, activeStatuses, liveStatuses, trialIndex])

  const stats = useMemo(() => {
    const recruiting = trials.filter((t) => {
      const status = liveStatuses[t.nctId ?? '']?.overallStatus ?? t.status
      return status === 'Recruiting' || status === 'Enrolling by invitation'
    }).length
    const phase3Plus = trials.filter((t) => t.phase.startsWith('Phase 3')).length
    const modalityCount = new Set(trials.map((t) => t.modality)).size
    return { total: trials.length, recruiting, phase3Plus, modalityCount }
  }, [liveStatuses])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
          ALS Clinical Trials Dashboard
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Every amyotrophic lateral sclerosis (ALS) study registered on{' '}
          <a href="https://clinicaltrials.gov" target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--cat-blue)' }}>
            ClinicalTrials.gov
          </a>
          , with its therapy target and modality. Follow the studies you care about to pin them to the top. Featured
          trials are late-stage
          programs with hand-researched summaries of the therapy, preclinical evidence, design, results and expected
          timeframes.
        </p>
      </header>

      <div role="tablist" aria-label="Dashboard views" className="mb-6 flex gap-1 border-b" style={{ borderColor: 'var(--gridline)' }}>
        {(
          [
            ['all', 'All registered studies'],
            ['featured', 'Featured trials'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => showView(key)}
            className="-mb-px border-b-2 px-3 py-2 text-sm font-medium"
            style={{
              borderColor: view === key ? 'var(--text-primary)' : 'transparent',
              color: view === key ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'all' ? (
        <RegistryCatalog
          featuredIds={featuredIds}
          onOpenFeatured={(id) => setSelectedTrial(trials.find((t) => t.nctId === id) ?? null)}
        />
      ) : (
      <>
      <div className="mb-6">
        <LiveSyncBar state={syncState} lastSyncedAt={lastSyncedAt} onRefresh={refresh} dataAsOf={DATA_AS_OF} />
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <StatTile label="Trials tracked" value={stats.total} />
        <StatTile label="Currently recruiting" value={stats.recruiting} />
        <StatTile label="Phase 3 / 3b programs" value={stats.phase3Plus} />
        <StatTile label="Modalities represented" value={stats.modalityCount} />
      </div>

      <div className="mb-6">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          activeModalities={activeModalities}
          onToggleModality={(m) => setActiveModalities((prev) => toggleInSet(prev, m))}
          activePhases={activePhases}
          onTogglePhase={(p) => setActivePhases((prev) => toggleInSet(prev, p))}
          activeStatuses={activeStatuses}
          onToggleStatus={(s) => setActiveStatuses((prev) => toggleInSet(prev, s))}
          onReset={() => {
            setSearch('')
            setActiveModalities(new Set())
            setActivePhases(new Set())
            setActiveStatuses(new Set())
          }}
        />
      </div>

      {filteredTrials.length === 0 ? (
        <div className="rounded-xl border p-8 text-center text-sm" style={{ borderColor: 'var(--border-hairline)', color: 'var(--text-muted)' }}>
          No trials match the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTrials.map((trial) => (
            <TrialCard
              key={trial.id}
              trial={trial}
              liveStatus={trial.nctId ? liveStatuses[trial.nctId] : undefined}
              onSelect={() => setSelectedTrial(trial)}
            />
          ))}
        </div>
      )}

      <section className="mt-12">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Recent readouts
        </h2>
        <p className="mt-1 mb-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Notable ALS trials that reported results or were discontinued in the past three years, newest first.
        </p>
        <ConcludedList readouts={concludedReadouts} />
      </section>
      </>
      )}

      <footer className="mt-12 border-t pt-4 text-xs" style={{ borderColor: 'var(--gridline)', color: 'var(--text-muted)' }}>
        This dashboard is for informational purposes only and is not medical advice. Trial details change frequently
        — always confirm current status and eligibility directly on ClinicalTrials.gov or with the trial sponsor
        before making care decisions.
      </footer>

      {selectedTrial && (
        <TrialDetail
          trial={selectedTrial}
          liveStatus={selectedTrial.nctId ? liveStatuses[selectedTrial.nctId] : undefined}
          onClose={() => setSelectedTrial(null)}
        />
      )}
    </div>
  )
}

export default App
