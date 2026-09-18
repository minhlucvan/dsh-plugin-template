# AGENT.md — Working in this Repository

Agent instructions for `@your-scope/dsh-plugin-template`, a standalone ESM Cordis
plugin repository for DeepSeek Harness (DSH).

This file is the repository contract for any coding agent. `CLAUDE.md` carries the
same rules for Claude-based sessions, and `AGENTS.md` is the short contributor
summary. Keep all three consistent when the contract changes.

## Commands

Run everything from the repository root:

```sh
pnpm install            # registry dependencies only
pnpm run lint           # Oxlint, type-aware, denies warnings
pnpm test               # Vitest
pnpm run build          # tsdown → lib/
pnpm pack --dry-run --json   # inspect the publishable archive
```

Useful variants:

| Command | Purpose |
|---|---|
| `pnpm run lint:fix` | Apply Oxlint's automatic fixes |
| `pnpm run fmt` | Format `src/` and `tests/` with Oxfmt |
| `pnpm run fmt:check` | Format check only (currently fails on pre-existing files; see *Known rough edges*) |
| `pnpm run build --sourcemap` | Build with source maps for local debugging |

`pnpm run lint`, `pnpm test`, and `pnpm run build` must pass before any change is
considered done. CI (`.github/workflows/ci.yml`) runs exactly those three.

## Ownership map

Keep each concern in its documented owner instead of letting files sprawl:

| Path | Owns |
|---|---|
| `src/index.ts` | Loader-facing plugin namespace: `name`, `inject`, `Config`, `apply` re-exports only |
| `src/config.ts` | Serializable Schemastery schema, defaults, `resolveConfig` for direct callers |
| `src/runtime.ts` | Fakeable host boundary (`PluginRuntime`) and Cordis activation |
| `src/client/` | Browser face: slot registration, locale dictionaries, settings model and page |
| `src/invariant.ts` | Optional `./invariant` companion for the host `invariants` service |
| `src/routes.ts` | Optional `./routes` companion serving HTTP endpoints through `ctx.webServer` |
| `src/tools.ts` | Optional `./tools` companion that registers tools through `ctx.tools` |
| `src/README.md` | Growth rules for feature modules and services |
| `tests/harness.ts` | Shared real-Cordis mount with an observable fake host boundary |
| `tests/plugin.test.ts` | Loader exports, configuration, activation, companion disposal |
| `tests/snapshots/` | Product-visible fixture contract (currently empty) |
| `tsdown.config.ts` | Build entries; add an entry for every new public subpath |
| `cordis.patch.yml` | Profile bundle contribution applied over a DSH profile |
| `.agents/skills/` | Repository-local plugin workflow skills |
| `docs/dsh-plugin-contracts.md` | Shared contract referenced by the local skills |

Add cohesive product capabilities as `src/<feature>/`, and `src/services/` only
when the package actually defines Cordis services. Create a directory only when
production code needs it.

## Hard rules

- **No default export.** Cordis Loader unwraps `exports.default ?? exports`; a
  stray default silently discards `inject`, `Config`, and `apply`. Every test run
  asserts `'default' in plugin === false`.
- **Everything is fiber-owned.** Registrations must go through `ctx.effect()`,
  `ctx.on()`, or a registry disposer so disposal is observable. Never register at
  module evaluation time — that outlives the fiber and leaks across reloads.
- **Stay inside this repository.** No source, configuration, documentation, or
  project-reference path may leave the root, and do not add `link:` or `file:`
  dependencies. Describe files with project-root paths such as
  `docs/dsh-plugin-contracts.md`; never use `../` in documentation.
- **Host APIs are consumer-supplied.** `@deepseek-ai/cordis` and
  `@deepseek-ai/dsh-tools` are peer dependencies. Development imports resolve from
  the declared `devDependencies` in this repository.
- **One package name, everywhere.** The name may be scoped or unscoped — do not
  assume an `@scope/dsh-` prefix. Use the selected name verbatim in
  `package.json`, `cordis.patch.yml`, invariant registration, tests, and docs.
  Today that literal is `@your-scope/dsh-plugin-template`; a rename must update
  every occurrence, including `src/invariant.ts` and `tests/plugin.test.ts`.
- **No TypeScript-only escapes.** `@ts-ignore`/`@ts-expect-error` and `any` leaks
  are lint errors. This matters because `pnpm run build` emits through tsdown
  without a separate `tsc --noEmit` gate.
- **Keep documentation in sync.** When behavior changes, update `README.md`,
  configuration JSDoc, tests, and `cordis.patch.yml` together.

## Optional companions

`./invariant`, `./routes` and `./tools` are separate entries so the core bundle
stays free of the DSH tool stack and the browser carrier:

- They are built as independent tsdown entries and exported as
  `@your-scope/dsh-plugin-template/invariant`, `.../routes` and `.../tools`.
- Each injects the host service it needs (`inject = ['invariants']`,
  `inject = ['webServer']`, `inject = ['tools']`) and resolves it through a
  narrow local interface plus a type guard, mirroring the pattern in
  `src/invariant.ts`. This keeps the build independent of host source packages
  while a composed profile supplies the real service.
- `src/routes.ts` annotates its service lookup as `unknown` before the type
  guard, because the host's `webServer` augmentation lives in a package this
  repository does not depend on. Without the annotation the lookup is `any`, and
  `no-unsafe-assignment` is a lint error.
- Do **not** add their bundle rows to `cordis.patch.yml` by default. Ordinary
  `dsh-base`/`dsh-web-app` profiles do not provide those services, and a pending
  injection blocks startup; the comment in `cordis.patch.yml` records this.
- `@deepseek-ai/dsh-tools` is declared as an *optional* peer via
  `peerDependenciesMeta`, and importing its root entry pulls its own peer graph
  (`dsh-scope`, `dsh-llm`, …), which is why those packages appear in
  `devDependencies` for local tests only.

## Testing

- `tests/harness.ts` mounts the **production** plugin with a real Cordis
  `Context` and a spied logger. Prefer extending it over duplicating behavior.
- Test companions by providing a fake service (`ctx.provide('tools', …)`) and
  asserting both registration and disposal. Clean up provided services with the
  returned disposer.
- A slow machine can trip the 5 s Vitest timeout; run the suite again before
  treating a timeout as a regression.
- Product-visible plugins should add a real Loader/profile composition test in the
  consuming DSH application instead of relying only on hand-mounted unit tests.

## Release

- `pnpm run build` produces `lib/`; `pnpm pack --dry-run --json` must list every
  file named by `main`, `types`, `exports`, and `files`.
- The package ships prebuilt: installation never runs a `prepare` hook.
- `.github/workflows/release.yml` packs on every push to `main` and publishes the
  tarball to the GitHub Release tagged `v<package.json version>`.
- Publishing to npm is **not** automated. Do not run `pnpm publish` or bump the
  version unless the request explicitly asks for it.

## Known rough edges

These are pre-existing and unrelated to the plugin contract:

- `pnpm run fmt:check` reports formatting drift in files such as `tests/README.md`
  and the snapshot README; `pnpm run lint` is the enforced gate.
- `README.md` still calls the test file `tests/plugin.spec.ts` while the
  repository uses `tests/plugin.test.ts`, and its layout table predates
  `src/tools.ts`.
- `AGENTS.md` references `.agents/skills/dsh-plugin-stent-*` skills and
  `docs/dsh-plugin-stent.md`, neither of which exists in this repository. The real
  skill set is the ten `dsh-plugin-*` directories listed in `README.md`.

Fix these in documentation, not by inventing the missing files.
