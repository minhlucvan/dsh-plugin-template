/**
 * Client-face tests.
 *
 * Two behaviours are worth regressing here, and one is not obvious.
 *
 * Normalization is the boundary that lets the page assume a valid snapshot: a
 * missing, legacy or wrongly-typed stored value must resolve to a default
 * rather than reach the form.
 *
 * The receiver binding is the subtle one. The host's settings scope is an
 * object whose methods read their own state through `this`, and React invokes
 * callbacks it is given as bare functions — so passing `scope.getSnapshot`
 * straight to `useSyncExternalStore` throws during render, and a section that
 * throws while rendering abdicates instead of showing an error. The test uses a
 * class, whose methods live on the prototype and therefore keep their receiver
 * only if the wrapper actually calls them on the scope.
 */
import { describe, expect, it } from 'vitest'

import { LOCALE_NAMESPACE, locales } from '#src/client/locale'
import type { ClientSettings } from '#src/client/settings'
import {
  defaultSettings,
  normalizeSettings,
  settingsScopeSource,
} from '#src/client/settings'

const TEST_TIMEOUT = 5000
const MAX_MESSAGE_LENGTH = 200
const OVERLONG_BY = 50

/** Zero, named to keep it out of the magic-number rule. */
const NO_KEYS = 0

/**
 * The `null` literal without writing it.
 *
 * `unicorn/no-null` bans the literal everywhere, including as an argument, and
 * `null` is the case worth testing most: `typeof null === 'object'`, so a guard
 * that checks only the type lets it through.
 */
const NULL_VALUE: unknown = JSON.parse('null')

/** A scope shaped like the host's: methods on the prototype, state on `this`. */
class ClassShapedScope {
  private value: ClientSettings = { message: 'from the host' }

  private listeners: (() => void)[] = []

  public getSnapshot(): ClientSettings {
    return this.value
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(
        (candidate) => candidate !== listener,
      )
    }
  }

  public mutate(next: ClientSettings): void {
    this.value = next
    for (const listener of this.listeners) {
      listener()
    }
  }
}

function testNormalizesMalformedValues(): void {
  expect.hasAssertions()
  expect(normalizeSettings()).toStrictEqual(defaultSettings)
  expect(normalizeSettings(NULL_VALUE)).toStrictEqual(defaultSettings)
  expect(normalizeSettings('a string')).toStrictEqual(defaultSettings)
}

function testNormalizesMissingFieldsAndBlanks(): void {
  expect.hasAssertions()
  expect(normalizeSettings({})).toStrictEqual(defaultSettings)
  expect(normalizeSettings({ message: 42 })).toStrictEqual(defaultSettings)
  expect(normalizeSettings({ message: '   ' })).toStrictEqual(defaultSettings)
}

function testNormalizesAValidValue(): void {
  expect.hasAssertions()
  expect(normalizeSettings({ message: '  hello  ' })).toStrictEqual({
    message: 'hello',
  })
}

function testTruncatesAnOverlongMessage(): void {
  expect.hasAssertions()
  const long = 'x'.repeat(MAX_MESSAGE_LENGTH + OVERLONG_BY)
  const normalized = normalizeSettings({ message: long })
  expect(normalized.message).toHaveLength(MAX_MESSAGE_LENGTH)
}

function testReturnsAFreshObjectForDefaults(): void {
  expect.hasAssertions()
  /*
   * A shared default object would let one caller's edit leak into the next
   * caller's snapshot, which is the sort of aliasing bug that only shows up as
   * one feature's setting appearing in another's.
   */
  const first = normalizeSettings()
  first.message = 'mutated'
  expect(normalizeSettings().message).toBe(defaultSettings.message)
}

function testScopeSourceKeepsTheReceiver(): void {
  expect.hasAssertions()
  const scope = new ClassShapedScope()
  const source = settingsScopeSource(scope)
  /*
   * Detaching either method would throw "Cannot read properties of undefined"
   * here, which is exactly the render-time failure this wrapper exists to stop.
   */
  expect(source.getSnapshot().message).toBe('from the host')

  /*
   * Assert the value the subscriber receives rather than that "something
   * happened": it proves the notification carried the new snapshot, and it
   * avoids a boolean matcher that two enabled vitest rules disagree about.
   */
  const received: string[] = []
  const unsubscribe = source.subscribe(() => {
    received.push(source.getSnapshot().message)
  })
  scope.mutate({ message: 'changed' })
  expect(received).toStrictEqual(['changed'])
  expect(source.getSnapshot().message).toBe('changed')
  unsubscribe()
}

function testLocaleDictionariesShareOneKeySet(): void {
  expect.hasAssertions()
  expect(LOCALE_NAMESPACE).toBe('plugin-template')

  const reference = Object.keys(locales.en ?? {}).toSorted()
  expect(reference.length).toBeGreaterThan(NO_KEYS)
  for (const [language, dictionary] of Object.entries(locales)) {
    expect(
      Object.keys(dictionary).toSorted(),
      `language ${language}`,
    ).toStrictEqual(reference)
  }
}

function testEveryLocaleStringIsNonEmpty(): void {
  expect.hasAssertions()
  for (const dictionary of Object.values(locales)) {
    for (const [key, value] of Object.entries(dictionary)) {
      expect(value.trim(), `key ${key}`).not.toBe('')
    }
  }
}

describe('client face', () => {
  it(
    'normalizes an omitted, null or wrongly-typed value to the default',
    { timeout: TEST_TIMEOUT },
    testNormalizesMalformedValues,
  )

  it(
    'normalizes missing fields and blank messages to the default',
    { timeout: TEST_TIMEOUT },
    testNormalizesMissingFieldsAndBlanks,
  )

  it(
    'normalizes a valid value',
    { timeout: TEST_TIMEOUT },
    testNormalizesAValidValue,
  )

  it(
    'truncates a message beyond the stored limit',
    { timeout: TEST_TIMEOUT },
    testTruncatesAnOverlongMessage,
  )

  it(
    'hands out a fresh object rather than a shared default',
    { timeout: TEST_TIMEOUT },
    testReturnsAFreshObjectForDefaults,
  )

  it(
    'wraps a class-shaped scope without losing its receiver',
    { timeout: TEST_TIMEOUT },
    testScopeSourceKeepsTheReceiver,
  )

  it(
    'keeps every locale dictionary on the reference key set',
    { timeout: TEST_TIMEOUT },
    testLocaleDictionariesShareOneKeySet,
  )

  it(
    'leaves no locale string empty',
    { timeout: TEST_TIMEOUT },
    testEveryLocaleStringIsNonEmpty,
  )
})
