// Dose levels, frequency and route of each drug in a study, read from the
// registry's free text: intervention descriptions and the descriptions of the
// arms that give the drug. Registries have no structured dose fields (except
// CTIS, whose fields other-registries.mjs writes into the description), so this
// is pattern matching. The registry passages it read are kept alongside, so the
// catalog can show the source wording under the summary.

const NUM = String.raw`\d+(?:[.,]\d+)?`
const UNIT = String.raw`mg\/kg\/day|mg\/kg\/d|mg\/kg|mg\/m2|mg\/m²|mg\/day|mg\/d|mg|µg\/kg|μg\/kg|mcg\/kg|ug\/kg|µg|μg|mcg|ug|g\/kg|g\/day|g\/d|g|IU\/kg|MIU|IU|U\/kg|units|vg\/kg|vg|cells\/kg|cells|mmol`
const DOSE = new RegExp(
  String.raw`(?<![\w.,])(${NUM}(?:\s*(?:-|–|to)\s*${NUM})?)\s*(?:[x×]\s*10\s*(?:\^|e|E)?\s*(\d{1,2})\s*)?(${UNIT})(?![\w/])`,
  'gi',
)
const SUPERSCRIPT = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }

function unitOf(u) {
  const x = u.replace(/μ/g, 'µ').replace(/^(mcg|ug)/i, 'µg').replace(/\/d$/i, '/day').replace(/m²/, 'm2')
  return /^(iu|miu|u\/kg)/i.test(x) ? x.toUpperCase().replace('/KG', '/kg') : x.toLowerCase()
}

const COUNT = { once: 'Once', '1x': 'Once', '1 x': 'Once', twice: 'Twice', '2x': 'Twice', '2 x': 'Twice', '2 times': 'Twice', thrice: 'Three times',
  'three times': 'Three times', '3x': 'Three times', '3 x': 'Three times', '3 times': 'Three times', 'four times': 'Four times', '4x': 'Four times', '4 times': 'Four times' }
const PER = { day: 'daily', daily: 'daily', week: 'weekly', weekly: 'weekly', month: 'monthly', monthly: 'monthly' }
const WORD_NUM = { two: 2, three: 3, four: 4, five: 5, six: 6, eight: 8, twelve: 12 }
const plural = (n, unit) => `${n} ${unit.replace(/s$/, '')}${Number(n) === 1 ? '' : 's'}`

// [pattern, how the match reads]
const FREQUENCY = [
  [/\b(once|twice|thrice|three times|four times|[1-4]\s*x|[1-4] times)[\s-]*(?:a|per|each|\/)?[\s-]*(day|daily|week|weekly|month|monthly)\b/gi,
    (m) => `${COUNT[m[1].toLowerCase().replace(/\s+/g, ' ')] ?? m[1]} ${PER[m[2].toLowerCase()]}`],
  [/\b(b\.?i\.?d|t\.?i\.?d|q\.?i\.?d|q\.d)\b\.?/gi,
    (m) => ({ b: 'Twice daily', t: 'Three times daily', q: m[1].length <= 3 && /d$/i.test(m[1]) && !/i/i.test(m[1]) ? 'Once daily' : 'Four times daily' })[m[1][0].toLowerCase()]],
  [/\bQD\b/g, () => 'Once daily'],
  [/\bevery\s+(other\s+(day|week)|(\d+|two|three|four|five|six|eight|twelve)\s+(days?|weeks?|months?|hours?)|day|week|month)\b/gi, (m) => {
    if (m[2]) return `Every other ${m[2].toLowerCase()}`
    if (m[3]) return `Every ${plural(WORD_NUM[m[3].toLowerCase()] ?? m[3], m[4].toLowerCase())}`
    return { day: 'Daily', week: 'Weekly', month: 'Monthly' }[m[1].toLowerCase()]
  }],
  [/\bq\s?(\d+)\s?(h|d|w|wks?|m)\b/gi, (m) => `Every ${plural(m[1], { h: 'hours', d: 'days', w: 'weeks', wk: 'weeks', wks: 'weeks', m: 'months' }[m[2].toLowerCase()])}`],
  [/\b(daily|weekly|monthly|fortnightly|nightly|at bedtime)\b/gi, (m) => m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()],
  [/\b(?:single|one[- ]time)\s+(?:dose|administration|injection|infusion|intrathecal|bolus|iv|treatment|subcutaneous|intravenous)|\badministered once\b|\bonce\s+(?:by|on|via)\b/gi, () => 'Single dose'],
  [/\bloading doses?\b/gi, () => 'Loading doses, then maintenance'],
]

