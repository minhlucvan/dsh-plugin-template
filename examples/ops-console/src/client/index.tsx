/**
 * Browser client entry: registration only.
 *
 * It resolves the host services it needs through narrow local contracts,
 * creates the console store once for this mounted instance, and seats one
 * component in one slot. It holds no rendering logic and no state of its own.
 *
 * Note what the store is _not_: module scope. Two mounted copies of this plugin
 * — and every test in the suite — would share a module-scope store, so one
 * console's audit trail would appear in another's. Creating it here makes the
 * store's lifetime the mounted instance's.
 *
 * @module @minhlucvan/dsh-plugin-ops-console/client
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ReactElement } from 'react'

import { ConsolePanel } from './console-panel'
import { ConsoleStoreProvider } from './context'
import { LOCALE_NAMESPACE, locales } from './locale.ts'
import { createConsoleStore } from './store.ts'
import type { ConsoleStore } from './store.ts'
import type { Translate } from './translate.ts'

/** Client plugin name; keep this stable after publishing. */
const name = 'ops-console-client'

/** Host services required before the client can seat anything. */
const inject = ['locale', 'slots']

/** Slot this feature seats a component in. */
const SLOT_NAME = 'settings.section'

/** This feature's seat within that slot. */
const SLOT_ID = 'ops-console'

/** Seat order among the slot's other seats. */
const SLOT_ORDER = 40

/** Dictionaries as the locale service accepts them. */
type LocaleDictionaries = Record<string, Record<string, string>>

/** Locale registry: dictionaries plus a translator bound to one namespace. */
interface LocaleService {
  /** Register one namespace's dictionaries; returns the removal disposer. */
  register: (namespace: string, dictionaries: LocaleDictionaries) => () => void
  /** Bind a translator to one namespace. */
  bind: (namespace: string) => Translate
}

/** One slot registration descriptor. */
interface SlotRegistration {
  /** Slot name this seat belongs to. */
  name: string
  /** Seat identifier, unique within the slot. */
  id: string
  /** Sort order among the slot's seats. */
  order: number
  /** Seat label, resolved at render time. */
  label: () => string
  /** Props handed to the component, resolved at render time. */
  inject: () => Record<string, unknown>
}

/** Slot registry the client registers into. */
interface SlotsService {
  /** Run `callback` once the named slot exists. */
  inject: (name: string, callback: () => void) => void
  /** Seat a component in a slot; returns the removal disposer. */
  register: (slot: SlotRegistration, component: unknown) => () => void
}

function isLocaleService(value: unknown): value is LocaleService {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  if (!('register' in value) || !('bind' in value)) {
    return false
  }
  return (
    typeof value.register === 'function' && typeof value.bind === 'function'
  )
}

function isSlotsService(value: unknown): value is SlotsService {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  if (!('inject' in value) || !('register' in value)) {
    return false
  }
  return (
    typeof value.inject === 'function' && typeof value.register === 'function'
  )
}

/**
 * Resolve a host service through its narrow local contract.
 *
 * @param value - Whatever the named lookup returned.
 * @param guard - Type guard for the narrow contract.
 * @param service - Service name, for a failure that names the cause.
 * @returns The narrowed service.
 * @throws {Error} When the service is absent or does not match its contract.
 */
function requireService<TService>(
  value: unknown,
  guard: (candidate: unknown) => candidate is TService,
  service: string,
): TService {
  if (!guard(value)) {
    throw new Error(`ops-console client requires the "${service}" service`)
  }
  return value
}

/**
 * Build the component this feature seats.
 *
 * The slot registry takes a component reference and calls the descriptor's
 * `inject()` at render time to produce its props. The store and translator are
 * already known here, so the seat takes no props of its own and closes over
 * them — which is also what makes the provider able to stay above the panel
 * while `ConsolePanel` itself reads the store through context.
 *
 * @param store - Store this seat reads.
 * @param translate - Translator bound to this feature's namespace.
 * @returns The component to register.
 */
function makeSeat(
  store: ConsoleStore,
  translate: Translate,
): () => ReactElement {
  return function OpsConsoleSeat(): ReactElement {
    return (
      <ConsoleStoreProvider store={store}>
        <ConsolePanel store={store} translate={translate} />
      </ConsoleStoreProvider>
    )
  }
}

/**
 * Register this package's browser face.
 *
 * @param ctx - Client Cordis context carrying the host services.
 * @returns Nothing; every registration is owned by the fiber.
 */
function apply(ctx: Context): void {
  const locale = requireService(ctx.get('locale'), isLocaleService, 'locale')
  const slots = requireService(ctx.get('slots'), isSlotsService, 'slots')

  ctx.effect(
    () => locale.register(LOCALE_NAMESPACE, locales),
    'client: dictionaries',
  )

  const translate = locale.bind(LOCALE_NAMESPACE)
  const store = createConsoleStore()

  /*
   * The callback runs once the slot exists, which may be after `apply` returns.
   * Registering inside an effect keeps the seat tied to the fiber either way, so
   * a later disposal still releases it.
   */
  slots.inject(SLOT_NAME, () => {
    ctx.effect(
      () =>
        slots.register(
          {
            name: SLOT_NAME,
            id: SLOT_ID,
            order: SLOT_ORDER,
            label: () => translate('nav'),
            inject: () => ({ store, translate }),
          },
          makeSeat(store, translate),
        ),
      'client: ops console section',
    )
  })
}

export { apply, inject, makeSeat, name, SLOT_ID, SLOT_NAME, SLOT_ORDER }
