/**
 * Shared test harness for the ops-console example.
 *
 * The companions resolve host services through narrow local contracts, so a
 * small fake context is enough to mount them — and mounting them for real is
 * the point: what these suites assert is which registrations happened and
 * whether they were released, not that a mock was called with the right shape.
 */
import type { Context } from '@deepseek-ai/cordis'
import { vi } from 'vitest'

/** The fake context a companion is mounted against. */
interface FakeContext {
  /** Records log lines; the server suite reads the bound origin from here. */
  logger: { info: (line: string) => void; warn: (line: string) => void }
  /** Runs an effect body and owns its disposer. */
  effect: (execute: () => () => unknown, label?: string) => void
  /** Subscribes to an event; returns the unsubscribe function. */
  on: (event: string, listener: (...args: never[]) => unknown) => () => void
  /** Reads a provided service, or `undefined`. */
  get: (name: string) => unknown
  /** Provides a service; returns the withdrawal function. */
  provide: (name: string, value: unknown) => () => void
  /** Labels of every effect registered so far. */
  labels: string[]
  /** Lines written through `logger.info`. */
  infos: string[]
  /** Event listeners registered through `ctx.on`, by event name. */
  listeners: Map<string, ((...args: never[]) => unknown)[]>
  /** Services provided through `ctx.provide`. */
  services: Map<string, unknown>
  /** Dispose every effect, in reverse order. */
  dispose: () => Promise<void>
  /** Disposers of the effects, for assertions. */
  disposers: (() => void)[]
}

/**
 * Build a fake Cordis context.
 *
 * Deliberately partial: it models the members these companions call and nothing
 * else. The type is not `Context`, because claiming to be one would force a
 * dozen stubs for loader members no companion touches and would hide which
 * surface is actually exercised.
 *
 * @param services - Services to make resolvable through `ctx.get`.
 * @returns The fake context, plus the recorders the suites assert on.
 */
function fakeContext(services: Record<string, unknown> = {}): FakeContext {
  const infos: string[] = []
  const labels: string[] = []
  const disposers: (() => void)[] = []
  const listeners = new Map<string, ((...args: never[]) => unknown)[]>()
  const provided = new Map<string, unknown>(Object.entries(services))

  const context: FakeContext = {
    logger: {
      info: (line: string) => {
        infos.push(line)
      },
      warn: (line: string) => {
        infos.push(`warn: ${line}`)
      },
    },
    effect: (execute, label) => {
      labels.push(label ?? '(unlabeled)')
      const undo = execute()
      disposers.push(() => {
        void undo()
      })
    },
    on: (event, listener) => {
      const existing = listeners.get(event) ?? []
      existing.push(listener)
      listeners.set(event, existing)
      return () => {
        listeners.set(
          event,
          (listeners.get(event) ?? []).filter(
            (candidate) => candidate !== listener,
          ),
        )
      }
    },
    get: (name: string) => provided.get(name),
    provide: (name: string, value: unknown) => {
      provided.set(name, value)
      return () => {
        provided.delete(name)
      }
    },
    labels,
    infos,
    listeners,
    services: provided,
    disposers,
    dispose: async () => {
      // A leading yield keeps this an honest async function for both the async
      // and require-await rules; reverse order matches a real fiber.
      await Promise.resolve()
      for (const disposer of [...disposers].toReversed()) {
        disposer()
      }
    },
  }

  return context
}

/** The parts of a tool definition these suites drive. */
interface RecordedTool {
  /** Tool name as registered. */
  name: string
  /** Run the tool body. */
  execute: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
  /** Pure model-facing projection of one validated value. */
  output: {
    render: (args: unknown, value: unknown) => { type: string; text: string }[]
  }
}

/**
 * A fake tool registry recording every registration.
 *
 * @param names - Tool names `schemas()` reports, simulating other plugins.
 * @returns The registry plus its recorders.
 */
function fakeToolRegistry(names: string[] = []): {
  registry: {
    register: (definition: unknown) => () => void
    guard: (guard: (execution: unknown) => string | undefined) => () => void
    schemas: () => { name: string; description: string }[]
  }
  registered: RecordedTool[]
  guards: ((execution: unknown) => string | undefined)[]
  unregister: ReturnType<typeof vi.fn>
} {
  const registered: RecordedTool[] = []
  const guards: ((execution: unknown) => string | undefined)[] = []
  const unregister = vi.fn<() => void>()

  return {
    registered,
    guards,
    unregister,
    registry: {
      register: (definition: unknown) => {
        registered.push(definition as RecordedTool)
        return () => {
          unregister()
        }
      },
      guard: (guard) => {
        guards.push(guard)
        return () => {
          unregister()
        }
      },
      schemas: () =>
        names.map((name) => ({ name, description: `${name} tool` })),
    },
  }
}

/**
 * Present the partial fake as the `Context` a companion accepts.
 *
 * The companions only call `logger`, `effect`, `on` and `get`, so the fake is
 * complete _for them_; this helper says that once rather than at every call
 * site.
 *
 * @param context - The partial fake.
 * @returns The same object, typed as what a companion takes.
 */
function asContext(context: FakeContext): Context {
  return context as unknown as Context
}

export {
  asContext,
  fakeContext,
  fakeToolRegistry,
  type FakeContext,
  type RecordedTool,
}
