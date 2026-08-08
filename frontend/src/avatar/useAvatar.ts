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

function storageKey(caseId?: string): string {
  return caseId ? `${STORAGE_KEY}.${caseId}` : STORAGE_KEY
}

export interface AvatarState {
  avatar: Avatar
  avatarId: string
  setAvatarId: (id: string) => void
}

export function saveAvatarId(caseId: string, id: string): void {
  if (!AVATARS.some((avatar) => avatar.id === id)) return
  try {
    localStorage.setItem(storageKey(caseId), id)
  } catch {
    // El caso sigue siendo utilizable aunque el navegador bloquee storage.
  }
}

export function useAvatar(caseId?: string): AvatarState {
  const [avatarId, setAvatarIdState] = useState<string>(() => readAvatarId(caseId))

  const setAvatarId = useCallback((id: string) => {
    if (!AVATARS.some((avatar) => avatar.id === id)) return
    setAvatarIdState(id)
    try {
      localStorage.setItem(storageKey(caseId), id)
    } catch {
      // Private browsing or a locked-down browser. The choice lasts the tab.
    }
  }, [caseId])

  return { avatar: avatarById(avatarId), avatarId, setAvatarId }
}

export function readAvatarId(caseId?: string): string {
  try {
    const stored = localStorage.getItem(storageKey(caseId)) ?? localStorage.getItem(STORAGE_KEY)
    return stored && AVATARS.some((avatar) => avatar.id === stored) ? stored : DEFAULT_AVATAR_ID
  } catch {
    return DEFAULT_AVATAR_ID
  }
}
