/**
 * Serializable configuration for the ops-console example.
 *
 * @module @minhlucvan/dsh-plugin-ops-console/config
 */

import schema from '@deepseek-ai/schemastery'

/** Plugin configuration supplied by the profile composition. */
interface Config {
  /** Message the example logs at activation. */
  message?: string
  /**
   * Tool names the policy companion refuses to dispatch.
   *
   * Deliberately configuration rather than a constant: a deployment's idea of a
   * dangerous tool is exactly the thing an operator must be able to change
   * without a code change, and it is what makes the guard seam worth having.
   */
  deniedTools?: string[]
  /** Path every console tool must stay inside; `undefined` disables the check. */
  sandboxRoot?: string
  /** Command name the slash-command companion registers. */
  commandName?: string
  /** Port the Fastify companion binds; `0` takes a free one. */
  port?: number
}

/** Configuration after defaults have been resolved. */
interface ResolvedConfig {
  /** Resolved activation message. */
  message: string
  /** Resolved denied-tool list. */
  deniedTools: string[]
  /** Resolved sandbox root, or `undefined` when containment is off. */
  sandboxRoot: string | undefined
  /** Resolved command name. */
  commandName: string
  /** Resolved bind port. */
  port: number
}

/** Default activation message. */
const DEFAULT_MESSAGE = 'ops-console example loaded'

/** Default command name registered by the command companion. */
const DEFAULT_COMMAND_NAME = 'ops'

/** Default bind port; `0` asks the OS for a free one. */
const DEFAULT_PORT = 0

/**
 * Tools denied by default.
 *
 * This is the example's one opinionated default: a console that can shell out
 * is a console that can delete a repository, so the deployment has to opt _in_
 * to the sharp tools rather than discover it shipped them enabled.
 */
const DEFAULT_DENIED_TOOLS = ['bash', 'write']

/** Loader-visible configuration schema and defaults. */
const Config: schema<Config> = schema.object({
  message: schema.string().default(DEFAULT_MESSAGE),
  deniedTools: schema.array(schema.string()).default([...DEFAULT_DENIED_TOOLS]),
  sandboxRoot: schema.string(),
  commandName: schema.string().default(DEFAULT_COMMAND_NAME),
  port: schema.natural().default(DEFAULT_PORT),
})

/**
 * Resolve the same defaults for direct callers that bypass Cordis Loader.
 *
 * @param config - Partial serialized configuration.
 * @returns Configuration with every default applied.
 */
function resolveConfig(config: Config = {}): ResolvedConfig {
  return {
    message: config.message ?? DEFAULT_MESSAGE,
    deniedTools: config.deniedTools ?? [...DEFAULT_DENIED_TOOLS],
    sandboxRoot: config.sandboxRoot,
    commandName: config.commandName ?? DEFAULT_COMMAND_NAME,
    port: config.port ?? DEFAULT_PORT,
  }
}

export {
  Config,
  DEFAULT_COMMAND_NAME,
  DEFAULT_DENIED_TOOLS,
  DEFAULT_MESSAGE,
  DEFAULT_PORT,
  resolveConfig,
  type ResolvedConfig,
}
