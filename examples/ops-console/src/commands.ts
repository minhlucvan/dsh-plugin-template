/**
 * Command companion: an operator-facing control.
 *
 * A slash command runs against the receiving agent without being sent to the
 * model, which makes it the right shape for the question this example's policy
 * raises: _what has the guard refused?_ The answer exists only inside the
 * plugin, so an operator needs a way to ask for it directly.
 *
 * The audit service is resolved opportunistically: `./tools` and `./policy` are
 * separate bundle rows, so this companion must work whether or not the policy
 * companion was mounted — reporting "no audit service" is more useful than
 * failing to load.
 *
 * @module @minhlucvan/dsh-plugin-ops-console/commands
 */

import type { Context } from '@deepseek-ai/cordis'

import type { AuditEntry } from './policy.ts'
import { AUDIT_SERVICE } from './policy.ts'

/** Cordis companion plugin name. */
const name = 'ops-console-commands'

/** Service that must exist before a command can be registered. */
const inject = ['commands']

/** A trail with no rows reports that rather than an empty table. */
const NO_ENTRIES = 0

/** Name the audit trail is looked up under, mirrored for the local contract. */
const AUDIT_LOOKUP = AUDIT_SERVICE

/** A command result the dispatching UI renders. */
interface CommandResult {
  /** Discriminant the UI switches on. */
  kind: 'success' | 'error'
  /** Text shown to the operator. */
  text: string
}

/** The slice of the invocation this command reads. */
interface CommandInvocation {
  /** Exact text following the command name. */
  rawInput: string
}

/** One command registration, as the host registry accepts it. */
interface CommandDefinition {
  /** Command name, without the leading slash. */
  name: string
  /** One-line description shown in discovery. */
  description: string
  /** Optional free-form input hint. */
  inputHint?: string
  /** Run the command. */
  run: (invocation: CommandInvocation) => CommandResult | Promise<CommandResult>
}

/** The slice of the command registry this companion calls. */
interface CommandRegistry {
  /** Register one command; the returned disposer unregisters it. */
  register: (definition: CommandDefinition) => () => void
}

/** The slice of the audit service this command reads. */
interface AuditReader {
  /** Most recent entries, newest last. */
  entries: () => readonly AuditEntry[]
  /** How many calls the guard refused. */
  denials: () => number
}

function isCommandRegistry(value: unknown): value is CommandRegistry {
  if (typeof value !== 'object' || value === null || !('register' in value)) {
    return false
  }
  return typeof value.register === 'function'
}

/**
 * Whether a looked-up value is the audit service.
 *
 * @param value - Result of the named service lookup.
 * @returns True when the value implements the read side.
 */
function isAuditReader(value: unknown): value is AuditReader {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  if (!('entries' in value) || !('denials' in value)) {
    return false
  }
  return (
    typeof value.entries === 'function' && typeof value.denials === 'function'
  )
}

/**
 * Format the audit trail for a human reader.
 *
 * @param entries - Recorded calls, newest last.
 * @param denials - Count of refused calls.
 * @returns A short report, one line per call.
 */
function report(entries: readonly AuditEntry[], denials: number): string {
  if (entries.length === NO_ENTRIES) {
    return 'No tool calls recorded yet.'
  }
  const lines = entries.map((entry) => {
    if (entry.denied) {
      return `denied  ${entry.tool} — ${entry.reason ?? 'no reason'}`
    }
    return `allowed ${entry.tool}`
  })
  return [
    `${String(denials)} of ${String(entries.length)} denied`,
    ...lines,
  ].join('\n')
}

/**
 * Register the example's slash command.
 *
 * @param ctx - Cordis context carrying the command registry.
 * @returns Nothing; the registration is owned by the fiber.
 */
function apply(ctx: Context): void {
  const registry = ctx.get('commands')
  if (!isCommandRegistry(registry)) {
    throw new Error(
      'ops-console command companion requires the "commands" service',
    )
  }

  ctx.effect(
    () =>
      registry.register({
        name: 'ops',
        description: 'Show what the ops-console policy has allowed and denied.',
        inputHint: '(no input)',
        run: (invocation): CommandResult => {
          const audit: unknown = ctx.get(AUDIT_LOOKUP)
          if (!isAuditReader(audit)) {
            return {
              kind: 'error',
              text: 'ops-console policy is not loaded, so there is no audit trail.',
            }
          }
          const trimmed = invocation.rawInput.trim()
          let suffix = ''
          if (trimmed !== '') {
            suffix = ` (input ignored: ${trimmed})`
          }
          return {
            kind: 'success',
            text: report(audit.entries(), audit.denials()) + suffix,
          }
        },
      }),
    'ops-console: /ops command',
  )
}

export { apply, inject, name, report, type CommandRegistry, type CommandResult }
