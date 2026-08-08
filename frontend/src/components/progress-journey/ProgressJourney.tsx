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
  // The track spans the node centres, which sit at 10% and 90% of the row —
  // so a full journey fills 80% of the width, not 100%.
  const span = nodes.length > 1 ? (activeIndex / (nodes.length - 1)) * 80 : 0

  return (
    <div
      className={styles.journey}
      role="group"
      aria-label={`Etapa ${activeIndex + 1} de ${nodes.length}`}
    >
      <span className={styles.track} aria-hidden="true" />
      <span className={styles.fill} style={{ width: `${span}%` }} aria-hidden="true" />

      {nodes.map((node, index) => {
        const classes = [styles.node]
        if (index < activeIndex) classes.push(styles.reached)
        if (index === activeIndex) classes.push(styles.current)

        return (
          <button
            key={node.id}
            type="button"
            className={classes.join(' ')}
            disabled={!onSelect}
            onClick={() => onSelect?.(node.id)}
            aria-current={index === activeIndex ? 'step' : undefined}
          >
            <span className={styles.index}>{String(index + 1).padStart(2, '0')}</span>
            <span className={styles.dot} />
            <span className={styles.label}>{node.label}</span>
            {index === activeIndex && <span className={styles.here}>Estás aquí</span>}
          </button>
        )
      })}
    </div>
  )
}
