/**
 * The feature's settings form.
 *
 * One form, not a component per field: the page owns its draft, its save
 * behaviour and its layout, and receives everything else as props. It never
 * reaches for a service, so it stays testable and re-renderable in isolation.
 *
 * @module @your-scope/dsh-plugin-template/client/settings-page
 */

import type { ReactElement } from 'react'
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'

import type { SettingsScope } from './contracts.ts'
import type { ClientSettings } from './settings.ts'
import { normalizeSettings, settingsScopeSource } from './settings.ts'

/** Props the slot injects into this page. */
interface SettingsPageProps {
  /** Persisted settings scope. */
  scope: SettingsScope<ClientSettings>
  /** Translator bound to this feature's namespace. */
  translate: (key: string) => string
}

/** Message key for a save that is in flight. */
const SAVE_KEY_BUSY = 'saving'

/** Message key for an idle save button. */
const SAVE_KEY_IDLE = 'save'

/** DOM id shared by the input and its description. */
const MESSAGE_INPUT_ID = 'plugin-template-message'

/** DOM id of the hint paragraph describing the input. */
const MESSAGE_HINT_ID = 'plugin-template-message-hint'

/**
 * Choose the save button's label key without a bare conditional in the JSX.
 *
 * @param saving - Whether a save is in flight.
 * @returns The message key to translate.
 */
function saveLabelKey(saving: boolean): string {
  if (saving) {
    return SAVE_KEY_BUSY
  }
  return SAVE_KEY_IDLE
}

/**
 * Choose the value the field should display.
 *
 * @param dirty - Whether the user has typed since the last save or reset.
 * @param draft - The last typed value.
 * @param persisted - The value the host currently holds.
 * @returns The value to render.
 */
function fieldValue(dirty: boolean, draft: string, persisted: string): string {
  if (dirty) {
    return draft
  }
  return persisted
}

/**
 * Render the settings form.
 *
 * @param props - Slot-injected scope and translator.
 * @returns The form element.
 */
function SettingsPage({ scope, translate }: SettingsPageProps): ReactElement {
  const source = useMemo(() => settingsScopeSource(scope), [scope])
  /*
   * Subscribe to the leaf value rather than the snapshot object: a primitive
   * compares by value, so a scope that rebuilds its snapshot on every read
   * cannot spin useSyncExternalStore into an infinite render loop.
   */
  const persisted = useSyncExternalStore(
    source.subscribe,
    useCallback(() => source.getSnapshot().message, [source]),
  )
  /*
   * Dirty-tracking rather than an undefined draft. A draft initialized from the
   * snapshot would be overwritten by every external notification, discarding
   * what was typed; a separate flag keeps the typed value until save or reset.
   */
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const value = fieldValue(dirty, draft, persisted)

  /*
   * Synchronous handler that starts asynchronous work. React ignores a handler's
   * return value, so the promise is explicitly discarded with `void` rather than
   * awaited and handed back — see the allowAsStatement note in .oxlintrc.json.
   */
  const onSave = useCallback((): void => {
    const persist = async (): Promise<void> => {
      setSaving(true)
      try {
        await scope.mutate(normalizeSettings({ message: value }))
        setDirty(false)
      } finally {
        setSaving(false)
      }
    }
    void persist()
  }, [scope, value])

  const onReset = useCallback((): void => {
    setDirty(false)
  }, [])

  return (
    <section aria-label={translate('nav')}>
      <h2>{translate('heading')}</h2>
      <p>{translate('description')}</p>
      <label htmlFor={MESSAGE_INPUT_ID}>{translate('fieldLabel')}</label>
      <input
        id={MESSAGE_INPUT_ID}
        type='text'
        value={value}
        aria-describedby={MESSAGE_HINT_ID}
        onChange={(event) => {
          setDraft(event.target.value)
          setDirty(true)
        }}
      />
      <p id={MESSAGE_HINT_ID}>{translate('fieldHint')}</p>
      <button type='button' disabled={saving} onClick={onSave}>
        {translate(saveLabelKey(saving))}
      </button>
      <button type='button' onClick={onReset}>
        {translate('reset')}
      </button>
    </section>
  )
}

export { SettingsPage, type SettingsPageProps }
