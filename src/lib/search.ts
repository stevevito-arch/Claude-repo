// Text search that treats "TDP-43", "TDP 43" and "tdp43" as the same, and
// matches short terms ("FUS", "MPO") only at the start of a word so they don't
// hit longer words that contain them ("fusion", "infusion").

const GREEK: Record<string, string> = { α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', κ: 'kappa', σ: 'sigma' }

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[αβγδκσ]/g, (c) => GREEK[c])
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    // Split letters from digits, so "IL6", "IL-6" and "IL 6" all read "il 6".
    .replace(/([a-z])(?=[0-9])|([0-9])(?=[a-z])/g, '$1$2 ')
    .trim()
}

export interface SearchIndex {
  /** Words separated by single spaces, with a space at each end. */
  spaced: string
  /** The same text with no spaces, for spelling variants like "ataxin2" vs "ataxin-2". */
  compact: string
}

interface Term {
  spaced: string
  compact: string
}

// Terms this short only match at the start of a word, and not when a letter
// follows ("sod" finds "SOD1"; "fus" doesn't find "fusion").
const SHORT_TERM = 3

export function buildIndex(parts: ReadonlyArray<string | null | undefined>): SearchIndex {
  const spaced = ` ${normalize(parts.filter(Boolean).join(' '))} `
  return { spaced, compact: spaced.replace(/ /g, '') }
}

export function parseQuery(query: string): Term[] {
  return query
    .split(/\s+/)
    .map(normalize)
    .filter(Boolean)
    .map((spaced) => ({ spaced, compact: spaced.replace(/ /g, '') }))
}

function termMatches(index: SearchIndex, term: Term): boolean {
  if (term.compact.length > SHORT_TERM) {
    return index.spaced.includes(term.spaced) || index.compact.includes(term.compact)
  }
  const needle = ` ${term.spaced}`
  for (let at = index.spaced.indexOf(needle); at !== -1; at = index.spaced.indexOf(needle, at + 1)) {
    if (!/[a-z]/.test(index.spaced.charAt(at + needle.length))) return true
  }
  return false
}

/** True when every term in the query matches. An empty query matches everything. */
export function matchesQuery(index: SearchIndex, terms: Term[]): boolean {
  return terms.every((term) => termMatches(index, term))
}
