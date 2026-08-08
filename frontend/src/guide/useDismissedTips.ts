/*
 * frontend/src/guide/useDismissedTips.ts // which tips a teacher has already
 * closed, per browser. Same reasoning as avatar/useAvatar.ts: no backend
 * field for this exists, so it's local rather than invented.
 */

import { useCallback, useState } from 'react'

const STORAGE_KEY = 'incloudy.dismissedTips'

export interface DismissedTipsState {
  isDismissed: (id: string) => boolean
  dismiss: (id: string) => void
}

export function useDismissedTips(): DismissedTipsState {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(readStored)

  const dismiss = useCallback((id: string) => {
    setDismissed((current) => {
      if (current.has(id)) return current
      const next = new Set(current)
      next.add(id)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        // Private browsing or a locked-down browser — the dismissal lasts the tab.
      }
      return next
    })
  }, [])

  const isDismissed = useCallback((id: string) => dismissed.has(id), [dismissed])

  return { isDismissed, dismiss }
}

function readStored(): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}
