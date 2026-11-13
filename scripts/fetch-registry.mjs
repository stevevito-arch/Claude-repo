// Builds public/data/als-registry.json: every ALS study registered on
// ClinicalTrials.gov, trimmed to the fields the catalog view uses.
//
//   node scripts/fetch-registry.mjs
//
// Behind an HTTPS proxy on Node 22+, run with NODE_USE_ENV_PROXY=1.
// Exits non-zero (leaving the existing file untouched) if the API fails, so CI
// can fall back to the committed snapshot.

import { readFile, writeFile, mkdir } from 'node:fs/promises'

const API = 'https://clinicaltrials.gov/api/v2/studies'
const OUT = new URL('../public/data/als-registry.json', import.meta.url)
const DRUGS = new URL('./drugs.json', import.meta.url)
const OUTCOMES = new URL('./outcomes.json', import.meta.url)
const FOCUS = new URL('./focus.json', import.meta.url)

const FIELDS = [
  'NCTId', 'BriefTitle', 'OfficialTitle', 'Acronym', 'OverallStatus', 'WhyStopped', 'Phase', 'StudyType',
  'Condition', 'Keyword', 'InterventionName', 'InterventionType', 'InterventionOtherName', 'LeadSponsorName', 'LeadSponsorClass',
  'StartDate', 'PrimaryCompletionDate', 'CompletionDate', 'EnrollmentCount', 'EnrollmentType',
  'HasResults', 'LocationCountry', 'ReferencesModule', 'PrimaryOutcomeMeasure', 'DesignPrimaryPurpose',
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

// Hand-curated, sourced drug table (scripts/drugs.json): for each drug, the
// names it goes by, its target(s), its modality and a source. An intervention
// gets the first entry with a name it starts with, so put specific products
// (codes, brand names) before the generic ingredients they contain.
const drugTable = JSON.parse(await readFile(DRUGS, 'utf8')).drugs
const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, '')
// Lowercase with every run of punctuation/space turned into one space, so
// "NPT520-34 (125 mg)" reads "npt520 34 125 mg" and still starts with "npt520 34".
const spaced = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
function startsWithName(name, term) {
  const n = spaced(name), c = spaced(term)
  // "NB-4746 High dose" matches NB-4746; "NP0012" does not match NP001.
  if (n.startsWith(c) && !/[0-9a-z]/.test(n.charAt(c.length))) return true
  // Same code written with different separators, e.g. "ISIS-333611".
  return norm(name) === norm(term)
}
function entryFor(intervention) {
  for (const name of [intervention.name, ...(intervention.otherNames ?? [])]) {
    const entry = drugTable.find((e) => e.match.some((term) => startsWithName(name, term)))
    if (entry) return entry
  }
  return null
}
const NOT_A_NAME = /placebo|vehicle|sham|saline|matching|control/i
// An intervention that is itself a comparator ("Placebo", "Matching placebo"),
// as opposed to a drug named alongside one ("TBN tablet / Placebo").
const IS_COMPARATOR = /^(matching\s+|matched\s+)?(placebo|sham|vehicle|saline|control|standard of care|usual care|best supportive care)/i

// Interventions that aren't drugs take their modality from the registry's type.
const TYPE_MODALITY = { DEVICE: 'Device', BEHAVIORAL: 'Behavioral', PROCEDURE: 'Procedure', DIAGNOSTIC_TEST: 'Diagnostic', RADIATION: 'Radiation', DIETARY_SUPPLEMENT: 'Supplement or diet' }
const DRUG_TYPES = new Set(['DRUG', 'BIOLOGICAL', 'GENETIC', 'COMBINATION_PRODUCT'])

function classify(interventions) {
  const drugs = new Map()
  const modalities = new Set()
  for (const i of interventions) {
    if (IS_COMPARATOR.test(i.name.trim())) continue
    const entry = entryFor(i)
    if (entry) {
      // Label each drug with the name this study uses for it.
      if (!drugs.has(entry)) drugs.set(entry, i.name)
      modalities.add(entry.modality)
    } else if (DRUG_TYPES.has(i.type)) {
      modalities.add('Not yet classified')
    } else if (TYPE_MODALITY[i.type]) {
      modalities.add(TYPE_MODALITY[i.type])
    }
  }
  // "Not yet classified" stays alongside known modalities when a study has
  // any drug the table doesn't cover, so gaps stay visible.
  return { entries: [...drugs.entries()], modalities: [...modalities] }
}

// Hand-researched outcomes (scripts/outcomes.json), keyed by NCT ID.
const curatedOutcomes = JSON.parse(await readFile(OUTCOMES, 'utf8')).outcomes

