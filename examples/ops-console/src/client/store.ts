/**
 * The example's client store.
 *
 * Built on `zustand/vanilla` so it imports no React: the audit rules and the
 * policy filter are then testable in plain Node, and React reaches them only
 * through `./hooks.ts`. One store is created per mounted plugin instance by the
 * provider in `./index.tsx`, never at module scope — a module-scope store would
 * be shared by two mounted copies and by every test.
 *
 * @module @minhlucvan/dsh-plugin-ops-console/client/store
 */

import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'

/** One recorded tool call, as the host route reports it. */
interface AuditEntry {
  /** Tool that was called. */
  tool: string
  /** Whether the policy guard refused it. */
  denied: boolean
  /** The guard's reason, when it refused. */
  reason?: string
}

/** Everything the console renders from. */
interface ConsoleState {
  /** Calls fetched from the host, newest last. */
  entries: AuditEntry[]
  /** Whether the host reports a policy companion at all. */
  available: boolean
  /** Whether a fetch is in flight. */
  loading: boolean
  /** Why the last fetch failed, `undefined` when it did not. */
  error: string | undefined
  /** Tool name the operator is filtering by. */
  filter: string
  /** Whether to show only refused calls. */
  deniedOnly: boolean
}

/** The transitions the UI may perform. */
interface ConsoleActions {
  /** Replace the audit trail, as fetched from the host. */
  receive: (payload: { available: boolean; entries: AuditEntry[] }) => void
  /** Record a fetch failure. */
  fail: (reason: string) => void
  /** Mark a fetch as started. */
  start: () => void
  /** Set the tool-name filter. */
  setFilter: (filter: string) => void
  /** Show only refused calls, or all of them. */
  setDeniedOnly: (deniedOnly: boolean) => void
}

/** Read and transition the console state. */
type ConsoleStore = StoreApi<ConsoleState & ConsoleActions>

/**
 * Whether a payload entry is shaped like an audit record.
 *
 * The route is another process's data, so it is validated rather than trusted:
 * a malformed row must not crash the table that renders it.
 *
 * @param value - Candidate entry.
 * @returns True when the value carries the fields the table reads.
 */
function isAuditEntry(value: unknown): value is AuditEntry {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  if (!('tool' in value) || !('denied' in value)) {
    return false
  }
  const { tool, denied } = value
  return typeof tool === 'string' && typeof denied === 'boolean'
}

/**
 * Filter an audit trail for display.
 *
 * Pure so the two rules — a case-insensitive name match and a denied-only view
 * — are assertable without a store or a DOM.
 *
 * @param entries - Trail as recorded, newest last.
 * @param filter - Tool-name substring, empty for no name filter.
 * @param deniedOnly - Whether to drop allowed calls.
 * @returns The rows to render, newest first.
 */
function visible(
  entries: AuditEntry[],
  filter: string,
  deniedOnly: boolean,
): AuditEntry[] {
  const needle = filter.trim().toLowerCase()
  return entries
    .filter((entry) => {
      if (deniedOnly && !entry.denied) {
        return false
      }
      if (needle === '') {
        return true
      }
      return entry.tool.toLowerCase().includes(needle)
    })
    .toReversed()
}

/**
 * Build a console store.
 *
 * @returns A store carrying the console state and its actions.
 */
function createConsoleStore(): ConsoleStore {
  return createStore<ConsoleState & ConsoleActions>()((set) => ({
    entries: [],
    available: false,
    loading: false,
    error: undefined,
    filter: '',
    deniedOnly: false,

    start: (): void => {
      set({ loading: true, error: undefined })
    },

    receive: (payload): void => {
      // Drop malformed rows instead of rendering them: the trail crosses a
      // Process boundary, so nothing about its shape is guaranteed.
      const entries = payload.entries.filter(isAuditEntry)
      set({
        entries,
        available: payload.available,
        loading: false,
        error: undefined,
      })
    },

    fail: (reason: string): void => {
      set({ loading: false, error: reason })
    },

    setFilter: (filter: string): void => {
      set({ filter })
    },

    setDeniedOnly: (deniedOnly: boolean): void => {
      set({ deniedOnly })
    },
  }))
}

export {
  createConsoleStore,
  isAuditEntry,
  visible,
  type AuditEntry,
  type ConsoleActions,
  type ConsoleState,
  type ConsoleStore,
}
