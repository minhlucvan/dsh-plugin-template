/**
 * Server companion: a Fastify listener this package owns.
 *
 * Kept separate from `./routes` because the two answer different questions.
 * This one binds its own port and is therefore reachable without the host's
 * trust fence — which is exactly what an inbound webhook needs and exactly what
 * an operator must opt into, hence the loopback/port-0 defaults.
 *
 * Its static rules are self-contained rather than imported from the template,
 * because this example is meant to be read as a standalone plugin. The rules
 * mirror `@deepseek-ai/dsh-host-frontend-static`: 404 for a missing path, 403
 * for traversal, 405 for anything but GET/HEAD, and `application/octet-stream`
 * for an unrecognized extension instead of a guess.
 *
 * @module @minhlucvan/dsh-plugin-ops-console/server
 */

import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import type { Context } from '@deepseek-ai/cordis'
import schema from '@deepseek-ai/schemastery'
import Fastify from 'fastify'

/** Cordis plugin name. */
const name = 'ops-console-server'

/** Services required before the listener can start. */
const inject: string[] = []

/** Where the listener binds by default: loopback, never every interface. */
const DEFAULT_HOST = '127.0.0.1'

/** Port `0` takes whatever the OS assigns, so two profiles never collide. */
const DEFAULT_PORT = 0

/** Artifact directory, resolved against this module rather than the cwd. */
const DEFAULT_ARTIFACT_ROOT = '.'

/** Index file served at the root path. */
const DEFAULT_INDEX_FILE = 'index.html'

/** Paths this listener answers. */
const HEALTH_PATH = '/health'
const CLIENT_PATH = '/client.js'
const INDEX_PATH = '/'

/** HTTP statuses used by the static rules. */
const STATUS_OK = 200
const STATUS_FORBIDDEN = 403
const STATUS_NOT_FOUND = 404
const STATUS_METHOD_NOT_ALLOWED = 405

/** Methods the static surface answers. */
const STATIC_METHODS = new Set(['GET', 'HEAD'])

/** Content types for the extensions this listener serves. */
const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
}

/** Supplied when a request has no recognizable extension. */
const DEFAULT_CONTENT_TYPE = 'application/octet-stream'

/** Returned by `lastIndexOf` when the separator is absent. */
const NOT_FOUND_INDEX = -1

/** Second index of a two-element pair, named out of the magic-number rule. */
const SECOND_INDEX = 1

/** Server configuration supplied by the profile composition. */
interface ServerConfig {
  /** Bind address. */
  host?: string
  /** Bind port; `0` takes a free one. */
  port?: number
  /** Directory of built browser assets to serve. */
  artifactRoot?: string
  /** File within the root served at the index path. */
  indexFile?: string
}

/** Configuration after defaults have been resolved. */
interface ResolvedServerConfig {
  /** Resolved bind address. */
  host: string
  /** Resolved bind port. */
  port: number
  /** Absolute artifact directory. */
  artifactRoot: string
  /** Resolved index file name. */
  indexFile: string
}

/** The slice of a reply this module writes through. */
interface StaticReply {
  /** Set the status. */
  code: (status: number) => StaticReply
  /** Set a header. */
  header: (key: string, value: string) => unknown
  /** Send the body. */
  send: (body?: unknown) => void
}

/** Loader-visible configuration schema and defaults. */
const Config: schema<ServerConfig> = schema.object({
  host: schema.string().default(DEFAULT_HOST),
  port: schema.natural().default(DEFAULT_PORT),
  artifactRoot: schema.string().default(DEFAULT_ARTIFACT_ROOT),
  indexFile: schema.string().default(DEFAULT_INDEX_FILE),
})

/**
 * Resolve the same defaults for direct callers that bypass Cordis Loader.
 *
 * @param config - Partial serialized configuration.
 * @param baseDir - Directory the default artifact root resolves against.
 * @returns Configuration with defaults applied and paths absolute.
 */
function resolveServerConfig(
  config: ServerConfig = {},
  baseDir: string = import.meta.dirname,
): ResolvedServerConfig {
  return {
    host: config.host ?? DEFAULT_HOST,
    port: config.port ?? DEFAULT_PORT,
    artifactRoot: path.resolve(
      baseDir,
      config.artifactRoot ?? DEFAULT_ARTIFACT_ROOT,
    ),
    indexFile: config.indexFile ?? DEFAULT_INDEX_FILE,
  }
}

/**
 * Decide which file answers a static request.
 *
 * @param pathname - Decoded request pathname.
 * @param method - Request method.
 * @param root - Artifact directory and index file name.
 * @returns The status to send, and the file to send on success.
 */
function resolveStatic(
  pathname: string,
  method: string,
  root: { artifactRoot: string; indexFile: string },
): { status: number; file?: string } {
  if (!STATIC_METHODS.has(method)) {
    return { status: STATUS_METHOD_NOT_ALLOWED }
  }

  let relative = pathname.replace(/^\/+/u, '')
  if (pathname === INDEX_PATH) {
    relative = root.indexFile
  }
  const file = path.resolve(root.artifactRoot, relative)

  // Anchor on the separator: a bare prefix check also accepts a sibling whose
  // Name merely starts with the root's, which is how `lib` and `lib-private`
  // Get confused for one another.
  let rootPrefix = root.artifactRoot + path.sep
  if (root.artifactRoot.endsWith(path.sep)) {
    rootPrefix = root.artifactRoot
  }
  if (file !== root.artifactRoot && !file.startsWith(rootPrefix)) {
    return { status: STATUS_FORBIDDEN }
  }

  return { status: STATUS_OK, file }
}