const ROUTE = [
  [/\b(?:orally|oral|per os|p\.o\.|by mouth|tablets?|capsules?|ORAL USE)\b/gi, 'Oral'],
  [/\bintravenous(?:ly)?\b|\bi\.v\.|\bIV (?:infusion|injection|bolus|administration)|\b(?:via|by) IV\b|\binfusions?\b/gi, 'Intravenous'],
  [/\bintrathecal(?:ly)?\b|\bIT (?:injection|bolus|administration)|\b(?:via|by) IT\b|\blumbar puncture\b/gi, 'Intrathecal'],
  [/\bsub-?cutaneous(?:ly)?\b|\bs\.c\.|\bSC (?:injection|administration)|\b(?:via|by) SC\b/gi, 'Subcutaneous'],
  [/\bintramuscular(?:ly)?\b|\bi\.m\.|\bIM injection/gi, 'Intramuscular'],
  [/\b(?:intra)?nasal(?:ly)?\b|\bnasal spray\b/gi, 'Intranasal'],
  [/\binhal(?:ed|ation)\b|\bnebuli[sz]/gi, 'Inhaled'],
  [/\btransdermal\b|\bpatch(?:es)?\b|(?<!sub)cutaneous use/gi, 'Transdermal'],
  [/\bsublingual(?:ly)?\b/gi, 'Sublingual'],
  [/\boromucosal\b|\bbuccal\b/gi, 'Oromucosal'],
  [/\bintracerebroventricular\b|\bICV\b/g, 'Into the brain ventricles'],
  [/\bintraspinal\b|\binto the spinal cord\b|\bspinal cord injection/gi, 'Into the spinal cord'],
  [/\bintracerebral\b|\bintraparenchymal\b/gi, 'Into the brain'],
  [/\bgastrostomy\b|\bfeeding tube\b|\bnasogastric\b/gi, 'Feeding tube'],
]

// Sentences about study visits rather than the drug ("blood draws every 28 days").
const ASSESSMENT = /\bvisits?\b|assessment|follow[- ]up|blood (?:draw|sample)|sampl|\bscans?\b|\bMRI\b|questionnaire|evaluat|measure/i
// Descriptions that only point elsewhere.
const BOILERPLATE = /^(?:administered|given|dosed|as)?\s*(?:as )?(?:specified|described|defined|detailed|per)\s+(?:in )?(?:the )?(?:treatment |study )?(?:arms?|protocol|arm description)\.?$|^see arm|^refer to/i
const SKIP_ARMS = new Set(['PLACEBO_COMPARATOR', 'NO_INTERVENTION', 'SHAM_COMPARATOR'])
const MAX_PASSAGES = 8
const MAX_PASSAGE = 600

