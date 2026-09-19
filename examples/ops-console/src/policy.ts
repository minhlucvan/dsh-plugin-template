/**
 * Policy companion: enforcement plus an audit trail.
 *
 * Wired through the two interception seams the tool pipeline exposes, so the
 * difference between them is visible in one file:
 *
 * - The guard (`ctx.tools.guard`) enforces and can only deny;
 * - The waterfall (`ctx.on('tools/pre-execute', …)`) observes and delegates.
 *
 * Both are registered through `ctx.effect`, so a reload releases them with the
 * fiber rather than leaving a guard installed against a disposed plugin.
 *
 * @module @minhlucvan/dsh-plugin-ops-console/policy
 */

import type { Context } from '@deepseek-ai/cordis'

import type { Config, ResolvedConfig } from './config.ts'
import { resolveConfig } from './config.ts'
import { decide } from './guard-policy.ts'
import type { ExecutableCall } from './guard-policy.ts'

/** Cordis plugin name. */
const name = 'ops-console-policy'

/** Service that must exist before a policy can be enforced. */
const inject = ['tools']

/** Most recent tool calls the in-memory audit trail retains. */
const AUDIT_LIMIT = 50

/** One recorded tool call. */
interface AuditEntry {
  /** Tool that was called. */
  tool: string
  /** Whether the guard refused it. */
  denied: boolean
  /** The guard's reason, when it refused. */
  reason?: string
}

/** The read side of the audit trail, exposed as a Cordis service. */
interface AuditService {
  /** Most recent entries, newest last. */
  entries: () => readonly AuditEntry[]
  /** Number of calls the guard refused. */
  denials: () => number
}

/** Name the audit trail is provided under, for other plugins to inject. */
const AUDIT_SERVICE = 'opsConsoleAudit'

/**
 * Narrow contract for the piece of `ctx.tools` this companion calls.
 *
 * The guard signature is the host's: a denial reason, or `undefined` to leave
 * the call alone. Declared locally so the example builds without the host's
 * source, exactly as the template's companions do.
 */
interface ToolGuardRegistry {
  guard: (guard: (execution: unknown) => string | undefined) => () => void
}

/**
 * Read the tool registry through a type guard.
 *
 * @param value - Result of the named service lookup.
 * @returns The narrowed registry.
 * @throws {Error} When the service is missing or does not match the contract.
 */
function requireGuardRegistry(value: unknown): ToolGuardRegistry {
  if (typeof value !== 'object' || value === null || !('guard' in value)) {
    throw new Error('ops-console policy requires the "tools" service')
  }
  const { guard } = value
  if (typeof guard !== 'function') {
    throw new TypeError('ops-console policy requires ctx.tools.guard')
  }
  return {
    guard: (candidate) =>
      (guard as (check: typeof candidate) => () => void)(candidate),
  }
}

/**
 * Whether a value is the object shape a tool execution presents.
 *
 * A predicate rather than an assertion: it narrows the value for the caller, so
 * the members are read off a typed object instead of a cast.
 *
 * @param value - Candidate execution.
 * @returns True when the value exposes a string `name`.
 */
function isExecutionLike(
  value: unknown,
): value is { name: string; arguments: unknown } {
  return (
    typeof value === 'object'
    && value !== null
    && 'name' in value
    && typeof value.name === 'string'
  )
}

/**
 * Read the tool name and arguments out of an execution.
 *
 * The guard receives the host's execution object; only these two fields are
 * meaningful to a policy, so they are the only ones read.
 *
 * @param execution - Value the pipeline handed the guard.
 * @returns The call, or `undefined` when it is not shaped like one.
 */
function asCall(execution: unknown): ExecutableCall | undefined {
  if (!isExecutionLike(execution)) {
    return undefined
  }
  return { name: execution.name, arguments: execution.arguments }
}

/**
 * Apply the policy companion.
 *
 * @param ctx - Cordis context carrying the tool service.
 * @param config - Configuration resolved by Cordis from the exported schema.
 * @returns Nothing; every registration is owned by the fiber.
 */
function apply(ctx: Context, config: Config = {}): void {
  const resolved: ResolvedConfig = resolveConfig(config)
  const tools: unknown = ctx.get('tools')
  const registry = requireGuardRegistry(tools)
  const log: AuditEntry[] = []

  const record = (entry: AuditEntry): void => {
    log.push(entry)
    if (log.length > AUDIT_LIMIT) {
      log.shift()
    }
  }

  // Enforcement: monotonic, and unable to be overridden by a later listener.
  ctx.effect(
    () =>
      registry.guard((execution) => {
        const call = asCall(execution)
        if (call === undefined) {
          return
        }
        const reason = decide(call, {
          deniedTools: resolved.deniedTools,
          sandboxRoot: resolved.sandboxRoot,
        })
        if (reason === undefined) {
          return
        }
        record({ tool: call.name, denied: true, reason })
        return reason
      }),
    'ops-console: tool guard',
  )

  // Observation: a waterfall listener that records and delegates. It passes
  // `next()`'s decision along rather than making one of its own, which is what
  // keeps it an observer. A listener that returned `{ kind: 'allow' }` would
  // instead cut the remaining listeners off, so delegation is the contract.
  ctx.effect(
    () =>
      ctx.on('tools/pre-execute', async (execution, next) => {
        const call = asCall(execution)
        if (call !== undefined) {
          record({ tool: call.name, denied: false })
        }
        // Held in a local: the body needs an `await`, and `return await` is
        // itself disallowed, so the decision is awaited then returned.
        const decision = await next()
        return decision
      }),
    'ops-console: pre-execute audit',
  )

  // `provide` rather than `set`: it is the fiber-owned registration, so the
  // Service disappears with the plugin instead of outliving it on the root.
  const audit: AuditService = {
    entries: () => [...log],
    denials: () => log.filter((entry) => entry.denied).length,
  }
  ctx.effect(
    () => ctx.provide(AUDIT_SERVICE, audit),
    'ops-console: audit service',
  )
}

export {
  apply,
  AUDIT_SERVICE,
  inject,
  name,
  type AuditEntry,
  type AuditService,
}
