# DeepSeek Harness Plugin Template

English | [中文](README.zh.md)

A self-contained standalone repository template for an ESM Cordis plugin. Every source file, compiler setting, test fixture, contributor instruction, skill, and build helper used by the repository is inside this directory; every development input resolves below this repository root.

Normal npm dependencies are resolved from the package registry. A DSH host is a runtime consumer of the finished package, not a source or build input.

## Repository layout

```text
.
├── .oxlintrc.json                 # Type-aware Oxlint configuration
├── .agents/skills/               # Repository-local plugin development workflow
│   ├── dsh-plugin-development/   # End-to-end coordinator
│   └── dsh-plugin-*/             # Plan, scaffold, implement, compose, test, release
├── docs/
│   └── dsh-plugin-contracts.md   # Shared local contract for all plugin skills
├── patches/
│   └── README.md                 # Dependency and DSH-host patch contract
├── scripts/
│   ├── check-package.mjs         # Asserts the packed archive covers the manifest
│   ├── extract-patch.mjs         # Config-driven host patch regeneration (see patches/README.md)
│   ├── patch.sh                  # Idempotent host patch application
│   ├── wrap-client.mjs           # Wraps the client bundle in the ModuleLoader envelope
│   └── verify-client.mjs         # Loads the built client through a loader shim
├── src/
│   ├── client/                   # Browser face
│   │   ├── store.ts              # zustand store: settings state and actions
│   │   ├── context.tsx           # per-instance store provider and its reader
│   │   ├── hooks.ts              # the read path components use
│   │   ├── settings-section.tsx  # layout, composing the parts below
│   │   ├── message-field.tsx     # presentational field, state via hooks
│   │   ├── save-controls.tsx     # commit and reset, state via hooks
│   │   ├── settings-page.tsx     # slot seam: props in, provider out
│   │   ├── contracts.ts          # narrow browser host contracts
│   │   ├── locale.ts             # feature-owned dictionaries
│   │   └── settings.ts           # persisted shape, defaults, normalization
│   ├── README.md                 # Growth rules for services and feature modules
│   ├── commands.ts               # Slash-command companion over ctx.commands
│   ├── config.ts                 # Serializable schema and resolved defaults
│   ├── index.ts                  # Loader-facing function-plugin namespace
│   ├── invariant.ts              # Package-owned invariant companion
│   ├── routes.ts                 # HTTP-route companion over ctx.webServer
│   ├── runtime.ts                # Fakeable host boundary and Cordis activation
│   ├── skills.ts                 # Runtime skill contribution over ctx.skills
│   └── tools.ts                  # Tool-registration companion over ctx.tools
├── tests/
│   ├── README.md                 # Harness, feature-test, and snapshot conventions
│   ├── client-components.test.tsx  # Store, context, hooks and components (jsdom)
│   ├── client-registration.test.ts  # Slot registration and fiber disposal
│   ├── client-store.test.ts      # Store transitions and host sync (Node)
│   ├── client.test.ts            # Settings normalization, receiver binding, locale parity
│   ├── companions.test.ts        # Tool, route, command and skill companions
│   ├── harness.ts                # Shared real-Cordis test mount
│   ├── plugin.test.ts            # Loader exports, activation, and companion disposal
│   ├── setup-dom.ts              # jsdom cleanup between component tests
│   └── snapshots/
│       └── README.md             # Optional product-visible fixture contract
├── .gitignore                    # Generated artifact exclusions
├── AGENT.md                      # Repository contract for coding agents
├── AGENTS.md                     # Repository-local contributor rules
├── CLAUDE.md                     # The same contract for Claude-based sessions
├── LICENSE                       # Template license
├── README.md                     # Repository and usage contract
├── cordis.patch.yml              # Profile bundle contribution
├── package.json                  # Exports, peers, dsh.bundle.patch, dsh.client
├── pnpm-lock.yaml                # Reproducible registry dependency graph
├── pnpm-workspace.yaml           # Package-manager and optional patch policy
├── tsconfig.json                 # Compiler and type-aware lint project
├── tsdown.config.ts              # Direct source-to-runtime/declaration build
├── tsdown.client.config.ts       # Separate CommonJS browser build
└── vitest.config.ts              # Test runner configuration
```

