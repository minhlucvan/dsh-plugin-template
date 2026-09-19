/**
 * The console's one host call.
 *
 * Kept apart from the components so the network boundary is explicit and
 * stubbable: a component test injects its own loader, and this module is the
 * only place that knows a URL exists. It always resolves — a console that
 * throws into React because a route is missing is harder to diagnose than one
 * that renders the reason.
 *
 * @module @minhlucvan/dsh-plugin-ops-console/client/api
 */

import type { AuditEntry } from './store.ts'

/** The route `./routes` seats on the host carrier. */
const AUDIT_ROUTE = '/api/ops-console/audit'

/** What a load reports back to the store. */
interface AuditPayload {
  /** Whether the host reports a policy companion. */
  available: boolean
  /** Rows the host returned, however they are shaped. */
  entries: AuditEntry[]
}

/** The store transitions a load drives. */
interface LoadTarget {
  /** Mark the fetch as started. */
  start: () => void
  /** Deliver a payload. */
  receive: (payload: AuditPayload) => void
  /** Record a failure. */
  fail: (reason: string) => void
}

/**
 * Whether a decoded payload carries the two fields a load needs.
 *
 * @param value - Decoded JSON, however malformed.
 * @returns True when the value can be handed to the store.
 */
function isAuditPayload(value: unknown): value is AuditPayload {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  if (!('available' in value) || !('entries' in value)) {
    return false
  }
  const { available, entries } = value
  return typeof available === 'boolean' && Array.isArray(entries)
}

/**
 * Read the audit trail from the host and deliver it to a store.
 *
 * @param target - Store transitions to drive.
 * @param fetcher - Fetch implementation; injected so tests need no network.
 * @returns Nothing once the store has been updated.
 */
async function loadAudit(
  target: LoadTarget,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  target.start()
  try {
    const response = await fetcher(AUDIT_ROUTE, {
      headers: { accept: 'application/json' },
    })
    if (!response.ok) {
      target.fail(`audit route answered ${String(response.status)}`)
      return
    }
    const decoded: unknown = await response.json()
    if (!isAuditPayload(decoded)) {
      target.fail('audit route returned an unexpected payload')
      return
    }
    target.receive({
      available: decoded.available,
      // The store validates each row; this only guarantees an array.
      entries: decoded.entries,
    })
  } catch (error) {
    if (error instanceof Error) {
      target.fail(error.message)
      return
    }
    target.fail('audit route unreachable')
  }
}

export {
  AUDIT_ROUTE,
  isAuditPayload,
  loadAudit,
  type AuditPayload,
  type LoadTarget,
}
