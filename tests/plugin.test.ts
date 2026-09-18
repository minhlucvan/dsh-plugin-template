import LoaderPlugin from '@cordisjs/plugin-loader'
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'

import { createPluginHarness } from './harness.ts'

const TEST_TIMEOUT = 5000
const EXPECTED_SINGLE_CALL = 1
const FIRST_INDEX = 0
const SECOND_INDEX = 1
const PACKAGE_NAME = '@your-scope/dsh-plugin-template'
const ROUTE_PATH = '/api/plugin-template/info'
const COMMAND_NAME = 'plugin-template'

interface PluginExports {
  readonly name: unknown
  readonly inject: unknown
  readonly Config: unknown
  readonly apply: unknown
}

function isPluginExports(value: unknown): value is PluginExports {
  return (
    typeof value === 'object'
    && value !== null
    && 'name' in value
    && 'inject' in value
    && 'Config' in value
    && 'apply' in value
  )
}

function createLoader(): LoaderPlugin {
  const candidate: unknown = Object.create(LoaderPlugin.prototype)
  if (!(candidate instanceof LoaderPlugin)) {
    throw new TypeError('Loader prototype did not produce a Loader instance')
  }
  return candidate
}

function assertPluginExports(unwrapped: unknown, plugin: object): void {
  if (!isPluginExports(unwrapped)) {
    throw new TypeError('Loader did not return plugin exports')
  }
  expect(unwrapped).toBe(plugin)
  expect(unwrapped.name).toBe('plugin-template')
  expect(unwrapped.inject).toStrictEqual([])
  expect(unwrapped.Config).toBeDefined()
  expect(unwrapped.apply).toBeTypeOf('function')
}

async function testPreservesPluginNamespace(): Promise<void> {
  expect.hasAssertions()
  const plugin = await import('#src/index')
  expect(['default' in plugin]).toStrictEqual([false])

  const loader = createLoader()
  const unwrapped: unknown = loader.unwrapExports(plugin)
  assertPluginExports(unwrapped, plugin)
}

async function testAppliesWithSchemaDefaults(): Promise<void> {
  expect.hasAssertions()
  const harness = await createPluginHarness()
  expect(harness.info).toHaveBeenCalledWith('DSH plugin template loaded')
  await harness.dispose()
}

async function testAcceptsCompositionConfiguration(): Promise<void> {
  expect.hasAssertions()
  const harness = await createPluginHarness({ message: 'hello from a profile' })
  expect(harness.info).toHaveBeenCalledWith('hello from a profile')
  await harness.dispose()
}

async function testRegistersInvariantCompanion(): Promise<void> {
  expect.hasAssertions()
  const ctx = new Context()
  const unregister = vi.fn<() => void>()
  const register = vi.fn<
    (packageName: string, installer: unknown) => () => void
  >(() => (): void => {
    unregister()
  })
  const removeService = ctx.provide('invariants', { register })
  const invariant = await import('#src/invariant')

  const fiber = await ctx.plugin(invariant)
  expect(register).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL)
  expect(register.mock.calls[FIRST_INDEX]?.[FIRST_INDEX]).toBe(PACKAGE_NAME)
  expect(register.mock.calls[FIRST_INDEX]?.[SECOND_INDEX]).toBeTypeOf(
    'function',
  )

  await fiber.dispose()
  expect(unregister).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL)
  removeService()
}

function assertToolName(defined: unknown, expected: string): void {
  if (typeof defined !== 'object' || defined === null || !('name' in defined)) {
    throw new TypeError('tool companion did not register a tool definition')
  }
  expect(defined.name).toBe(expected)
}

async function testRegistersToolCompanion(): Promise<void> {
  expect.hasAssertions()
  const ctx = new Context()
  const unregister = vi.fn<() => void>()
  const register = vi.fn<(tool: unknown) => () => void>(() => (): void => {
    unregister()
  })
  const removeService = ctx.provide('tools', { register })
  const tools = await import('#src/tools')

  const fiber = await ctx.plugin(tools)
  expect(register).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL)
  assertToolName(
    register.mock.calls[FIRST_INDEX]?.[FIRST_INDEX],
    'template_echo',
  )

  await fiber.dispose()
  expect(unregister).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL)
  removeService()
}

function assertRoutePath(route: unknown, expected: string): void {
  if (typeof route !== 'object' || route === null || !('path' in route)) {
    throw new TypeError('route companion did not register a route')
  }
  expect(route.path).toBe(expected)
}

