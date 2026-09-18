/**
 * Custom hooks over the scoped settings store.
 *
 * These are the only supported way for a component to reach settings state.
 * Each hook selects the narrowest slice it needs, because zustand re-renders a
 * consumer when its selection changes by reference: subscribing to the whole
 * state object would re-render every field on every keystroke in any field.
 *
 * @module @minhlucvan/dsh-plugin-template/client/hooks
 */

import { useCallback } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import { useSettingsStore } from './context.tsx'
import type { SettingsActions, SettingsState } from './store.ts'

/** What a form field binds to. */
interface SettingsField {
  /** The text to display in the field. */
  value: string
  /** Whether the field's commit control should be disabled. */
  disabled: boolean
  /** Record typed text. */
  onChange: (value: string) => void
}

/**
 * Read this instance's whole settings state.
 *
 * Prefer a narrower hook where one fits; this is for a container that genuinely
 * renders from several fields at once.
 *
 * @returns The current settings state.
 */
function useSettings(): SettingsState {
  return useStore(
    useSettingsStore(),
    useShallow((state: SettingsState) => state),
  )
}

/**
 * Read only what the field needs to render.
 *
 * `useShallow` compares the picked fields by value, so a change to `saving` —
 * or to any other slice — does not re-render the input that shows the draft.
 *
 * @returns The displayed text, and whether the field is currently editable.
 */
function useSettingsDraft(): Pick<
  SettingsState,
  'draft' | 'dirty' | 'persisted' | 'saving' | 'error'
> {
  return useStore(
    useSettingsStore(),
    useShallow((state: SettingsState) => ({
      draft: state.draft,
      dirty: state.dirty,
      persisted: state.persisted,
      saving: state.saving,
      error: state.error,
    })),
  )
}

/**
 * Read the store's actions.
 *
 * Actions are stable for the life of the store, so this selection never causes
 * a re-render; `useShallow` keeps it from allocating a fresh object each call
 * and defeating that.
 *
 * @returns The store's state transitions.
 */
function useSettingsActions(): SettingsActions {
  return useStore(
    useSettingsStore(),
    useShallow((state: SettingsActions) => ({
      setDraft: state.setDraft,
      reset: state.reset,
      save: state.save,
      sync: state.sync,
    })),
  )
}

/**
 * Read the value the field should show.
 *
 * A clean form follows the host; an edited one keeps what the user typed. The
 * store records which persisted value the draft was seeded from, so this is a
 * decision the store already made rather than one re-derived during render.
 *
 * @param state - The state slice from {@link useSettingsDraft}.
 * @returns The text to render.
 */
function displayValue(
  state: Pick<SettingsState, 'draft' | 'dirty' | 'persisted'>,
): string {
  if (state.dirty) {
    return state.draft
  }
  return state.persisted
}

/**
 * Bind a text field to the scoped store.
 *
 * The composite hook a field component actually consumes: one call, no props,
 * and no knowledge of zustand or the host scope.
 *
 * @returns The field's current value, disabled state, and change handler.
 */
function useSettingsField(): SettingsField {
  const state = useSettingsDraft()
  const { setDraft } = useSettingsActions()

  const onChange = useCallback(
    (value: string): void => {
      setDraft(value)
    },
    [setDraft],
  )

  return { value: displayValue(state), disabled: state.saving, onChange }
}

/** What the commit controls bind to. */
interface SettingsControls {
  /** Whether a save is in flight. */
  saving: boolean
  /** Whether the draft differs from the persisted value. */
  dirty: boolean
  /** The last save failure, absent when the previous save succeeded. */
  error?: string | undefined
  /** Persist the normalized draft. */
  save: () => Promise<void>
  /** Discard the draft. */
  reset: () => void
}

/**
 * Bind the save and reset controls to the scoped store.
 *
 * `save` is returned as the store's own stable action rather than a wrapper, so
 * passing it straight to an `onClick` cannot change identity between renders.
 *
 * @returns The controls' state and actions.
 */
function useSettingsControls(): SettingsControls {
  const { dirty, saving, error } = useSettingsDraft()
  const { save, reset } = useSettingsActions()
  return { saving, dirty, error, save, reset }
}

export {
  displayValue,
  useSettings,
  useSettingsActions,
  useSettingsControls,
  useSettingsDraft,
  useSettingsField,
  type SettingsControls,
  type SettingsField,
}
