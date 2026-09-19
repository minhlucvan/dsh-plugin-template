/**
 * Client store tests.
 *
 * The store is vanilla zustand, so these run in plain Node with no DOM and no
 * React. What they pin is the filtering and the defensive decoding: the audit
 * trail arrives from a route in another process, so a malformed row must be
 * dropped rather than rendered.
 */
import { describe, expect, it } from 'vitest'

import {
  createConsoleStore,
  isAuditEntry,
  visible,
} from '#example/client/store'
import type { AuditEntry } from '#example/client/store'

const TEST_TIMEOUT = 5000

/** Two allowed rows and one denied row, oldest first. */
const TRAIL = [
  { tool: 'read', denied: false },
  { tool: 'bash', denied: true, reason: 'denied by policy' },
  { tool: 'ops_echo', denied: false },
]

function testStartsEmpty(): void {
  expect.hasAssertions()
  const store = createConsoleStore()
  expect(store.getState().entries).toStrictEqual([])
  expect(store.getState().available).toBe(false)
  expect(store.getState().filter).toBe('')
  expect(store.getState().deniedOnly).toBe(false)
}

function testReceivesATrail(): void {
  expect.hasAssertions()
  const store = createConsoleStore()
  store.getState().receive({ available: true, entries: TRAIL })
  expect(store.getState().entries).toHaveLength(TRAIL.length)
  expect(store.getState().available).toBe(true)
  expect(store.getState().loading).toBe(false)
  expect(store.getState().error).toBeUndefined()
}

function testDropsMalformedRows(): void {
  expect.hasAssertions()
  const store = createConsoleStore()
  /*
   * The route is another process's data. Trusting it would let one bad row break
   * the table that renders all of them, so unusable rows are discarded instead.
   */
  store.getState().receive({
    available: true,
    entries: [
      { tool: 'read', denied: false },
      { tool: 42, denied: false },
      { tool: 'bash' },
      JSON.parse('null') as unknown,
      { tool: 'grep', denied: true },
    ] as unknown as AuditEntry[],
  })
  expect(store.getState().entries).toStrictEqual([
    { tool: 'read', denied: false },
    { tool: 'grep', denied: true },
  ])
}

function testRecordsAFailure(): void {
  expect.hasAssertions()
  const store = createConsoleStore()
  store.getState().start()
  expect(store.getState().loading).toBe(true)
  store.getState().fail('audit route answered 404')
  expect(store.getState().loading).toBe(false)
  expect(store.getState().error).toBe('audit route answered 404')
}

function testSetsFilterAndDeniedOnly(): void {
  expect.hasAssertions()
  const store = createConsoleStore()
  store.getState().setFilter('bash')
  store.getState().setDeniedOnly(true)
  expect(store.getState().filter).toBe('bash')
  expect(store.getState().deniedOnly).toBe(true)
}

function testOrdersNewestFirst(): void {
  expect.hasAssertions()
  // The trail records oldest first; an operator reading a console wants the
  // Newest event at the top.
  expect(visible(TRAIL, '', false).map((entry) => entry.tool)).toStrictEqual([
    'ops_echo',
    'bash',
    'read',
  ])
}

function testFiltersByToolNameCaseInsensitively(): void {
  expect.hasAssertions()
  expect(visible(TRAIL, 'BAS', false).map((entry) => entry.tool)).toStrictEqual(
    ['bash'],
  )
  expect(
    visible(TRAIL, '  read ', false).map((entry) => entry.tool),
  ).toStrictEqual(['read'])
  expect(visible(TRAIL, 'nothing', false)).toStrictEqual([])
}

function testFiltersDeniedOnly(): void {
  expect.hasAssertions()
  expect(visible(TRAIL, '', true).map((entry) => entry.tool)).toStrictEqual([
    'bash',
  ])
  // Both rules apply together, not one instead of the other.
  expect(visible(TRAIL, 'read', true)).toStrictEqual([])
}

function testValidatesEntries(): void {
  expect.hasAssertions()
  expect(isAuditEntry({ tool: 'read', denied: false })).toBe(true)
  expect(isAuditEntry({ tool: 'read', denied: 'no' })).toBe(false)
  expect(isAuditEntry({ denied: false })).toBe(false)
  // A non-object is the case a type-only guard lets through (`typeof null`).
  expect(isAuditEntry(JSON.parse('null') as unknown)).toBe(false)
}

describe('ops-console client store', () => {
  it('starts empty', { timeout: TEST_TIMEOUT }, testStartsEmpty)

  it('receives a trail', { timeout: TEST_TIMEOUT }, testReceivesATrail)

  it('drops malformed rows', { timeout: TEST_TIMEOUT }, testDropsMalformedRows)

  it('records a fetch failure', { timeout: TEST_TIMEOUT }, testRecordsAFailure)

  it(
    'sets the filter and the denied-only view',
    { timeout: TEST_TIMEOUT },
    testSetsFilterAndDeniedOnly,
  )

  it(
    'orders rows newest first',
    { timeout: TEST_TIMEOUT },
    testOrdersNewestFirst,
  )

  it(
    'filters by tool name',
    { timeout: TEST_TIMEOUT },
    testFiltersByToolNameCaseInsensitively,
  )

  it('filters denied rows', { timeout: TEST_TIMEOUT }, testFiltersDeniedOnly)

  it('validates audit rows', { timeout: TEST_TIMEOUT }, testValidatesEntries)
})
