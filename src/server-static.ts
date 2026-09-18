/**
 * Static-asset rules for the plugin's own server.
 *
 * Split from `./server.ts` deliberately: these are the decisions worth testing
 * — what answers a request, and with which status — and they touch no listener,
 * no framework, and no filesystem, so they can be exercised directly. The
 * Fastify wiring next door stays a thin adapter over them.
 *
 * The rules mirror `@deepseek-ai/dsh-host-frontend-static`, which serves the
 * host's own browser bundle: a missing path is 404, a traversal outside the
 * artifact root is 403, a method other than GET/HEAD is 405, and an
 * unrecognized extension ships as `application/octet-stream` rather than a
 * guessed type.
 *
 * @module @minhlucvan/dsh-plugin-template/server-static
 */

import path from 'node:path'

/** Path separator the traversal check anchors on. */
const SEPARATOR = path.sep

/** Separates a filename from its extension. */
const EXTENSION_SEPARATOR = '.'

/**
 * Index of a string's first character, named to keep it out of the magic-number
 * rule.
 */
const FIRST_CHARACTER = 0

/** HTTP status for a successful read. */
const STATUS_OK = 200
/** HTTP status for a request that must not be served. */
const STATUS_FORBIDDEN = 403
/** HTTP status for a path that does not exist. */
const STATUS_NOT_FOUND = 404
/** HTTP status for a method the static surface does not answer. */
const STATUS_METHOD_NOT_ALLOWED = 405

/** The only methods the static surface answers. */
const STATIC_METHODS = new Set(['GET', 'HEAD'])

/** Path the plugin's browser bundle is served at. */
const MODULE_PATH = '/client.js'

/** Path the loadable page is served at. */
const INDEX_PATH = '/'

/** Path of the server's readiness probe. */
const HEALTH_PATH = '/health'

/** Supplied when a caller asks for a path with no extension. */
const DEFAULT_CONTENT_TYPE = 'application/octet-stream'

/** Content types for the extensions this package serves. */
const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
}

/** The decision a static request resolves to. */
interface StaticDecision {
  /** Status to answer with. */
  status: number
  /** File to send when the status is 200. */
  file?: string
}

/**
 * Decide which file, if any, answers a static request.
 *
 * Separate 403 and 404 answers are the point: a traversal attempt and an empty
 * path are different events, and an operator reading logs needs to tell them
 * apart rather than seeing one generic failure.
 *
 * @param pathname - Decoded request pathname.
 * @param method - Request method.
 * @param root - Artifact directory and index file name.
 * @returns The status to answer with, and the file to send on success.
 */
function resolveStatic(
  pathname: string,
  method: string,
  root: { artifactRoot: string; indexFile: string },
): StaticDecision {
  if (!STATIC_METHODS.has(method)) {
    return { status: STATUS_METHOD_NOT_ALLOWED }
  }

  let relative = pathname.replace(/^\/+/u, '')
  if (pathname === INDEX_PATH) {
    relative = root.indexFile
  }
  const file = path.resolve(root.artifactRoot, relative)

  /*
   * Compare against the root *plus a separator*. A bare prefix check would also
   * accept a sibling directory whose name merely starts with the root's, which
   * is how `lib` and `lib-private` get confused for one another.
   */
  let rootPrefix = root.artifactRoot + SEPARATOR
  if (root.artifactRoot.endsWith(SEPARATOR)) {
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
 * @returns The declared type, or a binary default for anything unrecognized.
 */
function contentTypeFor(file: string): string {
  const dot = file.lastIndexOf(EXTENSION_SEPARATOR)
  if (dot < FIRST_CHARACTER) {
    return DEFAULT_CONTENT_TYPE
  }
  const declared = CONTENT_TYPES[file.slice(dot).toLowerCase()]
  if (declared === undefined) {
    return DEFAULT_CONTENT_TYPE
  }
  return declared
}

export {
  CONTENT_TYPES,
  contentTypeFor,
  DEFAULT_CONTENT_TYPE,
  HEALTH_PATH,
  INDEX_PATH,
  MODULE_PATH,
  resolveStatic,
  STATUS_FORBIDDEN,
  STATUS_METHOD_NOT_ALLOWED,
  STATUS_NOT_FOUND,
  STATUS_OK,
  type StaticDecision,
}
