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
}

export interface RegistrySnapshot {
  generatedAt: string
  source: string
  studies: RegistryStudy[]
}
