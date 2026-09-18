/**
 * The feature's zustand store: the single source of truth for settings state.
 *
 * The store is built on `zustand/vanilla` rather than `zustand`, so it imports
 * no React and can be constructed and exercised in plain Node. React reaches it
 * only through `./hooks.ts`, which is what keeps this file testable without a
 * DOM and keeps the components free of state logic.
 *
 * State ownership is deliberately split: the store holds the _mutable_ settings
 * state, while `SettingsScope` (the host's persisted scope) is the _external_
 * authority. `connectSettingsScope` mirrors the host into the store, and `save`
 * writes back through it, so a host-side change is never silently divergent.
 *
 * @module @minhlucvan/dsh-plugin-template/client/store
 */

import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'

import type { SettingsScope } from './contracts.ts'
import type { ClientSettings } from './settings.ts'
import { normalizeSettings } from './settings.ts'

/** Everything the settings UI renders from. */
interface SettingsState {
  /** The value the host currently holds, normalized. */
  persisted: string
  /** The value the user has typed. */
  draft: string
  /**
   * The persisted value the current draft was seeded from.
   *
   * Comparing this against `persisted` is what distinguishes "the user edited"
   * from "the host changed underneath us": only a draft seeded from the _old_
   * persistent value is worth protecting from an external update, so a clean
   * form follows the host while an edited one keeps what was typed.
   */
  draftOrigin: string
  /** Whether the draft differs from what the host holds. */
  dirty: boolean
  /** Whether a save is in flight. */
  saving: boolean
  /**
   * Human-readable reason the last save failed, `undefined` when it did not.
   *
   * Declared as a required `string | undefined` rather than an optional field:
   * under `exactOptionalPropertyTypes` an optional field cannot be explicitly
   * set back to `undefined`, which is exactly what clearing an error requires.
   */
  error: string | undefined
}

/** The state transitions the UI may perform. */
interface SettingsActions {
  /** Record typed text. */
  setDraft: (draft: string) => void
  /** Discard the draft and fall back to the persisted value. */
  reset: () => void
  /** Persist the normalized draft through the host scope. */
  save: () => Promise<void>
  /** Adopt an externally-provided persisted value. */
  sync: (persisted: string) => void
}

/** Read and transition the settings state. */
type SettingsStore = StoreApi<SettingsState & SettingsActions>

/**
 * Turn a thrown value into a message worth showing.
 *
 * @param error - Whatever the host `mutate` rejected with. Not necessarily an
 *   `Error`, which is why this narrows rather than casting.
 * @returns The error's message, or a generic one for a non-`Error` rejection.
 */
function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'save failed'
}

/**
 * Resolve the state an external persisted value produces.
 *
 * Pure so the "protect an edited draft" rule can be tested without a store or a
 * host. A state whose draft is still the one it was seeded from follows the new
 * value; one holding a user's edit keeps the edit and only rebases the
 * baseline.
 *
 * @param state - Current state.
 * @param persisted - The value the host now holds.
 * @returns The state fields an external update replaces.
 */
function externalUpdate(
  state: SettingsState,
  persisted: string,
): Pick<SettingsState, 'persisted' | 'draft' | 'draftOrigin' | 'dirty'> {
  if (state.dirty && state.draft !== state.draftOrigin) {
    return {
      persisted,
      draft: state.draft,
      draftOrigin: persisted,
      dirty: true,
    }
  }
  return { persisted, draft: persisted, draftOrigin: persisted, dirty: false }
}

/**
 * Resolve the state a reset produces.
 *
 * @param state - Current state.
 * @returns The state fields a reset replaces.
 */
function resetState(
  state: SettingsState,
): Pick<SettingsState, 'draft' | 'draftOrigin' | 'dirty' | 'error'> {
  return {
    draft: state.persisted,
    draftOrigin: state.persisted,
    dirty: false,
    error: undefined,
  }
}

/**
 * Build a settings store bound to one host scope.
 *
 * @param scope - The host's persisted settings scope for this namespace.
 * @returns A store carrying the settings state and its actions.
 */
function createSettingsStore(
  scope: SettingsScope<ClientSettings>,
): SettingsStore {
  const initial = normalizeSettings(scope.getSnapshot()).message

  return createStore<SettingsState & SettingsActions>()((set, get) => ({
    persisted: initial,
    draft: initial,
    draftOrigin: initial,
    dirty: false,
    saving: false,
    error: undefined,

    setDraft: (draft: string): void => {
      set({ draft, dirty: draft !== get().persisted })
    },

    reset: (): void => {
      set((state) => resetState(state))
    },

    sync: (persisted: string): void => {
      set((state) => externalUpdate(state, persisted))
    },

    save: async (): Promise<void> => {
      set({ saving: true, error: undefined })
      try {
        await scope.mutate(normalizeSettings({ message: get().draft }))
        set({ saving: false, dirty: false })
      } catch (error) {
        /*
         * Keep the draft on failure: discarding a user's text because the write
         * failed is the one outcome they cannot recover from. The reason is
         * recorded instead so the UI can surface it.
         */
        set({ saving: false, error: messageOf(error) })
      }
    },
  }))
}

/**
 * Mirror the host scope into a store.
 *
 * The subscription is returned rather than registered so the caller owns
 * disposal: in the browser that is the plugin fiber, which must release it on
 * unload or the store outlives the component that created it.
 *
 * @param store - Store to keep in sync.
 * @param scope - The host's persisted settings scope.
 * @returns The unsubscribe function.
 */
function connectSettingsScope(
  store: SettingsStore,
  scope: SettingsScope<ClientSettings>,
): () => void {
  store.getState().sync(normalizeSettings(scope.getSnapshot()).message)
  return scope.subscribe(() => {
    store.getState().sync(normalizeSettings(scope.getSnapshot()).message)
  })
}

export {
  connectSettingsScope,
  createSettingsStore,
  externalUpdate,
  resetState,
  type SettingsActions,
  type SettingsState,
  type SettingsStore,
}
