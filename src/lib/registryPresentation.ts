// Colours, groupings and small formatters shared by the registry catalog and
// the development timeline.

// Ordinal ramp, same tokens as the curated cards: later phase = darker.
export const PHASE_COLOR: Record<string, string> = {
  'Early Phase 1': 'var(--seq-250)',
  'Phase 1': 'var(--seq-250)',
  'Phase 1/2': 'var(--seq-350)',
  'Phase 2': 'var(--seq-450)',
  'Phase 2/3': 'var(--seq-550)',
  'Phase 3': 'var(--seq-650)',
  'Phase 4': 'var(--seq-650)',
}

// The two lightest ramp steps need dark text to stay readable.
export const LIGHT_PHASES = new Set(['Early Phase 1', 'Phase 1', 'Phase 1/2'])
export const DARK_INK = '#0d366b'

export type StatusGroup = 'Ongoing' | 'Completed' | 'Stopped early' | 'Status unknown'
export const STATUS_GROUPS: StatusGroup[] = ['Ongoing', 'Completed', 'Stopped early', 'Status unknown']

export function statusGroup(status: string): StatusGroup {
  if (['COMPLETED', 'ENDED', 'APPROVED_FOR_MARKETING', 'NO_LONGER_AVAILABLE'].includes(status)) return 'Completed'
  if (['TERMINATED', 'WITHDRAWN', 'SUSPENDED'].includes(status)) return 'Stopped early'
  if (status === 'UNKNOWN') return 'Status unknown'
  return 'Ongoing'
}

export const STATUS_GROUP_COLOR: Record<StatusGroup, string> = {
  Ongoing: 'var(--cat-blue)',
  Completed: 'var(--text-secondary)',
  'Stopped early': 'var(--status-critical)',
  'Status unknown': 'var(--text-muted)',
}

// Outcome verdicts (scripts/fetch-registry.mjs, scripts/outcomes.json) grouped
// for the filter, in the order the chips appear.
export const OUTCOME_GROUPS: [string, string[]][] = [
  ['Met primary endpoint', ['Met primary endpoint']],
  ['Missed or no benefit', ['Missed primary endpoint', 'No benefit shown', 'Stopped: no benefit']],
  ['Mixed or inconclusive', ['Mixed results', 'Inconclusive']],
  ['Stopped for safety', ['Stopped: safety']],
  ['Stopped for other reasons', ['Stopped: slow enrollment', 'Stopped: business or funding', 'Stopped: other reason', 'Stopped: reason not given', 'Withdrawn before enrolling', 'Suspended']],
  ['Results available, not summarised', ['Results posted, not yet summarised', 'Publication linked, not yet summarised']],
  ['No results available', ['No results posted', 'No results found']],
  ['Safety, extension or descriptive', ['Safety study', 'Extension or access study', 'Descriptive results', 'Not a treatment study']],
]
export const OUTCOME_GROUP_OF = new Map(OUTCOME_GROUPS.flatMap(([group, verdicts]) => verdicts.map((v) => [v, group] as const)))

export const VERDICT_COLOR: Record<string, string> = {
  'Met primary endpoint': 'var(--status-good)',
  'Missed or no benefit': 'var(--status-critical)',
  'Stopped for safety': 'var(--status-critical)',
  'Mixed or inconclusive': 'var(--cat-orange)',
  'Stopped for other reasons': 'var(--text-secondary)',
}

export function year(date: string | null): string {
  return date ? date.slice(0, 4) : '?'
}
