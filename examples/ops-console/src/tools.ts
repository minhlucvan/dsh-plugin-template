/**
 * Tool companion: the example's capability surface.
 *
 * Three tools, chosen to cover the parts of the tool contract that are easy to
 * get wrong rather than to cover the most ground:
 *
 * - `ops_inspect` reads deployment configuration, so the schema → defaults path
 *   is visible from the model's side;
 * - `ops_list_tools` reads the live registry at execution time, which is the
 *   difference between a tool that reports the surface that exists and one that
 *   reports the surface the author remembered;
 * - `ops_echo` declares a nested argument shape and a pure renderer, so the
 *   enforced-output and model-facing-projection halves are both exercised.
 *
 * Every registration goes through the registry returned by `register`, whose
 * disposer the fiber owns. Registering at module scope would outlive the plugin
 * and leak across reloads, which is the failure mode most worth avoiding here.
 *
 * @module @minhlucvan/dsh-plugin-ops-console/tools
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

import type { Config, ResolvedConfig } from './config.ts'
import { resolveConfig } from './config.ts'

/** Cordis plugin name. */
const name = 'ops-console-tools'

/** Service that must exist before any tool can be registered. */
const inject = ['tools']

/** This example's tool-name prefix, so its rows are greppable in a catalog. */
const TOOL_PREFIX = 'ops_'

/** A tool list with no entries renders its own empty text. */
const NO_MATCHES = 0

/** The slice of the tool registry this companion calls. */
interface ToolRegistry {
  /** Register one definition; the returned disposer unregisters it. */
  register: (definition: unknown) => () => void
  /** Every tool schema visible to an optional scope. */
  schemas: (scope?: unknown) => { name: string; description: string }[]
}

function isToolRegistry(value: unknown): value is ToolRegistry {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  if (!('register' in value) || !('schemas' in value)) {
    return false
  }
  return (
    typeof value.register === 'function' && typeof value.schemas === 'function'
  )
}

/**
 * Whether a value is a non-null object, so its own keys can be read.
 *
 * @param value - Candidate.
 * @returns True when the value is an object whose properties are readable.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Read one field as display text out of whatever the output schema validated.
 *
 * The declared output schema is an open object, so every field is `unknown` at
 * the type level. Numbers are rendered rather than rejected because a tool that
 * reports a count is not malformed — only a field that is neither a string nor
 * a finite number is. Keeping this total is deliberate: a renderer that throws
 * turns a malformed value into a failed call instead of a readable line.
 *
 * @param value - Canonical value the output schema validated.
 * @param key - Field to read.
 * @returns The field as text, or the empty string when it is unusable.
 */
function readText(value: unknown, key: string): string {
  if (!isRecord(value) || !(key in value)) {
    return ''
  }
  const field = value[key]
  if (typeof field === 'string') {
    return field
  }
  if (typeof field === 'number' && Number.isFinite(field)) {
    return String(field)
  }
  return ''
}

/**
 * The deployment facts `ops_inspect` reports.
 *
 * Built as a pure function so the shape is assertable without mounting the
 * plugin, and so the fields the tool exposes are visible in one place.
 *
 * @param config - Resolved configuration.
 * @param toolCount - Tools currently visible to the caller.
 * @returns A flat, explainable view of the deployment.
 */
function inspect(
  config: ResolvedConfig,
  toolCount: number,
): Record<string, string> {
  let denied = config.deniedTools.join(', ')
  if (config.deniedTools.length === NO_MATCHES) {
    denied = '(none)'
  }
  return {
    message: config.message,
    commandName: config.commandName,
    port: String(config.port),
    // Spell `undefined` as a word: a JSON-dropped key would make a disabled
    // Feature indistinguishable from a field the tool forgot to report.
    sandboxRoot: config.sandboxRoot ?? '(containment disabled)',
    deniedTools: denied,
    visibleTools: String(toolCount),
  }
}

/**
 * Register this example's tools.
 *
 * @param ctx - Cordis context carrying the tool service.
 * @param config - Configuration resolved by Cordis from the exported schema.
 * @returns Nothing; every registration is owned by the fiber.
 */
/**
 * Register the configuration-reporting tool.
 *
 * @param ctx - Cordis context owning the registration.
 * @param registry - Resolved tool registry.
 * @param config - Resolved configuration.
 */
