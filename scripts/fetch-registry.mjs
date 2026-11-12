// Builds public/data/als-registry.json: every ALS study registered on
// ClinicalTrials.gov, trimmed to the fields the catalog view uses.
//
//   node scripts/fetch-registry.mjs
//
// Behind an HTTPS proxy on Node 22+, run with NODE_USE_ENV_PROXY=1.
// Exits non-zero (leaving the existing file untouched) if the API fails, so CI
// can fall back to the committed snapshot.

import { writeFile, mkdir } from 'node:fs/promises'

const API = 'https://clinicaltrials.gov/api/v2/studies'
const OUT = new URL('../public/data/als-registry.json', import.meta.url)

const FIELDS = [
  'NCTId', 'BriefTitle', 'OfficialTitle', 'Acronym', 'OverallStatus', 'WhyStopped', 'Phase', 'StudyType',
  'Condition', 'Keyword', 'InterventionName', 'InterventionType', 'LeadSponsorName', 'LeadSponsorClass',
  'StartDate', 'PrimaryCompletionDate', 'CompletionDate', 'EnrollmentCount', 'EnrollmentType',
  'HasResults', 'LocationCountry',
].join(',')

function describedAs(s) {
  const p = s.protocolSection
  return [p.identificationModule.briefTitle, p.identificationModule.officialTitle,
    ...(p.conditionsModule?.conditions ?? []), ...(p.conditionsModule?.keywords ?? [])].join(' ')
}
const NAMES_ALS = /amyotrophic|\bALS\b|lou gehrig/i
const NAMES_ALS_OR_MND = /amyotrophic|\bALS\b|lou gehrig|motor neurone? disease|\bMND\b/i

// The registry's ALS condition search expands synonyms, which pulls in a few
// studies of other diseases (e.g. "Charcot disease" also matches Charcot foot
// neuropathy), so its results must still name ALS or motor neuron disease.
// It also misses a few ALS studies indexed only under "motor neuron disease";
// those come from the broader search, but only when they name ALS itself,
// since that search is otherwise mostly spinal muscular atrophy and others.
const SEARCHES = [
  { cond: 'Amyotrophic Lateral Sclerosis', keep: (s) => NAMES_ALS_OR_MND.test(describedAs(s)) },
  { cond: 'Motor Neuron Disease', keep: (s) => NAMES_ALS.test(describedAs(s)) },
]

async function fetchAll(cond) {
  const studies = []
  let pageToken
  do {
    const params = new URLSearchParams({ 'query.cond': cond, pageSize: '1000', fields: FIELDS })
    if (pageToken) params.set('pageToken', pageToken)
    const res = await fetch(`${API}?${params}`, { signal: AbortSignal.timeout(60_000) })
    if (!res.ok) throw new Error(`${cond}: HTTP ${res.status}`)
    const page = await res.json()
    studies.push(...page.studies)
    pageToken = page.nextPageToken
  } while (pageToken)
  return studies
}

const PHASE_LABEL = { EARLY_PHASE1: 'Early Phase 1', PHASE1: 'Phase 1', PHASE2: 'Phase 2', PHASE3: 'Phase 3', PHASE4: 'Phase 4' }

function slim(s) {
  const p = s.protocolSection
  const id = p.identificationModule
  const st = p.statusModule ?? {}
  const de = p.designModule ?? {}
  const interventions = p.armsInterventionsModule?.interventions ?? []
  const phases = (de.phases ?? []).filter((x) => PHASE_LABEL[x])
  return {
    id: id.nctId,
    title: id.briefTitle,
    acronym: id.acronym ?? null,
    status: st.overallStatus ?? 'UNKNOWN',
    whyStopped: st.whyStopped ?? null,
    type: p.designModule?.studyType ?? 'UNKNOWN',
    // "Phase 1/Phase 2" style combined phases are kept as one label.
    phase: phases.length ? phases.map((x) => PHASE_LABEL[x]).join('/').replace(/\/Phase /g, '/') : null,
    interventions: [...new Set(interventions.map((i) => i.name))].slice(0, 6),
    interventionTypes: [...new Set(interventions.map((i) => i.type))],
    sponsor: p.sponsorCollaboratorsModule?.leadSponsor?.name ?? null,
    sponsorClass: p.sponsorCollaboratorsModule?.leadSponsor?.class ?? null,
    start: st.startDateStruct?.date ?? null,
    primaryCompletion: st.primaryCompletionDateStruct?.date ?? null,
    completion: st.completionDateStruct?.date ?? null,
    enrollment: de.enrollmentInfo?.count ?? null,
    enrollmentActual: de.enrollmentInfo?.type === 'ACTUAL',
    hasResults: Boolean(s.hasResults),
    countries: [...new Set((p.contactsLocationsModule?.locations ?? []).map((l) => l.country).filter(Boolean))],
  }
}

const byId = new Map()
for (const { cond, keep } of SEARCHES) {
  for (const s of await fetchAll(cond)) {
    const id = s.protocolSection.identificationModule.nctId
    if (!byId.has(id) && keep(s)) byId.set(id, slim(s))
  }
}

const studies = [...byId.values()].sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''))
if (studies.length < 500) throw new Error(`Only ${studies.length} studies returned; refusing to overwrite the snapshot`)

await mkdir(new URL('.', OUT), { recursive: true })
await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), source: 'ClinicalTrials.gov API v2', studies }))
console.log(`Wrote ${studies.length} studies to ${OUT.pathname}`)
