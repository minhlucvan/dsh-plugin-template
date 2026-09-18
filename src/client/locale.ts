/**
 * Feature-owned locale dictionaries for the client face.
 *
 * Every product-visible string lives here: headings, labels, placeholders,
 * button text, saving and reset text, and accessibility text. Components
 * receive the translator as a prop and never invent fallback copy, so a missing
 * key is a visible gap rather than English leaking into another language.
 *
 * @module @minhlucvan/dsh-plugin-template/client/locale
 */

import type { LocaleDictionaries } from './contracts.ts'

/** Single namespace owned by this feature. */
const LOCALE_NAMESPACE = 'plugin-template'

/** The reference dictionary. Every other language must cover its key set. */
const en = {
  nav: 'Plugin template',
  heading: 'Plugin template settings',
  description:
    'One demonstrated setting, edited through the host settings scope.',
  fieldLabel: 'Load message',
  fieldHint: 'Written to the host log when the plugin activates.',
  save: 'Save',
  saving: 'Saving…',
  reset: 'Reset',
  saveFailed: 'Could not save',
} as const

/** Keys the reference dictionary declares. */
type MessageKey = keyof typeof en

/**
 * Simplified Chinese dictionary, constrained to the reference key set.
 *
 * The explicit `Record<MessageKey, string>` annotation is the constraint:
 * adding a key to the reference dictionary without translating it fails the
 * build rather than shipping a missing string.
 */
const zh: Record<MessageKey, string> = {
  nav: '插件模板',
  heading: '插件模板设置',
  description: '一个演示设置，通过宿主设置作用域编辑。',
  fieldLabel: '加载消息',
  fieldHint: '插件激活时写入宿主日志。',
  save: '保存',
  saving: '保存中…',
  reset: '重置',
  saveFailed: '保存失败',
}

/** Dictionaries registered under this feature's namespace. */
const locales: LocaleDictionaries = { en, zh }

export { LOCALE_NAMESPACE, locales, type MessageKey }
