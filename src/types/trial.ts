export type TrialPhase = 'Phase 1' | 'Phase 1/2' | 'Phase 2' | 'Phase 2/3' | 'Phase 3' | 'Phase 3b'

export type Modality =
  | 'Antisense oligonucleotide'
  | 'Cell therapy'
  | 'Small molecule'
  | 'Monoclonal antibody'
  | 'Gene therapy'
  | 'Peptide'
  | 'Platform trial'

export type TrialStatus = 'Recruiting' | 'Active, not recruiting' | 'Not yet recruiting' | 'Enrolling by invitation'

export interface ResultReadout {
  date: string
  headline: string
  detail: string
  sourceUrl: string
  sourceLabel: string
}

export interface Trial {
  id: string
  nctId: string | null
  name: string
  shortName: string
  sponsor: string
  modality: Modality
  target: string
  phase: TrialPhase
  status: TrialStatus
  population: string
  background: string
  preclinical: string
  design: string
  primaryEndpoint: string
  enrollmentTarget: number | null
  startDate: string | null
  estimatedPrimaryCompletion: string | null
  estimatedTimeframeNote: string
  results: ResultReadout[]
  isPlatformArm: boolean
  parentPlatform?: string
  sources: { label: string; url: string }[]
  dataAsOf: string
}

export interface ConcludedReadout {
  id: string
  name: string
  sponsor: string
  modality: Modality
  target: string
  outcome: 'Negative / discontinued' | 'Mixed' | 'Positive'
  summary: string
  date: string
  sourceUrl: string
  sourceLabel: string
}

export interface LiveTrialStatus {
  nctId: string
  overallStatus: string
  enrollmentCount: number | null
  lastUpdatePostDate: string | null
  primaryCompletionDate: string | null
  studyUrl: string
}
