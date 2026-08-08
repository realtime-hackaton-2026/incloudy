/*
 * frontend/src/test/avatar.test.tsx // the avatar picker and its
 * localStorage persistence — there's no backend field for this yet, so the
 * hook falling back safely (missing storage, a forged/unknown id) matters
 * more here than it would for a server-backed value.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AVATARS, DEFAULT_AVATAR_ID, AvatarPicker, avatarById, useAvatar } from '../avatar'

describe('avatarById', () => {
  it('falls back to the default rather than returning undefined for an unknown id', () => {
    expect(avatarById('not-a-real-avatar').id).toBe(DEFAULT_AVATAR_ID)
  })

  it('resolves every real id to itself', () => {
    for (const avatar of AVATARS) {
      expect(avatarById(avatar.id).id).toBe(avatar.id)
    }
  })
})

describe('useAvatar', () => {
  it('starts on the default avatar with nothing stored', () => {
    const { result } = renderHook(() => useAvatar())
    expect(result.current.avatarId).toBe(DEFAULT_AVATAR_ID)
  })

  it('persists a selection across a fresh mount (a reload, in practice)', () => {
    const { result, unmount } = renderHook(() => useAvatar())
    act(() => result.current.setAvatarId('peruano'))
    expect(result.current.avatarId).toBe('peruano')
    unmount()

    const { result: reloaded } = renderHook(() => useAvatar())
    expect(reloaded.current.avatarId).toBe('peruano')
  })

  it('ignores a forged id instead of adopting it', () => {
    localStorage.setItem('incloudy.avatarId', 'not-a-real-avatar')
    const { result } = renderHook(() => useAvatar())
    expect(result.current.avatarId).toBe(DEFAULT_AVATAR_ID)
  })

  it('rejects setAvatarId called with an unknown id — the caller can only pick from the catalog', () => {
    const { result } = renderHook(() => useAvatar())
    act(() => result.current.setAvatarId('nope'))
    expect(result.current.avatarId).toBe(DEFAULT_AVATAR_ID)
  })
})

describe('AvatarPicker', () => {
  it('marks exactly one avatar as checked, matching the selected id', () => {
    render(<AvatarPicker avatarId="joven" onSelect={() => {}} />)
    const checked = screen.getAllByRole('radio').filter((el) => el.getAttribute('aria-checked') === 'true')
    expect(checked).toHaveLength(1)
    expect(checked[0]).toHaveAccessibleName(/joven/i)
  })

  it('reports the clicked avatar id, not an event object or index', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<AvatarPicker avatarId="gaucho" onSelect={onSelect} />)
    await user.click(screen.getByRole('radio', { name: /moderno/i }))
    expect(onSelect).toHaveBeenCalledWith('moderno')
  })

  it('renders every catalog avatar exactly once', () => {
    render(<AvatarPicker avatarId="gaucho" onSelect={() => {}} />)
    expect(screen.getAllByRole('radio')).toHaveLength(AVATARS.length)
  })
})
