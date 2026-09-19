/**
 * The console panel: a filter toolbar over an audit table.
 *
 * It receives only the store and a translator, and reads everything else
 * through hooks — no state is prop-drilled, so adding a column or a filter is a
 * change to this file and `./hooks.ts`, not to the registration that mounts
 * it.
 *
 * @module @minhlucvan/dsh-plugin-ops-console/client/console-panel
 */

import type { ReactElement } from 'react'
import { useCallback, useState } from 'react'

import { loadAudit } from './api.ts'
import { useConsoleView, useFilterControls, useInitialLoad } from './hooks.ts'
import type { AuditEntry, ConsoleStore } from './store.ts'
import type { Translate } from './translate.ts'

/** DOM id shared by the filter input and its label. */
const FILTER_INPUT_ID = 'ops-console-filter'

/** A table with no rows renders its empty state instead. */
const NO_ROWS = 0

/** Props the slot injects into this panel. */
interface ConsolePanelProps {
  /** Store this panel reads and drives. */
  store: ConsoleStore
  /** Translator bound to this feature's namespace. */
  translate: Translate
}

/**
 * Build the stable loader this panel drives the store with.
 *
 * A loader is scoped to a store, so it lives here rather than in `./api.ts`,
 * which knows only the URL and the response shape.
 *
 * @param store - Store the load updates.
 * @returns A loader whose identity is stable for the store's lifetime.
 */
function useAuditLoader(store: ConsoleStore): () => void {
  return useCallback((): void => {
    void loadAudit(store.getState())
  }, [store])
}

/**
 * Whether a row should be marked as refused.
 *
 * @param entry - Audit row.
 * @returns True when the policy refused the call.
 */
function isDenied(entry: AuditEntry): boolean {
  return entry.denied
}

/**
 * Resolve the refresh button's label key.
 *
 * @param loading - Whether a fetch is in flight.
 * @returns The message key to translate.
 */
function refreshLabel(loading: boolean): string {
  if (loading) {
    return 'refreshing'
  }
  return 'refresh'
}

/**
 * Render a load failure, when there is one.
 *
 * @param props - The failure message, or nothing.
 * @returns The alert element, or nothing to render.
 */
function LoadError({
  error,
}: {
  error: string | undefined
}): ReactElement | undefined {
  if (error === undefined) {
    return undefined
  }
  return <p role='alert'>{error}</p>
}

/**
 * Render the notice shown when the policy companion is not mounted.
 *
 * @param props - Whether the policy is available, and a translator.
 * @returns The notice, or nothing when the policy is present.
 */
function PolicyNotice({
  available,
  translate,
}: {
  available: boolean
  translate: Translate
}): ReactElement | undefined {
  if (available) {
    return undefined
  }
  return <p>{translate('unavailable')}</p>
}

/**
 * Resolve a row's outcome label.
 *
 * @param entry - Audit row.
 * @param translate - Translator bound to this feature's namespace.
 * @returns The localized outcome.
 */
function outcomeLabel(entry: AuditEntry, translate: Translate): string {
  if (isDenied(entry)) {
    return translate('denied')
  }
  return translate('allowed')
}

/**
 * Render the optional reason cell.
 *
 * @param props - The row and whether the column is shown.
 * @returns The cell, or nothing.
 */
function ReasonCell({
  entry,
  showReasons,
}: {
  entry: AuditEntry
  showReasons: boolean
}): ReactElement | undefined {
  if (!showReasons) {
    return undefined
  }
  return <td>{entry.reason ?? ''}</td>
}

/**
 * Render one audit row.
 *
 * @param props - The row, whether to include the reason, and a translator.
 * @returns The table row.
 */
function AuditRow({
  entry,
  showReasons,
  translate,
}: {
  entry: AuditEntry
  showReasons: boolean
  translate: Translate
}): ReactElement {
  return (
    <tr>
      <td>{entry.tool}</td>
      <td>{outcomeLabel(entry, translate)}</td>
      <ReasonCell entry={entry} showReasons={showReasons} />
    </tr>
  )
}

/**
 * Render the optional reason column header.
 *
 * @param props - Whether to render it, and a translator.
 * @returns The header cell, or nothing.
 */
function ReasonHeader({
  showReasons,
  translate,
}: {
  showReasons: boolean
  translate: Translate
}): ReactElement | undefined {
  if (!showReasons) {
    return undefined
  }
  return <th scope='col'>{translate('columnReason')}</th>
}

/**
 * Render the audit table.
 *
 * @param props - Rows, a translator, and whether to include the reason column.
 * @returns The table, or a one-line empty state.
 */
function AuditTable({
  rows,
  translate,
  showReasons,
}: {
  rows: AuditEntry[]
  translate: Translate
  showReasons: boolean
}): ReactElement {
  if (rows.length === NO_ROWS) {
    return <p>{translate('empty')}</p>
  }
  return (
    <table>
      <thead>
        <tr>
          <th scope='col'>{translate('columnTool')}</th>
          <th scope='col'>{translate('columnOutcome')}</th>
          <ReasonHeader showReasons={showReasons} translate={translate} />
        </tr>
      </thead>
      <tbody>
        {rows.map((entry, index) => (
          // The trail carries no stable id, so position within this render is
          // the honest key; rows are replaced wholesale on every load.
          <AuditRow
            key={`${entry.tool}-${String(index)}`}
            entry={entry}
            showReasons={showReasons}
            translate={translate}
          />
        ))}
      </tbody>
    </table>
  )
}

/**
 * Render the ops console.
 *
 * @param props - Slot-injected store and translator.
 * @returns The panel element.
 */
function ConsolePanel({ store, translate }: ConsolePanelProps): ReactElement {
  const view = useConsoleView()
  const load = useAuditLoader(store)
  const controls = useFilterControls(load)
  // Local rather than store state. Whether a column is open is presentation;
  // putting it in the store would re-render the whole table when it toggled.
  const [showReasons, setShowReasons] = useState(true)

  useInitialLoad(load)

  return (
    <section aria-label={translate('nav')}>
      <h2>{translate('heading')}</h2>
      <p>{translate('description')}</p>

      <p>
        {translate('summary')
          .replace('{denied}', String(view.denied))
          .replace('{total}', String(view.total))}
      </p>

      <label htmlFor={FILTER_INPUT_ID}>{translate('filterLabel')}</label>
      <input
        id={FILTER_INPUT_ID}
        type='text'
        value={controls.filter}
        onChange={(event) => {
          controls.onFilter(event.target.value)
        }}
      />

      <label>
        <input
          type='checkbox'
          checked={controls.deniedOnly}
          onChange={(event) => {
            controls.onDeniedOnly(event.target.checked)
          }}
        />
        {translate('deniedOnly')}
      </label>

      <label>
        <input
          type='checkbox'
          checked={showReasons}
          onChange={(event) => {
            setShowReasons(event.target.checked)
          }}
        />
        {translate('showReasons')}
      </label>

      <button type='button' disabled={view.loading} onClick={controls.refresh}>
        {translate(refreshLabel(view.loading))}
      </button>

      <LoadError error={view.error} />
      <PolicyNotice available={view.available} translate={translate} />

      <AuditTable
        rows={view.rows}
        translate={translate}
        showReasons={showReasons}
      />
    </section>
  )
}

export {
  AuditRow,
  AuditTable,
  ConsolePanel,
  FILTER_INPUT_ID,
  isDenied,
  LoadError,
  outcomeLabel,
  PolicyNotice,
  refreshLabel,
  useAuditLoader,
  type ConsolePanelProps,
}
