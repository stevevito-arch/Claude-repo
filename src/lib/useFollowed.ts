import { useCallback, useEffect, useState } from 'react'

// Followed studies live in this browser only: the site is static, so there is no
// account or server to sync them to. Storage can be unavailable (private
// windows, blocked site data), in which case following still works until reload.
const STORAGE_KEY = 'als-dashboard:followed'

function load(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function save(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Not persisted; the in-memory list still works for this visit.
  }
}

/** NCT IDs the viewer follows, most recently followed first. */
export function useFollowed() {
  const [followed, setFollowed] = useState<string[]>(load)

  // Keep other open tabs of the dashboard in step.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setFollowed(load())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggleFollow = useCallback((id: string) => {
    setFollowed((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]
      save(next)
      return next
    })
  }, [])

  return { followed, toggleFollow }
}
