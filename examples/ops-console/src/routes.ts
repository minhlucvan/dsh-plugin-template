/**
 * Route companion: the example's data endpoints on the host's carrier.
 *
 * `./server` starts a listener this package owns; this one seats endpoints on
 * the listener the _host_ already runs. Both are shown because the choice is
 * architectural, not cosmetic:
 *
 * - A route inherits the host's auth, trust fence and TLS, so it is the right
 *   place for anything the browser or an operator already reaches;
 * - An owned listener is reachable without the host knowing, so it is the right
 *   place for an inbound webhook or a callback that must not pass the fence.
 *
 * The audit trail is read at request time and reported as absent when the
 * policy companion is not mounted, rather than failing the request: a route
 * that 500s because an optional companion is missing is harder to diagnose than
 * one that says what is missing.
 *
 * @module @minhlucvan/dsh-plugin-ops-console/routes
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

import type { Context } from '@deepseek-ai/cordis'

import type { AuditEntry } from './policy.ts'
import { AUDIT_SERVICE } from './policy.ts'

/** Cordis companion plugin name. */
const name = 'ops-console-routes'

/** Service required before any route can be served. */
const inject = ['webServer']

/** Exact paths this companion claims. */
const ROUTE_INFO = '/api/ops-console/info'
const ROUTE_AUDIT = '/api/ops-console/audit'

/** Status code for a successful read. */
const STATUS_OK = 200

/** Route match kind as the host carrier accepts it. */
type RouteKind = 'exact' | 'prefix'

/** One route, as the host's browser carrier accepts it. */
interface WebRoute {
  /** How the pathname is matched. */
  kind: RouteKind
  /** Absolute pathname. */
  path: string
  /** Owns the full response lifecycle. */
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}

/** The slice of the host carrier this companion calls. */
interface WebServerLike {
  /** Register one route; the returned disposer unregisters it. */
  register: (route: WebRoute) => () => void
}

/** The slice of the audit service these routes read. */
interface AuditReader {
  /** Most recent entries, newest last. */
  entries: () => readonly AuditEntry[]
  /** How many calls the guard refused. */
  denials: () => number
}

function isWebServerLike(value: unknown): value is WebServerLike {
  if (typeof value !== 'object' || value === null || !('register' in value)) {
    return false
  }
  return typeof value.register === 'function'
}

function isAuditReader(value: unknown): value is AuditReader {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  if (!('entries' in value) || !('denials' in value)) {
    return false
  }
  return (
    typeof value.entries === 'function' && typeof value.denials === 'function'
  )
}

/**
 * Write one JSON response.
 *
 * `content-length` comes from the encoded byte length rather than the string
 * length, so a payload containing multi-byte characters is not truncated by a
 * length that counted characters.
 *
 * @param res - Response to own.
 * @param body - Any JSON-serializable value.
 * @param status - Status code to send.
 */
function writeJson(
  res: ServerResponse,
  body: unknown,
  status = STATUS_OK,
): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

/**
 * Apply the route companion.
 *
 * @param ctx - Cordis context carrying the host's browser carrier.
 * @returns Nothing; every registration is owned by the fiber.
 */
function apply(ctx: Context): void {
  const webServer: unknown = ctx.get('webServer')
  if (!isWebServerLike(webServer)) {
    throw new Error('ops-console routes require the "webServer" service')
  }

  ctx.effect(
    () =>
      webServer.register({
        kind: 'exact',
        path: ROUTE_INFO,
        handler: (_req, res) => {
          writeJson(res, {
            name,
            package: '@minhlucvan/dsh-plugin-ops-console',
            routes: [ROUTE_INFO, ROUTE_AUDIT],
          })
        },
      }),
    `ops-console: GET ${ROUTE_INFO}`,
  )

  ctx.effect(
    () =>
      webServer.register({
        kind: 'exact',
        path: ROUTE_AUDIT,
        handler: (_req, res) => {
          const audit: unknown = ctx.get(AUDIT_SERVICE)
          if (!isAuditReader(audit)) {
            writeJson(res, { available: false, entries: [], denials: 0 })
            return
          }
          writeJson(res, {
            available: true,
            denials: audit.denials(),
            entries: audit.entries(),
          })
        },
      }),
    `ops-console: GET ${ROUTE_AUDIT}`,
  )
}

export {
  apply,
  inject,
  name,
  ROUTE_AUDIT,
  ROUTE_INFO,
  writeJson,
  type WebServerLike,
}
