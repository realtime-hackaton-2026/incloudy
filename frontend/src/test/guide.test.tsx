/*
 * frontend/src/test/guide.test.tsx // the owl's dismissible tips. The
 * behavior worth protecting is the dismissal — it must survive a remount
 * (a page reload, in practice) and never come back once closed.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OwlTip, TIPS } from '../guide'

describe('OwlTip', () => {
  it('shows the catalog message for its id', () => {
    render(<OwlTip tipId="map-guide" />)
    expect(screen.getByTestId('owl-tip')).toHaveTextContent(TIPS['map-guide'])
  })

  it('disappears once dismissed, and stays gone across a remount', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<OwlTip tipId="map-guide" />)

    await user.click(screen.getByRole('button', { name: /cerrar consejo/i }))
    expect(screen.queryByTestId('owl-tip')).toBeNull()
    unmount()

    render(<OwlTip tipId="map-guide" />)
    expect(screen.queryByTestId('owl-tip')).toBeNull()
  })
})
