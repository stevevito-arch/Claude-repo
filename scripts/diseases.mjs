// Per-disease settings for the registry build (fetch-registry.mjs,
// other-registries.mjs). Each disease gets its own catalog,
// public/data/<id>-registry.json, and its own hand-curated files in
// scripts/data/<id>/: outcomes.json, focus.json, duplicates.json and the saved
// EU Clinical Trials Register copy, euctr.json. The drug table, scripts/drugs.json,
// is shared: a drug's target doesn't depend on the disease.

// Care, rehabilitation and assistive technology, for any disease.
const SUPPORT_COMMON = String.raw`muscle (strength )?training|expiratory muscle|inspiratory muscle|ventilat|\bNIV\b|bipap|tracheost|diaphragm(atic)? pac|insufflat|airway clearance|respiratory (muscle )?training|gastrostom|\bPEG\b|\bRIG\b|feeding|nutrition|\bdiet|caloric|calorie|exercise|rehabilit|physiotherap|physical therap|occupational therap|speech therap|communication|brain[- ]computer|\bBCI\b|eye[- ]track|augmentative|voice bank|palliative|end[- ]of[- ]life|caregiver|carer|telehealth|telemedicine|multidisciplinary|quality of life|psycholog|mindfulness|music|exoskeleton|wheelchair|orthos|robot|advance care|decision aid|dysphagia|swallow|home care|assistive|neural interface|neuroprosthe|intracortical|tetrapleg|paralysis|brain[- ]machine|cortical communication|neurotechnology|manipulation device|\\bbrace\\b|dysarthria|advance care`

