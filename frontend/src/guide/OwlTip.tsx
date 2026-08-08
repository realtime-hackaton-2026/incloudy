/*
 * frontend/src/guide/OwlTip.tsx // one dismissible tip from the owl.
 * Renders nothing once closed — the caller doesn't need to track that.
 */

import { Owl } from './Owl'
import { TIPS } from './tips'
import type { TipId } from './tips'
import { useDismissedTips } from './useDismissedTips'
import styles from './OwlTip.module.css'

export interface OwlTipProps {
  tipId: TipId
}

export function OwlTip({ tipId }: OwlTipProps) {
  const { isDismissed, dismiss } = useDismissedTips()
  if (isDismissed(tipId)) return null

  return (
    <div className={styles.tip} data-testid="owl-tip" data-tip-id={tipId}>
      <Owl className={styles.icon} />
      <p className={styles.bubble}>{TIPS[tipId]}</p>
      <button
        type="button"
        className={styles.dismiss}
        onClick={() => dismiss(tipId)}
        aria-label="Cerrar consejo"
      >
        ✕
      </button>
    </div>
  )
}
