import { useCallback, useEffect, useState } from 'react'
import type { LiveTrialStatus } from '../types/trial'
import { fetchLiveTrialStatuses } from './clinicalTrialsApi'

export type LiveSyncState = 'idle' | 'loading' | 'live' | 'unavailable'

export function useLiveTrialStatuses(nctIds: string[]) {
  const [statuses, setStatuses] = useState<Record<string, LiveTrialStatus>>({})
  const [state, setState] = useState<LiveSyncState>('idle')
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

  const refresh = useCallback(async () => {
    setState('loading')
    const result = await fetchLiveTrialStatuses(nctIds)
    if (Object.keys(result).length > 0) {
      setStatuses(result)
      setState('live')
      setLastSyncedAt(new Date())
    } else {
      setState('unavailable')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nctIds.join(',')])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { statuses, state, lastSyncedAt, refresh }
}
