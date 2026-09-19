/**
 * Tool companion tests.
 *
 * The companion is mounted against a fake registry and then its tools are
 * actually called, because the parts worth pinning are the ones a
 * registration-count assertion misses: that a tool reads configuration
 * correctly, that it reads the registry at execution time rather than at
 * registration time, and that every registration carries a disposer.
 */
import { describe, expect, it } from 'vitest'

import { DEFAULT_DENIED_TOOLS, resolveConfig } from '#example/config'
import { TOOL_PREFIX, apply, inject, inspect } from '#example/tools'

import { asContext, fakeContext, fakeToolRegistry } from './harness.ts'
import type { RecordedTool } from './harness.ts'

const TEST_TIMEOUT = 5000
const EXPECTED_TOOL_COUNT = 3
const EXPECTED_DISPOSERS = 3
const EXPECTED_VISIBLE_TOOLS = 7
const TWO_TOOLS = 2
const ONE_TOOL = 1

/**
 * Find a registered tool by name.
 *
 * @param tools - Recorded definitions.
 * @param toolName - Name to find.
 * @returns The definition.
 * @throws {Error} When the tool was not registered.
 */
function toolNamed(tools: RecordedTool[], toolName: string): RecordedTool {
  const found = tools.find((tool) => tool.name === toolName)
  if (found === undefined) {
    throw new Error(`tool ${toolName} was not registered`)
  }
  return found
}

function testRegistersItsTools(): void {
  expect.hasAssertions()
  const tools = fakeToolRegistry()
  const ctx = fakeContext({ tools: tools.registry })
  apply(asContext(ctx), {})

  expect(tools.registered).toHaveLength(EXPECTED_TOOL_COUNT)
  expect(tools.registered.map((tool) => tool.name)).toStrictEqual([
    `${TOOL_PREFIX}inspect`,
    `${TOOL_PREFIX}list_tools`,
    `${TOOL_PREFIX}echo`,
  ])
}

function testRequiresTheToolService(): void {
  expect.hasAssertions()
  // A companion that silently does nothing when its service is missing is a
  // plugin that "loads" and has no effect, which is the worse failure.
  expect(() => {
    apply(asContext(fakeContext()), {})
  }).toThrow(/tools/u)
  expect(inject).toStrictEqual(['tools'])
}

async function testDisposalReleasesEveryRegistration(): Promise<void> {
  expect.hasAssertions()
  const tools = fakeToolRegistry()
  const ctx = fakeContext({ tools: tools.registry })
  apply(asContext(ctx), {})
  expect(ctx.disposers).toHaveLength(EXPECTED_DISPOSERS)

  await ctx.dispose()
  expect(tools.unregister).toHaveBeenCalledTimes(EXPECTED_DISPOSERS)
}

async function testInspectReportsConfiguration(): Promise<void> {
  expect.hasAssertions()
  const tools = fakeToolRegistry(['ops_inspect', 'read'])
  const ctx = fakeContext({ tools: tools.registry })
  apply(asContext(ctx), {
    deniedTools: ['bash'],
    sandboxRoot: '/work',
    port: 4321,
  })

  const result = await toolNamed(
    tools.registered,
    `${TOOL_PREFIX}inspect`,
  ).execute({})
  expect(result.message).toBe('ops-console example loaded')
  expect(result.sandboxRoot).toBe('/work')
  expect(result.deniedTools).toBe('bash')
  expect(result.port).toBe('4321')
  // Counted from the registry at execution time, not from configuration.
  expect(result.visibleTools).toBe('2')
}

async function testInspectSpellsOutDisabledContainment(): Promise<void> {
  expect.hasAssertions()
  const tools = fakeToolRegistry()
  const ctx = fakeContext({ tools: tools.registry })
  apply(asContext(ctx), {})

  const result = await toolNamed(
    tools.registered,
    `${TOOL_PREFIX}inspect`,
  ).execute({})
  // A dropped key would be indistinguishable from a tool that forgot the field.
  expect(result.sandboxRoot).toBe('(containment disabled)')
  expect(result.deniedTools).toBe(DEFAULT_DENIED_TOOLS.join(', '))
}

function testInspectIsPure(): void {
  expect.hasAssertions()
  const plain = inspect(resolveConfig({}), EXPECTED_VISIBLE_TOOLS)
  expect(plain.visibleTools).toBe('7')
  expect(plain.message).toBe('ops-console example loaded')
}

