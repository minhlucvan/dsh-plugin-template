/**
 * Custom hooks over the console store.
 *
 * Each hook selects the narrowest slice it needs. zustand re-renders a consumer
 * when its selection changes by reference, so a hook that returned the whole
 * state would re-render every row when the operator typed one character into
 * the filter.
 *
 * @module @minhlucvan/dsh-plugin-ops-console/client/hooks
 */

import { useCallback, useEffect } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import { useConsoleStore } from './context'
import type { AuditEntry, ConsoleState } from './store.ts'
import { visible } from './store.ts'

/** The rows to render plus the counts the header shows. */
interface ConsoleView {
  /** Rows to render, newest first, already filtered. */
  rows: AuditEntry[]
  /** Total rows fetched, before filtering. */
  total: number
  /** Rows the policy refused, before filtering. */
  denied: number
  /** Whether the host reports a policy companion. */
  available: boolean
  /** Whether a fetch is in flight. */
  loading: boolean
  /** Why the last fetch failed, if it did. */
  error: string | undefined
}

/**
 * Read the filtered view and its counts.
 *
 * `useShallow` compares the returned fields by value, so selecting several at
 * once does not re-render on every unrelated store change.
 *
 * @returns The view the panel renders.
 */
function useConsoleView(): ConsoleView {
  return useStore(
    useConsoleStore(),
    useShallow((state: ConsoleState) => ({
      rows: visible(state.entries, state.filter, state.deniedOnly),
      total: state.entries.length,
      denied: state.entries.filter((entry) => entry.denied).length,
      available: state.available,
      loading: state.loading,
      error: state.error,
    })),
  )
}

/** The filter controls' state and handlers. */
interface FilterControls {
  /** Current tool-name filter. */
  filter: string
  /** Whether only refused calls are shown. */
  deniedOnly: boolean
  /** Update the tool-name filter. */
  onFilter: (value: string) => void
  /** Toggle the denied-only view. */
  onDeniedOnly: (value: boolean) => void
  /** Re-read the trail from the host. */
  refresh: () => void
}

/**
 * Bind the filter controls to the store.
 *
 * @param load - Loader that re-reads the trail from the host.
 * @returns The controls' state and handlers.
 */
function useFilterControls(load: () => void): FilterControls {
  const { filter, deniedOnly, setFilter, setDeniedOnly } = useStore(
    useConsoleStore(),
    useShallow(
      (
        state: ConsoleState & {
          setFilter: (value: string) => void
          setDeniedOnly: (value: boolean) => void
        },
      ) => ({
        filter: state.filter,
        deniedOnly: state.deniedOnly,
        setFilter: state.setFilter,
        setDeniedOnly: state.setDeniedOnly,
      }),
    ),
  )

  const onFilter = useCallback(
    (value: string): void => {
      setFilter(value)
    },
    [setFilter],
  )

  const onDeniedOnly = useCallback(
    (value: boolean): void => {
      setDeniedOnly(value)
    },
    [setDeniedOnly],
  )

  return { filter, deniedOnly, onFilter, onDeniedOnly, refresh: load }
}

/**
 * Load the audit trail once on mount.
 *
 * The fetch is owned by this hook rather than by the store so the store stays
 * free of environment assumptions — it can be driven from a test by calling
 * `receive` directly, with no fetch anywhere in sight.
 *
 * @param load - Loader that reads the trail and updates the store.
 */
function useInitialLoad(load: () => void): void {
  useEffect(() => {
    load()
  }, [load])
}

export {
  useConsoleView,
  useFilterControls,
  useInitialLoad,
  type ConsoleView,
  type FilterControls,
}
