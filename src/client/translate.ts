/**
 * The translator contract, split from `contracts.ts` so components depend on a
 * one-line type instead of the whole host service surface.
 *
 * @module @minhlucvan/dsh-plugin-template/client/translate
 */

/** Translates a key in this feature's namespace. */
type Translate = (key: string) => string

export type { Translate }
