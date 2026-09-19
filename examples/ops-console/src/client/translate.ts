/**
 * The translator contract, kept in its own module so components depend on a
 * one-line type instead of the host service surface.
 *
 * @module @minhlucvan/dsh-plugin-ops-console/client/translate
 */

/** Translates a key in this feature's namespace. */
type Translate = (key: string) => string

export type { Translate }
