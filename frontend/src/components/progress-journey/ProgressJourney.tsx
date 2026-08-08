/**
 * Progress as a journey.
 *
 * Deliberately generic over its nodes: the case map feeds it the five
 * stations today, but a case's own checklist could feed it just as well
 * without this component learning anything about either.
 */

import styles from './ProgressJourney.module.css'

export interface JourneyNode {
  id: string
  label: string
}

export interface ProgressJourneyProps {
  nodes: readonly JourneyNode[]
  /** Index of the node the case currently stands on. */
  activeIndex: number
  /** Omit to render read-only: nodes stop being clickable. */
  onSelect?: (id: string) => void
}

export function ProgressJourney({ nodes, activeIndex, onSelect }: ProgressJourneyProps) {
  /*
   * Clamp at the boundary. A caller handing us a stale or garbage index must
   * not produce an impossible bar — an unclamped index of -100 rendered a
   * width of -2000%, which a property test caught. Invalid input is
   * normalised here rather than trusted, and the node markers below use the
   * same clamped value so the bar and the dots can never disagree.
   */
  const safeIndex = Number.isFinite(activeIndex)
    ? Math.min(Math.max(Math.trunc(activeIndex), 0), Math.max(nodes.length - 1, 0))
    : 0
  // The track spans the node centres, which sit at 10% and 90% of the row —
  // so a full journey fills 80% of the width, not 100%.
  const span = nodes.length > 1 ? (safeIndex / (nodes.length - 1)) * 80 : 0

  return (
    <div
      className={styles.journey}
      role="group"
      aria-label={`Aventura ${safeIndex + 1} de ${nodes.length}`}
      data-testid="progress-journey"
      data-active-index={safeIndex}
      data-total={nodes.length}
    >
      <span className={styles.track} aria-hidden="true" />
      <span className={styles.fill} style={{ width: `${span}%` }} aria-hidden="true" />

      {nodes.map((node, index) => {
        const classes = [styles.node]
        if (index < safeIndex) classes.push(styles.reached)
        if (index === safeIndex) classes.push(styles.current)

        const state = index < safeIndex ? 'reached' : index === safeIndex ? 'current' : 'upcoming'

        return (
          <button
            key={node.id}
            type="button"
            className={classes.join(' ')}
            disabled={!onSelect}
            onClick={() => onSelect?.(node.id)}
            aria-current={index === safeIndex ? 'step' : undefined}
            data-state={state}
          >
            <span className={styles.index}>{String(index + 1).padStart(2, '0')}</span>
            <span className={styles.dot} />
            <span className={styles.label}>{node.label}</span>
            {index === safeIndex && <span className={styles.here}>Aquí estás</span>}
          </button>
        )
      })}
    </div>
  )
}
