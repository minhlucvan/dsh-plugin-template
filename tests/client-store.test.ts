/**
 * Settings store tests.
 *
 * These run in plain Node with no DOM and no React: the store is deliberately
 * built on `zustand/vanilla`, so its rules are verifiable without a renderer.
 * The rules worth pinning are the ones a form gets subtly wrong — losing a
 * user's text when the host changes underneath them, or clearing a draft after
 * a failed save.
 */
import { describe, expect, it, vi } from 'vitest'

import type { SettingsScope } from '#src/client/contracts'
import type { ClientSettings } from '#src/client/settings'
import {
  connectSettingsScope,
  createSettingsStore,
  externalUpdate,
} from '#src/client/store'
import type { SettingsState } from '#src/client/store'

const TEST_TIMEOUT = 5000
const EXPECTED_SINGLE_CALL = 1
const FIRST_INDEX = 0
const PERSISTED = 'from the host'
const TYPED = 'typed by the user'

/**
 * A scope that records mutations instead of persisting them.
 *
 * @param options - Initial snapshot and an optional rejection to simulate a
 *   failed write.
 * @returns The fake scope plus its recorders.
 */
function fakeScope(
  options: {
    snapshot?: unknown
    reject?: Error
  } = {},
): {
  scope: SettingsScope<ClientSettings>
  mutate: ReturnType<typeof vi.fn>
  notify: () => void
  unsubscribe: ReturnType<typeof vi.fn>
  setSnapshot: (value: unknown) => void
} {
  let snapshot: unknown = options.snapshot ?? { message: PERSISTED }
  const listeners = new Set<() => void>()
  const unsubscribe = vi.fn<() => void>()
  const mutate = vi.fn<(value: ClientSettings) => Promise<void>>(async () => {
    if (options.reject !== undefined) {
      await Promise.reject(options.reject)
    }
  })

  const scope: SettingsScope<ClientSettings> = {
    // oxlint-disable-next-line no-unsafe-type-assertion -- See fakeScope above.
    getSnapshot: () => snapshot as ClientSettings,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        unsubscribe()
      }
    },
    mutate,
  }

  return {
    scope,
    mutate,
    unsubscribe,
    notify: () => {
      for (const listener of listeners) {
        listener()
      }
    },
    setSnapshot: (value: unknown) => {
      snapshot = value
    },
  }
}

/** A state literal with every field the transitions read. */
function stateWith(overrides: Partial<SettingsState>): SettingsState {
  return {
    persisted: PERSISTED,
    draft: PERSISTED,
    draftOrigin: PERSISTED,
    dirty: false,
    saving: false,
    error: undefined,
    ...overrides,
  }
}

function testCleanStateFollowsTheHost(): void {
  expect.hasAssertions()
  const next = externalUpdate(stateWith({}), 'host moved on')
  expect(next.persisted).toBe('host moved on')
  expect(next.draft).toBe('host moved on')
  expect(next.dirty).toBe(false)
}

function testEditedDraftSurvivesAnExternalChange(): void {
  expect.hasAssertions()
  const edited = stateWith({
    draft: TYPED,
    draftOrigin: PERSISTED,
    dirty: true,
  })
  const next = externalUpdate(edited, 'host moved on')
  // The host's new value is recorded, but the user's text is not discarded.
  expect(next.persisted).toBe('host moved on')
  expect(next.draft).toBe(TYPED)
  expect(next.dirty).toBe(true)
}

function testDraftEqualToPersistedIsNotProtected(): void {
  expect.hasAssertions()
  /*
   * A draft that matches what is persisted is not an edit worth protecting,
   * even if a previous keystroke left `dirty` set — following the host here is
   * what keeps a form from showing stale text after an external change.
   */
  const stale = stateWith({
    draft: PERSISTED,
    draftOrigin: PERSISTED,
    dirty: true,
  })
  const next = externalUpdate(stale, 'host moved on')
  expect(next.draft).toBe('host moved on')
  expect(next.dirty).toBe(false)
}

function testStartsFromTheNormalizedHostSnapshot(): void {
  expect.hasAssertions()
  const store = createSettingsStore(
    fakeScope({ snapshot: { message: '  hello  ' } }).scope,
  )
  expect(store.getState().persisted).toBe('hello')
  expect(store.getState().dirty).toBe(false)
}

function testNormalizesAMalformedSnapshot(): void {
  expect.hasAssertions()
  const store = createSettingsStore(fakeScope({ snapshot: 42 }).scope)
  expect(store.getState().persisted).toBe('DSH plugin template loaded')
}

function testSetDraftMarksDirty(): void {
  expect.hasAssertions()
  const store = createSettingsStore(
    fakeScope({ snapshot: { message: PERSISTED } }).scope,
  )
  store.getState().setDraft(TYPED)
  expect(store.getState().draft).toBe(TYPED)
  expect(store.getState().dirty).toBe(true)
}

function testTypingBackToPersistedClearsDirty(): void {
  expect.hasAssertions()
  const store = createSettingsStore(
    fakeScope({ snapshot: { message: PERSISTED } }).scope,
  )
  store.getState().setDraft(TYPED)
  store.getState().setDraft(PERSISTED)
  expect(store.getState().dirty).toBe(false)
}

