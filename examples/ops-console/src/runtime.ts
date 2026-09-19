/**
 * Cordis activation for the ops-console example.
 *
 * The core plugin does one thing the model can observe — it reports that it
 * loaded — and then stays out of the way. Everything else is a separate entry,
 * because a plugin whose core imports the tool stack, the browser carrier and
 * the command registry forces every profile to satisfy all of them whether or
 * not it uses them.
 *
 * @module @minhlucvan/dsh-plugin-ops-console/runtime
 */

import type { Context } from '@deepseek-ai/cordis'

import type { Config } from './config.ts'
import { resolveConfig } from './config.ts'

/** Fakeable host boundary used by the plugin's own behavior. */
interface PluginRuntime {
  /** Publish one informational line through the host. */
  info: (line: string) => void
}

/**
 * Build the production runtime adapter from a scoped Cordis context.
 *
 * @param ctx - Scoped plugin context.
 * @returns Host behavior used by the plugin.
 */
function createPluginRuntime(ctx: Context): PluginRuntime {
  return {
    info: (line: string) => {
      ctx.logger.info(line)
    },
  }
}

/**
 * Apply the plugin to its Cordis context.
 *
 * @param ctx - Scoped plugin context; registrations must be owned by its
 *   effects.
 * @param config - Configuration resolved by Cordis from the exported schema.
 */
function apply(ctx: Context, config: Config = {}): void {
  const runtime = createPluginRuntime(ctx)
  const resolved = resolveConfig(config)
  runtime.info(resolved.message)
}

export { apply, createPluginRuntime, type PluginRuntime }
