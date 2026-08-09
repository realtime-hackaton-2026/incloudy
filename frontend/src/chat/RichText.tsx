/*
 * frontend/src/chat/RichText.tsx // renders the small slice of Markdown the
 * model actually emits (headings, bold, lists, rules) as real elements.
 */

import type { ReactNode } from 'react'
import styles from './RichText.module.css'

/**
 * Splits on `**bold**` only. The model also uses a bare `*` to open list
 * items, so treating a single asterisk as emphasis would eat the bullets —
 * inline emphasis is deliberately not supported.
 */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /\*\*(.+?)\*\*/g
  let last = 0
  let match: RegExpExecArray | null
  let index = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    nodes.push(<strong key={`${keyPrefix}-b${index}`}>{match[1]}</strong>)
    last = match.index + match[0].length
    index += 1
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes.length ? nodes : [text]
}

const BULLET = /^\s*[*-]\s+(.*)$/
const NUMBERED = /^\s*\d+\.\s+(.*)$/
const HEADING = /^\s*(#{1,6})\s+(.*)$/
const RULE = /^\s*-{3,}\s*$/

/**
 * A single pass, line by line. Consecutive list lines are gathered into one
 * `<ul>`/`<ol>` so a list reads as a list rather than as loose paragraphs.
 */
export function RichText({ text }: { text: unknown }) {
  // Portal history can contain legacy or partially retracted records. The
  // caller normally supplies a string, but malformed realtime data must never
  // crash the whole case screen just because Markdown needs to split lines.
  const safeText = typeof text === 'string' ? text : ''
  const lines = safeText.split('\n')
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let paragraph: string[] = []

  function flushList() {
    if (!list) return
    const items = list.items.map((item, i) => <li key={i}>{inline(item, `li${blocks.length}-${i}`)}</li>)
    blocks.push(
      list.ordered ? (
        <ol key={`b${blocks.length}`} className={styles.list}>{items}</ol>
      ) : (
        <ul key={`b${blocks.length}`} className={styles.list}>{items}</ul>
      ),
    )
    list = null
  }

  function flushParagraph() {
    if (!paragraph.length) return
    const joined = paragraph.join(' ')
    blocks.push(
      <p key={`b${blocks.length}`} className={styles.paragraph}>
        {inline(joined, `p${blocks.length}`)}
      </p>,
    )
    paragraph = []
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }

    if (RULE.test(line)) {
      flushParagraph()
      flushList()
      blocks.push(<hr key={`b${blocks.length}`} className={styles.rule} />)
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      flushParagraph()
      flushList()
      blocks.push(
        <p key={`b${blocks.length}`} className={styles.heading}>
          {inline(heading[2], `h${blocks.length}`)}
        </p>,
      )
      continue
    }

    const numbered = NUMBERED.exec(line)
    const bullet = numbered ? null : BULLET.exec(line)
    if (numbered || bullet) {
      flushParagraph()
      const ordered = Boolean(numbered)
      if (list && list.ordered !== ordered) flushList()
      if (!list) list = { ordered, items: [] }
      list.items.push((numbered ?? bullet)![1])
      continue
    }

    flushList()
    paragraph.push(line.trim())
  }

  flushParagraph()
  flushList()

  return <div className={styles.rich}>{blocks}</div>
}
