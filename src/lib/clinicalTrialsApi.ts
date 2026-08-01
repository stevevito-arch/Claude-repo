import type { LiveTrialStatus } from '../types/trial'

const API_BASE = 'https://clinicaltrials.gov/api/v2/studies'
const REQUEST_TIMEOUT_MS = 8000

interface RawStudy {
  protocolSection?: {
    identificationModule?: { nctId?: string }
    statusModule?: {
      overallStatus?: string
      lastUpdatePostDateStruct?: { date?: string }
      primaryCompletionDateStruct?: { date?: string }
    }
    designModule?: { enrollmentInfo?: { count?: number } }
  }
}

interface RawStudiesResponse {
  studies?: RawStudy[]
}

function parseStudy(study: RawStudy): LiveTrialStatus | null {
  const nctId = study.protocolSection?.identificationModule?.nctId
  if (!nctId) return null
  return {
    nctId,
    overallStatus: study.protocolSection?.statusModule?.overallStatus ?? 'Unknown',
    enrollmentCount: study.protocolSection?.designModule?.enrollmentInfo?.count ?? null,
    lastUpdatePostDate: study.protocolSection?.statusModule?.lastUpdatePostDateStruct?.date ?? null,
    primaryCompletionDate: study.protocolSection?.statusModule?.primaryCompletionDateStruct?.date ?? null,
    studyUrl: `https://clinicaltrials.gov/study/${nctId}`,
  }
}

/**
 * Fetches live status for a set of NCT IDs from the public ClinicalTrials.gov API v2.
 * Runs entirely in the browser. If the request fails for any reason (offline,
 * CORS restrictions in a given deployment environment, API changes, etc.) this
 * resolves to an empty map so callers can fall back to the bundled curated data.
 */
export async function fetchLiveTrialStatuses(nctIds: string[]): Promise<Record<string, LiveTrialStatus>> {
  const ids = nctIds.filter((id): id is string => Boolean(id))
  if (ids.length === 0) return {}

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const url = `${API_BASE}?filter.ids=${ids.join(',')}&pageSize=${ids.length}&format=json`
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`ClinicalTrials.gov API responded ${response.status}`)

    const data = (await response.json()) as RawStudiesResponse
    const result: Record<string, LiveTrialStatus> = {}
    for (const study of data.studies ?? []) {
      const parsed = parseStudy(study)
      if (parsed) result[parsed.nctId] = parsed
    }
    return result
  } catch {
    return {}
  } finally {
    clearTimeout(timeout)
  }
}
