/**
 * Policy companion tests.
 *
 * The two seams are asserted separately because they fail differently: a guard
 * that stops firing is a security regression, while a waterfall listener that
 * stops delegating is a correctness one. The waterfall case also pins that the
 * listener _delegates_ — returning `next()`'s decision rather than its own —
 * since a listener returning `{ kind: 'allow' }` would short-circuit every
 * later listener while looking identical at a glance.
 */
import { describe, expect, it } from 'vitest'

import { AUDIT_SERVICE, apply, inject } from '#example/policy'

import { asContext, fakeContext, fakeToolRegistry } from './harness.ts'

const TEST_TIMEOUT = 5000
const FIRST_INDEX = 0
const EXPECTED_DISPOSERS = 3
const DENIED_TOOL = 'bash'
const ALLOWED_TOOL = 'read'
const PRE_EXECUTE = 'tools/pre-execute'
const BOUNDED_TRAIL = 50
const RECORDED = 60
const DENIED_HALF = 30

/** The audit service as these suites read it. */
interface AuditShape {
  entries: () => readonly { tool: string; denied: boolean; reason?: string }[]
  denials: () => number
}

/**
 * Read the audit service out of a fake context.
 *
 * @param ctx - The fake context.
 * @returns The audit service.
 * @throws {Error} When the companion did not provide it.
 */
function auditOf(ctx: ReturnType<typeof fakeContext>): AuditShape {
  const service = ctx.services.get(AUDIT_SERVICE)
  if (service === undefined) {
    throw new Error('audit service was not provided')
  }
  return service as AuditShape
}

function testRequiresTheToolService(): void {
  expect.hasAssertions()
  expect(() => {
    apply(asContext(fakeContext()), {})
  }).toThrow(/tools/u)
  expect(inject).toStrictEqual(['tools'])
}

function testRegistersGuardWaterfallAndService(): void {
  expect.hasAssertions()
  const tools = fakeToolRegistry()
  const ctx = fakeContext({ tools: tools.registry })
  apply(asContext(ctx), { deniedTools: [DENIED_TOOL] })

  expect(tools.guards).toHaveLength(1)
  expect(ctx.listeners.get(PRE_EXECUTE)).toHaveLength(1)
  expect(ctx.services.has(AUDIT_SERVICE)).toBe(true)
  expect(ctx.disposers).toHaveLength(EXPECTED_DISPOSERS)
}

async function testDisposalReleasesEverything(): Promise<void> {
  expect.hasAssertions()
  const tools = fakeToolRegistry()
  const ctx = fakeContext({ tools: tools.registry })
  apply(asContext(ctx), {})

  expect(ctx.listeners.get(PRE_EXECUTE)).toHaveLength(1)
  expect(ctx.services.has(AUDIT_SERVICE)).toBe(true)

  await ctx.dispose()

  /*
   * Each effect releases a different kind of registration, so each is asserted
   * for what it owns: the guard disposer is the registry's, the listener is
   * removed by `ctx.on`'s disposer, and the service is withdrawn. One shared
   * call count would pass while two of the three silently leaked.
   */
  // oxlint-disable-next-line vitest/prefer-to-have-been-called-times -- toHaveBeenCalledTimes is what this rule wants, and vitest/prefer-called-once rejects it.
  expect(tools.unregister.mock.calls).toHaveLength(1)
  expect(ctx.listeners.get(PRE_EXECUTE)).toStrictEqual([])
  expect(ctx.services.has(AUDIT_SERVICE)).toBe(false)
}

function testGuardDeniesAConfiguredTool(): void {
  expect.hasAssertions()
  const tools = fakeToolRegistry()
  const ctx = fakeContext({ tools: tools.registry })
  apply(asContext(ctx), { deniedTools: [DENIED_TOOL] })

  const reason = tools.guards[FIRST_INDEX]?.({
    name: DENIED_TOOL,
    arguments: {},
  })
  expect(reason).toContain(DENIED_TOOL)
  expect(auditOf(ctx).denials()).toBe(1)
}