async function testSavePersistsTheNormalizedDraft(): Promise<void> {
  expect.hasAssertions()
  const fake = fakeScope({ snapshot: { message: PERSISTED } })
  const store = createSettingsStore(fake.scope)
  store.getState().setDraft('  padded  ')
  await store.getState().save()

  expect(fake.mutate).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL)
  expect(fake.mutate.mock.calls[FIRST_INDEX]?.[FIRST_INDEX]).toStrictEqual({
    message: 'padded',
  })
  expect(store.getState().dirty).toBe(false)
  expect(store.getState().saving).toBe(false)
}

async function testFailedSaveKeepsTheDraftAndRecordsTheReason(): Promise<void> {
  expect.hasAssertions()
  const fake = fakeScope({ reject: new Error('host refused') })
  const store = createSettingsStore(fake.scope)
  store.getState().setDraft(TYPED)
  await store.getState().save()

  /*
   * This is the regression that matters: a failed write must not cost the user
   * the text they typed, and must not pretend the save succeeded.
   */
  expect(store.getState().draft).toBe(TYPED)
  expect(store.getState().dirty).toBe(true)
  expect(store.getState().saving).toBe(false)
  expect(store.getState().error).toBe('host refused')
}

function testResetRestoresThePersistedValue(): void {
  expect.hasAssertions()
  const store = createSettingsStore(
    fakeScope({ snapshot: { message: PERSISTED } }).scope,
  )
  store.getState().setDraft(TYPED)
  store.getState().reset()
  expect(store.getState().draft).toBe(PERSISTED)
  expect(store.getState().dirty).toBe(false)
  expect(store.getState().error).toBeUndefined()
}

function testConnectMirrorsTheHostIntoTheStore(): void {
  expect.hasAssertions()
  const fake = fakeScope({ snapshot: { message: PERSISTED } })
  const store = createSettingsStore(fake.scope)
  const disconnect = connectSettingsScope(store, fake.scope)

  fake.setSnapshot({ message: 'changed on the host' })
  fake.notify()
  expect(store.getState().persisted).toBe('changed on the host')
  expect(store.getState().draft).toBe('changed on the host')

  disconnect()
  expect(fake.unsubscribe).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL)
}

function testConnectNormalizesAHostChange(): void {
  expect.hasAssertions()
  const fake = fakeScope({ snapshot: { message: PERSISTED } })
  const store = createSettingsStore(fake.scope)
  connectSettingsScope(store, fake.scope)

  fake.setSnapshot({ message: '   ' })
  fake.notify()
  expect(store.getState().persisted).toBe('DSH plugin template loaded')
}

function testStoreStopsTrackingAfterDisconnect(): void {
  expect.hasAssertions()
  const fake = fakeScope({ snapshot: { message: PERSISTED } })
  const store = createSettingsStore(fake.scope)
  const disconnect = connectSettingsScope(store, fake.scope)
  disconnect()

  fake.setSnapshot({ message: 'after disconnect' })
  fake.notify()
  expect(store.getState().persisted).toBe(PERSISTED)
}

describe('settings store', () => {
  it(
    'follows the host when the draft is clean',
    { timeout: TEST_TIMEOUT },
    testCleanStateFollowsTheHost,
  )

  it(
    'keeps an edited draft when the host changes',
    { timeout: TEST_TIMEOUT },
    testEditedDraftSurvivesAnExternalChange,
  )

  it(
    'does not protect a draft that matches the persisted value',
    { timeout: TEST_TIMEOUT },
    testDraftEqualToPersistedIsNotProtected,
  )

  it(
    'starts from the normalized host snapshot',
    { timeout: TEST_TIMEOUT },
    testStartsFromTheNormalizedHostSnapshot,
  )

  it(
    'normalizes a malformed snapshot',
    { timeout: TEST_TIMEOUT },
    testNormalizesAMalformedSnapshot,
  )

  it(
    'marks the store dirty on a draft edit',
    { timeout: TEST_TIMEOUT },
    testSetDraftMarksDirty,
  )

  it(
    'clears dirty when the draft returns to the persisted value',
    { timeout: TEST_TIMEOUT },
    testTypingBackToPersistedClearsDirty,
  )

  it(
    'persists the normalized draft on save',
    { timeout: TEST_TIMEOUT },
    testSavePersistsTheNormalizedDraft,
  )

  it(
    'keeps the draft and records the reason when a save fails',
    { timeout: TEST_TIMEOUT },
    testFailedSaveKeepsTheDraftAndRecordsTheReason,
  )

  it(
    'restores the persisted value on reset',
    { timeout: TEST_TIMEOUT },
    testResetRestoresThePersistedValue,
  )

  it(
    'mirrors a host change into the store',
    { timeout: TEST_TIMEOUT },
    testConnectMirrorsTheHostIntoTheStore,
  )

  it(
    'normalizes a host change',
    { timeout: TEST_TIMEOUT },
    testConnectNormalizesAHostChange,
  )

  it(
    'stops tracking the host after unsubscribe',
    { timeout: TEST_TIMEOUT },
    testStoreStopsTrackingAfterDisconnect,
  )
})
