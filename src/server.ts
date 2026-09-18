/**
 * Optional Fastify server companion for `@minhlucvan/dsh-plugin-template`.
 *
 * This is the _server surface_: an HTTP listener this package owns, rather than
 * a seat on the host's carrier. Reach for it when a plugin needs endpoints of
 * its own — a webhook, an OAuth callback, a bundle served to a browser — and
 * for `./routes` when it should extend the host's existing listener instead. A
 * profile normally wants one or the other, not both.
 *
 * React follows the DSH pattern here, and that is deliberately _not_
 * server-side rendering: the browser face is a built artifact, so the server
 * serves those bytes and the page that loads them while the browser mounts the
 * tree. The static rules live in `./server-static.ts` and mirror
 * `@deepseek-ai/dsh-host-frontend-static`, which does the same for the host's
 * own dist.
 *
 * @module @minhlucvan/dsh-plugin-template/server
 */

import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import type { Context } from '@deepseek-ai/cordis'
import schema from '@deepseek-ai/schemastery'
import Fastify from 'fastify'

import {
  HEALTH_PATH,
  INDEX_PATH,
  MODULE_PATH,
  STATUS_NOT_FOUND,
  STATUS_OK,
  contentTypeFor,
  resolveStatic,
} from './server-static.ts'

/** Cordis companion plugin name. */
const name = 'plugin-template-server'

/** Services that must exist before the server can be applied. */
const inject: string[] = []

/** Default bind address: loopback, not every interface. */
const DEFAULT_HOST = '127.0.0.1'

/** Default port; `0` asks the operating system for a free one. */
const DEFAULT_PORT = 0

/**
 * Default artifact directory.
 *
 * Resolved against this module rather than the process's working directory,
 * which belongs to the composing application: the built `lib/server.js` sits
 * beside `lib/client.js`, so the module's own directory is the artifact root.
 */
const DEFAULT_ARTIFACT_ROOT = '.'

/** Default index file name. */
const DEFAULT_INDEX_FILE = 'index.html'

/** Server configuration supplied by the profile composition. */
interface ServerConfig {
  /** Address to bind. Loopback by default; widening it is an explicit choice. */
  host?: string
  /** Port to bind. `0`, the default, takes whatever port is free. */
  port?: number
  /** Directory of built browser assets to serve. */
  artifactRoot?: string
  /** File within `artifactRoot` served at the index path. */
  indexFile?: string
}

/** Configuration after defaults have been resolved. */
interface ResolvedServerConfig {
  /** Resolved bind address. */
  host: string
  /** Resolved port; `0` means "whatever is free". */
  port: number
  /** Absolute artifact directory. */
  artifactRoot: string
  /** Resolved index file name. */
  indexFile: string
}

/**
 * The slice of Fastify's reply this module writes through.
 *
 * Narrowed on purpose: the static surface only sets a status, a header and a
 * body, so depending on Fastify's full reply type here would couple otherwise
 * portable logic to the framework.
 */
interface StaticReply {
  /** Set the response status. */
  code: (status: number) => StaticReply
  /** Set a response header. */
  header: (key: string, value: string) => unknown
  /** Send the response, optionally with a body. */
  send: (body?: unknown) => void
}

/** Where the static surface reads from. */
interface StaticRoot {
  /** Absolute artifact directory. */
  artifactRoot: string
  /** Index file name, served at the index path. */
  indexFile: string
}

