/*
 * frontend/src/test/video-modal.test.tsx // the pitch video: nothing loads
 * until asked, and the lightbox escapes whatever transformed box opened it.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VideoTrigger } from '../components/video-modal'

describe('VideoTrigger', () => {
  it('loads no third-party frame until someone opens it', () => {
    render(<VideoTrigger />)
    expect(document.querySelectorAll('iframe')).toHaveLength(0)
  })

  it('opens the privacy-preserving embed on click', async () => {
    const user = userEvent.setup()
    render(<VideoTrigger />)
    await user.click(screen.getByTestId('video-trigger'))

    const iframe = await screen.findByTitle('Cómo funciona incloudy')
    expect(iframe.getAttribute('src')).toContain('youtube-nocookie.com/embed/gvU5rjlymDs')
  })

  /*
   * The regression this guards: rendered in place, the modal's `position:
   * fixed` resolves against the nearest *transformed* ancestor rather than
   * the viewport — and it is opened from the login panel and the tour card,
   * both animated with transforms. It shrank to their width.
   */
  it('renders outside a transformed ancestor, not inside it', async () => {
    const user = userEvent.setup()
    render(
      <div style={{ transform: 'translateX(-50%)', width: 320 }} data-testid="cramped">
        <VideoTrigger />
      </div>,
    )
    await user.click(screen.getByTestId('video-trigger'))

    const modal = await screen.findByTestId('video-modal')
    expect(screen.getByTestId('cramped')).not.toContainElement(modal)
    expect(modal.parentElement).toBe(document.body)
  })

  it('offers a fullscreen toggle that reports its own state', async () => {
    const user = userEvent.setup()
    render(<VideoTrigger />)
    await user.click(screen.getByTestId('video-trigger'))

    const toggle = await screen.findByTestId('video-fullscreen')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(toggle).toHaveAccessibleName(/pantalla completa/i)
  })

  it('survives a browser that refuses fullscreen', async () => {
    const user = userEvent.setup()
    render(<VideoTrigger />)
    await user.click(screen.getByTestId('video-trigger'))

    const frame = (await screen.findByTestId('video-modal')).firstElementChild as HTMLElement
    frame.requestFullscreen = vi.fn(() => Promise.reject(new Error('denied')))

    await user.click(screen.getByTestId('video-fullscreen'))
    // Rejected, not crashed: the video keeps playing at its normal size.
    expect(screen.getByTestId('video-modal')).toBeInTheDocument()
  })

  it('closes on Escape and stops holding the page scroll', async () => {
    const user = userEvent.setup()
    render(<VideoTrigger />)
    await user.click(screen.getByTestId('video-trigger'))
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByTestId('video-modal')).not.toBeInTheDocument()
    })
    expect(document.body.style.overflow).toBe('')
  })
})
