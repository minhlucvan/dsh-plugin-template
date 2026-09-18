/**
 * Optional command companion for `@your-scope/dsh-plugin-template`.
 *
 * A human-invoked slash command runs against the receiving agent without being
 * sent to the model, so it is the right shape for an action the operator wants
 * to trigger directly and see reported back. Like the other companions this one
 * resolves its service through a narrow local contract, so the package builds
 * and tests without the host's command package.
 *
 * @module @your-scope/dsh-plugin-template/commands
 */

import type { Context } from '@deepseek-ai/cordis'

/** A command that completed and wants its text shown to the operator. */
interface CommandSuccess {
  /** Discriminant the dispatching UI switches on. */
  kind: 'success'
  /** Text rendered directly by that UI. */
  text: string
}

/** A command that refused, with the reason the operator needs to see. */
interface CommandFailure {
  /** Discriminant the dispatching UI switches on. */
  kind: 'error'
  /** Why the command could not run. */
  text: string
}

/** What a command handler returns. */
type CommandResult = CommandSuccess | CommandFailure

/** The slice of the invocation this command reads. */
interface CommandInvocation {
  /** Exact text following the command name, including separator whitespace. */
  rawInput: string
}

/** Optional free-form input advertised to capable clients. */
interface CommandInputDescriptor {
  /** Placeholder shown before the user supplies free-form input. */
  hint: string
}

/** One command registration, as the host's registry accepts it. */
interface CommandDefinition {
  /** Lowercase command name without the leading slash. */
  name: string
  /** Human-readable summary used in discovery UI. */
  description: string
  /** Optional input hint. */
  input?: CommandInputDescriptor
  /** Runs the command against the receiving agent. */
  handler: (invocation: CommandInvocation) => CommandResult
}

/**
 * Minimal command-registry contract used without a host source checkout.
 *
 * The host's registry also lists, resolves and scopes commands per agent; a
 * companion that registers one global command needs none of that, and modelling
 * only `register` is what keeps the build independent of the host package.
 */
interface CommandRegistry {
  register: (definition: CommandDefinition) => () => void
}

/** Cordis companion plugin name. */
const name = 'plugin-template-commands'

/** Service required before the companion can register anything. */
const inject = ['commands']

/** The command this template claims, without its leading slash. */
const COMMAND_NAME = 'plugin-template'

/** Placeholder shown while the operator types the command's input. */
const INPUT_HINT = 'text to echo back'

/**
 * Whether a value is a command registry.
 *
 * @param value - Candidate service.
 * @returns True when the value implements the narrow registry contract.
 */
function isCommandRegistry(value: unknown): value is CommandRegistry {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  if (!('register' in value)) {
    return false
  }
  return typeof value.register === 'function'
}

/**
 * Resolve the host's command registry through Cordis's named service lookup.
 *
 * @param ctx - Cordis context carrying the host service.
 * @returns The host command registry.
 * @throws {Error} When the companion is loaded without its host service.
 */
function getCommandRegistry(ctx: Context): CommandRegistry {
  const registry: unknown = ctx.get('commands')
  if (!isCommandRegistry(registry)) {
    throw new Error('command companion requires the "commands" service')
  }
  return registry
}

/**
 * Echo the operator's input back, or refuse when there is none.
 *
 * Both result kinds appear here on purpose. A command that always succeeds
 * teaches a template reader nothing about the failure branch, and an empty
 * invocation is the one case a handler can decide on its own without inventing
 * state it does not own.
 *
 * @param invocation - The settled invocation.
 * @returns A success carrying the echoed text, or an error explaining the
 *   refusal.
 */
function runTemplateCommand(invocation: CommandInvocation): CommandResult {
  const input = invocation.rawInput.trim()
  if (input === '') {
    return {
      kind: 'error',
      text: `/${COMMAND_NAME} needs some input, for example: /${COMMAND_NAME} hello`,
    }
  }
  return { kind: 'success', text: `${COMMAND_NAME}: ${input}` }
}

/**
 * Register this package's slash command on its own Cordis fiber.
 *
 * @param ctx - Cordis context carrying the command service.
 */
function apply(ctx: Context): void {
  const registry = getCommandRegistry(ctx)
  ctx.effect(
    () =>
      registry.register({
        name: COMMAND_NAME,
        description:
          'Echo text back through the host without sending it to the model.',
        input: { hint: INPUT_HINT },
        handler: runTemplateCommand,
      }),
    'commands: registration',
  )
}

export { apply, inject, name }
