/**
 * Loader-facing entry for the ops-console example.
 *
 * Named exports only, and no default export: Cordis Loader unwraps
 * `exports.default ?? exports`, so a stray default would silently discard
 * `inject`, `Config` and `apply`.
 *
 * @module @minhlucvan/dsh-plugin-ops-console
 */

/** Cordis plugin name; keep this stable after publishing. */
const name = 'ops-console'

/** Services that must exist before the plugin is applied. */
const inject: string[] = []

export { Config } from './config.ts'
export type { ResolvedConfig } from './config.ts'
export { apply } from './runtime.ts'
export { inspect } from './tools.ts'
export { inject, name }
