/*
 * frontend/src/components/video-modal/VideoModal.tsx // the pitch video, kept
 * behind a click so no screen pays for it until someone asks.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
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

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
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

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="video-modal"
      onClick={onClose}
    >
      {/* The backdrop closes; the frame must not close when clicked through. */}
      <div className={styles.frame} onClick={(event) => event.stopPropagation()}>
        <div className={styles.frameHead}>
          <span className={styles.frameTitle}>{title}</span>
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
    </div>
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

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6.4 5.2l4.4 2.8-4.4 2.8z" fill="currentColor" />
    </svg>
  )
}