## Scalable source and test structure

A package may be host-only, client-only, or split across host and browser faces. Keep Loader metadata, configuration, runtime/service boundaries, browser behavior, shared contracts, and tests in the owners appropriate to the package; the template does not require every plugin to copy one fixed directory layout.

The template's sample skeleton uses `src/index.ts`, `src/config.ts`, `src/runtime.ts`, `src/invariant.ts`, `src/tools.ts`, `src/commands.ts`, `src/routes.ts`, `src/skills.ts`, `src/client/`, `tests/harness.ts`, and `tests/plugin.test.ts`; retain those owners when they fit the package, and document any deliberate replacement. Stable product-visible expected output belongs under the package's actual snapshot owner. Dependency and DSH-host patches use the optional `patches/` contract when needed.

## Create your plugin

1. Replace package identity in `package.json`, the Loader owner, configuration/runtime/invariant owners, focused test owners, bundle metadata, TypeScript metadata, `README.md`, and `AGENTS.md` as applicable. The sample skeleton names these owners explicitly; a deliberate replacement must update the package's local documentation and static-analysis configuration too.
2. Choose and record the exact npm package name before replacing identity. It may be scoped or unscoped (for example, `comem`); do not assume the template's `@your-scope/dsh-` prefix. Use the selected name verbatim in `package.json`, bundle rows, invariant registration, exports, tests, and documentation. Replace the template package name `@minhlucvan/dsh-plugin-template` and plugin ids only in those identity owners. Do not perform a global replacement inside `.agents/skills/`; its generic examples and marker checks must remain reusable.
3. Update `description`, `keywords`, `LICENSE`, and `cordis.patch.yml`.
4. Add only the DSH host services used by the implementation to the package contract and composition patch. Keep source and build dependencies resolvable from this repository's `node_modules`; host-provided runtime APIs remain consumer-supplied peers.
5. Replace the empty invariant installer when the package owns an authoritative event or mutable data relationship.
6. Implement activation and host-boundary behavior in the actual runtime/service owners, moving cohesive capabilities into project-specific modules as needed. Keep `src/index.ts` limited to Loader metadata and public re-exports when that matches the package, and scope registrations through `ctx.effect()`, `ctx.on()`, or registry disposers.
7. Keep every source, compiler, documentation, and project-reference path inside this repository. Describe files from the project root, for example `docs/dsh-plugin-contracts.md`. Do not add local-path `link:` or `file:` dependencies.
8. Set `private` to `false` only when the package's public dependencies and distribution artifacts are ready.

Do not add a default export to a function plugin. Cordis Loader unwraps `exports.default ?? exports`; a stray default export discards namespace exports such as `inject`, `Config`, and `apply`.

## Bundled development skills

DSH discovers the repository-local workflow under `.agents/skills/`. Start with [`dsh-plugin-development`](.agents/skills/dsh-plugin-development/SKILL.md) for the complete sequence, or invoke one stage directly:

