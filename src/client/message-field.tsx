/**
 * The settings field: a presentational component with no state of its own.
 *
 * It reads and writes through `useSettingsField`, so it never receives a value,
 * a change handler, or the host scope as props — which is what lets it be
 * dropped into another slot, or rendered twice, without rewiring anything.
 *
 * @module @minhlucvan/dsh-plugin-template/client/message-field
 */

import type { ReactElement } from 'react'

import { useSettingsField } from './hooks.ts'
import type { Translate } from './translate.ts'

/** DOM id shared by the input and its label. */
const MESSAGE_INPUT_ID = 'plugin-template-message'

/** DOM id of the hint paragraph describing the input. */
const MESSAGE_HINT_ID = 'plugin-template-message-hint'

/** Props accepted by {@link MessageField}. */
interface MessageFieldProps {
  /** Translator bound to this feature's namespace. */
  translate: Translate
}

/**
 * Render the load-message input.
 *
 * @param props - The bound translator. The value and handler come from the
 *   scoped store rather than the caller.
 * @returns The labelled input and its hint.
 */
function MessageField({ translate }: MessageFieldProps): ReactElement {
  const { value, disabled, onChange } = useSettingsField()

  return (
    <>
      <label htmlFor={MESSAGE_INPUT_ID}>{translate('fieldLabel')}</label>
      <input
        id={MESSAGE_INPUT_ID}
        type='text'
        value={value}
        disabled={disabled}
        aria-describedby={MESSAGE_HINT_ID}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
      <p id={MESSAGE_HINT_ID}>{translate('fieldHint')}</p>
    </>
  )
}

export {
  MessageField,
  MESSAGE_HINT_ID,
  MESSAGE_INPUT_ID,
  type MessageFieldProps,
}
