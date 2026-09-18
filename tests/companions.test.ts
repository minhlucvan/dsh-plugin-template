/**
 * Companion tests.
 *
 * Each optional companion is a separate entry with its own injected service, so
 * each is mounted here against a fake of that service. Two things are asserted
 * every time: that the companion registers exactly once, and that disposing the
 * fiber releases it. The second is not ceremony — a registration that survives
 * disposal leaks across reloads, and the failure is invisible until the profile
 * reloads.
 *
 * The tests live apart from `plugin.test.ts` so the core suite stays about the
 * Loader-facing namespace and the companions can grow without crowding it.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'

const TEST_TIMEOUT = 5000
const EXPECTED_SINGLE_CALL = 1
const FIRST_INDEX = 0
const ROUTE_PATH = '/api/plugin-template/info'
const COMMAND_NAME = 'plugin-template'
const SKILL_NAME = 'plugin-template-demo'
const DESCRIPTION_MIN_LENGTH = 80

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

/** The slice of a skill registration these tests read. */
interface RecordedSkill {
  name?: unknown
  description?: unknown
  content?: unknown
}

/**
 * Narrow a recorded skill registration to the shape under test.
 *
 * @param value - The recorded first argument.
 * @returns True when the value carries a description and a body.
 */
function isRecordedSkill(value: unknown): value is RecordedSkill {
  return (
    typeof value === 'object'
    && value !== null
    && 'description' in value
    && 'content' in value
  )
}

async function testRegistersSkillCompanion(): Promise<void> {
  expect.hasAssertions()
  const ctx = new Context()
  const unregister = vi.fn<() => void>()
  const register = vi.fn<(skill: unknown) => () => void>(() => (): void => {
    unregister()
  })
  const removeService = ctx.provide('skills', { register })
  const skills = await import('#src/skills')

  const fiber = await ctx.plugin(skills)
  expect(register).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL)

  const skill: unknown = register.mock.calls[FIRST_INDEX]?.[FIRST_INDEX]
  if (typeof skill !== 'object' || skill === null || !('name' in skill)) {
    throw new TypeError('skill companion did not register a skill')
  }
  expect(skill.name).toBe(SKILL_NAME)

  await fiber.dispose()
  expect(unregister).toHaveBeenCalledTimes(EXPECTED_SINGLE_CALL)
  removeService()
}

async function testSkillCarriesRoutingCopy(): Promise<void> {
  expect.hasAssertions()
  const ctx = new Context()
  const recorded: unknown[] = []
  const register = vi.fn<(skill: unknown) => () => void>(
    (skill: unknown): (() => void) => {
      recorded.push(skill)
      return (): void => {
        // Nothing to release in this fake.
      }
    },
  )
  const removeService = ctx.provide('skills', { register })
  const skills = await import('#src/skills')
  const fiber = await ctx.plugin(skills)

  const skill: unknown = recorded[FIRST_INDEX]
  if (!isRecordedSkill(skill)) {
    throw new TypeError('skill companion did not register a skill body')
  }
  const { description, content } = skill
  if (typeof description !== 'string' || typeof content !== 'string') {
    throw new TypeError(
      'the registered skill has a non-string description or body',
    )
  }

  /*
   * The description is the entire routing decision for a skill, so a title-shaped
   * or empty one is a defect rather than a wording preference. The body must also
   * say something, or loading the skill would be a no-op.
   */
  expect(description.length).toBeGreaterThan(DESCRIPTION_MIN_LENGTH)
  expect(content).toContain('ctx.effect')

  await fiber.dispose()
  removeService()
}

describe('companions', () => {
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

  it(
    'registers the skill companion and disposes it with the fiber',
    { timeout: TEST_TIMEOUT },
    testRegistersSkillCompanion,
  )

  it(
    'publishes a skill with routing copy and a body',
    { timeout: TEST_TIMEOUT },
    testSkillCarriesRoutingCopy,
  )
})
