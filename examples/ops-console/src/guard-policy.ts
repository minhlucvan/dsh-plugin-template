/**
 * The example's policy engine.
 *
 * A DSH tool pipeline offers three distinct interception shapes, and this
 * module uses the two that compose well:
 *
 * - **`ctx.on('tools/pre-execute', …)`** is a waterfall. Each listener receives
 *   the execution and `next()`; it may inspect and then delegate. It can
 *   _allow_ a call, which is what makes it the right place for observation and
 *   shaping.
 * - **`ctx.tools.guard(fn)`** is a monotonic guard. It runs after every
 *   pre-execute listener and can only deny — there is no "allow" result, so no
 *   listener ordering can turn a denial back into permission. That asymmetry is
 *   the point: a policy that must hold should not be expressible as a waterfall
 *   listener that a later plugin can undo.
 *
 * `decide` is a pure function over the execution so the rules are testable
 * without a Cordis context, a scheduler, or a running agent.
 *
 * @module @minhlucvan/dsh-plugin-ops-console/guard-policy
 */

/** Why an execution was refused, or nothing when it is allowed. */
type Denial = string | undefined

/** The fields of a tool execution this policy reads. */
interface ExecutableCall {
  /** Tool being invoked. */
  readonly name: string
  /** Parsed arguments, as the pipeline presents them. */
  readonly arguments: unknown
}

/** The policy a deployment configured. */
interface Policy {
  /** Tool names refused outright. */
  readonly deniedTools: readonly string[]
  /**
   * Directory the call's `path`-like arguments must stay inside.
   *
   * `undefined` disables containment, which is the honest spelling of "off": an
   * empty string would silently mean "nothing is contained", and a caller could
   * never tell the two apart.
   */
  readonly sandboxRoot: string | undefined
}

/** Argument keys treated as filesystem paths. */
const PATH_KEYS = ['path', 'file', 'cwd', 'directory'] as const

/** Prefix every denial carries, so logs are greppable by origin. */
const DENIAL_PREFIX = 'ops-console policy'

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
 * Read a string argument from an unknown argument bag.
 *
 * @param args - Parsed arguments, of unknown shape by design.
 * @param key - Argument name to read.
 * @returns The string value, or `undefined` when absent or not a string.
 */
function stringArg(args: unknown, key: string): string | undefined {
  if (!isRecord(args) || !(key in args)) {
    return undefined
  }
  const value = args[key]
  if (typeof value !== 'string' || value === '') {
    return undefined
  }
  return value
}

/**
 * Whether a path stays inside a root.
 *
 * A lexical check, not a filesystem one: the pipeline is synchronous, and a
 * symlink that resolves outside the root is the filesystem's answer to give at
 * open time, not this function's to guess. It rejects both `..` traversal and
 * an absolute path outside the root, which are the two cases an operator means
 * by "stay in this directory".
 *
 * @param candidate - Path argument from the call.
 * @param root - Directory the path must stay inside.
 * @returns True when the path does not escape the root.
 */
function isContained(candidate: string, root: string): boolean {
  let normalizedRoot = `${root}/`
  if (root.endsWith('/')) {
    normalizedRoot = root
  }
  if (candidate === root) {
    return true
  }
  if (candidate.startsWith('/')) {
    return candidate.startsWith(normalizedRoot)
  }
  // A relative path escapes only by walking upward past the root.
  return !candidate.split('/').includes('..')
}

/**
 * Find the first path-like argument that escapes the root.
 *
 * A loop rather than a `find` callback so the argument key survives for the
 * message, which is what makes a refusal actionable.
 *
 * @param args - Parsed arguments, of unknown shape by design.
 * @param root - Directory every path argument must stay inside.
 * @returns The offending key and value, or `undefined` when all are contained.
 */
function escapingArgument(
  args: unknown,
  root: string,
): { key: string; value: string } | undefined {
  for (const key of PATH_KEYS) {
    const value = stringArg(args, key)
    if (value !== undefined && !isContained(value, root)) {
      return { key, value }
    }
  }
  return undefined
}

/**
 * Decide whether one call is allowed.
 *
 * Rules run least-to-most specific so the reported reason is the most useful
 * one: a denied tool is denied regardless of its arguments, and containment is
 * only consulted for tools that survived that check.
 *
 * @param call - The tool name and its parsed arguments.
 * @param policy - The configured policy.
 * @returns A human-readable denial reason, or `undefined` to allow the call.
 */
function decide(call: ExecutableCall, policy: Policy): Denial {
  if (policy.deniedTools.includes(call.name)) {
    return `${DENIAL_PREFIX}: ${call.name} is denied by configuration`
  }

  if (policy.sandboxRoot === undefined) {
    return undefined
  }

  // Names the value as well as the key: "path escapes /work" alone leaves the
  // Operator guessing which of the several path arguments was refused.
  const escaping = escapingArgument(call.arguments, policy.sandboxRoot)
  if (escaping === undefined) {
    return undefined
  }
  return `${DENIAL_PREFIX}: ${escaping.key} "${escaping.value}" escapes ${policy.sandboxRoot}`
}

export {
  decide,
  DENIAL_PREFIX,
  escapingArgument,
  isContained,
  PATH_KEYS,
  stringArg,
  type Denial,
  type ExecutableCall,
  type Policy,
}
