# Test Layout

`tests/plugin.test.ts` owns the baseline Loader shape, configuration behavior,
activation, and disposal evidence. The remaining suites own one face each:

- `tests/companions.test.ts`: the `tools`, `routes`, `commands` and `skills`
  companions, including registration and fiber disposal;
- `tests/client.test.ts`: settings normalization, receiver binding, and locale
  dictionary parity;
- `tests/client-store.test.ts`: store transitions and host-scope sync, in the
  `node` project because the store imports no React;
- `tests/client-components.test.tsx`: the provider, hooks, and components in a
  real React tree, in the `dom` project;
- `tests/client-registration.test.ts`: slot registration and fiber disposal;
- `tests/harness.ts`: the shared real-Cordis mount with an observable fake host
  boundary.

Extend test support only when the plugin requires it:

- extend `tests/harness.ts` when several suites need the same deterministic
  production composition;
- add `tests/<feature>.test.ts` for focused feature behavior;
- add fixtures under `tests/snapshots/` for stable user-, model-, CLI-,
  terminal-, editor-, or browser-visible expected output.

A harness should mount production services and expose observable state rather
than duplicate the implementation. Assert the value a subscriber receives rather
than that "something happened": it proves the notification carried the new
state. The baseline has no snapshot fixtures and therefore defines no refresh
command. When snapshots are introduced, add and document a repository-local
refresh command here, with deterministic inputs, exact fixture ownership, and
semantic review. Type-aware static checking is provided by the repository's
Oxlint command. The packed archive is verified separately by
`scripts/check-package.mjs` from CI, after `pnpm run build` — it is deliberately
not part of this suite, so that `pnpm test` stays runnable on a fresh checkout
with no `lib/` present.
