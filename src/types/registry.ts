// A drug recognised from scripts/drugs.json.
export interface RegistryDrug {
  /** The name this study uses for the drug. */
  label: string
  /** Other names for it (e.g. the nonproprietary name of a company code). */
  names: string[]
  what: string | null
  targets: string[]
  modality: string
  /** A checked source, or null for standard, widely documented pharmacology. */
  source: string | null
}

// What became of a finished or stopped study (see scripts/outcomes.json).
export interface RegistryOutcome {
  verdict: string
  summary: string | null
  source: string | null
  /** True when researched by hand; false when read off the registry record. */
  curated: boolean
}

// One study from public/data/als-registry.json (see scripts/fetch-registry.mjs).
export interface RegistryStudy {
  id: string
  title: string
  acronym: string | null
  status: string
  whyStopped: string | null
  type: 'INTERVENTIONAL' | 'OBSERVATIONAL' | 'EXPANDED_ACCESS' | string
  phase: string | null
  interventions: string[]
  /** Other names for the interventions: the registry's own plus curated ones. */
  aliases: string[]
  drugs: RegistryDrug[]
  /** All targets of this study's recognised drugs. */
  targets: string[]
  /** Modalities of this study's interventions; "Not yet classified" marks drugs the table doesn't cover. */
  modalities: string[]
  interventionTypes: string[]
  sponsor: string | null
  sponsorClass: string | null
  start: string | null
  primaryCompletion: string | null
  completion: string | null
  enrollment: number | null
  enrollmentActual: boolean
  hasResults: boolean
  countries: string[]
  /** Publications the registry lists as reporting this study's results. */
  publications: { pmid: string; citation: string }[]
  outcome: RegistryOutcome | null
  /**
   * For trials before Phase 3: for each drug tested, the furthest phase any
   * ALS trial of that drug reached (null phase: none beyond this trial).
   */
  laterDevelopment: { drug: string; phase: string | null; id: string | null; start: string | null; status: string | null }[]
  /** What the study is mainly for (see focusOf in scripts/fetch-registry.mjs). */
  focus: string
}

export interface RegistrySnapshot {
  generatedAt: string
  source: string
  studies: RegistryStudy[]
}
