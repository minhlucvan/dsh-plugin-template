/**
 * Client registration tests.
 *
 * The client entry's whole job is registration, so its tests are about what it
 * registered and what it released. The host services are provided as fakes here
 * because the entry resolves them through narrow local contracts — which is
 * what lets this run without the host's client packages, and what makes the
 * registration observable at all.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'

const TEST_TIMEOUT = 5000
const EXPECTED_SINGLE_CALL = 1
const FIRST_INDEX = 0

/** The snapshot shape the fake scope returns. */
interface FakeSnapshot {
  message: string
}

/** A settings scope as the client's narrow contract sees it. */
interface FakeScope {
  getSnapshot: () => FakeSnapshot
  subscribe: () => () => void
  mutate: () => void
}

/**
 * Whether a recorded slot registration is a descriptor rather than a component.
 *
 * @param value - The recorded first argument.
 * @returns True when the value carries a `name` field.
 */
function isRecordedDescriptor(
  value: unknown,
): value is { name?: unknown; id?: unknown } {
  return typeof value === 'object' && value !== null
}

/** The fake services the client entry requires, plus their call recorders. */
interface Fakes {
  registerLocale: ReturnType<typeof vi.fn>
  unregisterLocale: ReturnType<typeof vi.fn>
  slotInject: ReturnType<typeof vi.fn>
  slotRegister: ReturnType<typeof vi.fn>
  unregisterSlot: ReturnType<typeof vi.fn>
  scopeBind: ReturnType<typeof vi.fn>
}

/**
 * Provide the three host services the client injects.
 *
 * @param ctx - Cordis context to provide into.
 * @returns The recorders, for assertions.
 */
function provideFakes(ctx: Context): Fakes {
  const unregisterLocale = vi.fn<() => void>()
  const unregisterSlot = vi.fn<() => void>()
  const registerLocale = vi.fn<
    (namespace: string, dictionaries: unknown) => () => void
  >((): (() => void) => (): void => {
    unregisterLocale()
  })
  const bind = vi.fn<(namespace: string) => (key: string) => string>(
    (): ((key: string) => string) =>
      (key: string): string =>
        key,
  )
  const slotRegister = vi.fn<(slot: unknown, component: unknown) => () => void>(
    (): (() => void) => (): void => {
      unregisterSlot()
    },
  )
  /*
   * The slot's `inject` calls its callback immediately, as the host does once the
   * slot exists, so registration happens during the mount rather than later.
   */
  const slotInject = vi.fn<(name: string, callback: () => void) => void>(
    (_name: string, callback: () => void): void => {
      callback()
    },
  )
  const scopeBind = vi.fn<(options: { namespace: string }) => FakeScope>(
    (): FakeScope => ({
      getSnapshot: (): { message: string } => ({
        message: 'from the fake host',
      }),
      subscribe: (): (() => void) => (): void => {
        // No notifications are delivered by this fake.
      },
      mutate: (): void => {
        // The fake records nothing; the real scope persists.
      },
    }),
  )

  ctx.provide('locale', { bind, register: registerLocale })
  ctx.provide('slots', { inject: slotInject, register: slotRegister })
  ctx.provide('settingsScope', { bind: scopeBind })

  return {
    registerLocale,
    scopeBind,
    slotInject,
    slotRegister,
    unregisterLocale,
    unregisterSlot,
  }
}

async function testRegistersLocaleAndSlot(): Promise<void> {
  expect.hasAssertions()
  const ctx = new Context()
  const fakes = provideFakes(ctx)
  const client = await import('#src/client/index')

  const fiber = await ctx.plugin(client)

  expect(fakes.registerLocale).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL)
  expect(fakes.scopeBind).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL)
  expect(fakes.slotRegister).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL)
  await fiber.dispose()
}

async function testSeatsInTheSettingsSection(): Promise<void> {
  expect.hasAssertions()
  const ctx = new Context()
  const fakes = provideFakes(ctx)
  const client = await import('#src/client/index')

  const fiber = await ctx.plugin(client)

  expect(fakes.slotInject.mock.calls[FIRST_INDEX]?.[FIRST_INDEX]).toBe(
    'settings.section',
  )

  const recorded: unknown =
    fakes.slotRegister.mock.calls[FIRST_INDEX]?.[FIRST_INDEX]
  if (!isRecordedDescriptor(recorded)) {
    throw new TypeError('the client did not register a slot descriptor')
  }
  expect(recorded.name).toBe('settings.section')
  expect(recorded.id).toBe('plugin-template')
  await fiber.dispose()
}

async function testDisposesEveryRegistration(): Promise<void> {
  expect.hasAssertions()
  const ctx = new Context()
  const fakes = provideFakes(ctx)
  const client = await import('#src/client/index')

  const fiber = await ctx.plugin(client)
  await fiber.dispose()

  expect(fakes.unregisterLocale).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL)
  expect(fakes.unregisterSlot).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL)
}

async function testClientNamespaceThroughLoader(): Promise<void> {
  expect.hasAssertions()
  const client = await import('#src/client/index')
  expect(['default' in client]).toStrictEqual([false])
  expect(client.name).toBe('plugin-template-client')
  expect(client.inject).toStrictEqual(['locale', 'settingsScope', 'slots'])
}

describe('client registration', () => {
  it(
    'registers locale, settings scope and one slot',
    { timeout: TEST_TIMEOUT },
    testRegistersLocaleAndSlot,
  )

  it(
    'seats the page in the settings section',
    { timeout: TEST_TIMEOUT },
    testSeatsInTheSettingsSection,
  )

  it(
    'releases every registration when the fiber is disposed',
    { timeout: TEST_TIMEOUT },
    testDisposesEveryRegistration,
  )

  it(
    'exposes the client plugin namespace with no default export',
    { timeout: TEST_TIMEOUT },
    testClientNamespaceThroughLoader,
  )
})
