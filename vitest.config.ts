import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

/**
 * Resolve the `#src` prefixes used by every suite.
 *
 * The package's `imports` map declares `#src/*` for `.ts` only, which a test
 * importing a `.tsx` module cannot resolve. Vitest's nested project configs do
 * not inherit the root `resolve` block, so each project declares this itself.
 *
 * `#example` is the same idea for the example plugin under `examples/`: it has
 * its own package identity and its own `#src` map, and two packages cannot both
 * own one prefix in a single config.
 */
const srcAlias = {
  '#src': fileURLToPath(new URL('./src', import.meta.url)),
  '#example': fileURLToPath(new URL('./examples/ops-console/src', import.meta.url)),
}

/**
 * Where the template's own suites and the example's suites live.
 *
 * The example keeps its tests beside its code rather than in the template's
 * `tests/`, so each half stays readable on its own.
 */
const TEST_ROOTS = ['tests', 'examples/*/tests']
const includeFor = (extension: string): string[] =>
  TEST_ROOTS.map(root => `${root}/**/*.test.${extension}`)

/**
 * Two projects, because the two halves of this package need different worlds.
 *
 * The host-side and store suites are pure Node: they touch no DOM, and running
 * them in a browser emulator would only slow them down and hide accidental DOM
 * coupling. The component and hook suites render a real React tree, so they need
 * a DOM plus the automatic `cleanup` that keeps one test's rendered output from
 * leaking into the next.
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: srcAlias },
        test: {
          name: 'node',
          include: includeFor('ts'),
          environment: 'node',
          pool: 'forks',
        },
      },
      {
        resolve: { alias: srcAlias },
        test: {
          name: 'dom',
          include: includeFor('tsx'),
          environment: 'jsdom',
          pool: 'forks',
          setupFiles: ['tests/setup-dom.ts'],
        },
      },
    ],
  },
})