function registerInspect(
  ctx: Context,
  registry: ToolRegistry,
  config: ResolvedConfig,
): void {
  const dispose = registry.register(
    defineTool({
      name: `${TOOL_PREFIX}inspect`,
      description:
        'Report how this ops-console deployment is configured. Use it to see the '
        + 'effective policy before attempting a call the policy might refuse.',
      parameters: {},
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => {
          const lines = [
            `message: ${readText(value, 'message')}`,
            `command: ${readText(value, 'commandName')}`,
            `port: ${readText(value, 'port')}`,
            `sandbox: ${readText(value, 'sandboxRoot')}`,
            `denied: ${readText(value, 'deniedTools')}`,
            `visible tools: ${readText(value, 'visibleTools')}`,
          ]
          return [{ type: 'text', text: lines.join('\n') }]
        },
      },
      async execute() {
        await Promise.resolve()
        return inspect(config, registry.schemas().length)
      },
    }),
  )
  ctx.effect(() => dispose, 'ops-console: ops_inspect')
}

/**
 * Register the tool-listing tool.
 *
 * @param ctx - Cordis context owning the registration.
 * @param registry - Resolved tool registry.
 */
function registerListTools(ctx: Context, registry: ToolRegistry): void {
  const disposeList = registry.register(
    defineTool({
      name: `${TOOL_PREFIX}list_tools`,
      description:
        'List the tools visible to the calling agent, filtered by an optional prefix.',
      parameters: {
        prefix: {
          type: 'string',
          description: `Only names starting with this text (default "${TOOL_PREFIX}").`,
        },
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => {
          const names = readText(value, 'names')
          if (names === '') {
            return [{ type: 'text', text: 'no tools matched' }]
          }
          return [
            {
              type: 'text',
              text: `${readText(value, 'count')} tools:\n${names}`,
            },
          ]
        },
      },
      async execute(args) {
        await Promise.resolve()
        const want = args.prefix ?? TOOL_PREFIX
        // Read at execution time, not registration time: restrictions and other
        // Plugins' registrations both change what is visible after this runs.
        const names = registry
          .schemas()
          .map((schema) => schema.name)
          .filter((toolName) => toolName.startsWith(want))
          .toSorted()
        return { names: names.join('\n'), count: names.length }
      },
    }),
  )
  ctx.effect(() => disposeList, 'ops-console: ops_list_tools')
}

/**
 * Register the structured-echo tool.
 *
 * @param ctx - Cordis context owning the registration.
 * @param registry - Resolved tool registry.
 */
function registerEcho(ctx: Context, registry: ToolRegistry): void {
  const disposeEcho = registry.register(
    defineTool({
      name: `${TOOL_PREFIX}echo`,
      description:
        'Echo structured input back. Demonstrates a nested argument shape and a '
        + 'renderer that projects one validated value into model-facing text.',
      parameters: {
        label: {
          type: 'string',
          description: 'Label for the echo.',
          required: true,
        },
        detail: {
          type: 'object',
          description: 'Optional structured detail.',
          properties: {
            note: { type: 'string', description: 'Free-form note.' },
            count: { type: 'integer', description: 'A count.' },
          },
          additionalProperties: false,
        },
        tags: {
          type: 'array',
          description: 'Optional tags.',
          items: { type: 'string' },
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: true,
        },
        render: (_args, value) => [
          { type: 'text', text: readText(value, 'summary') },
        ],
      },
      async execute(args) {
        await Promise.resolve()
        const note = args.detail?.note ?? '(no note)'
        const tags = (args.tags ?? []).join(', ')
        let shownTags = tags
        if (tags === '') {
          shownTags = '(none)'
        }
        const summary = `${args.label} | note=${note} | tags=${shownTags}`
        return { summary }
      },
    }),
  )
  ctx.effect(() => disposeEcho, 'ops-console: ops_echo')
}

/**
 * Register this example's tools.
 *
 * @param ctx - Cordis context carrying the tool service.
 * @param config - Configuration resolved by Cordis from the exported schema.
 * @returns Nothing; every registration is owned by the fiber.
 */
function apply(ctx: Context, config: Config = {}): void {
  const resolved = resolveConfig(config)
  const registry = ctx.get('tools')
  if (!isToolRegistry(registry)) {
    throw new Error('ops-console tools require the "tools" service')
  }

  registerInspect(ctx, registry, resolved)
  registerListTools(ctx, registry)
  registerEcho(ctx, registry)
}

export { apply, inject, inspect, name, TOOL_PREFIX, type ToolRegistry }
