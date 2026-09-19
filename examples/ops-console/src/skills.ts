/**
 * Skill companion: routing metadata plus a markdown body.
 *
 * A skill differs from a tool in exactly one way that matters: a tool is always
 * in the catalog, while a skill's body is loaded only when its description
 * matches the task. That makes the description the entire routing decision, so
 * it is written as the answer to "when should this load" rather than as a
 * title.
 *
 * The body is inline so the example stays self-contained. A package with
 * substantial documentation would register a `resourceBase` and ship the
 * directory instead.
 *
 * @module @minhlucvan/dsh-plugin-ops-console/skills
 */

import type { Context } from '@deepseek-ai/cordis'

/** Cordis companion plugin name. */
const name = 'ops-console-skills'

/** Service required before a skill can be contributed. */
const inject = ['skills']

/** Kebab-case identifier this skill is addressed by. */
const SKILL_NAME = 'ops-console-policy'

/**
 * The routing description.
 *
 * The whole sentence is the routing decision: it names the trigger (a refused
 * tool call) and the outcome (how to read the reason and change the policy).
 */
const SKILL_DESCRIPTION =
  'How the ops-console example intercepts tool calls: the guard/waterfall split, '
  + 'why a denial cannot be overridden, and which configuration key controls it. '
  + 'Use when a tool call is refused with an "ops-console policy" reason, or when '
  + 'changing deniedTools or sandboxRoot in a profile composition.'

/** Markdown body loaded when the skill is selected. */
const SKILL_CONTENT = `# The ops-console policy

Two seams intercept every tool call, and they are not interchangeable:

- \`ctx.tools.guard(fn)\` is **monotonic**. It runs after every \`tools/pre-execute\`
  listener and can only return a reason (deny) or \`undefined\` (leave alone).
  There is no allow result, so a later listener cannot undo a denial. Use it when
  the rule must hold regardless of what else is installed.
- \`ctx.on('tools/pre-execute', (exec, next) => …)\` is a **waterfall**. Each
  listener may inspect the call and must eventually call \`next()\`. Returning
  \`{ kind: 'allow' }\` short-circuits the remaining listeners, so this seam is for
  observation and shaping, not for policy.

## Reading a refusal

A denial reason is prefixed \`ops-console policy:\`. Two rules produce one:

- the tool name is listed in \`deniedTools\` (default \`bash\`, \`write\`);
- a path-like argument (\`path\`, \`file\`, \`cwd\`, \`directory\`) escapes
  \`sandboxRoot\`. Containment is only checked when \`sandboxRoot\` is set; leaving
  it unset is how a deployment disables the check.

Containment is lexical, not resolved through the filesystem. A symlink whose
target lies outside the root is the filesystem's answer to give at open time.

## Changing the policy

Both keys are configuration, so a profile changes them without a code change:

\`\`\`yaml
- id: ops-console-policy
  config:
    deniedTools: [bash]
    sandboxRoot: /workspace
\`\`\`

Remember that a patch replaces the targeted row's **whole** \`config\`, so every
key the row owns must be restated.

## Inspecting what happened

\`/ops\` prints the in-memory audit trail — allowed and denied calls, newest last.
The trail is bounded and lives in memory, so it is diagnostic, not durable.
`

/** The slice of the skill registry this companion calls. */
interface SkillRegistry {
  /** Register one skill; the returned disposer unregisters it. */
  register: (skill: {
    name: string
    description: string
    content: string
    source: string
    whenToUse?: string
  }) => () => void
}

function isSkillRegistry(value: unknown): value is SkillRegistry {
  if (typeof value !== 'object' || value === null || !('register' in value)) {
    return false
  }
  return typeof value.register === 'function'
}

/**
 * Register the example's runtime skill.
 *
 * @param ctx - Cordis context carrying the skill registry.
 * @returns Nothing; the registration is owned by the fiber.
 */
function apply(ctx: Context): void {
  const registry = ctx.get('skills')
  if (!isSkillRegistry(registry)) {
    throw new Error('ops-console skill companion requires the "skills" service')
  }

  ctx.effect(
    () =>
      registry.register({
        name: SKILL_NAME,
        description: SKILL_DESCRIPTION,
        whenToUse:
          'Load when a tool call is refused by ops-console, or when editing '
          + 'deniedTools or sandboxRoot for a deployment.',
        content: SKILL_CONTENT,
        source: '@minhlucvan/dsh-plugin-ops-console',
      }),
    'ops-console: runtime skill',
  )
}

export { apply, inject, name, SKILL_CONTENT, SKILL_DESCRIPTION, SKILL_NAME }
