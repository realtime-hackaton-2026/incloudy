/*
 * frontend/src/test/room-code.test.tsx // copying the code out and pasting it
 * back in, including when the browser refuses the clipboard.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { CodeChip, CodeInput, normaliseCode } from '../components/room-code'

function stubClipboard(impl: { readText?: () => Promise<string>; writeText?: () => Promise<void> }) {
  // jsdom exposes `clipboard` through a getter only, so it has to be
  // redefined rather than assigned.
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      readText: impl.readText ?? (() => Promise.resolve('')),
      writeText: impl.writeText ?? (() => Promise.resolve()),
    },
  })
}

/*
 * Order matters: `userEvent.setup()` installs its own clipboard stub, so it
 * has to run before ours or it overwrites it.
 */
function setup(impl: Parameters<typeof stubClipboard>[0]) {
  const user = userEvent.setup()
  stubClipboard(impl)
  return user
}

function Harness({ initial = '' }: { initial?: string }) {
  const [code, setCode] = useState(initial)
  return (
    <>
      <CodeInput value={code} onChange={setCode} />
      <span data-testid="value">{code}</span>
    </>
  )
}

describe('normaliseCode', () => {
  it('keeps six alphanumerics, uppercased', () => {
    expect(normaliseCode('  abc-123 ')).toBe('ABC123')
  })

  it('truncates anything longer', () => {
    expect(normaliseCode('ABCDEFGHI')).toBe('ABCDEF')
  })
})

describe('CodeChip', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('copies the code and confirms it', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    const user = setup({ writeText })

    render(<CodeChip code="ABC123" />)
    await user.click(screen.getByTestId('room-code-copy'))

    expect(writeText).toHaveBeenCalledWith('ABC123')
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Código copiado')
    })
  })

  it('says so when the clipboard is refused instead of failing silently', async () => {
    const user = setup({ writeText: () => Promise.reject(new Error('denied')) })

    render(<CodeChip code="ABC123" />)
    await user.click(screen.getByTestId('room-code-copy'))

    await waitFor(() => {
      expect(screen.getByText('Copia el código a mano.')).toBeInTheDocument()
    })
  })
})

describe('CodeInput', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('pastes the clipboard code on right-click', async () => {
    const user = setup({ readText: () => Promise.resolve('xyz789') })

    render(<Harness />)
    await user.pointer({ keys: '[MouseRight]', target: screen.getByTestId('room-code-input') })

    await waitFor(() => {
      expect(screen.getByTestId('value')).toHaveTextContent('XYZ789')
    })
  })

  it('falls back to a Ctrl+V hint when the clipboard is unreadable', async () => {
    const user = setup({ readText: () => Promise.reject(new Error('denied')) })

    render(<Harness />)
    await user.pointer({ keys: '[MouseRight]', target: screen.getByTestId('room-code-input') })

    await waitFor(() => {
      expect(screen.getByText('Pega el código con Ctrl + V.')).toBeInTheDocument()
    })
  })

  it('reports an empty clipboard rather than clearing the field', async () => {
    const user = setup({ readText: () => Promise.resolve('   ') })

    render(<Harness initial="OLD123" />)
    await user.pointer({ keys: '[MouseRight]', target: screen.getByTestId('room-code-input') })

    await waitFor(() => {
      expect(screen.getByText('No hay ningún código en el portapapeles.')).toBeInTheDocument()
    })
    expect(screen.getByTestId('value')).toHaveTextContent('OLD123')
  })
})