async function testRegistersRouteCompanion(): Promise<void> {
  expect.hasAssertions()
  const ctx = new Context()
  const unregister = vi.fn<() => void>()
  const register = vi.fn<(route: unknown) => () => void>(() => (): void => {
    unregister()
  })
  const removeService = ctx.provide('webServer', { register })
  const routes = await import('#src/routes')

  const fiber = await ctx.plugin(routes)
  expect(register).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL)
  assertRoutePath(register.mock.calls[FIRST_INDEX]?.[FIRST_INDEX], ROUTE_PATH)

  await fiber.dispose()
  expect(unregister).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL)
  removeService()
}

/** The slice of a command definition these tests read. */
interface DefinedCommand {
  name?: unknown
  handler?: (invocation: { rawInput: string }) => { kind: string; text: string }
}

/**
 * Narrow a recorded command definition to the shape under test.
 *
 * @param value - The recorded first argument.
 * @returns True when the value carries a handler.
 */
function isDefinedCommand(value: unknown): value is DefinedCommand {
  return typeof value === 'object' && value !== null && 'handler' in value
}

async function testRegistersCommandCompanion(): Promise<void> {
  expect.hasAssertions()
  const ctx = new Context()
  const unregister = vi.fn<() => void>()
  const register = vi.fn<(definition: unknown) => () => void>(
    () => (): void => {
      unregister()
    },
  )
  const removeService = ctx.provide('commands', { register })
  const commands = await import('#src/commands')

  const fiber = await ctx.plugin(commands)
  expect(register).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL)

  const definition: unknown = register.mock.calls[FIRST_INDEX]?.[FIRST_INDEX]
  if (!isDefinedCommand(definition)) {
    throw new TypeError(
      'command companion did not register a command definition',
    )
  }
  expect(definition.name).toBe(COMMAND_NAME)

  await fiber.dispose()
  expect(unregister).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL)
  removeService()
}

async function testCommandHandlerEchoesAndRefuses(): Promise<void> {
  expect.hasAssertions()
  const ctx = new Context()
  const recorded: unknown[] = []
  const register = vi.fn<(definition: unknown) => () => void>(
    (definition: unknown): (() => void) => {
      recorded.push(definition)
      return (): void => {
        // Nothing to release in this fake.
      }
    },
  )
  const removeService = ctx.provide('commands', { register })
  const commands = await import('#src/commands')
  const fiber = await ctx.plugin(commands)

  const definition: unknown = recorded[FIRST_INDEX]
  if (!isDefinedCommand(definition) || definition.handler === undefined) {
    throw new TypeError('command companion did not register a handler')
  }

  /*
   * Both branches: the echo, and the refusal that keeps an empty invocation from
   * silently succeeding.
   */
  expect(definition.handler({ rawInput: '  hello  ' })).toStrictEqual({
    kind: 'success',
    text: `${COMMAND_NAME}: hello`,
  })
  expect(definition.handler({ rawInput: '   ' }).kind).toBe('error')

  await fiber.dispose()
  removeService()
}

describe('@your-scope/dsh-plugin-template', () => {
  it(
    'preserves the function-plugin namespace through Loader unwrapping',
    { timeout: TEST_TIMEOUT },
    testPreservesPluginNamespace,
  )

  it(
    'applies with schema defaults',
    { timeout: TEST_TIMEOUT },
    testAppliesWithSchemaDefaults,
  )

  it(
    'accepts composition configuration',
    { timeout: TEST_TIMEOUT },
    testAcceptsCompositionConfiguration,
  )

  it(
    'registers the invariant companion through its local host contract',
    { timeout: TEST_TIMEOUT },
    testRegistersInvariantCompanion,
  )

  it(
    'registers the tool companion and disposes it with the fiber',
    { timeout: TEST_TIMEOUT },
    testRegistersToolCompanion,
  )

  it(
    'registers the route companion and disposes it with the fiber',
    { timeout: TEST_TIMEOUT },
    testRegistersRouteCompanion,
  )

  it(
    'registers the command companion and disposes it with the fiber',
    { timeout: TEST_TIMEOUT },
    testRegistersCommandCompanion,
  )

  it(
    'echoes command input and refuses an empty invocation',
    { timeout: TEST_TIMEOUT },
    testCommandHandlerEchoesAndRefuses,
  )
})
