/**
 * Client settings model: the persisted shape, its defaults, boundary
 * normalization, and the receiver-safe source React consumes.
 *
 * @module @your-scope/dsh-plugin-template/client/settings
 */

import type { SettingsScope } from './contracts.ts'

/** Settings this feature persists. */
interface ClientSettings {
  /** Message written when the plugin activates. */
  message: string
}

/** Upper bound on the stored message, so a paste cannot grow without limit. */
const MAX_MESSAGE_LENGTH = 200

/**
 * Index of a string's first character, named to keep it out of the magic-number
 * rule.
 */
const FIRST_CHARACTER = 0

/** Defaults applied when nothing is persisted or a value is unusable. */
const defaultSettings: ClientSettings = {
  message: 'DSH plugin template loaded',
}

/**
 * Normalize whatever the host hands back into a valid snapshot.
 *
 * Missing, legacy, wrong-typed and blank values all resolve to the default
 * rather than reaching the form, so the draft never starts from `undefined`.
 * Normalizing here is what keeps the page free of defensive checks.
 *
 * @param value - The raw persisted value, however malformed. Omitted is itself
 *   a valid malformed input and resolves to the default.
 * @returns A complete, valid settings snapshot.
 */
function normalizeSettings(value?: unknown): ClientSettings {
  if (typeof value !== 'object' || value === null) {
    return { ...defaultSettings }
  }
  if (!('message' in value)) {
    return { ...defaultSettings }
  }
  const { message } = value
  if (typeof message !== 'string') {
    return { ...defaultSettings }
  }
  const trimmed = message.trim()
  if (trimmed === '') {
    return { ...defaultSettings }
  }
  return { message: trimmed.slice(FIRST_CHARACTER, MAX_MESSAGE_LENGTH) }
}

/** Read-only source React can consume through `useSyncExternalStore`. */
interface SettingsSource<TValue> {
  /** Read the current snapshot. */
  getSnapshot: () => TValue
  /** Subscribe to changes; returns an unsubscribe function. */
  subscribe: (listener: () => void) => () => void
}

/**
 * Wrap a settings scope so React can call its members safely.
 *
 * The host scope exposes instance methods that read their own state through
 * `this`. React invokes the callbacks it is handed as bare functions, so
 * `useSyncExternalStore(scope.subscribe, scope.getSnapshot)` throws during
 * render — and a section that crashes while rendering abdicates, which removes
 * its nav row instead of showing an error. Returning an object of arrow
 * functions keeps the receiver by construction.
 *
 * @param scope - The host settings scope.
 * @returns A receiver-safe source.
 */
function settingsScopeSource<TValue>(
  scope: SettingsScope<TValue>,
): SettingsSource<TValue> {
  return {
    getSnapshot: () => scope.getSnapshot(),
    subscribe: (listener: () => void) => scope.subscribe(listener),
  }
}

export {
  defaultSettings,
  normalizeSettings,
  settingsScopeSource,
  type ClientSettings,
  type SettingsSource,
}