// Sorts a registry stop reason into a few kinds. Checked in this order: e.g.
// "enrolment rates could not meet protocol objectives" is about enrollment, and
// "Data and Safety Monitoring Board recommended stopping for futility" is about
// futility, not safety.
const STOP_REASONS = [
  ['Stopped: slow enrollment', /recruit|enrol|no inclusion|inclusion was stopped|including patients|no participants|participants were not|accrual|patients filling/i],
  ['Stopped: no benefit', /futilit|no (clinical |survival )?benefit|lack of (efficacy|benefit)|no evidence of benefit|did not meet|not meet|unsuccessful|unlikely to demonstrat|no tendency|absence of benefit|benefit[- ]risk/i],
  ['Stopped: safety', /adverse events|excess mortality|toxicit|threatful/i],
  ['Stopped: business or funding', /fund|financ|economic|business|company|sponsor|strateg|development of|not moving forward|no longer required|change in study plans|restructur|closure|supply|shortage|human res/i],
]

// What became of a finished or stopped interventional study: the curated
// outcome where there is one, otherwise what the registry itself shows.
function outcomeOf(id, type, status, whyStopped, hasResults, publications) {
  const curated = curatedOutcomes[id]
  if (curated) return { ...curated, curated: true }
  if (type !== 'INTERVENTIONAL') return null
  const auto = (verdict) => ({ verdict, summary: null, source: null, curated: false })
  if (status === 'WITHDRAWN') return auto('Withdrawn before enrolling')
  if (status === 'SUSPENDED') return auto('Suspended')
  if (status === 'TERMINATED') {
    if (!whyStopped) return auto('Stopped: reason not given')
    return auto(STOP_REASONS.find(([, re]) => re.test(whyStopped))?.[0] ?? 'Stopped: other reason')
  }
  if (status === 'COMPLETED') {
    if (hasResults) return auto('Results posted, not yet summarised')
    if (publications.length) return auto('Publication linked, not yet summarised')
    return auto('No results posted')
  }
  return null
}

// What a study is mainly for. Decided from the registry record by the rules
// below, with hand corrections in scripts/focus.json where the rules get it wrong.
const focusOverrides = JSON.parse(await readFile(FOCUS, 'utf8')).focus
const SYMPTOM = /pseudobulbar|emotional labil|\bPBA\b|pathological (laughing|crying)|sialorrh|drool|saliva|secretion|cramp|spastic|fasciculation|depress|anxiety|\bpain\b|insomnia|\bsleep|fatigue|appetite|constipation|dyspn|breathless|cough|itch|pruritus|cognitive (impair|symptom)|apathy|muscle stiffness/i
const SUPPORT = /ventilat|\bNIV\b|bipap|tracheost|diaphragm(atic)? pac|insufflat|airway clearance|respiratory (muscle )?training|gastrostom|\bPEG\b|\bRIG\b|feeding|nutrition|\bdiet|caloric|calorie|exercise|rehabilit|physiotherap|physical therap|occupational therap|speech therap|communication|brain[- ]computer|\bBCI\b|eye[- ]track|augmentative|voice bank|palliative|end[- ]of[- ]life|caregiver|carer|telehealth|telemedicine|multidisciplinary|quality of life|psycholog|mindfulness|music|exoskeleton|wheelchair|orthos|robot|advance care|decision aid|dysphagia|swallow|home care|assistive|neural interface|neuroprosthe|intracortical|tetrapleg|paralysis|brain[- ]machine|cortical communication|neurotechnology|manipulation device|\\bbrace\\b|dysarthria|advance care/i
const DIAGNOSTIC = /\bPET\b|positron|SPECT|\bMRI\b|magnetic resonance imaging|imaging|tracer|radioligand|biomarker|diagnos|electromyograph|\bEMG\b|nerve conduction|electrical impedance|ultrasound|spectroscopy/i
const ALS_IN_TITLE = /amyotrophic|\bALS\b|motor neurone? disease|\bMND\b|lou gehrig/i
const ALS_LIKE_CONDITION = /amyotrophic|\bALS\b|motor neuron|\bMND\b|lou gehrig|frontotemporal|\bFTD\b|neurodegenerat|primary lateral|progressive muscular atrophy|bulbar palsy|healthy/i

const THERAPEUTIC_TYPES = new Set(['DRUG', 'BIOLOGICAL', 'GENETIC', 'COMBINATION_PRODUCT'])
const TRACER = /\bPET\b|positron|SPECT|tracer|radioligand|dosimetry|imaging/i

