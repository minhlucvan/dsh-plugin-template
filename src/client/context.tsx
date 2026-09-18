/**
 * React context that scopes one settings store to one plugin instance.
 *
 * A zustand store created at module scope would be shared by every instance of
 * this plugin — and by every test that mounts it — so two mounted copies would
 * silently edit each other's state. The provider creates the store once per
 * mount instead and hands it down through context, which is what makes the
 * store's lifetime match the component tree's.
 *
 * @module @minhlucvan/dsh-plugin-template/client/context
 */

import type { ReactElement, ReactNode } from 'react'
import { createContext, useContext, useEffect, useState } from 'react'

import type { SettingsScope } from './contracts.ts'
import type { ClientSettings } from './settings.ts'
import type { SettingsStore } from './store.ts'
import { connectSettingsScope, createSettingsStore } from './store.ts'

/**
 * The scoped store, or `undefined` when read outside the provider.
 *
 * `undefined` rather than a throw-on-read proxy: the consumer is `useStore`
 * below, which turns the absent value into an error naming the mis-wiring.
 */
const SettingsStoreContext = createContext<SettingsStore | undefined>(undefined)

/** Props accepted by {@link SettingsStoreProvider}. */
interface SettingsStoreProviderProps {
  /** The host's persisted settings scope this store mirrors. */
  scope: SettingsScope<ClientSettings>
  /** The tree allowed to read the store. */
  children: ReactNode
}

/**
 * Create this instance's store and expose it to `children`.
 *
 * The store is created in a `useState` initializer, not a `useMemo`: a memo is
 * permitted to discard and rebuild its value, which would reset user state
 * mid-session, while state is guaranteed to persist across renders.
 *
 * @param props - The host scope and the subtree to scope it to.
 * @returns The provider element.
 */
function SettingsStoreProvider({
  scope,
  children,
}: SettingsStoreProviderProps): ReactElement {
  const [store] = useState(() => createSettingsStore(scope))

  /*
   * The host scope is the external authority. Subscribing here — rather than in
   * the store — keeps the store free of React, and returning the unsubscribe
   * from the effect ties the subscription to this component's lifetime.
   */
  useEffect(() => connectSettingsScope(store, scope), [store, scope])

  return (
    <SettingsStoreContext.Provider value={store}>
      {children}
    </SettingsStoreContext.Provider>
  )
}

/**
 * Read the scoped store, or fail with the reason it is missing.
 *
 * @returns The store for the nearest provider.
 * @throws {Error} When called outside {@link SettingsStoreProvider}.
 */
function useSettingsStore(): SettingsStore {
  const store = useContext(SettingsStoreContext)
  if (store === undefined) {
    throw new Error(
      'useSettingsStore must be called inside a SettingsStoreProvider; '
        + 'render the component through the plugin slot rather than in isolation',
    )
  }
  return store
}

export {
  SettingsStoreProvider,
  useSettingsStore,
  type SettingsStoreProviderProps,
}