/**
 * Content type for a served file.
 *
 * @param file - Absolute path being served.
 * @returns The declared type, or a binary default.
 */
function contentTypeFor(file: string): string {
  const dot = file.lastIndexOf('.')
  if (dot === NOT_FOUND_INDEX) {
    return DEFAULT_CONTENT_TYPE
  }
  const extension = file.slice(dot).toLowerCase()
  return CONTENT_TYPES[extension] ?? DEFAULT_CONTENT_TYPE
}

/**
 * Read a file, distinguishing absent from unreadable.
 *
 * @param file - Absolute path.
 * @returns The bytes, or `undefined` when it is not a readable file.
 */
async function readArtifact(file: string): Promise<Buffer | undefined> {
  try {
    const stats = await stat(file)
    if (!stats.isFile()) {
      return undefined
    }
    return await readFile(file)
  } catch {
    return undefined
  }
}

/** One static request, grouped so the helper stays inside the parameter limit. */
interface StaticRequest {
  /** Reply to write. */
  reply: StaticReply
  /** Decoded request pathname. */
  pathname: string
  /** Request method. */
  method: string
  /** Artifact directory and index file name. */
  root: { artifactRoot: string; indexFile: string }
}

/**
 * Answer one static request.
 *
 * @param request - The reply, path, method and artifact root.
 * @returns Nothing; the response is sent.
 */
async function serveStatic(request: StaticRequest): Promise<void> {
  const { reply, pathname, method, root } = request
  const { status, file } = resolveStatic(pathname, method, root)
  if (file === undefined) {
    reply.code(status).send()
    return
  }
  const body = await readArtifact(file)
  if (body === undefined) {
    reply.code(STATUS_NOT_FOUND).send()
    return
  }
  reply.header('content-type', contentTypeFor(file))
  if (method === 'HEAD') {
    reply.code(STATUS_OK).send()
    return
  }
  reply.code(STATUS_OK).send(body)
}

/**
 * Build a browsable origin from a bound address.
 *
 * @param host - Bound address.
 * @param port - Bound port.
 * @returns A browsable origin.
 */
function originOf(host: string, port: number): string {
  if (host === '0.0.0.0' || host === '::') {
    return `http://127.0.0.1:${String(port)}`
  }
  return `http://${host}:${String(port)}`
}

/**
 * Resolve the port the listener actually bound.
 *
 * @param address - `server.address()` result.
 * @param fallback - Port to report when no socket address exists.
 * @returns The bound port.
 */
function boundPort(address: unknown, fallback: number): number {
  if (typeof address === 'object' && address !== null && 'port' in address) {
    const { port } = address as { port?: unknown }
    if (typeof port === 'number') {
      return port
    }
  }
  return fallback
}

/**
 * Start the example's HTTP listener.
 *
 * `fastify` is a runtime dependency kept external by the build, so the consumer
 * resolves it from its own tree; bundling it would ship a private copy whose
 * plugins could not be shared.
 *
 * @param ctx - Cordis context; the instance is owned by its fiber.
 * @param config - Configuration resolved by Cordis from the exported schema.
 * @returns Nothing; the listener is a fiber-owned effect.
 */
function apply(ctx: Context, config: ServerConfig = {}): void {
  const resolved = resolveServerConfig(config)
  const root = {
    artifactRoot: resolved.artifactRoot,
    indexFile: resolved.indexFile,
  }

  ctx.effect(() => {
    // Fastify's API is a callable factory, not a constructor.
    const server = Fastify({ logger: false })

    server.get(HEALTH_PATH, () => ({ name, ok: true }))
    // One GET registration per path: Fastify derives HEAD from GET and
    // Rejects an explicit duplicate, so the arriving method is read here.
    server.get(CLIENT_PATH, (request, reply) => {
      void serveStatic({
        reply,
        pathname: CLIENT_PATH,
        method: request.method,
        root,
      })
    })
    server.get(INDEX_PATH, (request, reply) => {
      void serveStatic({
        reply,
        pathname: INDEX_PATH,
        method: request.method,
        root,
      })
    })

    let disposed = false

    const start = async (): Promise<void> => {
      try {
        await server.listen({ host: resolved.host, port: resolved.port })
      } catch (error) {
        if (!disposed) {
          ctx.logger.warn(
            `ops-console server failed to start: ${String(error)}`,
          )
        }
        return
      }
      if (disposed) {
        return
      }
      const address = server.server.address()
      const parts = originOf(resolved.host, boundPort(address, resolved.port))
      ctx.logger.info(`ops-console server listening on ${parts}`)
    }

    const started = start()

    return async (): Promise<void> => {
      disposed = true
      await started
      await server.close()
    }
  }, 'ops-console: fastify listener')
}

export {
  apply,
  Config,
  CONTENT_TYPES,
  contentTypeFor,
  DEFAULT_ARTIFACT_ROOT,
  DEFAULT_HOST,
  DEFAULT_INDEX_FILE,
  DEFAULT_PORT,
  HEALTH_PATH,
  INDEX_PATH,
  CLIENT_PATH,
  inject,
  name,
  originOf,
  resolveServerConfig,
  resolveStatic,
  SECOND_INDEX,
  type ResolvedServerConfig,
  type ServerConfig,
}
