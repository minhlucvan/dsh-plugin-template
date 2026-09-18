/**
 * Client component and hook tests.
 *
 * These render a real React tree, because the layering being verified only
 * exists at render time: the provider creating a per-instance store, the hooks
 * selecting from it through context, and the components reading state with no
 * props threaded through them. A store unit test cannot show that a component
 * outside the provider fails loudly, or that two trees do not share state.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  SettingsStoreProvider,
  useSettingsStore,
} from '#src/client/context.tsx'
import type { SettingsScope } from '#src/client/contracts'
import { useSettings } from '#src/client/hooks'
import type { ClientSettings } from '#src/client/settings'
import { SettingsPage } from '#src/client/settings-page.tsx'

const TEST_TIMEOUT = 5000
const EXPECTED_SINGLE_CALL = 1
const FIRST_INDEX = 0
const SECOND_INDEX = 1
const PERSISTED = 'from the host'
const TYPED = 'typed by the user'

/** A bound translator returning the key, so assertions read the key itself. */
const translate = (key: string): string => key

/**
 * A scope that records mutations instead of persisting them.
 *
 * @param options - Initial snapshot and an optional rejection to simulate a
 *   failed write.
 * @returns The fake scope plus its recorders.
 */
function fakeScope(options: { snapshot?: unknown; reject?: Error } = {}): {
  scope: SettingsScope<ClientSettings>
  mutate: ReturnType<typeof vi.fn>
  setSnapshot: (value: unknown) => void
  notify: () => void
} {
  let snapshot: unknown = options.snapshot ?? { message: PERSISTED }
  const listeners = new Set<() => void>()
  const mutate = vi.fn<(value: ClientSettings) => Promise<void>>(async () => {
    if (options.reject !== undefined) {
      await Promise.reject(options.reject)
    }
  })

  return {
    scope: {
      // oxlint-disable-next-line no-unsafe-type-assertion -- See fakeScope above.
      getSnapshot: () => snapshot as ClientSettings,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
      mutate,
    },
    mutate,
    setSnapshot: (value: unknown) => {
      snapshot = value
    },
    notify: () => {
      for (const listener of listeners) {
        listener()
      }
    },
  }
}

/**
 * Render the real slot-facing page with fake host services.
 *
 * @param scope - The persisted scope to hand the page.
 * @returns The testing-library render result.
 */
function renderPage(
  scope: SettingsScope<ClientSettings>,
): ReturnType<typeof render> {
  return render(<SettingsPage scope={scope} translate={translate} />)
}

/**
 * Read the load-message input.
 *
 * @returns The input element.
 */
function messageInput(): HTMLInputElement {
  return screen.getByLabelText('fieldLabel')
}

/**
 * Read the save button.
 *
 * @returns The save button element.
 */
function saveButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'save' })
}

/** A probe that renders the store's own view of the draft. */
function DraftProbe(): ReactElement {
  const { draft, dirty } = useSettings()
  return <output data-testid='probe'>{`${draft}|${String(dirty)}`}</output>
}

/** A component that reads the store with no provider above it. */
function UnscopedConsumer(): ReactElement {
  const store = useSettingsStore()
  return <output>{store.getState().draft}</output>
}

function testRendersThePersistedValue(): void {
  expect.hasAssertions()
  renderPage(fakeScope({ snapshot: { message: PERSISTED } }).scope)
  expect(messageInput().value).toBe(PERSISTED)
}

function testTypingUpdatesTheFieldAndMarksDirty(): void {
  expect.hasAssertions()
  renderPage(fakeScope({ snapshot: { message: PERSISTED } }).scope)

  // A clean form has nothing to commit, so the control is disabled.
  expect(saveButton().disabled).toBe(true)
  fireEvent.change(messageInput(), { target: { value: TYPED } })
  expect(messageInput().value).toBe(TYPED)
  expect(saveButton().disabled).toBe(false)
}

function testResetRestoresThePersistedValue(): void {
  expect.hasAssertions()
  renderPage(fakeScope({ snapshot: { message: PERSISTED } }).scope)
  fireEvent.change(messageInput(), { target: { value: TYPED } })
  fireEvent.click(screen.getByRole('button', { name: 'reset' }))
  expect(messageInput().value).toBe(PERSISTED)
}

