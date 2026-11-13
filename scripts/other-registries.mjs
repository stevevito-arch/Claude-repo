// ALS trials from registries other than ClinicalTrials.gov: ISRCTN (UK), the
// EU's CTIS (trials authorised from 2023) and the older EU Clinical Trials
// Register (EudraCT, 2004-2023). Each record is reshaped into the same form as a
// ClinicalTrials.gov API record, so the catalog's drug, focus and outcome logic
// applies unchanged. Every record also carries `registry`, `url` and `otherIds`
// (the trial's numbers in other registries, used to drop duplicates).

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; ALS trials dashboard)' }
// Comparators that registries list as products.
const PLACEBO = /placebo|vehicle|saline|sodium chloride|kochsalz|artificial c(erebro|erebral )?spinal fluid|\bacsf\b/i
// Drug codes in a title (LY4256984, QRL-101), for records that list no products.
const CODE = /\b[A-Z]{2,5}-?\d{3,7}[A-Z]?\b/g
const ALS = /amyotrophic|\bALS\b|motor neurone? disease|\bMND\b|lou gehrig/i
const TODAY = new Date().toISOString().slice(0, 10)

function record({ id, registry, url, title, officialTitle, acronym, status, whyStopped, type, phases, interventions, conditions,
  sponsor, start, completion, enrollment, enrollmentActual, countries, primaryOutcomes, purpose, publications, otherIds, resultsUrl }) {
  return {
    registry, url, resultsUrl: resultsUrl ?? null, otherIds: otherIds.filter(Boolean),
    hasResults: Boolean(resultsUrl),
    protocolSection: {
      identificationModule: { nctId: id, briefTitle: title, officialTitle: officialTitle || undefined, acronym: acronym || undefined },
      statusModule: {
        overallStatus: status, whyStopped: whyStopped || undefined,
        startDateStruct: start ? { date: start } : undefined,
        completionDateStruct: completion ? { date: completion } : undefined,
      },
      designModule: {
        studyType: type, phases,
        enrollmentInfo: enrollment ? { count: enrollment, type: enrollmentActual ? 'ACTUAL' : 'ESTIMATED' } : undefined,
        designInfo: purpose ? { primaryPurpose: purpose } : undefined,
      },
      conditionsModule: { conditions },
      armsInterventionsModule: { interventions },
      sponsorCollaboratorsModule: sponsor ? { leadSponsor: { name: sponsor } } : undefined,
      contactsLocationsModule: { locations: countries.map((country) => ({ country })) },
      outcomesModule: { primaryOutcomes: primaryOutcomes.filter(Boolean).map((measure) => ({ measure })) },
      referencesModule: { references: publications.map((p) => ({ type: 'RESULT', ...p })) },
    },
  }
}

// Phase numbers in a registry's wording ("Phase I/II", "Therapeutic exploratory (Phase II)").
function phasesFrom(text) {
  const found = new Set()
  for (const m of (text ?? '').matchAll(/phase\s*(IV|III|II|I|[1-4])\b/gi)) {
    found.add({ I: 1, II: 2, III: 3, IV: 4 }[m[1].toUpperCase()] ?? Number(m[1]))
  }
  for (const m of (text ?? '').matchAll(/phase\s*(I{1,3}|[1-3])\s*\/\s*(I{1,3}|IV|[2-4])\b/gi)) {
    found.add({ I: 1, II: 2, III: 3, IV: 4 }[m[2].toUpperCase()] ?? Number(m[2]))
  }
  return [...found].sort().map((n) => `PHASE${n}`)
}

