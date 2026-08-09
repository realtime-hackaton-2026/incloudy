/*
 * frontend/src/components/video-modal/VideoModal.tsx // the pitch video, kept
 * behind a click so no screen pays for it until someone asks.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './VideoModal.module.css'

/** The incloudy pitch. */
export const PITCH_VIDEO_ID = 'gvU5rjlymDs'

/*
 * No iframe and no thumbnail until the teacher opens it.
 *
 * An embed on the login screen costs a third-party frame, its scripts and
 * its cookies on first paint — for a video most people will not watch. The
 * trigger is plain markup, so the page stays ours until the click.
 * `youtube-nocookie` is the privacy-preserving host, and `rel=0` keeps the
 * end screen from advertising unrelated channels to a room of teachers.
 */
function embedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`
}

export interface VideoModalProps {
  open: boolean
  onClose: () => void
  videoId?: string
  title?: string
}

export function VideoModal({
  open,
  onClose,
  videoId = PITCH_VIDEO_ID,
  title = 'Cómo funciona incloudy',
}: VideoModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)

  /*
   * The browser owns fullscreen, not us: it can also be left with F11 or the
   * platform's own Escape, so the button follows the document rather than a
   * flag we set when it was clicked.
   */
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === frameRef.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const toggleFullscreen = useCallback(() => {
    const frame = frameRef.current
    if (!frame) return
    if (document.fullscreenElement) {
      void document.exitFullscreen?.()
      return
    }
    // Older Safari and locked-down embeds simply refuse; the modal is still
    // usable at its normal size, so a rejection is not worth surfacing.
    void frame.requestFullscreen?.().catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      // In fullscreen, Escape belongs to the browser: it leaves fullscreen.
      // Closing the modal too would swallow the video in one keystroke.
      if (event.key === 'Escape' && !document.fullscreenElement) onClose()
    }
    document.addEventListener('keydown', onKey)
    // The video is loud and full-width; the page behind must not scroll
    // under it.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  /*
   * Portalled to the body on purpose.
   *
   * A `position: fixed` element is laid out against its nearest transformed
   * ancestor, not the viewport — and this modal is opened from the login
   * panel and the tour card, both of which are animated with transforms.
   * Rendered in place it sized itself to those small boxes.
   */
  return createPortal(
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="video-modal"
      onClick={onClose}
    >
      {/* The backdrop closes; the frame must not close when clicked through. */}
      <div
        ref={frameRef}
        className={`${styles.frame} ${fullscreen ? styles.frameFull : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.frameHead}>
          <span className={styles.frameTitle}>{title}</span>
          <div className={styles.frameActions}>
            <button
              type="button"
              className={styles.expand}
              onClick={toggleFullscreen}
              aria-pressed={fullscreen}
              aria-label={fullscreen ? 'Salir de pantalla completa' : 'Ver en pantalla completa'}
              data-testid="video-fullscreen"
            >
              {fullscreen ? <ShrinkIcon /> : <ExpandIcon />}
            </button>
            <button
              ref={closeRef}
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="Cerrar el vídeo"
            >
              ×
            </button>
          </div>
        </div>
        <div className={styles.player}>
          <iframe
            src={embedUrl(videoId)}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}

export interface VideoTriggerProps {
  label?: string
  className?: string
  videoId?: string
}

/** The link plus the modal it opens, so a caller only drops in one element. */
export function VideoTrigger({
  label = 'Ver cómo funciona · 2 min',
  className,
  videoId,
}: VideoTriggerProps) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      <button
        type="button"
        className={`${styles.trigger} ${className ?? ''}`}
        onClick={() => setOpen(true)}
        data-testid="video-trigger"
      >
        <PlayIcon />
        {label}
      </button>
      <VideoModal open={open} onClose={close} videoId={videoId} />
    </>
  )
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M6 2.6H2.6V6M10 2.6h3.4V6M10 13.4h3.4V10M6 13.4H2.6V10"
        fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ShrinkIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M2.6 6H6V2.6M13.4 6H10V2.6M13.4 10H10v3.4M2.6 10H6v3.4"
        fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6.4 5.2l4.4 2.8-4.4 2.8z" fill="currentColor" />
    </svg>
  )
}
