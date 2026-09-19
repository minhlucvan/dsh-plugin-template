/**
 * Command companion tests.
 *
 * The command is the operator's only window into state that exists solely
 * inside the plugin, so the cases worth pinning are the ones where that window
 * could lie: reporting success when no audit service is mounted, or dropping
 * rows.
 */
import { describe, expect, it, vi } from 'vitest'

import { apply, inject, report } from '#example/commands'
import { AUDIT_SERVICE } from '#example/policy'

import { asContext, fakeContext } from './harness.ts'

const TEST_TIMEOUT = 5000
const FIRST_INDEX = 0
const EXPECTED_DISPOSERS = 1
const ONE_ROW = 1

/** One audit row as the command reads it. */
interface Row {
  tool: string
  denied: boolean
  reason?: string
}

/** The command definition shape these suites drive. */
interface RecordedCommand {
  name: string
  description: string
  run: (invocation: {
    rawInput: string
  }) => { kind: string; text: string } | Promise<{ kind: string; text: string }>
}

/**
 * Build a registry that keeps the definitions it was given.
 *
 * @returns The registry, the recorded definitions, and a disposer spy.
 */
function fakeCommands(): {
  registry: { register: (definition: RecordedCommand) => () => void }
  registered: RecordedCommand[]
  unregister: ReturnType<typeof vi.fn>
} {
  const registered: RecordedCommand[] = []
  const unregister = vi.fn<() => void>()
  return {
    registered,
    unregister,
    registry: {
      register: (definition) => {
        registered.push(definition)
        return () => {
          unregister()
        }
      },
    },
  }
}

/**
 * An audit service with a fixed trail.
 *
 * @param entries - Rows the trail reports.
 * @returns The read side of the audit service.
 */
function fakeAudit(entries: Row[]): {
  entries: () => readonly Row[]
  denials: () => number
} {
  return {
    entries: () => entries,
    denials: () => entries.filter((entry) => entry.denied).length,
  }
}

function testRequiresTheCommandService(): void {
  expect.hasAssertions()
  expect(() => {
    apply(asContext(fakeContext()))
  }).toThrow(/commands/u)
  expect(inject).toStrictEqual(['commands'])
}

function testRegistersTheCommand(): void {
  expect.hasAssertions()
  const commands = fakeCommands()
  const ctx = fakeContext({ commands: commands.registry })
  apply(asContext(ctx))

  expect(commands.registered).toHaveLength(1)
  expect(commands.registered[FIRST_INDEX]?.name).toBe('ops')
  expect(ctx.disposers).toHaveLength(EXPECTED_DISPOSERS)
}

async function testReportsTheTrail(): Promise<void> {
  expect.hasAssertions()
  const commands = fakeCommands()
  const ctx = fakeContext({
    commands: commands.registry,
    [AUDIT_SERVICE]: fakeAudit([
      { tool: 'read', denied: false },
      {
        tool: 'bash',
        denied: true,
        reason: 'ops-console policy: bash is denied',
      },
    ]),
  })
  apply(asContext(ctx))

  const result = await commands.registered[FIRST_INDEX]?.run({ rawInput: '' })
  expect(result?.kind).toBe('success')
  expect(result?.text).toContain('1 of 2 denied')
  expect(result?.text).toContain('allowed read')
  expect(result?.text).toContain('denied  bash')
}

async function testReportsWhenThePolicyIsAbsent(): Promise<void> {
  expect.hasAssertions()
  const commands = fakeCommands()
  const ctx = fakeContext({ commands: commands.registry })
  apply(asContext(ctx))

  /*
   * Reporting success here would be the worst outcome: the operator would read
   * "no calls recorded" and conclude the policy was idle, when in fact it is not
   * mounted at all.
   */
  const result = await commands.registered[FIRST_INDEX]?.run({ rawInput: '' })
  expect(result?.kind).toBe('error')
  expect(result?.text).toContain('not loaded')
}

async function testIgnoresAndEchoesInput(): Promise<void> {
  expect.hasAssertions()
  const commands = fakeCommands()
  const ctx = fakeContext({
    commands: commands.registry,
    [AUDIT_SERVICE]: fakeAudit([]),
  })
  apply(asContext(ctx))

  const result = await commands.registered[FIRST_INDEX]?.run({
    rawInput: '  extra  ',
  })
  expect(result?.text).toContain('No tool calls recorded yet.')
  // Ignoring input silently would be confusing, so the report says so.
  expect(result?.text).toContain('input ignored: extra')
}

function testReportHandlesAnEmptyTrail(): void {
  expect.hasAssertions()
  expect(report([], 0)).toBe('No tool calls recorded yet.')
  expect(report([{ tool: 'read', denied: false }], 0)).toBe(
    ['0 of 1 denied', 'allowed read'].join('\n'),
  )
  // A denial without a reason must still render: the reason crosses a boundary
  // the reporter does not own.
  expect(report([{ tool: 'bash', denied: true }], ONE_ROW)).toContain(
    'no reason',
  )
}

describe('ops-console command companion', () => {
  it(
    'requires the command service',
    { timeout: TEST_TIMEOUT },
    testRequiresTheCommandService,
  )

  it(
    'registers the /ops command',
    { timeout: TEST_TIMEOUT },
    testRegistersTheCommand,
  )

  it('reports the audit trail', { timeout: TEST_TIMEOUT }, testReportsTheTrail)

  it(
    'reports when the policy is not mounted',
    { timeout: TEST_TIMEOUT },
    testReportsWhenThePolicyIsAbsent,
  )

  it(
    'echoes ignored input',
    { timeout: TEST_TIMEOUT },
    testIgnoresAndEchoesInput,
  )

  it(
    'formats an empty trail',
    { timeout: TEST_TIMEOUT },
    testReportHandlesAnEmptyTrail,
  )
})