export const DISEASES = {
  als: {
    id: 'als',
    name: 'ALS',
    // The default focus: what most of the field means by a treatment for the disease.
    progressionFocus: 'Slowing ALS progression',
    // ClinicalTrials.gov condition searches. Each expands synonyms, so its results
    // must still name the disease: "Charcot disease" also matches Charcot foot
    // neuropathy. The motor neuron disease search adds a few ALS studies indexed
    // only under it, but is otherwise mostly spinal muscular atrophy and others,
    // so only results naming ALS itself are kept.
    searches: [
      { cond: 'Amyotrophic Lateral Sclerosis', names: /amyotrophic|\bALS\b|lou gehrig|motor neurone? disease|\bMND\b/i },
      { cond: 'Motor Neuron Disease', names: /amyotrophic|\bALS\b|lou gehrig/i },
    ],
    // Records from other registries must name the disease in these words.
    names: /amyotrophic|\bALS\b|motor neurone? disease|\bMND\b|lou gehrig/i,
    isrctnQuery: 'condition:"amyotrophic lateral sclerosis" OR condition:"motor neurone disease" OR condition:"motor neuron disease"',
    ctisTerms: ['amyotrophic lateral sclerosis', 'motor neurone disease', 'motor neuron disease'],
    euctrQueries: ['amyotrophic lateral sclerosis', 'motor neurone disease'],
    // Focus rules (see focusOf in fetch-registry.mjs).
    symptom: /pseudobulbar|emotional labil|\bPBA\b|pathological (laughing|crying)|sialorrh|drool|saliva|secretion|cramp|spastic|fasciculation|depress|anxiety|\bpain\b|insomnia|\bsleep|fatigue|appetite|constipation|dyspn|breathless|cough|itch|pruritus|cognitive (impair|symptom)|apathy|muscle stiffness/i,
    support: new RegExp(SUPPORT_COMMON, 'i'),
    inTitle: /amyotrophic|\bALS\b|motor neurone? disease|\bMND\b|lou gehrig/i,
    // Conditions that don't make a study about another disease.
    likeConditions: /amyotrophic|\bALS\b|motor neuron|\bMND\b|lou gehrig|frontotemporal|\bFTD\b|neurodegenerat|primary lateral|progressive muscular atrophy|bulbar palsy|healthy/i,
    // The standard treatment new drugs are added to; left out when a study tests something else too.
    background: /^riluzole\b/i,
    minStudies: 500,
  },

  pd: {
    id: 'pd',
    name: "Parkinson's",
    // Includes restorative approaches (cell replacement, growth factors) as well
    // as treatments meant to slow the disease.
    progressionFocus: "Slowing or reversing Parkinson's",
    searches: [
      { cond: 'Parkinson Disease', names: /parkinson/i },
    ],
    names: /parkinson/i,
    isrctnQuery: 'condition:"parkinson"',
    ctisTerms: ["parkinson's disease", 'parkinson disease'],
    euctrQueries: ['parkinson'],
    // Motor and non-motor symptoms, and the add-on-to-levodopa trials that treat them.
    symptom: /motor fluctuation|\boff\b[- ]?(episode|period|time|state|phenomen|symptom)|wearing[- ]off|\bon[- ]time\b|dyskinesi|levodopa[- ]induced|\bLIDs?\b|tremor|freezing|\bFOG\b|\bgait\b|balance|postural instab|\bfalls?\b|bradykinesi|rigidity|motor symptom|motor complication|akinesia|dystonia|camptocormia|psychos|hallucinat|delusion|dementia|cognitive|cognition|memory|depress|anxiety|apathy|impulse control|sleep|insomnia|\bREM\b|somnolen|restless legs|nocturia|nocturnal|constipat|gastroparesis|gastric emptying|orthostatic|hypotension|\bnOH\b|urinary|bladder|overactive|erectile|sexual|drool|sialorrh|saliva|\bpain\b|fatigue|dysphagia|swallow|speech|\bvoice\b|dysarthria|hypophonia|olfact|\bsmell\b|sweat|adjunct|add-on|adjuvant|levodopa (response|challenge|equivalent)/i,
    support: new RegExp(`${SUPPORT_COMMON}|tai chi|qigong|yoga|\\bdanc|boxing|treadmill|cycling|bicycl|aerobic|resistance training|strength training|cueing|virtual reality|exergam|walking|nordic|aquatic|hydrotherap|massage|acupunct|\\bLSVT\\b|\\bnurs|self[- ]management|education|coaching|smartphone|\\bapp\\b|wearable|telerehab|art therap|cognitive training|cognitive rehabilitation|cognitive[- ]behavio|\\bCBT\\b|counsel|training program|physical activity|fitness`, 'i'),
    inTitle: /parkinson/i,
    likeConditions: /parkinson|\bPD\b|lewy|synucle|neurodegenerat|movement disorder|healthy|dyskines|fluctuat|psychos|hallucin|constipat|orthostatic|hypotension|sleep|depress|anxiety|apathy|cognit|dementia|freezing|gait|fall|drool|sialorr|\bpain\b|fatigue|dysphag|speech|voice|swallow|olfact|REM|aging|elderly|older adult/i,
    background: /^(levodopa|carbidopa|l-dopa|benserazide|sinemet|madopar|stalevo)\b/i,
    // Drug classes whose trials treat symptoms, so a drug trial whose recognised
    // drugs all act on these is symptom management unless its title says it
    // aims at progression (e.g. rasagiline's delayed-start trials).
    symptomaticTargets: new Set([
      'Dopamine replacement', 'Dopamine D2 receptor', 'Dopamine D1/D5 receptors', 'Dopamine and serotonin receptors', 'MAO-B', 'COMT',
      'AADC (dopa decarboxylase)', 'Adenosine A2A receptor', 'NMDA receptor', '5-HT2A receptor', 'Serotonin receptors', 'Muscarinic receptors',
      'Acetylcholinesterase', 'Noradrenaline precursor', 'Monoamine reuptake', 'Serotonin transporter', 'Melatonin receptors', 'Dopamine transporter',
      'mGluR5', 'Histamine H3 receptor', 'Orexin receptors', 'α2-adrenergic receptor', 'Peripheral opioid receptors', 'Chloride channels (gut)',
      'Cannabinoid receptors', 'SV2A', 'Phosphodiesterases (PDE3/4/5/10)', 'Acetylcholine release (botulinum toxin)', 'SNAP-25 (acetylcholine release)',
      'β2-adrenergic receptor', 'Nicotinic receptors', 'Voltage-gated calcium channels (α2δ)', 'GABA-A receptor', 'Opioid receptors',
    ]),
    progressionCue: /progression|disease[- ]modif|neuroprotect|delayed[- ]start|slow(ing)? (the )?(decline|progress)|neurorestor|restorat|prodromal/i,
    // Surgery and brain stimulation treat motor symptoms.
    symptomaticProcedure: /deep brain stimulation|\bDBS\b|focused ultrasound|\bMRgFUS\b|\bFUS\b|thalamotomy|pallidotomy|subthalamotomy|transcranial magnetic|\brTMS\b|\bTMS\b|\btDCS\b|transcranial direct|transcranial alternating|spinal cord stimulation|vagus nerve stimulation|\bVNS\b|neuromodulation|stimulat/i,
    minStudies: 3000,
  },
}

export function diseaseFrom(argv) {
  const id = argv[2] ?? 'als'
  const disease = DISEASES[id]
  if (!disease) throw new Error(`Unknown disease "${id}"; expected one of ${Object.keys(DISEASES).join(', ')}`)
  return disease
}
