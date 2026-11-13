// Builds public/data/als-registry.json: every ALS study registered on
// ClinicalTrials.gov, plus ALS trials found only in ISRCTN, the EU's CTIS or
// the EU Clinical Trials Register (see other-registries.mjs), trimmed to the
// fields the catalog view uses.
//
//   node scripts/fetch-registry.mjs
//
// Behind an HTTPS proxy on Node 22+, run with NODE_USE_ENV_PROXY=1.
// Exits non-zero (leaving the existing file untouched) if the API fails, so CI
// can fall back to the committed snapshot.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fetchIsrctn, fetchCtis, fetchEuctr } from './other-registries.mjs'

const API = 'https://clinicaltrials.gov/api/v2/studies'
const OUT = new URL('../public/data/als-registry.json', import.meta.url)
const DRUGS = new URL('./drugs.json', import.meta.url)
const OUTCOMES = new URL('./outcomes.json', import.meta.url)
const FOCUS = new URL('./focus.json', import.meta.url)
const DUPLICATES = new URL('./duplicates.json', import.meta.url)

const FIELDS = [
  'NCTId', 'BriefTitle', 'OfficialTitle', 'Acronym', 'OverallStatus', 'WhyStopped', 'Phase', 'StudyType',
  'Condition', 'Keyword', 'InterventionName', 'InterventionType', 'InterventionOtherName', 'LeadSponsorName', 'LeadSponsorClass',
  'StartDate', 'PrimaryCompletionDate', 'CompletionDate', 'EnrollmentCount', 'EnrollmentType',
  'HasResults', 'LocationCountry', 'ReferencesModule', 'SecondaryIdInfo', 'PrimaryOutcomeMeasure', 'DesignPrimaryPurpose',
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

// The drugs a study tests, as keys that stay the same across studies: the drug
// table entry when there is one (so a code and its later name match), otherwise
// the intervention name without its dose. Riluzole is left out when it is only
// the background treatment alongside the drug under test.
const BACKGROUND = /^riluzole\b/i
// Placeholder names (other registries' interventions without a drug name) aren't drugs to track.
const GENERIC_NAME = /^(drug|biological product|genetic therapy|other intervention|behavioural intervention|device|procedure|supplement or diet)$/i
// Medicines given alongside the one under test, e.g. steroids before a gene therapy.
const HELPER = /prevent|prophyla|premedicat|pre-medicat/i
const DOSE = /\s+\d+(\.\d+)?\s*(mg|g|mcg|ug|µg|ml|iu|units?|cells|x)\b.*$/i
const DOSE_PREFIX = /^((single|multiple) ascending doses? of|\d+(\.\d+)?\s*(mg|g|mcg|ug|µg|ml))\s+/i
function testedDrugs(interventions) {
  const found = new Map()
  for (const i of interventions) {
    if (!DRUG_TYPES.has(i.type) || IS_COMPARATOR.test(i.name.trim()) || HELPER.test(i.name)) continue
    const label = i.name.replace(DOSE_PREFIX, '').replace(DOSE, '').trim()
    const entry = entryFor(i)
    // Group entries (various stem-cell products, say) are tracked by the study's own name.
    const known = Boolean(entry)
    const key = entry && !entry.group ? `t:${entry.match[0].toLowerCase()}` : `n:${spaced(label)}`
    if (key !== 'n:' && !GENERIC_NAME.test(label) && !found.has(key)) found.set(key, { key, label, known })
  }
  let tested = [...found.values()].filter((d) => !BACKGROUND.test(d.label))
  if (!tested.length) tested = [...found.values()]
  // When the table recognises a drug, other names in the study are usually
  // helpers (e.g. a drug-interaction cocktail), so keep only the recognised ones.
  if (tested.some((d) => d.known)) tested = tested.filter((d) => d.known)
  return tested.map(({ key, label }) => ({ key, label }))
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
  if (curated) {
    const { ignorePublications: _, ...outcome } = curated
    return { ...outcome, curated: true }
  }
  if (type !== 'INTERVENTIONAL') return null
  const auto = (verdict) => ({ verdict, summary: null, source: null, curated: false })
  if (status === 'WITHDRAWN') return auto('Withdrawn before enrolling')
  if (status === 'SUSPENDED') return auto('Suspended')
  if (status === 'TERMINATED') {
    if (!whyStopped) return auto('Stopped: reason not given')
    return auto(STOP_REASONS.find(([, re]) => re.test(whyStopped))?.[0] ?? 'Stopped: other reason')
  }
  if (status === 'COMPLETED' || status === 'ENDED') {
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
const SUPPORT = /muscle (strength )?training|expiratory muscle|inspiratory muscle|ventilat|\bNIV\b|bipap|tracheost|diaphragm(atic)? pac|insufflat|airway clearance|respiratory (muscle )?training|gastrostom|\bPEG\b|\bRIG\b|feeding|nutrition|\bdiet|caloric|calorie|exercise|rehabilit|physiotherap|physical therap|occupational therap|speech therap|communication|brain[- ]computer|\bBCI\b|eye[- ]track|augmentative|voice bank|palliative|end[- ]of[- ]life|caregiver|carer|telehealth|telemedicine|multidisciplinary|quality of life|psycholog|mindfulness|music|exoskeleton|wheelchair|orthos|robot|advance care|decision aid|dysphagia|swallow|home care|assistive|neural interface|neuroprosthe|intracortical|tetrapleg|paralysis|brain[- ]machine|cortical communication|neurotechnology|manipulation device|\\bbrace\\b|dysarthria|advance care/i
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
    .filter((r) => r.type === 'RESULT' && (r.pmid || r.url))
    .map((r) => ({ pmid: r.pmid ?? null, url: r.url ?? null, citation: r.citation ?? '' }))
    .slice(0, 3)
  const status = st.overallStatus ?? 'UNKNOWN'
  const type = p.designModule?.studyType ?? 'UNKNOWN'
  const registry = s.registry ?? 'ClinicalTrials.gov'
  return {
    _drugs: type === 'INTERVENTIONAL' ? testedDrugs(interventions) : [],
    id: id.nctId,
    registry,
    url: s.url ?? `https://clinicaltrials.gov/study/${id.nctId}`,
    resultsUrl: s.resultsUrl ?? (s.hasResults ? `https://clinicaltrials.gov/study/${id.nctId}?tab=results` : null),
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
    // Curated outcomes can mark the registry's "result" papers as background or another study.
    publications: curatedOutcomes[id.nctId]?.ignorePublications ? [] : publications,
    focus: focusOf(id.nctId, p, type, modalities),
    outcome: outcomeOf(id.nctId, type, status, st.whyStopped ?? null, Boolean(s.hasResults), publications),
  }
}

const byId = new Map()
// Every identifier the catalog already covers: its NCT numbers and the
// EudraCT, CTIS, ISRCTN and other numbers those records list.
const knownIds = new Set()
// Registry numbers in one form: no "EudraCT"/"CTIS" prefix, and a trial moved
// from the old EU register to CTIS (old number + "-00") matches its old number.
const normId = (x) => String(x).toUpperCase().replace(/\s+/g, '').replace(/^(EUDRACT|EUCT|CTIS)[:#-]*/, '').replace(/^(\d{4}-\d{6}-\d{2})-00$/, '$1')
// Words that say nothing about which trial a title describes.
const COMMON = new Set(('amyotrophic lateral sclerosis motor neuron neurone disease diseases patients participants subjects people adults ' +
  'study trial clinical phase randomized randomised double blind single placebo controlled multicenter multicentre multi centre center ' +
  'international multinational parallel group open label pilot safety efficacy tolerability tolerability pharmacokinetics evaluate evaluation ' +
  'evaluating assess assessment investigate investigating effect effects treatment therapy compared versus with from into their sporadic ' +
  'familial over long term extension dose doses oral intravenous daily weeks months year years exploratory proof concept ' +
  'healthy volunteers volunteer investigational drug test medicine agent product participant adult male female').split(' '))
const words = (t) => new Set((t.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter((w) => !COMMON.has(w)))
const similarTitles = (a, b) => {
  const x = words(a), y = words(b)
  const shared = [...x].filter((w) => y.has(w)).length
  return shared >= 3 && shared / Math.max(1, new Set([...x, ...y]).size) >= 0.35
}
for (const { cond, keep } of SEARCHES) {
  for (const s of await fetchAll(cond)) {
    const id = s.protocolSection.identificationModule.nctId
    if (!byId.has(id) && keep(s)) {
      byId.set(id, slim(s))
      knownIds.add(id)
      for (const sec of s.protocolSection.identificationModule.secondaryIdInfos ?? []) knownIds.add(normId(sec.id))
    }
  }
}

// Trials from other registries, unless the catalog already has them under any
// of their numbers. Sources are tried in this order, so a trial in both CTIS
// and the older EU register is kept once, from CTIS. If a registry can't be
// reached, its trials from the previous snapshot are kept.
// Duplicates the automatic matching can't catch, checked by hand.
const knownDuplicates = JSON.parse(await readFile(DUPLICATES, 'utf8')).duplicates
let previous = []
try {
  previous = JSON.parse(await readFile(OUT, 'utf8')).studies
} catch {
  // No earlier snapshot.
}
for (const [registry, fetchFrom] of [['EU CTIS', fetchCtis], ['ISRCTN', fetchIsrctn], ['EudraCT', fetchEuctr]]) {
  let added = 0
  try {
    for (const s of await fetchFrom()) {
      const ids = s.otherIds.map(normId)
      const duplicate = ids.some((x) => knownIds.has(x)) || Boolean(knownDuplicates[s.protocolSection.identificationModule.nctId])
      // A duplicate's other numbers still count: a third registry may list only those.
      ids.forEach((x) => knownIds.add(x))
      if (duplicate) continue
      const study = slim(s)
      // Some records don't cross-reference ClinicalTrials.gov at all. Treat one as
      // the same trial when a ClinicalTrials.gov trial tests the same recognised
      // drug at the same phase and started within a year of it. A drug often has
      // several Phase 1 studies, so those must also have similar titles; platform
      // trials, which test many drugs, are never matched this way.
      const earlyPhase = /Phase 1/.test(study.phase ?? '')
      const tests = (x) => x.interventions.filter((n) => !IS_COMPARATOR.test(n.trim())).length
      // Different groups often tested the same repurposed drug at the same time (lithium in 2008-09, say), so the
      // trials must also share a country when both list countries.
      const sameCountry = (o) => !o.countries.length || !study.countries.length || o.countries.some((c) => study.countries.includes(c))
      const ownTitles = [s.protocolSection.identificationModule.briefTitle, s.protocolSection.identificationModule.officialTitle].filter(Boolean)
      const years = (o) => Math.abs(Number(o.start.slice(0, 4)) - Number(study.start.slice(0, 4)))
      // Registries word phases differently ("Phase 2/3" vs "Phase 3"), so any shared phase counts.
      const phaseNums = (p) => new Set((p ?? '').match(/\d/g) ?? [])
      const samePhase = (o) => [...phaseNums(o.phase)].some((n) => phaseNums(study.phase).has(n))
      const twin = study.phase && study.start && [...byId.values()].find((o) => o.registry === 'ClinicalTrials.gov' && o.start && samePhase(o) && sameCountry(o) && (
        // Same recognised drug, within a year.
        (tests(study) <= 2 && tests(o) <= 2 && years(o) <= 1 &&
          o._drugs.some((d) => d.key.startsWith('t:') && study._drugs.some((e) => e.key === d.key)) &&
          (!earlyPhase || ownTitles.some((t) => similarTitles(o.title, t)))) ||
        // Or near-identical titles, within three years (the old EU register only gives the date a trial was entered).
        (years(o) <= 3 && ownTitles.some((t) => similarTitles(o.title, t)))))
      if (twin) {
        console.log(`  ${study.id} looks like ${twin.id}: ${study.title.slice(0, 50)} | ${twin.title.slice(0, 50)}`)
        continue
      }
      byId.set(study.id, study)
      added++
    }
    console.log(`${registry}: added ${added} trials not on ClinicalTrials.gov`)
  } catch (err) {
    const kept = previous.filter((s) => s.registry === registry && !byId.has(s.id))
    for (const s of kept) byId.set(s.id, { ...s, _drugs: [] })
    console.warn(`::warning::${registry} unavailable (${err.message}); kept ${kept.length} trials from the previous snapshot`)
  }
}

const missingFocus = Object.keys(focusOverrides).filter((id) => !byId.has(id))
if (missingFocus.length) console.warn(`Focus corrections for studies not in the catalog: ${missingFocus.join(', ')}`)
const missing = Object.keys(curatedOutcomes).filter((id) => !byId.has(id))
if (missing.length) console.warn(`Curated outcomes for studies not in the catalog: ${missing.join(', ')}`)

const studies = [...byId.values()].sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''))

// Whether each drug tested before Phase 3 reached a later phase in ALS: the
// furthest phase of any trial of the same drug, with that trial's ID, start
// and status. Phase 1 studies sometimes run alongside a drug's Phase 3 (e.g.
// drug-interaction studies), so the other trial may have started first.
// Withdrawn trials never ran, so they don't count; at the furthest phase, the
// drug's first main trial is shown rather than an extension or a platform
// trial's master protocol.
const EXTENSION = /extension|continuation|rollover|roll-over|long[- ]term (safety|follow)/i
// Phase 4 (post-approval) studies are left out: they say nothing about
// whether a new drug advanced. So is riluzole, approved since 1995, when a
// study tests a new form of it.
const PHASE_RANK = { 'Early Phase 1': 0, 'Phase 1': 1, 'Phase 1/2': 1.5, 'Phase 2': 2, 'Phase 2/3': 2.5, 'Phase 3': 3 }
const byDrug = new Map()
for (const st of studies) for (const { key } of st._drugs) {
  if (!byDrug.has(key)) byDrug.set(key, [])
  byDrug.get(key).push(st)
}
for (const st of studies) {
  const rank = PHASE_RANK[st.phase]
  st.laterDevelopment = rank === undefined || rank >= 3 ? [] : st._drugs.filter((x) => !/riluzole/i.test(x.label)).slice(0, 3).map(({ key, label }) => {
    const later = byDrug.get(key)
      .filter((o) => o !== st && o.status !== 'WITHDRAWN' && o.focus === st.focus && (PHASE_RANK[o.phase] ?? -1) > rank)
      .sort((a, b) => PHASE_RANK[b.phase] - PHASE_RANK[a.phase] ||
        Number(EXTENSION.test(a.title)) - Number(EXTENSION.test(b.title)) ||
        // A drug's own trial rather than a platform master protocol listing many drugs.
        a._drugs.length - b._drugs.length || (a.start ?? '9999').localeCompare(b.start ?? '9999'))[0]
    return later
      ? { drug: label, phase: later.phase, id: later.id, url: later.url, start: later.start, status: later.status }
      : { drug: label, phase: null, id: null, url: null, start: null, status: null }
  })
}
for (const st of studies) delete st._drugs
if (studies.length < 500) throw new Error(`Only ${studies.length} studies returned; refusing to overwrite the snapshot`)

await mkdir(new URL('.', OUT), { recursive: true })
await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), source: 'ClinicalTrials.gov API v2', studies }))
console.log(`Wrote ${studies.length} studies to ${OUT.pathname}`)