function testGuardAllowsAnUnlistedTool(): void {
  expect.hasAssertions()
  const tools = fakeToolRegistry()
  const ctx = fakeContext({ tools: tools.registry })
  apply(asContext(ctx), { deniedTools: [DENIED_TOOL] })

  expect(
    tools.guards[FIRST_INDEX]?.({ name: ALLOWED_TOOL, arguments: {} }),
  ).toBeUndefined()
  expect(auditOf(ctx).denials()).toBe(0)
}

function testGuardIgnoresMalformedExecutions(): void {
  expect.hasAssertions()
  const tools = fakeToolRegistry()
  const ctx = fakeContext({ tools: tools.registry })
  apply(asContext(ctx), { deniedTools: [DENIED_TOOL] })

  // A guard that threw on an unexpected shape would take the pipeline down.
  expect(tools.guards[FIRST_INDEX]?.({})).toBeUndefined()
  expect(tools.guards[FIRST_INDEX]?.('not an object')).toBeUndefined()
  expect(tools.guards[FIRST_INDEX]?.({ arguments: {} })).toBeUndefined()
}

async function testWaterfallRecordsAndDelegates(): Promise<void> {
  expect.hasAssertions()
  const tools = fakeToolRegistry()
  const ctx = fakeContext({ tools: tools.registry })
  apply(asContext(ctx), {})

  const registered = ctx.listeners.get(PRE_EXECUTE)?.[FIRST_INDEX]
  expect(registered).toBeTypeOf('function')

  const decision = { kind: 'allow' }
  const next = async (): Promise<unknown> => {
    const resolved = await Promise.resolve(decision)
    return resolved
  }
  // Typed here rather than asserted at the call: the fake stores listeners
  // loosely, and this is the one place that knows the waterfall's shape.
  const listener = registered as (
    execution: unknown,
    nextStep: () => Promise<unknown>,
  ) => Promise<unknown>
  const result = await listener({ name: ALLOWED_TOOL, arguments: {} }, next)

  // It must return what `next()` produced: delegating is the contract.
  expect(result).toBe(decision)
  expect(auditOf(ctx).entries()).toStrictEqual([
    { tool: ALLOWED_TOOL, denied: false },
  ])
}

function testAuditIsBoundedAndCountsDenials(): void {
  expect.hasAssertions()
  const tools = fakeToolRegistry()
  const ctx = fakeContext({ tools: tools.registry })
  apply(asContext(ctx), { deniedTools: [DENIED_TOOL] })
  const guard = tools.guards[FIRST_INDEX]

  for (let index = 0; index < RECORDED; index += 1) {
    guard?.({
      name: index % 2 === 0 ? DENIED_TOOL : ALLOWED_TOOL,
      arguments: {},
    })
  }

  const audit = auditOf(ctx)
  // Bounded: the trail is diagnostic, so it must not grow without limit.
  expect(audit.entries().length).toBeLessThanOrEqual(BOUNDED_TRAIL)
  expect(audit.denials()).toBe(DENIED_HALF)
}

describe('ops-console policy companion', () => {
  it(
    'requires the tool service',
    { timeout: TEST_TIMEOUT },
    testRequiresTheToolService,
  )

  it(
    'registers a guard, a waterfall listener and an audit service',
    { timeout: TEST_TIMEOUT },
    testRegistersGuardWaterfallAndService,
  )

  it(
    'releases everything on disposal',
    { timeout: TEST_TIMEOUT },
    testDisposalReleasesEverything,
  )

  it(
    'denies a configured tool',
    { timeout: TEST_TIMEOUT },
    testGuardDeniesAConfiguredTool,
  )

  it(
    'allows a tool that is not listed',
    { timeout: TEST_TIMEOUT },
    testGuardAllowsAnUnlistedTool,
  )

  it(
    'ignores an execution it cannot read',
    { timeout: TEST_TIMEOUT },
    testGuardIgnoresMalformedExecutions,
  )

  it(
    'records and delegates in the waterfall',
    { timeout: TEST_TIMEOUT },
    testWaterfallRecordsAndDelegates,
  )

  it(
    'bounds the audit trail',
    { timeout: TEST_TIMEOUT },
    testAuditIsBoundedAndCountsDenials,
  )
})