function focusOf(id, p, type, modalities) {
  if (focusOverrides[id]) return focusOverrides[id]
  const ident = p.identificationModule
  const titles = `${ident.briefTitle} ${ident.officialTitle ?? ''}`
  const conditions = p.conditionsModule?.conditions ?? []
  const text = [titles, ...conditions, ...(p.conditionsModule?.keywords ?? []),
    ...(p.outcomesModule?.primaryOutcomes ?? []).map((o) => o.measure)].join(' ')
  const purpose = p.designModule?.designInfo?.primaryPurpose
  const interventions = p.armsInterventionsModule?.interventions ?? []
  // A drug, biologic or gene therapy that isn't a diagnostic agent.
  const treats = interventions.some((i) => THERAPEUTIC_TYPES.has(i.type) && !/placebo/i.test(i.name)) &&
    modalities.some((m) => m !== 'Diagnostic')

  if (modalities.includes('Diagnostic') || (treats ? TRACER.test(titles) && !modalities.some((m) => m !== 'Diagnostic' && m !== 'Not yet classified')
    : purpose === 'DIAGNOSTIC' || purpose === 'SCREENING')) return 'Diagnostics & biomarkers'
  const symptomTitle = SYMPTOM.test(titles)
  const supportTitle = SUPPORT.test(titles)
  // Drugs for a symptom are symptom management; devices, therapy and care
  // aimed at a symptom (e.g. ventilation for breathlessness) are supportive care.
  if (symptomTitle && (!supportTitle || treats)) return 'Symptom management'
  if (supportTitle) return 'Supportive care'
  if (conditions.some((c) => SYMPTOM.test(c))) return treats ? 'Symptom management' : 'Supportive care'
  if (purpose === 'SUPPORTIVE_CARE') return treats && SYMPTOM.test(text) ? 'Symptom management' : 'Supportive care'
  // ALS is one of several conditions, and not what the title is about.
  if (!ALS_IN_TITLE.test(titles) && conditions.some((c) => !ALS_LIKE_CONDITION.test(c))) return 'Other-disease studies'
  if (type === 'OBSERVATIONAL') return DIAGNOSTIC.test(text) ? 'Diagnostics & biomarkers' : 'Natural history & other research'
  if (!treats && DIAGNOSTIC.test(titles)) return 'Diagnostics & biomarkers'
  return 'Slowing ALS progression'
}

const PHASE_LABEL = { EARLY_PHASE1: 'Early Phase 1', PHASE1: 'Phase 1', PHASE2: 'Phase 2', PHASE3: 'Phase 3', PHASE4: 'Phase 4' }

function slim(s) {
  const p = s.protocolSection
  const id = p.identificationModule
  const st = p.statusModule ?? {}
  const de = p.designModule ?? {}
  const interventions = p.armsInterventionsModule?.interventions ?? []
  const phases = (de.phases ?? []).filter((x) => PHASE_LABEL[x])
  const names = [...new Set(interventions.map((i) => i.name))]
  const { entries, modalities } = classify(interventions)
  const lowerNames = new Set(names.map(norm))
  // Search terms: the registry's own "other names" plus curated names.
  const aliases = [...new Set([
    ...interventions.filter((i) => !NOT_A_NAME.test(i.name)).flatMap((i) => i.otherNames ?? []),
    ...entries.flatMap(([e]) => e.names ?? []),
  ])].filter((a) => !NOT_A_NAME.test(a) && !lowerNames.has(norm(a))).slice(0, 8)
  // Publications the registry lists as reporting this study's results.
  const publications = (p.referencesModule?.references ?? [])
    .filter((r) => r.type === 'RESULT' && r.pmid)
    .map((r) => ({ pmid: r.pmid, citation: r.citation ?? '' }))
    .slice(0, 3)
  const status = st.overallStatus ?? 'UNKNOWN'
  const type = p.designModule?.studyType ?? 'UNKNOWN'
  return {
    id: id.nctId,
    title: id.briefTitle,
    acronym: id.acronym ?? null,
    status,
    whyStopped: st.whyStopped ?? null,
    type,
    // "Phase 1/Phase 2" style combined phases are kept as one label.
    phase: phases.length ? phases.map((x) => PHASE_LABEL[x]).join('/').replace(/\/Phase /g, '/') : null,
    interventions: names.slice(0, 6),
    aliases,
    // What each recognised drug is: label, other names, target(s), modality, source.
    drugs: entries.map(([e, label]) => ({ label, names: e.names ?? [], what: e.what ?? null, targets: e.targets, modality: e.modality, source: e.source })),
    targets: [...new Set(entries.flatMap(([e]) => e.targets))],
    modalities,
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
    publications,
    focus: focusOf(id.nctId, p, type, modalities),
    outcome: outcomeOf(id.nctId, type, status, st.whyStopped ?? null, Boolean(s.hasResults), publications),
  }
}

const byId = new Map()
for (const { cond, keep } of SEARCHES) {
  for (const s of await fetchAll(cond)) {
    const id = s.protocolSection.identificationModule.nctId
    if (!byId.has(id) && keep(s)) byId.set(id, slim(s))
  }
}

const missingFocus = Object.keys(focusOverrides).filter((id) => !byId.has(id))
if (missingFocus.length) console.warn(`Focus corrections for studies not in the catalog: ${missingFocus.join(', ')}`)
const missing = Object.keys(curatedOutcomes).filter((id) => !byId.has(id))
if (missing.length) console.warn(`Curated outcomes for studies not in the catalog: ${missing.join(', ')}`)

const studies = [...byId.values()].sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''))
if (studies.length < 500) throw new Error(`Only ${studies.length} studies returned; refusing to overwrite the snapshot`)

await mkdir(new URL('.', OUT), { recursive: true })
await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), source: 'ClinicalTrials.gov API v2', studies }))
console.log(`Wrote ${studies.length} studies to ${OUT.pathname}`)
