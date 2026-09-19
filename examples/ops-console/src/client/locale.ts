/**
 * Feature-owned locale dictionaries for the example's browser face.
 *
 * Every product-visible string lives here. Components receive the translator
 * and never invent fallback copy, so a missing key stays a visible gap rather
 * than English leaking into another language.
 *
 * @module @minhlucvan/dsh-plugin-ops-console/client/locale
 */

/** Single namespace owned by this feature. */
const LOCALE_NAMESPACE = 'ops-console'

/** Dictionary shape: language tag to key to text. */
type LocaleDictionaries = Record<string, Record<string, string>>

/** The reference dictionary. Every other language must cover its key set. */
const en = {
  nav: 'Ops console',
  heading: 'Ops console policy',
  description: 'What the policy allowed and denied, read from the host route.',
  summary: '{denied} of {total} recorded calls were denied.',
  filterLabel: 'Filter by tool name',
  deniedOnly: 'Denied only',
  showReasons: 'Show reasons',
  refresh: 'Refresh',
  refreshing: 'Refreshing…',
  empty: 'No tool calls recorded yet.',
  unavailable: 'The policy companion is not loaded in this profile.',
  columnTool: 'Tool',
  columnOutcome: 'Outcome',
  columnReason: 'Reason',
  denied: 'denied',
  allowed: 'allowed',
} as const

/** Keys the reference dictionary declares. */
type MessageKey = keyof typeof en

/**
 * Simplified Chinese dictionary, constrained to the reference key set.
 *
 * The explicit `Record<MessageKey, string>` annotation is the constraint:
 * adding a key to the reference dictionary without translating it fails the
 * type check rather than shipping a missing string.
 */
const zh: Record<MessageKey, string> = {
  nav: '运维控制台',
  heading: '运维控制台策略',
  description: '策略允许与拒绝的调用，读取自宿主路由。',
  summary: '{total} 次已记录调用中有 {denied} 次被拒绝。',
  filterLabel: '按工具名筛选',
  deniedOnly: '仅被拒绝',
  showReasons: '显示原因',
  refresh: '刷新',
  refreshing: '刷新中…',
  empty: '尚未记录任何工具调用。',
  unavailable: '当前 profile 未加载策略 companion。',
  columnTool: '工具',
  columnOutcome: '结果',
  columnReason: '原因',
  denied: '已拒绝',
  allowed: '已允许',
}

/** Dictionaries registered under this feature's namespace. */
const locales: LocaleDictionaries = { en, zh }

export { LOCALE_NAMESPACE, locales, type LocaleDictionaries, type MessageKey }