| Skill | Purpose |
|---|---|
| [`dsh-plugin-plan`](.agents/skills/dsh-plugin-plan/SKILL.md) | Decide plugin form, dependencies, configuration, invariant, composition, and evidence. |
| [`dsh-plugin-scaffold`](.agents/skills/dsh-plugin-scaffold/SKILL.md) | Instantiate and baseline-verify a new repository from this template. |
| [`dsh-plugin-align`](.agents/skills/dsh-plugin-align/SKILL.md) | Migrate an existing non-template repository to this toolchain without replacing product behavior. |
| [`dsh-plugin-implement`](.agents/skills/dsh-plugin-implement/SKILL.md) | Implement lifecycle-safe Cordis behavior, metadata, docs, and invariants. |
| [`dsh-plugin-i18n`](.agents/skills/dsh-plugin-i18n/SKILL.md) | Localize browser UI with typed dictionaries, locale seats, fallback, and disposal evidence. |
| [`dsh-plugin-compose`](.agents/skills/dsh-plugin-compose/SKILL.md) | Install the bundle into an isolated profile and prove effective activation. |
| [`dsh-plugin-test`](.agents/skills/dsh-plugin-test/SKILL.md) | Verify Loader exports, behavior, disposal, composition, snapshots, and artifacts. |
| [`dsh-plugin-release`](.agents/skills/dsh-plugin-release/SKILL.md) | Check local, Git, or npm distribution readiness without publishing implicitly. |

Keep these directories when copying the template so future sessions rooted in the plugin repository retain the same workflow.

## Independent development

Run every command from this directory:

```sh
pnpm install
pnpm run lint
pnpm test
pnpm run build
```

`lint` runs Oxlint with type-aware analysis and denies warnings for the configured source and test projects. `build` runs the configured source-to-artifact pipeline, including any declaration assembly or final artifact verifier owned by the package, and emits ready-to-pack output; it does not run an install-time lifecycle build. Extra arguments are passed through to tsdown, so `pnpm run build --sourcemap` emits source maps for local debugging; the default `build` emits none.

Because the package has both a host and a browser face, `build` is two builds:

- `pnpm run build:host` — the host entries in `lib/`, built from `tsdown.config.ts`;
- `pnpm run build:client` — the CommonJS browser bundle, then
  `scripts/wrap-client.mjs` to wrap it in the ModuleLoader envelope and
  `scripts/verify-client.mjs` to load the artifact through a loader shim.

`pnpm run build` runs both. Prefer the narrower command while iterating on one
face; the full build is the pre-commit gate.

The release artifact is built from the configured source owners before packing. Profile or consumer installation uses the ready-made `lib/` output and does not run `prepare`; `node scripts/check-package.mjs` asserts the archive covers every path declared by `exports`, `main`, `types`, and `dsh.bundle.patch`, and `pnpm pack --dry-run --json` prints the final contents.

## CI

Two GitHub Actions workflows ship with the template:

- `.github/workflows/ci.yml` — every push to `main` and every pull request:
  installs with the frozen lockfile, then runs Oxlint, tests, the full build, and
  `scripts/check-package.mjs`. It runs on Node 22 and Node 24 with
  `fail-fast: false`, because the package supports both ends of its declared
  `engines` range and a failure should name the version that regressed. The
  workflow is read-only (`permissions: contents: read`) and cancels superseded
  runs on the same ref.
- `.github/workflows/release.yml` — every push to `main`, or a manual dispatch:
  runs the same checks, packs the ready-made tarball as `dist/pkg.tgz`, and
  attaches it to the GitHub Release tagged `v<version>` from `package.json`,
  creating the release when it does not exist. It checks out with
  `fetch-depth: 0` so `--generate-notes` has the history it needs.

Bump `version` in `package.json` to cut a new release; pushing again without a
bump refreshes the existing release's artifact. Publishing to npm is not
automated.

## Profile activation

The package manifest declares the bundle patch:

```json
{
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
```

A DSH host may install this package into a profile and apply `cordis.patch.yml` over its own runtime composition. That host integration is intentionally outside this repository's build and test inputs. The patch composes plugins; it does not alter host source, compiler settings, build scripts, or catalogs.

The invariant companion uses a narrow local interface for the host's `invariants` service. This keeps the package build independent of the host's private source package while preserving the runtime registration used by an invariants-enabled DSH profile. Insert its bundle row only when the consuming profile provides that service; ordinary `dsh-base`/`dsh-web-app` profiles should omit the row.

## Client face

