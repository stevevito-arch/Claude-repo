import { createContext, useContext } from 'react'

// The diseases the dashboard covers. Each has its own registry catalog,
// public/data/<id>-registry.json, built by scripts/fetch-registry.mjs with the
// settings in scripts/diseases.mjs.
export interface Disease {
  id: 'als' | 'pd'
  /** Short name used in running text: "ALS trial", "Parkinson's trial". */
  short: string
  /** Name for headings and the first mention. */
  full: string
  /** Where the dashboard opens for this disease (URL hash, without '#'). */
  hash: string
  /** The default focus: what most of the field means by a treatment for the disease. */
  progressionFocus: string
  /** Whether hand-researched featured trials exist for this disease. */
  hasFeatured: boolean
}

export const DISEASES: Disease[] = [
  {
    id: 'als',
    short: 'ALS',
    full: 'amyotrophic lateral sclerosis (ALS)',
    hash: 'als',
    progressionFocus: 'Slowing ALS progression',
    hasFeatured: true,
  },
  {
    id: 'pd',
    short: "Parkinson's",
    full: "Parkinson's disease",
    hash: 'parkinsons',
    progressionFocus: "Slowing or reversing Parkinson's",
    hasFeatured: false,
  },
]

export const DiseaseContext = createContext<Disease>(DISEASES[0])

export function useDisease(): Disease {
  return useContext(DiseaseContext)
}
