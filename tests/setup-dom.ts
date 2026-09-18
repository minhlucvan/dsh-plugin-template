/**
 * DOM-test setup.
 *
 * `@testing-library/react` auto-cleans only when it can see a global
 * `afterEach`, which this repository does not enable (tests import from
 * `vitest` explicitly). Registering cleanup here is what keeps one test's
 * rendered tree — and the store effects it mounted — from leaking into the
 * next.
 */
// oxlint-disable vitest/require-top-level-describe -- Setup registers hooks only.
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
