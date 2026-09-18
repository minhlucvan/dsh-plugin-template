/**
 * Optional tool-registration companion for `@your-scope/dsh-plugin-template`.
 * @module @your-scope/dsh-plugin-template/tools
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

/**
 * Minimal registration handle used without a host source checkout. Keeping this
 * narrow local contract mirrors the invariant companion: the package builds and
 * tests against a fakeable boundary, while a composed DSH profile supplies the
 * real `tools` service.
 */
interface ToolRegistry {
  register: (tool: unknown) => () => void
}

/** Cordis companion plugin name. */
const name = 'plugin-template-tools'

/** Service required before the companion can register tools. */
const inject = ['tools']

/**
 * Read the echoed string out of a validated tool value.
 *
 * The output schema is an open object, so each field is `unknown` at the type
 * level. Narrowing it here keeps the renderer total: a renderer that can throw
 * turns a malformed value into a failed call instead of a bad line.
 * @param value - The canonical value the output schema validated.
 * @returns The echoed text, or the empty string when it is absent.
 */
function readEchoed(value: unknown): string {
  if (typeof value !== 'object' || value === null) {
    return ''
  }
  if (!('echoed' in value)) {
    return ''
  }
  const { echoed } = value
  if (typeof echoed !== 'string') {
    return ''
  }
  return echoed
}

function isToolRegistry(value: unknown): value is ToolRegistry {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  if (!('register' in value)) {
    return false
  }
  return typeof value.register === 'function'
}

/**
 * Resolve the host registry through Cordis's named service lookup. Keeping this
 * narrow local contract lets the template build without host source files; a
 * composed DSH profile still supplies the real `tools` service.
 * @param ctx - Cordis context carrying the host service.
 * @returns the host tool registry.
 * @throws {Error} when the companion is loaded without its host service.
 */
function getToolRegistry(ctx: Context): ToolRegistry {
  const registry = ctx.get('tools')
  if (!isToolRegistry(registry)) {
    throw new Error('tools companion requires the "tools" service')
  }
  return registry
}

/**
 * Register this plugin's tools on its own Cordis fiber.
 *
 * The registry disposer is returned to `ctx.effect`, so the registration is
 * owned by the calling fiber and fires on unload. Registering at module
 * evaluation time instead would outlive the fiber and leak across reloads.
 *
 * @param ctx - Cordis context carrying the `tools` service.
 */
function apply(ctx: Context): void {
  const registry = getToolRegistry(ctx)

  ctx.effect(() =>
    registry.register(
      defineTool({
        name: 'template_echo',
        description:
          'Echo a message back through the host. Demonstrates the tool contract: a ' +
          'per-property parameter schema, an enforced output schema, and a pure ' +
          'renderer that turns one validated value into model-facing content.',
        parameters: {
          message: {
            type: 'string',
            description: 'Text to echo. Defaults to the configured load message.',
          },
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: true,
          },
          render: (_args, value) => [{ type: 'text', text: readEchoed(value) }],
        },
        async execute(args) {
          // The tool API is asynchronous by contract, but this body has no I/O.
          // A single yield keeps one honest async shape without extra work.
          await Promise.resolve()
          return { echoed: args.message ?? 'DSH plugin template loaded' }
        },
      }),
    ),
  )
}

export { apply, inject, name }