// ---------- ISRCTN ----------
const tag = (x, t) => {
  const m = x.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`))
  return m ? m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''
}
const tags = (x, t) => [...x.matchAll(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, 'g'))].map((m) => m[1])
const ISRCTN_TYPE = { drug: 'DRUG', biological: 'BIOLOGICAL', vaccine: 'BIOLOGICAL', supplement: 'DIETARY_SUPPLEMENT', device: 'DEVICE',
  behavioural: 'BEHAVIORAL', 'procedure/surgery': 'PROCEDURE', genetic: 'GENETIC', other: 'OTHER', mixed: 'OTHER' }
const ISRCTN_TYPE_LABEL = { DRUG: 'Drug', BIOLOGICAL: 'Biological product', GENETIC: 'Genetic therapy', BEHAVIORAL: 'Behavioural intervention', DEVICE: 'Device', PROCEDURE: 'Procedure', DIETARY_SUPPLEMENT: 'Supplement or diet', OTHER: 'Other intervention' }
const ISRCTN_PURPOSE = { treatment: 'TREATMENT', 'supportive care': 'SUPPORTIVE_CARE', diagnostic: 'DIAGNOSTIC', screening: 'SCREENING',
  prevention: 'PREVENTION', 'basic science': 'BASIC_SCIENCE', 'health services research': 'HEALTH_SERVICES_RESEARCH' }

function isrctnStatus(ft) {
  const override = tag(ft, 'recruitmentStatusOverride').toLowerCase()
  if (/stopped|terminated/.test(override)) return 'TERMINATED'
  if (/suspend/.test(override)) return 'SUSPENDED'
  if (/withdrawn|cancel/.test(override)) return 'WITHDRAWN'
  const start = tag(ft, 'recruitmentStart').slice(0, 10)
  const recruitEnd = tag(ft, 'recruitmentEnd').slice(0, 10)
  const end = tag(ft, 'overallEndDate').slice(0, 10)
  if (end && end < TODAY) return 'COMPLETED'
  if (start && start > TODAY) return 'NOT_YET_RECRUITING'
  if (recruitEnd && recruitEnd >= TODAY) return 'RECRUITING'
  return 'ACTIVE_NOT_RECRUITING'
}

export async function fetchIsrctn() {
  const q = 'condition:"amyotrophic lateral sclerosis" OR condition:"motor neurone disease" OR condition:"motor neuron disease"'
  const res = await fetch(`https://www.isrctn.com/api/query/format/default?limit=500&q=${encodeURIComponent(q)}`, { headers: UA, signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`ISRCTN: HTTP ${res.status}`)
  const xml = await res.text()
  const out = []
  for (const ft of xml.split('<fullTrial>').slice(1)) {
    const id = ft.match(/publicIdentifierCanonical="([^"]+)"/)?.[1]
    if (!id) continue
    const title = tag(ft, 'title')
    if (/^deferred registration/i.test(title)) continue
    const conditions = tags(tags(ft, 'conditions')[0] ?? '', 'condition').map((c) => tag(c, 'description')).filter(Boolean)
    if (!ALS.test(`${title} ${tag(ft, 'scientificTitle')} ${conditions.join(' ')}`)) continue
    const interventions = []
    for (const iv of tags(ft, 'intervention')) {
      const type = ISRCTN_TYPE[tag(iv, 'interventionType').toLowerCase()] ?? 'OTHER'
      const drugs = tag(iv, 'drugNames').split(/,|;|\band\b/).map((d) => d.trim()).filter((d) => d && d.length < 60)
      // Free-text descriptions make poor names, so non-drug interventions are named by type.
      // A drug trial with no drug names may still give a drug code in its title.
      const codes = type === 'DRUG' ? [...new Set(title.match(CODE) ?? [])] : []
      if (drugs.length) for (const name of drugs) interventions.push({ name, type })
      else if (codes.length) for (const name of codes) interventions.push({ name, type })
      else interventions.push({ name: ISRCTN_TYPE_LABEL[type] ?? 'Other intervention', type })
    }
    const secondary = [...ft.matchAll(/canonicalSecondaryNumber="([^"]+)"/g)].map((m) => m[1])
    const outputs = tags(ft, 'output').length ? [...ft.matchAll(/<output [^>]*outputType="([^"]+)"[\s\S]*?<\/output>/g)] : []
    const publications = outputs.filter((m) => m[1] === 'resultsarticle').map((m) => {
      const link = m[0].match(/<externalLink url="([^"]+)"/)?.[1]
      const pmid = link?.match(/pubmed[^0-9]*(\d{6,9})/)?.[1]
      return link ? { pmid: pmid ?? undefined, url: link, citation: tag(m[0], 'description') || 'Results article' } : null
    }).filter(Boolean).slice(0, 3)
    const hasBasicResults = outputs.some((m) => m[1] === 'basicresults')
    const final = Number(tag(ft, 'totalFinalEnrolment')) || 0
    out.push(record({
      id, registry: 'ISRCTN', url: `https://www.isrctn.com/${id}`,
      title, officialTitle: tag(ft, 'scientificTitle'), acronym: tag(ft, 'acronym'),
      status: isrctnStatus(ft), type: /observational/i.test(tag(ft, 'primaryStudyDesign')) ? 'OBSERVATIONAL' : 'INTERVENTIONAL',
      phases: phasesFrom(tag(ft, 'phase')), interventions, conditions,
      sponsor: tag(tags(ft, 'sponsor')[0] ?? '', 'organisation'),
      start: tag(ft, 'recruitmentStart').slice(0, 10), completion: tag(ft, 'overallEndDate').slice(0, 10),
      enrollment: final || Number(tag(ft, 'targetEnrolment')) || null, enrollmentActual: final > 0,
      countries: [...new Set(tags(tags(ft, 'recruitmentCountries')[0] ?? '', 'country').map((c) => c.trim()))],
      primaryOutcomes: tags(ft, 'outcomeMeasure').slice(0, 2).map((o) => tag(o, 'description')),
      purpose: ISRCTN_PURPOSE[tag(ft, 'purpose').toLowerCase()],
      publications, otherIds: [id, ...secondary], resultsUrl: hasBasicResults ? `https://www.isrctn.com/${id}` : null,
    }))
  }
  return out
}