const escape = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const baseName = (name) => name.replace(/\s*[([].*$/, '').replace(/\s+\d.*$/, '').trim()

function sentences(text) {
  return text.split(/(?<=[.;])\s+(?=[A-Z(])|\n+|(?<=:)\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean)
}

function joinValues(values) {
  return values.length <= 1 ? values.join('') : `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`
}

/**
 * @param module   the study's armsInterventionsModule (ClinicalTrials.gov form)
 * @param drugs    [{ id, names: string[], interventions: Set<string> }] for the study's recognised drugs
 * @returns Map id -> { doses, frequency, route, passages } (drugs with nothing found are left out)
 */
export function dosingOf(module, drugs) {
  const interventions = module?.interventions ?? []
  const arms = module?.armGroups ?? []
  // Every name in the study that can own a dose: the drugs, plus placebo and
  // unrecognised interventions, so their doses aren't given to a drug.
  const mentions = []
  for (const d of drugs) {
    for (const n of new Set(d.names.map(baseName).filter((n) => n.length >= 3))) mentions.push({ owner: d.id, re: n })
  }
  for (const i of interventions) {
    if (drugs.some((d) => d.interventions.has(i.name))) continue
    const n = baseName(i.name)
    if (n.length >= 3) mentions.push({ owner: null, re: n })
  }
  mentions.push({ owner: null, re: 'placebo' })
  // Riluzole is the usual background drug, and registries misspell it ("riluzol 50mg bid").
  const riluzole = drugs.find((d) => d.names.some((n) => /^riluzole$/i.test(n)))
  mentions.push({ owner: riluzole?.id ?? null, re: 'riluzol' }, { owner: riluzole?.id ?? null, re: 'riluzole' })
  const mentionRes = mentions.map((m) => ({ owner: m.owner, re: new RegExp(`(?<![A-Za-z0-9])${escape(m.re)}(?![A-Za-z0-9])`, 'gi') }))
  const ownerOfIntervention = new Map()
  for (const d of drugs) for (const n of d.interventions) ownerOfIntervention.set(n, d.id)

  const found = new Map(drugs.map((d) => [d.id, { doses: new Map(), frequency: new Set(), route: new Set(), passages: [] }]))

  function read(text, fallback) {
    for (const sentence of sentences(text)) {
      const at = []
      for (const m of mentionRes) for (const x of sentence.matchAll(m.re)) at.push({ pos: x.index, end: x.index + x[0].length, owner: m.owner })
      at.sort((a, b) => a.pos - b.pos)
      const visitTalk = ASSESSMENT.test(sentence)
      const ownerAt = (pos) => {
        const before = at.filter((a) => a.end <= pos).pop()
        if (before) return before.owner
        const after = at.find((a) => a.pos >= pos)
        if (after && after.pos - pos <= 25) return after.owner
        return visitTalk ? null : fallback
      }
      for (const x of sentence.matchAll(DOSE)) {
        const owner = ownerAt(x.index)
        if (owner == null) continue
        const value = x[1].replace(/\s*(?:-|–|to)\s*/, '–').replace(',', '.')
        const unit = (x[2] ? `×10${[...x[2]].map((c) => SUPERSCRIPT[c]).join('')} ` : '') + unitOf(x[3])
        const doses = found.get(owner).doses
        if (!doses.has(unit)) doses.set(unit, new Set())
        doses.get(unit).add(value)
      }
      // Patterns run most specific first; a match inside an earlier one
      // ("daily" in "twice daily") is skipped.
      const taken = []
      for (const [re, read] of FREQUENCY) for (const x of sentence.matchAll(re)) {
        const end = x.index + x[0].length
        if (taken.some(([s, e]) => x.index < e && end > s)) continue
        taken.push([x.index, end])
        const owner = ownerAt(x.index)
        if (owner != null) found.get(owner).frequency.add(read(x))
      }
      for (const [re, route] of ROUTE) for (const x of sentence.matchAll(re)) {
        const owner = ownerAt(x.index)
        if (owner != null) found.get(owner).route.add(route)
      }
    }
  }

  const passage = (owner, label, text) => {
    const list = found.get(owner).passages
    const clipped = text.length > MAX_PASSAGE ? `${text.slice(0, MAX_PASSAGE - 1).replace(/\s+\S*$/, '')}…` : text
    if (list.length < MAX_PASSAGES && !list.some((p) => p.text === clipped)) list.push({ label, text: clipped })
  }

  for (const i of interventions) {
    const text = (i.description ?? '').trim()
    if (!text || BOILERPLATE.test(text)) continue
    const own = ownerOfIntervention.get(i.name) ?? null
    read(text, own)
    if (own != null) passage(own, i.name, text)
  }
  for (const arm of arms) {
    if (SKIP_ARMS.has(arm.type)) continue
    const given = new Set((arm.interventionNames ?? []).map((n) => n.replace(/^[A-Za-z ]+:\s*/, '')))
    const owners = [...new Set([...given].map((n) => ownerOfIntervention.get(n)).filter((o) => o != null))]
    const text = (arm.description ?? '').trim()
    // The arm's own drug when it gives just one; otherwise only named mentions count.
    const fallback = owners.length === 1 ? owners[0] : null
    read(`${arm.label ?? ''}.\n${text}`, fallback)
    if (text) for (const o of owners) passage(o, arm.label ?? 'Arm', text)
  }

  const out = new Map()
  for (const [id, f] of found) {
    const doses = [...f.doses].map(([unit, values]) => {
      const sorted = [...values].sort((a, b) => parseFloat(a) - parseFloat(b))
      const shown = sorted.length > 8 ? [...sorted.slice(0, 7), '…'] : sorted
      return `${joinValues(shown)} ${unit}`
    })
    if (!doses.length && !f.frequency.size && !f.route.size && !f.passages.length) continue
    out.set(id, { doses, frequency: [...f.frequency], route: [...f.route], passages: f.passages })
  }
  return out
}
