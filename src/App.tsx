import { useMemo, useState } from 'react'
import { trials, concludedReadouts } from './data/trials'
import type { Modality, Trial, TrialPhase, TrialStatus } from './types/trial'
import { useLiveTrialStatuses } from './lib/useLiveTrialStatuses'
import { StatTile } from './components/StatTile'
import { FilterBar } from './components/FilterBar'
import { TrialCard } from './components/TrialCard'
import { TrialDetail } from './components/TrialDetail'
import { LiveSyncBar } from './components/LiveSyncBar'
import { ConcludedList } from './components/ConcludedList'

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

  const nctIds = useMemo(() => trials.map((t) => t.nctId).filter((id): id is string => Boolean(id)), [])
  const { statuses: liveStatuses, state: syncState, lastSyncedAt, refresh } = useLiveTrialStatuses(nctIds)

  const filteredTrials = useMemo(() => {
    const query = search.trim().toLowerCase()
    return trials.filter((trial) => {
      if (activeModalities.size > 0 && !activeModalities.has(trial.modality)) return false
      if (activePhases.size > 0 && !activePhases.has(trial.phase)) return false
      const effectiveStatus = liveStatuses[trial.nctId ?? '']?.overallStatus ?? trial.status
      if (activeStatuses.size > 0 && !activeStatuses.has(effectiveStatus as TrialStatus)) return false
      if (query.length > 0) {
        const haystack = `${trial.name} ${trial.sponsor} ${trial.target} ${trial.modality}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [search, activeModalities, activePhases, activeStatuses, liveStatuses])

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
          Tracking notable ongoing amyotrophic lateral sclerosis (ALS) trials: therapy background and mechanism,
          preclinical evidence, phase and design, results reported so far, and estimated timeframes for future
          readouts. Curated content is a hand-researched snapshot; status and enrollment sync live from{' '}
          <a href="https://clinicaltrials.gov" target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--cat-blue)' }}>
            ClinicalTrials.gov
          </a>
          .
        </p>
      </header>

      <div className="mb-6">
        <LiveSyncBar state={syncState} lastSyncedAt={lastSyncedAt} onRefresh={refresh} dataAsOf="2026-08-01" />
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
          Recently concluded readouts
        </h2>
        <p className="mt-1 mb-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
          For context: notable ALS trials that read out or were discontinued recently, shown alongside the ongoing
          programs above.
        </p>
        <ConcludedList readouts={concludedReadouts} />
      </section>

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