// ---------- CTIS ----------
// Public status codes, worked out against trials registered in both CTIS and
// ClinicalTrials.gov. 8 ("Ended") covers both completed and stopped trials.
const CTIS_STATUS = { 2: 'NOT_YET_RECRUITING', 3: 'RECRUITING', 4: 'RECRUITING', 5: 'ACTIVE_NOT_RECRUITING', 6: 'SUSPENDED', 8: 'ENDED', 9: 'ENDED' }

async function ctisSearch(text) {
  const found = []
  for (let page = 1; page <= 10; page++) {
    const body = { pagination: { page, size: 50 }, sort: { property: 'decisionDate', direction: 'DESC' }, searchCriteria: { containAll: text } }
    const res = await fetch('https://euclinicaltrials.eu/ctis-public-api/search', {
      method: 'POST', headers: { ...UA, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) throw new Error(`CTIS search: HTTP ${res.status}`)
    const j = await res.json()
    found.push(...j.data)
    if (!j.pagination?.nextPage) break
  }
  return found
}

export async function fetchCtis() {
  const byId = new Map()
  for (const text of ['amyotrophic lateral sclerosis', 'motor neurone disease', 'motor neuron disease']) {
    for (const t of await ctisSearch(text)) if (ALS.test(`${t.conditions} ${t.ctTitle}`)) byId.set(t.ctNumber, t)
  }
  const out = []
  for (const t of byId.values()) {
    const res = await fetch(`https://euclinicaltrials.eu/ctis-public-api/retrieve/${t.ctNumber}`, { headers: { ...UA, Accept: 'application/json' }, signal: AbortSignal.timeout(60_000) })
    const full = res.ok ? await res.json() : {}
    const part1 = full.authorizedApplication?.authorizedPartI ?? {}
    const details = part1.trialDetails ?? {}
    const ids = details.clinicalTrialIdentifiers ?? {}
    const sec = ids.secondaryIdentifyingNumbers ?? {}
    const duration = details.trialInformation?.trialDuration ?? {}
    // Only the products under test: not placebos, comparators or auxiliary
    // medicines such as premedication. Named by active substance where given.
    const tested = (part1.productRoleGroupInfos ?? []).filter((g) => g.productRoleName === 'Test').flatMap((g) => g.products ?? [])
    const products = [...new Map(tested.map((p) => {
      const product = p.productName || p.productDictionaryInfo?.prodName || ''
      const substance = p.productDictionaryInfo?.activeSubstanceName || ''
      const name = substance && substance.length < 40 ? substance : product
      return [name.toLowerCase(), { name, type: 'DRUG', otherNames: product && product !== name ? [product] : [] }]
    })).values()].filter((p) => p.name.length > 1 && !PLACEBO.test(p.name))
    const codes = [...new Set(`${t.ctTitle} ${ids.publicTitle ?? ''}`.match(CODE) ?? [])]
    const interventions = products.length ? products : codes.map((name) => ({ name, type: 'DRUG' }))
    out.push(record({
      id: t.ctNumber, registry: 'EU CTIS', url: `https://euclinicaltrials.eu/search-for-clinical-trials/?lang=en&EUCT=${t.ctNumber}`,
      title: ids.publicTitle || t.ctTitle, officialTitle: ids.fullTitle || t.ctTitle, acronym: t.shortTitle,
      status: CTIS_STATUS[t.ctStatus] ?? 'UNKNOWN', type: 'INTERVENTIONAL', phases: phasesFrom(t.trialPhase),
      interventions, conditions: (t.conditions ?? '').split(/,|;/).map((c) => c.trim()).filter(Boolean),
      sponsor: t.sponsor, start: duration.estimatedRecruitmentStartDate, completion: duration.estimatedGlobalEndDate ?? duration.estimatedEndDate,
      enrollment: Number(t.totalNumberEnrolled) || null, enrollmentActual: false,
      countries: [...new Set((t.trialCountries ?? []).map((c) => c.split(':')[0]))],
      primaryOutcomes: [t.primaryEndPoint], purpose: undefined, publications: [],
      // Trials moved over from the old EU register keep their EudraCT number somewhere in the record.
      otherIds: [t.ctNumber, sec.nctNumber?.number, sec.eudraCt?.number, ...(sec.additionalRegistries ?? []).map((a) => a.number),
        ...new Set(JSON.stringify(full).match(/\b20\d\d-\d{6}-\d\d(?!-)/g) ?? [])],
      resultsUrl: t.resultsFirstReceived === 'Yes' ? `https://euclinicaltrials.eu/search-for-clinical-trials/?lang=en&EUCT=${t.ctNumber}` : null,
    }))
  }
  return out
}

// ---------- EU Clinical Trials Register (EudraCT) ----------
// The register closed to new trials when the EU moved to CTIS, so its records
// rarely change, and its firewall rejects repeated bulk downloads. The build
// therefore reads a saved copy (scripts/euctr-als.json); refresh it now and
// then with `npm run fetch-euctr`, which downloads slowly and stops at the
// first rejection.
const EUCTR_SNAPSHOT = new URL('./euctr-als.json', import.meta.url)

export async function fetchEuctr() {
  const { readFile } = await import('node:fs/promises')
  try {
    return JSON.parse(await readFile(EUCTR_SNAPSHOT, 'utf8')).records
  } catch {
    return []
  }
}

export async function saveEuctrSnapshot() {
  const { writeFile } = await import('node:fs/promises')
  const records = await downloadEuctr()
  await writeFile(EUCTR_SNAPSHOT, JSON.stringify({ downloadedAt: new Date().toISOString(), records }) + '\n')
  return records.length
}

const EUCTR_STATUS_ORDER = ['Ongoing', 'Restarted', 'Temporarily Halted', 'Prematurely Ended', 'Completed', 'Not Authorised']

function euctrFields(block) {
  const f = {}
  for (const line of block.split('\n')) {
    const m = line.match(/^([A-Z]\.[\d.]*\s?[^:]{0,160}?|Trial Status|EudraCT Number|Date on which this record was first entered in the EudraCT database|National Competent Authority): (.*)$/)
    if (!m || /\([a-z]{2}\):?$/.test(m[1].trim()) || / \([a-z]{2}\)$/.test(m[1])) continue
    const key = m[1].trim()
    ;(f[key] ??= []).push(m[2].trim())
  }
  return f
}
const first = (f, prefix) => Object.entries(f).find(([k]) => k.startsWith(prefix))?.[1].find((v) => v) ?? ''
const all = (f, prefix) => Object.entries(f).filter(([k]) => k.startsWith(prefix)).flatMap(([, v]) => v).filter(Boolean)

async function downloadEuctr() {
  const blocks = new Map()
  let lastFirst
  for (const query of ['amyotrophic lateral sclerosis', 'motor neurone disease']) {
    for (let page = 1; page <= 15; page++) {
      const res = await fetch(`https://www.clinicaltrialsregister.eu/ctr-search/rest/download/full?query=${encodeURIComponent(query)}&mode=current_page&page=${page}`,
        { headers: UA, signal: AbortSignal.timeout(120_000) })
      if (!res.ok) throw new Error(`EU CTR: HTTP ${res.status}`)
      const text = (await res.text()).replace(/\r/g, '')
      if (/Request Rejected/i.test(text)) throw new Error('EU CTR rejected the request; try again later')
      // Pages of the same query come back identical if paging isn't honoured.
      if (page > 1 && text.split(/\nSummary\nEudraCT Number: /)[1]?.slice(0, 14) === lastFirst) break
      lastFirst = text.split(/\nSummary\nEudraCT Number: /)[1]?.slice(0, 14)
      await new Promise((r) => setTimeout(r, 8000))
      const parts = text.split(/\nSummary\nEudraCT Number: /).slice(1)
      if (!parts.length) break
      for (const p of parts) {
        const id = p.slice(0, 14).trim()
        ;(blocks.get(id) ?? blocks.set(id, []).get(id)).push(p)
      }
      if (parts.length < 20) break
    }
  }
  const out = []
  for (const [id, parts] of blocks) {
    const fs = parts.map(euctrFields)
    const f = fs[0]
    const title = first(f, 'A.3 Full title of the trial')
    const conditions = [...new Set(fs.flatMap((x) => all(x, 'E.1.1 Medical condition')))].slice(0, 3)
    if (!ALS.test(`${title} ${first(f, 'A.3.1')} ${conditions.join(' ')}`)) continue
    const statuses = fs.flatMap((x) => x['Trial Status'] ?? [])
    const status = EUCTR_STATUS_ORDER.find((s) => statuses.includes(s))
    const entered = first(f, 'Date on which this record was first entered')
    const end = fs.flatMap((x) => all(x, 'P. Date of the global end')).sort().pop() ?? ''
    // "Ongoing" records that were never updated are as stale as ClinicalTrials.gov's "unknown status".
    const stale = (status === 'Ongoing' || status === 'Restarted') && entered && entered < `${Number(TODAY.slice(0, 4)) - 8}`
    const mapped = stale ? 'UNKNOWN' : { Ongoing: 'ACTIVE_NOT_RECRUITING', Restarted: 'ACTIVE_NOT_RECRUITING', 'Temporarily Halted': 'SUSPENDED',
      'Prematurely Ended': 'TERMINATED', Completed: 'COMPLETED', 'Not Authorised': 'WITHDRAWN' }[status] ?? 'UNKNOWN'
    const phases = [['E.7.1 Human pharmacology (Phase I)', 'PHASE1'], ['E.7.2 Therapeutic exploratory (Phase II)', 'PHASE2'],
      ['E.7.3 Therapeutic confirmatory (Phase III)', 'PHASE3'], ['E.7.4 Therapeutic use (Phase IV)', 'PHASE4']]
      .filter(([k]) => /^yes/i.test(first(f, k))).map(([, p]) => p)
    const names = [...new Set(fs.flatMap((x) => [...all(x, 'D.3.1 Product name'), ...all(x, 'D.3.2 Product code')]).filter((n) => !PLACEBO.test(n)))]
    const inns = [...new Set(fs.flatMap((x) => all(x, 'D.3.8 INN')).filter((n) => !PLACEBO.test(n)))]
    const interventions = (names.length ? names : inns).slice(0, 4).map((name, i) => ({ name, type: 'DRUG', otherNames: inns[i] && inns[i] !== name ? [inns[i]] : [] }))
    const block = parts.join('\n')
    out.push(record({
      id, registry: 'EudraCT', url: `https://www.clinicaltrialsregister.eu/ctr-search/search?query=${id}`,
      title: first(f, 'A.3.1 Title of the trial for lay people') || title, officialTitle: title, acronym: first(f, 'A.3.2 Name or abbreviated title'),
      status: mapped, type: 'INTERVENTIONAL', phases, interventions, conditions,
      sponsor: first(f, 'B.1.1 Name of Sponsor'), start: entered, completion: end,
      enrollment: Number(first(f, 'F.4.2.2')) || Number(first(f, 'F.4.1')) || null, enrollmentActual: false,
      countries: [...new Set(fs.flatMap((x) => x['National Competent Authority'] ?? []).map((c) => c.split(' - ')[0].trim()))],
      primaryOutcomes: [first(f, 'E.5.1 Primary end point')], purpose: 'TREATMENT', publications: [],
      otherIds: [id, ...(block.match(/NCT\d{8}/g) ?? []), ...(block.match(/ISRCTN\d{6,}/g) ?? [])],
      resultsUrl: null,
    }))
  }
  return out
}
