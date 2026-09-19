/**
 * A plugin-local zustand store passed through React context.
 *
 * This is the second half of the "zustand without a module-scope store" story:
 * the plugin's own client entry creates the store once, per mounted instance,
 * and this context hands it to the components. Creating it at module scope
 * would let two mounted copies — and every test — share one store and edit each
 * other's audit trail.
 *
 * @module @minhlucvan/dsh-plugin-ops-console/client/context
 */

import type { ReactElement, ReactNode } from 'react'
import { createContext, useContext } from 'react'

import type { ConsoleStore } from './store.ts'

/**
 * The scoped store, or `undefined` outside the provider.
 *
 * `undefined` rather than a throwing default: the reader below turns the absent
 * value into an error that names the wiring mistake.
 */
const ConsoleStoreContext = createContext<ConsoleStore | undefined>(undefined)

/** Props accepted by {@link ConsoleStoreProvider}. */
interface ConsoleStoreProviderProps {
  /** Store this subtree reads. */
  store: ConsoleStore
  /** Subtree allowed to read it. */
  children: ReactNode
}

/**
 * Expose a store to a subtree.
 *
 * @param props - The store and the subtree.
 * @returns The provider element.
 */
function ConsoleStoreProvider({
  store,
  children,
}: ConsoleStoreProviderProps): ReactElement {
  return (
    <ConsoleStoreContext.Provider value={store}>
      {children}
    </ConsoleStoreContext.Provider>
  )
}

/**
 * Read the scoped store, or fail with the reason it is missing.
 *
 * @returns The store for the nearest provider.
 * @throws {Error} When called outside {@link ConsoleStoreProvider}.
 */
function useConsoleStore(): ConsoleStore {
  const store = useContext(ConsoleStoreContext)
  if (store === undefined) {
    throw new Error(
      'useConsoleStore must be called inside a ConsoleStoreProvider; '
        + 'render the panel through the plugin slot rather than in isolation',
    )
  }
  return store
}

export { ConsoleStoreProvider, useConsoleStore, type ConsoleStoreProviderProps }