/** One static request, grouped so the helper stays within the parameter limit. */
interface StaticRequest {
  /** Reply to write. */
  reply: StaticReply
  /** Decoded request pathname. */
  pathname: string
  /** Request method. */
  method: string
  /** Artifact directory and index file name. */
  root: StaticRoot
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
 * @returns Configuration with every default applied and paths absolute.
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
 * Build a browsable origin from a bound address.
 *
 * Reporting the _bound_ port rather than the configured one is what makes
 * `port: 0` usable: the operator needs the port the OS actually chose.
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
 * Read a file's bytes, distinguishing "absent" from "unreadable".
 *
 * @param file - Absolute path to read.
 * @returns The bytes, or `undefined` when the path is not a readable file.
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

/**
 * Answer one static request from the artifact root.
 *
 * @param request - The request's reply, path, method and artifact root.
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
    // A legitimate path that holds no readable file is a 404, not a 500.
    reply.code(STATUS_NOT_FOUND).send()
    return
  }

  reply.header('content-type', contentTypeFor(file))
  // HEAD reports the type but must not carry a body.
  if (method === 'HEAD') {
    reply.code(STATUS_OK).send()
    return
  }
  reply.code(STATUS_OK).send(body)
}

/**
 * Resolve the port the listener actually bound.
 *
 * @param address - `server.address()` result.
 * @param fallback - Port to report when no socket address is available.
 * @returns The bound port.
 */
function boundPort(address: unknown, fallback: number): number {
  if (typeof address === 'object' && address !== null && 'port' in address) {
    const { port } = address
    if (typeof port === 'number') {
      return port
    }
  }
  return fallback
}

/**
 * Start the plugin's own HTTP server.
 *
 * Fastify is a declared runtime `dependency` left external by the build, so it
 * resolves from the consumer's own tree rather than being bundled — the
 * opposite of the browser face, whose dependencies are bundled because the host
 * supplies no module loader for them.
 *
 * @param ctx - Cordis context; the instance is owned by its fiber.
 * @param config - Configuration resolved by Cordis from the exported schema.
 * @returns Nothing; the server is registered as a fiber-owned effect.
 */
function apply(ctx: Context, config: ServerConfig = {}): void {
  const resolved = resolveServerConfig(config)
  const root: StaticRoot = {
    artifactRoot: resolved.artifactRoot,
    indexFile: resolved.indexFile,
  }

  ctx.effect(() => {
    // oxlint-disable-next-line new-cap -- Fastify's API is a callable factory, not a constructor.
    const server = Fastify({ logger: false })

    server.get(HEALTH_PATH, () => ({ name, ok: true }))
    /*
     * One GET registration per path, reading the arriving method rather than
     * registering HEAD separately: Fastify already derives HEAD from GET and
     * rejects an explicit duplicate. The static rules still decide what a
     * non-read method answers, which is why `resolveStatic` keeps its own
     * method check.
     */
    server.get(MODULE_PATH, (request, reply) => {
      void serveStatic({
        reply,
        pathname: MODULE_PATH,
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

    /*
     * `disposed` gates logging, not the bind: a listener answering while
     * unload is in flight is harmless, but calling a logger from a fiber that
     * has already been disposed is not.
     */
    let disposed = false

    const start = async (): Promise<void> => {
      try {
        await server.listen({ host: resolved.host, port: resolved.port })
      } catch (error) {
        /*
         * A port conflict must not take the host down with it. This companion
         * is additive, so a failed bind is reported and the rest of the plugin
         * keeps working.
         */
        if (!disposed) {
          ctx.logger.warn(
            `plugin-template server failed to start: ${String(error)}`,
          )
        }
        return
      }
      if (disposed) {
        return
      }
      const port = boundPort(server.server.address(), resolved.port)
      ctx.logger.info(
        `plugin-template server listening on ${originOf(resolved.host, port)}`,
      )
    }

    // Started immediately, awaited on disposal so a close cannot race a listen.
    const started = start()

    return async (): Promise<void> => {
      disposed = true
      await started
      await server.close()
    }
  }, 'server: fastify listener')
}

export {
  apply,
  Config,
  DEFAULT_ARTIFACT_ROOT,
  DEFAULT_HOST,
  DEFAULT_INDEX_FILE,
  DEFAULT_PORT,
  inject,
  name,
  originOf,
  resolveServerConfig,
  type ResolvedServerConfig,
  type ServerConfig,
}
