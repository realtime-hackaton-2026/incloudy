/*
 * frontend/src/test/a11y-names.test.tsx // every control a teacher can
 * operate needs an accessible name. A placeholder is not one — it vanishes
 * on the first keystroke — and that is exactly how these two regressed.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CaseChat } from '../chat'
import { OwlTip } from '../guide'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('accessible names', () => {
  it('names the assistant input by label, not by placeholder', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse({ respuesta: 'ok' }))))
    render(<CaseChat token="tok" caseId="case-1" />)

    const input = screen.getByLabelText(/pregunta para el asistente/i)
    expect(input).toBeInTheDocument()
    // The placeholder may help sighted users, but it must not be the name.
    expect(input).toHaveAttribute('placeholder')
  })

  it('names the guide dismiss button', () => {
    render(<OwlTip tipId="map-guide" />)
    expect(screen.getByRole('button', { name: /cerrar consejo/i })).toBeInTheDocument()
  })
})
