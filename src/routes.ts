/**
 * Optional HTTP-route companion for `@minhlucvan/dsh-plugin-template`.
 *
 * @module @minhlucvan/dsh-plugin-template/routes
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

import type { Context } from '@deepseek-ai/cordis'

/**
 * Route match kind: `exact` matches the pathname verbatim; `prefix` matches it
 * and its subtree.
 */
type RouteKind = 'exact' | 'prefix'

/** One named route registration, as the host's browser carrier accepts it. */
interface WebRoute {
  /** How the pathname is matched. */
  kind: RouteKind
  /** Absolute pathname, no trailing slash. */
  path: string
  /** Owns the full response lifecycle, including holding the response open. */
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}

/**
 * Minimal browser-carrier contract used without a host source checkout.
 *
 * The host's real service is richer — upgrade routes, a fallback seat, index
 * taps — but a companion that only adds one JSON endpoint must not depend on
 * the whole surface. Keeping the contract narrow is what lets this package
 * build and test against a fake while a composed profile supplies the real
 * one.
 */
interface WebServerLike {
  register: (route: WebRoute) => () => void
}

/** Cordis companion plugin name. */
const name = 'plugin-template-routes'

/** Service required before the companion can serve anything. */
const inject = ['webServer']

/** The one endpoint this template claims. */
const ROUTE_PATH = '/api/plugin-template/info'

/** Status code for a successful read. */
const STATUS_OK = 200

function isWebServerLike(value: unknown): value is WebServerLike {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  if (!('register' in value)) {
    return false
  }
  return typeof value.register === 'function'
}

/**
 * Resolve the host's browser carrier through Cordis's named service lookup.
 *
 * @param ctx - Cordis context carrying the host service.
 * @returns The host web server.
 * @throws {Error} When the companion is loaded without its host service.
 */
function getWebServer(ctx: Context): WebServerLike {
  const webServer: unknown = ctx.get('webServer')
  if (!isWebServerLike(webServer)) {
    throw new Error('route companion requires the "webServer" service')
  }
  return webServer
}

/**
 * Write one JSON response.
 *
 * `content-length` is set from the encoded byte length rather than the string
 * length, so a payload containing multi-byte characters is not truncated by a
 * length that counted characters.
 *
 * @param res - The response to own.
 * @param body - Any JSON-serializable value.
 */
function writeJson(res: ServerResponse, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(STATUS_OK, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

/**
 * Register this package's HTTP routes.
 *
 * @param ctx - Cordis context carrying the browser-carrier service.
 * @returns The route registration's disposer after setup succeeds.
 */
async function apply(ctx: Context): Promise<() => void> {
  const webServer = getWebServer(ctx)
  const disposer = webServer.register({
    kind: 'exact',
    path: ROUTE_PATH,
    handler: (_req, res) => {
      writeJson(res, { name, ok: true })
    },
  })
  // Preserve the asynchronous plugin contract after synchronous registration.
  await Promise.resolve(disposer)
  return disposer
}

export { apply, inject, name }
