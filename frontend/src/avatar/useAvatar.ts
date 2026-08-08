/*
 * frontend/src/avatar/useAvatar.ts // the chosen avatar, per browser.
 * There's no field for it on the backend User yet — this stores locally
 * rather than inventing a server endpoint that doesn't exist. Worth moving
 * server-side later so the choice follows the teacher across devices; see
 * docs/memoria.md.
 */

import { useCallback, useState } from 'react'
import { AVATARS, DEFAULT_AVATAR_ID, avatarById } from './catalog'
import type { Avatar } from './catalog'

const STORAGE_KEY = 'incloudy.avatarId'

export interface AvatarState {
  avatar: Avatar
  avatarId: string
  setAvatarId: (id: string) => void
}

export function useAvatar(): AvatarState {
  const [avatarId, setAvatarIdState] = useState<string>(readStoredId)

  const setAvatarId = useCallback((id: string) => {
    if (!AVATARS.some((avatar) => avatar.id === id)) return
    setAvatarIdState(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Private browsing or a locked-down browser. The choice lasts the tab.
    }
  }, [])

  return { avatar: avatarById(avatarId), avatarId, setAvatarId }
}

function readStoredId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored && AVATARS.some((avatar) => avatar.id === stored) ? stored : DEFAULT_AVATAR_ID
  } catch {
    return DEFAULT_AVATAR_ID
  }
}