A package may contribute browser UI as well as host behaviour. This template does,
in `src/client/`, and the build differs from the host entries in three ways worth
knowing before you copy it.

**The artifact is not an ES module.** The host evaluates a plugin's client file and
expects it to call `window.__ModuleLoader__.load({ id, factory })`, where the
factory behaves like CommonJS: it receives a `require` resolving the host's own
modules and returns the plugin's exports. So `pnpm run build` does not finish at
the bundler — `scripts/wrap-client.mjs` wraps the CommonJS intermediate in that
envelope, and renames the declaration that tsdown suffixes as `.d.cts`.

**The format is CommonJS and React is external.** `tsdown.client.config.ts` builds
the client separately: `format: ['cjs']`, a browser target, and `deps.neverBundle`
for `react` and `react/jsx-runtime`, which the host supplies. Declaring React as a
`devDependency` is correct — it is needed to build and typecheck, never to ship.

### State: zustand, scoped through context

The browser face is a React tree with a **zustand** store, layered so that adding
a field means adding a hook and a component, not threading props:

| Layer | File | Owns |
|---|---|---|
| Store | `src/client/store.ts` | All mutable settings state and the actions over it |
| Context | `src/client/context.tsx` | One store per plugin instance, plus the provider |
| Hooks | `src/client/hooks.ts` | The only supported read path for components |
| Components | `src/client/settings-section.tsx`, `message-field.tsx`, `save-controls.tsx` | Rendering, reading state only through hooks |
| Seam | `src/client/settings-page.tsx` | Receives the slot's props and mounts the provider |

Three decisions are worth keeping if you copy this:

**The store is vanilla zustand, not the React build.** `createStore` from
`zustand/vanilla` imports no React, so the state rules are unit-testable in plain
Node with no DOM — which is why `tests/client-store.test.ts` runs in the `node`
project while the component tests run in `jsdom`.

**zustand is bundled, not host-supplied.** The host's browser loader supplies
`react`, `react/jsx-runtime`, `react-dom` and its own `@deepseek-ai/*` client
packages; it does not supply zustand. So zustand is a `devDependency` that is
bundled into `lib/client.js`. Do not add it to `deps.neverBundle` — that would
leave a `require('zustand')` the host cannot resolve. The cost is small (a few kB;
with React 19 the `use-sync-external-store` shim is unused), and because the host
itself uses a `useSyncExternalStore` store rather than zustand, there is no
version to stay compatible with.

**One store per instance, created by the provider.** A module-scope store would be
shared by every mounted copy of the plugin and by every test, so two instances
would silently edit each other. `SettingsStoreProvider` creates the store in a
`useState` initializer — not `useMemo`, which React may discard — and hands it
down through context. Reading a hook outside the provider throws a named error
rather than rendering `undefined`.

The store treats the host scope as the external authority: `connectSettingsScope`
mirrors it in, and a change arriving while the form is **clean** is followed,
while one arriving during an **edit** keeps the typed text and only rebases the
baseline. A failed save likewise keeps the draft and records the reason instead
of discarding what the user typed.

**A successful build is not evidence the UI works.** `scripts/verify-client.mjs`
installs a `__ModuleLoader__` shim, supplies the host modules, imports the artifact,
and asserts the loader id and the `apply` / `inject` / `name` exports. An artifact
can build, pack and ship while failing every one of those steps, and the only
symptom is a panel that never appears.

Two tsconfig settings are load-bearing and easy to lose. `"types"` must include
`"react"`, or no JSX types resolve and `event.target.value` reports as missing on
`HTMLInputElement`. And `"lib"` must include `DOM`, which `@tsconfig/node24` does
not set — without it the DOM types are error-typed and every event handler is
`any`.

Wire the browser half with `dsh.client` in `package.json`, naming the host client
packages whose services the entry injects:

```json
{
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-locale"] }
  }
}
```

### Richest slot: a right-sidebar tab