async function testListToolsReadsTheRegistryAtExecutionTime(): Promise<void> {
  expect.hasAssertions()
  const tools = fakeToolRegistry([`${TOOL_PREFIX}inspect`])
  const ctx = fakeContext({ tools: tools.registry })
  apply(asContext(ctx), {})
  const list = toolNamed(tools.registered, `${TOOL_PREFIX}list_tools`)

  const first = await list.execute({})
  expect(first.count).toBe(ONE_TOOL)

  /*
   * Another plugin registers between the two calls. A tool that captured the
   * catalog at registration time would still report one; this is the difference
   * between describing the surface that exists and the one the author remembered.
   */
  tools.registry.schemas = (): { name: string; description: string }[] => [
    { name: `${TOOL_PREFIX}inspect`, description: 'x' },
    { name: `${TOOL_PREFIX}echo`, description: 'y' },
    { name: 'read', description: 'z' },
  ]
  const second = await list.execute({})
  expect(second.count).toBe(TWO_TOOLS)
}

async function testEchoProjectsItsArguments(): Promise<void> {
  expect.hasAssertions()
  const tools = fakeToolRegistry()
  const ctx = fakeContext({ tools: tools.registry })
  apply(asContext(ctx), {})
  const echo = toolNamed(tools.registered, `${TOOL_PREFIX}echo`)

  const full: Record<string, unknown> = await echo.execute({
    label: 'hello',
    detail: { note: 'from a test', count: 2 },
    tags: ['a', 'b'],
  })
  expect(full.summary).toBe('hello | note=from a test | tags=a, b')
  const sparse = await echo.execute({ label: 'bare' })
  expect(sparse.summary).toBe('bare | note=(no note) | tags=(none)')
}

function testEchoRenderIsTotal(): void {
  expect.hasAssertions()
  const tools = fakeToolRegistry()
  const ctx = fakeContext({ tools: tools.registry })
  apply(asContext(ctx), {})
  const echo = toolNamed(tools.registered, `${TOOL_PREFIX}echo`)

  // A malformed value must render as text, never throw.
  expect(echo.output.render({}, { summary: 'ok' })[0]?.text).toBe('ok')
  expect(echo.output.render({}, {})[0]?.text).toBe('')
  expect(echo.output.render({}, 'not an object')[0]?.text).toBe('')
}

function testInspectRenderIsTotal(): void {
  expect.hasAssertions()
  const tools = fakeToolRegistry()
  const ctx = fakeContext({ tools: tools.registry })
  apply(asContext(ctx), {})
  const tool = toolNamed(tools.registered, `${TOOL_PREFIX}inspect`)
  const text =
    tool.output.render(
      {},
      {
        message: 'm',
        commandName: 'c',
        port: 1,
        sandboxRoot: 's',
        deniedTools: 'd',
        visibleTools: 3,
      },
    )[0]?.text ?? ''
  expect(text).toContain('message: m')
  // Numbers are rendered rather than rejected.
  expect(text).toContain('port: 1')
  expect(text).toContain('visible tools: 3')
}

describe('ops-console tools', () => {
  it(
    'registers its tools under a shared prefix',
    { timeout: TEST_TIMEOUT },
    testRegistersItsTools,
  )

  it(
    'requires the tool service',
    { timeout: TEST_TIMEOUT },
    testRequiresTheToolService,
  )

  it(
    'releases every registration on disposal',
    { timeout: TEST_TIMEOUT },
    testDisposalReleasesEveryRegistration,
  )

  it(
    'reports the effective configuration',
    { timeout: TEST_TIMEOUT },
    testInspectReportsConfiguration,
  )

  it(
    'spells out disabled containment',
    { timeout: TEST_TIMEOUT },
    testInspectSpellsOutDisabledContainment,
  )

  it('builds its report purely', { timeout: TEST_TIMEOUT }, testInspectIsPure)

  it(
    'reads the registry at execution time',
    { timeout: TEST_TIMEOUT },
    testListToolsReadsTheRegistryAtExecutionTime,
  )

  it(
    'projects its nested arguments',
    { timeout: TEST_TIMEOUT },
    testEchoProjectsItsArguments,
  )

  it(
    'renders malformed output as text',
    { timeout: TEST_TIMEOUT },
    testEchoRenderIsTotal,
  )

  it(
    'renders numeric output as text',
    { timeout: TEST_TIMEOUT },
    testInspectRenderIsTotal,
  )
})
