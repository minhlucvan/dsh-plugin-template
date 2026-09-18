/**
 * The slot-facing page.
 *
 * This is the seam between the host and the feature's React tree: the host
 * injects the scope and translator as props, and everything below this file
 * reads its state from the scoped store instead. The page holds no state and no
 * rendering logic of its own, so it does not grow as the form does.
 *
 * @module @minhlucvan/dsh-plugin-template/client/settings-page
 */

import type { ReactElement } from 'react'

import { SettingsStoreProvider } from './context.tsx'
import type { SettingsScope } from './contracts.ts'
import { SettingsSection } from './settings-section.tsx'
import type { ClientSettings } from './settings.ts'
import type { Translate } from './translate.ts'

/** Props the slot injects into this page. */
interface SettingsPageProps {
  /** Persisted settings scope this instance edits. */
  scope: SettingsScope<ClientSettings>
  /** Translator bound to this feature's namespace. */
  translate: Translate
}

/**
 * Render the settings page.
 *
 * @param props - Slot-injected scope and translator.
 * @returns The provider-wrapped section.
 */
function SettingsPage({ scope, translate }: SettingsPageProps): ReactElement {
  return (
    <SettingsStoreProvider scope={scope}>
      <SettingsSection translate={translate} />
    </SettingsStoreProvider>
  )
}

export { SettingsPage, type SettingsPageProps }