The `settings.section` seat this template demonstrates is a simple list slot. The
right sidebar is the other extreme — a **dockable tab registry** — and it is a
different shape, so it is worth knowing before you need it. It is not demonstrated
here, only documented.

Registration is **two-stage, and both stages are required**: a tab type with no
body registered renders the shell's "nothing can view this" notice rather than an
empty pane.

**Stage one** — what the type is, into `ctx.sidebarRightTabs`:

```ts
ctx.effect(
  () =>
    ctx.sidebarRightTabs.register({
      id: '@minhlucvan/dsh-plugin-template',   // unique; the key stage two registers under
      kind: 'plugin-template-console',         // what openTab names
      // Omit `patterns` for a page type, which recognizes no address and is
      // opened by kind. Present, they are VS Code-style globs over scheme:// URIs,
      // and a pattern containing `:` matches the whole address rather than the path.
      priority: 'extension',                   // the default, and the band a plugin wants
      title: () => t('tabTitle'),              // thunked: read fresh, so language changes re-render
      guide: [{ order: 50, title: () => t('tabTitle'), description: () => t('tabHint') }],
    }),
  'client: tab type',
)
```

`priority: 'extension'` is the default and the reason a plugin is not a
second-class viewer: a type that declares nothing outranks every tab type shipped
with the product, and may take over a `builtin`'s kind until it unregisters. A
second registration in the same band, or an `id` already in use, throws — the
registry treats both as wiring mistakes rather than picking one.

**Stage two** — the body, into the **keyed** seat, keyed by stage one's `id`:

```ts
ctx.effect(
  () =>
    ctx.slots.inject('sidebar.right.pane.tab', () =>
      ctx.slots.register(
        { name: 'sidebar.right.pane.tab', key: '@minhlucvan/dsh-plugin-template', locale: NS, store, inject },
        ConsoleBody,
      ),
    ),
  'client: tab body',
)
```

Note `key`, not `id`: a keyed seat is addressed by the definition's identity. The
body receives every tab of that kind, in every pane, docked or floating.

`sidebar.right.pane.tab.title` is a separate keyed registration for a **live**
chip — for a type whose title comes from its own store rather than the text
captured when the tab opened. Omit it and the chip keeps the `title(address)` text
from open time.

## Plugin forms

This template demonstrates a function plugin and therefore named exports:

```ts
// src/index.ts
export const name = 'plugin-template'
export const inject: string[] = []
export { Config } from './config.ts'
export { apply } from './runtime.ts'

// src/config.ts
export interface Config { /* serializable fields */ }
export const Config: z<Config> = z.object({ /* validation and defaults */ })

// src/runtime.ts
export function apply(ctx: Context, config: Config): void { /* effects */ }
```

A service provider instead normally default-exports its `Service` subclass. Do not mix the two forms.

## Distribution checks

Before considering packed or GitHub Release distribution, build and inspect the final archive:

```sh
pnpm run lint
pnpm test
pnpm run build
node scripts/check-package.mjs
pnpm pack --dry-run --json
```

The final package must contain every runtime and declaration file named by `main`, `types`, `exports`, and `files`; `check-package.mjs` fails the run when any declared path is missing from the archive. Set `private: true` while the package is still a starting point, and clear it only once the DSH host peers are available through the channel you intend to publish on — npm publication of this package is not automated.

## Testing guidance

`pnpm test` runs two projects, because the two halves of the package need different worlds: the `node` project covers the host entries and the store (no DOM), and the `dom` project covers the React components and hooks in `jsdom`. The `#src/*` alias in `vitest.config.ts` mirrors the manifest's `imports` map, which is declared for `.ts` only and cannot resolve a `.tsx` module on its own.

The included test proves Loader-safe ESM exports and schema-resolved activation. Replace the activation assertions with observable behavior and disposal assertions for every registry contribution. Product-visible plugins should add a real Loader/profile composition test in the consuming DSH application rather than relying only on hand-mounted unit tests.
