/**
 * Optional skill companion for `@minhlucvan/dsh-plugin-template`.
 *
 * A skill is routing metadata plus a markdown body the model loads only when
 * the description matches the task, which is what makes it different from a
 * tool: a tool is always in the catalog, a skill's body is not. Publishing one
 * is therefore about the _description_ — it is the whole routing decision, and
 * a vague one costs every session that reads the catalog.
 *
 * The body here is inline rather than a file on disk so the package stays
 * self-contained; a package with substantial documentation registers a
 * `resourceBase` instead and ships the directory.
 *
 * @module @minhlucvan/dsh-plugin-template/skills
 */

import type { Context } from '@deepseek-ai/cordis'

/** Whether each surface's catalogs include this skill. */
interface SkillInvocationPolicy {
  /** Include the skill in model-facing catalogs and loaders. */
  modelInvocable: boolean
  /** Include the skill in human-facing command catalogs. */
  userInvocable: boolean
}

/** One runtime skill contribution, as the host's registry accepts it. */
interface SkillRegistration {
  /** Kebab-case identifier used to address the skill. */
  name: string
  /** Short routing description shown by discovery consumers. */
  description: string
  /** Optional extra routing guidance. */
  whenToUse?: string
  /** Markdown instruction body loaded when the skill is selected. */
  content: string
  /** Discovery source that produced this skill. */
  source: string
  /** Invocation controls; omission permits both surfaces. */
  invocation?: SkillInvocationPolicy
}

/**
 * Minimal skill-registry contract used without a host source checkout.
 *
 * The host's registry also lists, gets and observes a merged catalog from
 * several providers. A companion contributing one runtime skill needs only
 * `register`, and modelling only that is what keeps the build independent of
 * the host package.
 */
interface SkillRegistry {
  register: (skill: SkillRegistration) => () => void
}

/** Cordis companion plugin name. */
const name = 'plugin-template-skills'

/** Service required before the companion can contribute a skill. */
const inject = ['skills']

/** Kebab-case identifier this template's skill is addressed by. */
const SKILL_NAME = 'plugin-template-demo'

/**
 * The routing description.
 *
 * Written as the answer to "when should the model load this", not as a summary
 * of the body: the description is the entire routing decision, and a
 * description that restates the title routes nothing.
 */
const SKILL_DESCRIPTION =
  'Reference for the dsh-plugin-template repository layout and its four optional companions. '
  + 'Use when adding a capability to a plugin built from this template, or when deciding '
  + 'whether work belongs in tools, routes, commands, the browser client, or the invariant.'

/** Markdown body loaded when the skill is selected. */
const SKILL_CONTENT = `# Choosing where a capability belongs

Each companion is a separate entry so the core bundle stays free of host packages
it does not need. Pick the narrowest one that fits:

- **Tool** (\`src/tools.ts\`) — the model should be able to call it during a turn.
- **Command** (\`src/commands.ts\`) — the operator triggers it directly, and it runs
  without being sent to the model.
- **Route** (\`src/routes.ts\`) — a surface needs to fetch data over HTTP.
- **Client** (\`src/client/\`) — the operator needs to see or edit something in the
  browser. Registration only; the page receives everything as props.
- **Invariant** (\`src/invariant.ts\`) — the package owns an authoritative event or
  data relationship another component could violate.

Everything registered must go through \`ctx.effect()\`, \`ctx.on()\`, or a registry
disposer. A synchronous \`apply\` that merely returns a disposer is not disposed.
`

/**
 * Whether a value is a skill registry.
 *
 * @param value - Candidate service.
 * @returns True when the value implements the narrow registry contract.
 */
function isSkillRegistry(value: unknown): value is SkillRegistry {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  if (!('register' in value)) {
    return false
  }
  return typeof value.register === 'function'
}

/**
 * Resolve the host's skill registry through Cordis's named service lookup.
 *
 * @param ctx - Cordis context carrying the host service.
 * @returns The host skill registry.
 * @throws {Error} When the companion is loaded without its host service.
 */
function getSkillRegistry(ctx: Context): SkillRegistry {
  const registry: unknown = ctx.get('skills')
  if (!isSkillRegistry(registry)) {
    throw new Error('skill companion requires the "skills" service')
  }
  return registry
}

/**
 * Register this package's skill on its own Cordis fiber.
 *
 * @param ctx - Cordis context carrying the skill service.
 */
function apply(ctx: Context): void {
  const registry = getSkillRegistry(ctx)
  ctx.effect(
    () =>
      registry.register({
        name: SKILL_NAME,
        description: SKILL_DESCRIPTION,
        content: SKILL_CONTENT,
        source: 'runtime',
        invocation: { modelInvocable: true, userInvocable: true },
      }),
    'skills: registration',
  )
}

export { apply, inject, name }