async function testSavePersistsTheTypedValue(): Promise<void> {
  expect.hasAssertions()
  const fake = fakeScope({ snapshot: { message: PERSISTED } })
  renderPage(fake.scope)

  fireEvent.change(messageInput(), { target: { value: TYPED } })
  fireEvent.click(saveButton())

  await waitFor(() => {
    expect(fake.mutate).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL)
  })
  expect(fake.mutate.mock.calls[FIRST_INDEX]?.[FIRST_INDEX]).toStrictEqual({
    message: TYPED,
  })
  // A committed form is clean again, so its control returns to disabled.
  await waitFor(() => {
    expect(saveButton().disabled).toBe(true)
  })
}

async function testFailedSaveKeepsTheDraftAndReports(): Promise<void> {
  expect.hasAssertions()
  const fake = fakeScope({ reject: new Error('host refused') })
  renderPage(fake.scope)

  fireEvent.change(messageInput(), { target: { value: TYPED } })
  fireEvent.click(saveButton())

  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('saveFailed')
  expect(alert.textContent).toContain('host refused')
  // The typed text is still there: a failed write must not cost the user input.
  expect(messageInput().value).toBe(TYPED)
}

function testCleanFormFollowsAHostChange(): void {
  expect.hasAssertions()
  const fake = fakeScope({ snapshot: { message: PERSISTED } })
  renderPage(fake.scope)

  /*
   * A host change arrives outside React's event system, so its re-render is
   * scheduled rather than synchronous. `act` flushes it; without that the
   * assertion reads the DOM before React has committed.
   */
  act(() => {
    fake.setSnapshot({ message: 'changed on the host' })
    fake.notify()
  })
  expect(messageInput().value).toBe('changed on the host')
}

function testEditedFormIgnoresAHostChange(): void {
  expect.hasAssertions()
  const fake = fakeScope({ snapshot: { message: PERSISTED } })
  renderPage(fake.scope)

  fireEvent.change(messageInput(), { target: { value: TYPED } })
  act(() => {
    fake.setSnapshot({ message: 'changed on the host' })
    fake.notify()
  })
  // The edited draft is protected, so the host's value does not replace it.
  expect(messageInput().value).toBe(TYPED)
}

function testTwoProvidersDoNotShareState(): void {
  expect.hasAssertions()
  const first = fakeScope({ snapshot: { message: 'first' } })
  const second = fakeScope({ snapshot: { message: 'second' } })

  render(
    <SettingsStoreProvider scope={first.scope}>
      <DraftProbe />
    </SettingsStoreProvider>,
  )
  render(
    <SettingsStoreProvider scope={second.scope}>
      <DraftProbe />
    </SettingsStoreProvider>,
  )

  const probes = screen.getAllByTestId('probe')
  expect(probes[FIRST_INDEX]?.textContent).toBe('first|false')
  expect(probes[SECOND_INDEX]?.textContent).toBe('second|false')
}

function testHookOutsideProviderFailsLoudly(): void {
  expect.hasAssertions()
  /*
   * The failure must name the cause. Rendering without the provider and getting
   * `undefined` reads as a random render crash; this is the wiring mistake the
   * context exists to catch, so it says so.
   */
  expect(() => render(<UnscopedConsumer />)).toThrow(/SettingsStoreProvider/u)
}

describe('client settings page', () => {
  it(
    'renders the persisted value',
    { timeout: TEST_TIMEOUT },
    testRendersThePersistedValue,
  )

  it(
    'updates the field and enables save on typing',
    { timeout: TEST_TIMEOUT },
    testTypingUpdatesTheFieldAndMarksDirty,
  )

  it(
    'restores the persisted value on reset',
    { timeout: TEST_TIMEOUT },
    testResetRestoresThePersistedValue,
  )

  it(
    'persists the typed value on save',
    { timeout: TEST_TIMEOUT },
    testSavePersistsTheTypedValue,
  )

  it(
    'keeps the draft and reports the reason when a save fails',
    { timeout: TEST_TIMEOUT },
    testFailedSaveKeepsTheDraftAndReports,
  )

  it(
    'follows a host change while clean',
    { timeout: TEST_TIMEOUT },
    testCleanFormFollowsAHostChange,
  )

  it(
    'ignores a host change while edited',
    { timeout: TEST_TIMEOUT },
    testEditedFormIgnoresAHostChange,
  )

  it(
    'scopes one store per provider',
    { timeout: TEST_TIMEOUT },
    testTwoProvidersDoNotShareState,
  )

  it(
    'fails loudly when a hook is used outside the provider',
    { timeout: TEST_TIMEOUT },
    testHookOutsideProviderFailsLoudly,
  )
})
