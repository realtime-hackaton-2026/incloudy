/*
 * frontend/src/test/richtext.test.tsx // the assistant was printing raw
 * Markdown at the reader (`**Majo**`, `###`, `---`). These lock in that the
 * syntax becomes structure and never reaches the screen as characters.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RichText } from '../chat/RichText'

describe('RichText', () => {
  it('turns **bold** into an element instead of printing the asterisks', () => {
    const { container } = render(<RichText text="el caso de **Majo** avanza" />)
    expect(container.querySelector('strong')).toHaveTextContent('Majo')
    expect(container.textContent).not.toContain('**')
  })

  it('renders a heading as a label, without the hashes', () => {
    const { container } = render(<RichText text="### Resumen del Caso" />)
    expect(screen.getByText('Resumen del Caso')).toBeInTheDocument()
    expect(container.textContent).not.toContain('#')
  })

  it('groups consecutive bullets into one list', () => {
    const { container } = render(
      <RichText text={'* Primera pista\n* Segunda pista\n* Tercera pista'} />,
    )
    const lists = container.querySelectorAll('ul')
    expect(lists).toHaveLength(1)
    expect(lists[0].querySelectorAll('li')).toHaveLength(3)
    expect(container.textContent).not.toContain('*')
  })

  it('keeps numbered steps ordered, and separate from bullets', () => {
    const { container } = render(
      <RichText text={'1. Revisar producciones\n2. Definir estrategia\n\n* Una nota'} />,
    )
    expect(container.querySelectorAll('ol')).toHaveLength(1)
    expect(container.querySelectorAll('ol li')).toHaveLength(2)
    expect(container.querySelectorAll('ul li')).toHaveLength(1)
  })

  it('renders a rule as a divider rather than three dashes', () => {
    const { container } = render(<RichText text={'Antes\n\n---\n\nDespués'} />)
    expect(container.querySelector('hr')).toBeInTheDocument()
    expect(container.textContent).not.toContain('---')
  })

  it('joins a wrapped paragraph into one block, and splits on the blank line', () => {
    const { container } = render(
      <RichText text={'Una frase\nque sigue aquí.\n\nOtro párrafo.'} />,
    )
    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0].textContent).toBe('Una frase que sigue aquí.')
  })

  it('renders plain prose untouched', () => {
    render(<RichText text="Sin formato, solo texto." />)
    expect(screen.getByText('Sin formato, solo texto.')).toBeInTheDocument()
  })

  it('never turns model output into live markup', () => {
    const { container } = render(
      <RichText text={'**Ojo** <img src=x onerror="window.__pwned=1"> fin'} />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined()
    expect(container.textContent).toContain('<img')
  })
})
