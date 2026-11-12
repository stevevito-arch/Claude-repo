// See scripts/drug-aliases.json.
export interface DrugNote {
  codes: string[]
  names: string[]
  what: string
  source: string
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
  /** Curated, sourced descriptions of drugs the registry names only by code. */
  drugNotes: DrugNote[]
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
