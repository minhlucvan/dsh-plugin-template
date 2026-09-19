/**
 * Policy engine tests.
 *
 * `decide` is pure, so these assert the rules directly — no Cordis context, no
 * scheduler, no agent. What is pinned here is what an operator relies on: a
 * denied tool is refused regardless of its arguments, containment applies only
 * when a sandbox root is configured, and containment is lexical rather than
 * resolved through the filesystem.
 *
 * The companion that installs these rules is covered in
 * `./policy-companion.test.ts`.
 */
import { describe, expect, it } from 'vitest'

import { decide, isContained, stringArg } from '#example/guard-policy'

const TEST_TIMEOUT = 5000

/** A policy with no containment, for the denied-tool cases. */
const OPEN_POLICY = { deniedTools: ['bash', 'write'], sandboxRoot: undefined }

/** A policy containing everything under /work. */
const SANDBOXED = { deniedTools: [] as string[], sandboxRoot: '/work' }

/** Every argument key the engine treats as a filesystem path. */
const PATH_KEYS = ['path', 'file', 'cwd', 'directory']

function testDeniesAConfiguredTool(): void {
  expect.hasAssertions()
  const reason = decide({ name: 'bash', arguments: {} }, OPEN_POLICY)
  expect(reason).toContain('bash')
  expect(reason).toContain('denied')
}

function testDeniesRegardlessOfArguments(): void {
  expect.hasAssertions()
  /*
   * The denied-tool check runs before containment, so a refused tool is refused
   * whatever it was handed. Reversed, a denied tool with an in-sandbox path
   * would slip through.
   */
  const reason = decide(
    { name: 'write', arguments: { path: '/work/safe.txt' } },
    { deniedTools: ['write'], sandboxRoot: '/work' },
  )
  expect(reason).toContain('denied')
}

function testAllowsAnUnlistedTool(): void {
  expect.hasAssertions()
  expect(decide({ name: 'read', arguments: {} }, OPEN_POLICY)).toBeUndefined()
}

function testAllowsAnythingWhenContainmentIsDisabled(): void {
  expect.hasAssertions()
  // An unset root disables containment. It must not behave like an empty root,
  // Which would refuse every path.
  expect(
    decide({ name: 'read', arguments: { path: '/etc/passwd' } }, OPEN_POLICY),
  ).toBeUndefined()
}

function testDeniesAPathOutsideTheRoot(): void {
  expect.hasAssertions()
  const reason = decide(
    { name: 'read', arguments: { path: '/etc/passwd' } },
    SANDBOXED,
  )
  expect(reason).toContain('/etc/passwd')
  expect(reason).toContain('/work')
}

function testAllowsAPathInsideTheRoot(): void {
  expect.hasAssertions()
  expect(
    decide({ name: 'read', arguments: { path: '/work/notes.md' } }, SANDBOXED),
  ).toBeUndefined()
}

function testAllowsTheRootItself(): void {
  expect.hasAssertions()
  expect(
    decide({ name: 'read', arguments: { path: '/work' } }, SANDBOXED),
  ).toBeUndefined()
}

function testDeniesEachPathLikeArgument(): void {
  expect.hasAssertions()
  for (const key of PATH_KEYS) {
    const reason = decide(
      { name: 'read', arguments: { [key]: '/outside' } },
      SANDBOXED,
    )
    expect(reason, `key ${key}`).toBeDefined()
    expect(reason).toContain(key)
  }
}

function testDeniesRelativeTraversal(): void {
  expect.hasAssertions()
  expect(
    decide({ name: 'read', arguments: { file: '../secrets' } }, SANDBOXED),
  ).toBeDefined()
}

function testIgnoresNonPathArguments(): void {
  expect.hasAssertions()
  // `label` is not a path key, so a value that merely looks like one is ignored.
  expect(
    decide({ name: 'echo', arguments: { count: 3, label: '/etc' } }, SANDBOXED),
  ).toBeUndefined()
}

function testContainmentIsLexical(): void {
  expect.hasAssertions()
  expect(isContained('/work/a', '/work')).toBe(true)
  expect(isContained('/work', '/work')).toBe(true)
  // A sibling whose name shares the root's prefix is outside it.
  expect(isContained('/workshop', '/work')).toBe(false)
  expect(isContained('a/b', '/work')).toBe(true)
  expect(isContained('../a', '/work')).toBe(false)
}

function testReadsOnlyNonEmptyStrings(): void {
  expect.hasAssertions()
  expect(stringArg({ path: '/x' }, 'path')).toBe('/x')
  expect(stringArg({ path: '' }, 'path')).toBeUndefined()
  expect(stringArg({ path: 42 }, 'path')).toBeUndefined()
  expect(stringArg('not an object', 'path')).toBeUndefined()
  expect(stringArg({}, 'path')).toBeUndefined()
}

describe('ops-console policy engine', () => {
  it(
    'denies a configured tool',
    { timeout: TEST_TIMEOUT },
    testDeniesAConfiguredTool,
  )

  it(
    'denies a configured tool whatever its arguments',
    { timeout: TEST_TIMEOUT },
    testDeniesRegardlessOfArguments,
  )

  it(
    'allows a tool that is not listed',
    { timeout: TEST_TIMEOUT },
    testAllowsAnUnlistedTool,
  )

  it(
    'allows anything when containment is disabled',
    { timeout: TEST_TIMEOUT },
    testAllowsAnythingWhenContainmentIsDisabled,
  )

  it(
    'denies a path outside the sandbox root',
    { timeout: TEST_TIMEOUT },
    testDeniesAPathOutsideTheRoot,
  )

  it(
    'allows a path inside the sandbox root',
    { timeout: TEST_TIMEOUT },
    testAllowsAPathInsideTheRoot,
  )

  it(
    'allows the sandbox root itself',
    { timeout: TEST_TIMEOUT },
    testAllowsTheRootItself,
  )

  it(
    'denies every path-like argument key',
    { timeout: TEST_TIMEOUT },
    testDeniesEachPathLikeArgument,
  )

  it(
    'denies relative traversal',
    { timeout: TEST_TIMEOUT },
    testDeniesRelativeTraversal,
  )

  it(
    'ignores arguments that are not path-like',
    { timeout: TEST_TIMEOUT },
    testIgnoresNonPathArguments,
  )

  it(
    'treats containment as lexical',
    { timeout: TEST_TIMEOUT },
    testContainmentIsLexical,
  )

  it(
    'reads only non-empty strings',
    { timeout: TEST_TIMEOUT },
    testReadsOnlyNonEmptyStrings,
  )
})
