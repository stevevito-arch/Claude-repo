import type { Modality, TrialPhase, TrialStatus } from '../types/trial'

// Fixed categorical order — never cycled, never reassigned by filter state.
export const MODALITY_COLOR: Record<Modality, string> = {
  'Small molecule': 'var(--cat-blue)',
  'Antisense oligonucleotide': 'var(--cat-orange)',
  'Cell therapy': 'var(--cat-aqua)',
  'Monoclonal antibody': 'var(--cat-yellow)',
  'Gene therapy': 'var(--cat-magenta)',
  Peptide: 'var(--cat-green)',
  'Platform trial': 'var(--cat-violet)',
}

export const MODALITY_ORDER: Modality[] = [
  'Small molecule',
  'Antisense oligonucleotide',
  'Cell therapy',
  'Monoclonal antibody',
  'Gene therapy',
  'Platform trial',
]

// Ordinal sequential ramp: earlier phase = lighter, later phase = darker.
export const PHASE_COLOR: Record<TrialPhase, string> = {
  'Phase 1': 'var(--seq-250)',
  'Phase 1/2': 'var(--seq-350)',
  'Phase 2': 'var(--seq-450)',
  'Phase 2/3': 'var(--seq-550)',
  'Phase 3': 'var(--seq-650)',
  'Phase 3b': 'var(--seq-650)',
}

export const PHASE_ORDER: TrialPhase[] = ['Phase 1', 'Phase 1/2', 'Phase 2', 'Phase 2/3', 'Phase 3', 'Phase 3b']

export const STATUS_ORDER: TrialStatus[] = ['Recruiting', 'Enrolling by invitation', 'Active, not recruiting', 'Not yet recruiting']

export function formatDate(value: string | null): string {
  if (!value) return 'Not yet reported'
  const parts = value.split('-')
  if (parts.length === 1) return parts[0]
  const [year, month] = parts
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthIndex = Number(month) - 1
  if (Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return value
  return `${monthNames[monthIndex]} ${year}`
}

export function formatEnrollment(n: number | null): string {
  return n === null ? 'Not disclosed' : n.toLocaleString()
}
