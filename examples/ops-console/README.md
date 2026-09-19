# ops-console — a deep-customization example plugin

A working DSH plugin that exercises every extension seam this template offers,
so the surface is demonstrated rather than only described. It is a standalone
package (`@minhlucvan/dsh-plugin-ops-console`) that lives in `examples/` and
reuses the template's toolchain.

**It is not published.** `private: true`, and it is not part of the template's
packed archive. Fork it, or read it.

## What it does

It watches tool calls. A policy engine refuses configured tools and any call
whose path argument escapes a sandbox root; an audit trail records what it
allowed and refused; and three surfaces expose that state — a `/ops` command, an
HTTP route, a browser panel, and its own Fastify listener.

## Run it

```sh
# From the repository root. The example shares the template's dependencies.
pnpm install
pnpm test                                   # 115 tests, including the example's
cd examples/ops-console
pnpm run build                              # host entries, then the browser face
```

`pnpm run build` runs two builds and a transform, exactly as the template does:
the host entries are ESM, the browser entry is CommonJS wrapped in the
`__ModuleLoader__` envelope, and `scripts/verify-client.mjs` loads the result
through a loader shim. A build that succeeds is not evidence the UI works —
verification is the step that proves the artifact loads and exports `apply`,
`inject` and `name`.

## The seam map

Every numbered row is a place the host calls into this package. The middle
column is the file that owns it; the right column is what makes it worth using.

### Host (Node) seams

| Seam                  | File              | What it shows                                                                                                                                    |
| --------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tool registration     | `src/tools.ts`    | Parameter schemas (including nested objects and arrays), an enforced output schema, and a pure renderer.                                         |
| Live registry read    | `src/tools.ts`    | `ops_list_tools` reads `ctx.tools.schemas()` at **execution** time, so it reports the surface that exists, not the one captured at registration. |
| Tool policy guard     | `src/policy.ts`   | `ctx.tools.guard(fn)` is monotonic: it can only deny. See below.                                                                                 |
| Pre-execute waterfall | `src/policy.ts`   | `ctx.on('tools/pre-execute', (exec, next) => …)` observes and delegates.                                                                         |
| Slash command         | `src/commands.ts` | Runs against the receiving agent without reaching the model — the only way an operator can read state that lives inside the plugin.              |
| Runtime skill         | `src/skills.ts`   | Routing metadata plus a markdown body, loaded only when its description matches.                                                                 |
| Host-carrier routes   | `src/routes.ts`   | JSON endpoints on the **host's** listener, inheriting its trust fence.                                                                           |
| Owned listener        | `src/server.ts`   | A Fastify server on its own port, reachable without the host knowing.                                                                            |
| Lifecycle             | every companion   | Registrations go through `ctx.effect`, and the tests assert disposal.                                                                            |

### Browser seams

| Seam                 | File                           | What it shows                                                                                             |
| -------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Slot registration    | `src/client/index.tsx`         | Seats a component in `settings.section`, registered inside an effect so it is releasable.                 |
| Locale dictionaries  | `src/client/locale.ts`         | Two languages on one key set, so a missing translation is a type error.                                   |
| zustand store        | `src/client/store.ts`          | `zustand/vanilla`, so the state rules are testable in Node with no DOM.                                   |
| Per-instance context | `src/client/context.tsx`       | One store per mounted instance, published through context; a hook outside the provider fails with a name. |
| Custom hooks         | `src/client/hooks.ts`          | Narrow selectors, so one keystroke in the filter does not re-render every row.                            |
| Composed components  | `src/client/console-panel.tsx` | Reads state only through hooks; no state is prop-drilled.                                                 |
| Host fetch           | `src/client/api.ts`            | The one boundary that knows a URL exists, and it always resolves rather than throwing into React.         |

### Profile seams

`cordis.patch.yml` is where the deployment is configured, and it demonstrates
all three things a patch layer can do:

```yaml
# 1. insert — add rows. Each companion is its own row, so a profile can take the
#    policy without the browser face, or the tools without the server.
- insert:
    - id: ops-console
      name: '@minhlucvan/dsh-plugin-ops-console'
      config:
        deniedTools: [bash, write]

# 2. retarget — address an EXISTING row by id. A patch replaces the whole
#    `config`, so every key the row owns must be restated.
- id: tools
  config:
    mode: native
    maxParallelSubCalls: 16

# 3. disable — turn an existing row off, without touching code.
- id: message-feedback
  disabled: true
```

Rows 2 and 3 are copied from the patch file; row 1 is abridged. The file
explains both rules at the point of use.

## Why the guard and the waterfall are different

This is the example's most transferable lesson. The tool pipeline offers two
interception points that look interchangeable and are not:

- **`ctx.tools.guard(fn)` is monotonic.** It runs after every
  `tools/pre-execute` listener and returns either a denial reason or
  `undefined`. There is no "allow" result, so **no listener ordering can turn a
  denial back into permission.** A rule that must hold belongs here.
- **`ctx.on('tools/pre-execute', …)` is a waterfall.** Each listener receives
  the execution and `next()`. Returning `{ kind: 'allow' }` short-circuits every
  later listener, so a rule expressed here can be undone by whatever loads next.

`src/guard-policy.ts` holds the rules as a pure function (`decide`) with no
Cordis dependency, which is what makes them testable without a scheduler or an
agent.

## The Fastify surface, and why it is opt-in

`./server` binds its own port. That makes it reachable **without** the host's
trust fence, which is exactly what an inbound webhook needs and exactly what an
operator should have to ask for. Hence:

- the default bind is `127.0.0.1`, not `0.0.0.0`;
- the default port is `0`, so two profiles never collide;
- the row ships **commented out** in `cordis.patch.yml`.

`fastify` is a runtime `dependency` kept external by the build, so
`lib/server.js` contains a real `import 'fastify'` that the consumer resolves.
Bundling it would ship a private copy whose plugins could not be shared — the
opposite of the browser face, where dependencies _are_ bundled because the host
supplies no loader for them.

## Patches and hacks

`patches/` in the template repository documents two escalation levels beyond
`cordis.patch.yml`. This example is honest about both:

**Dependency patches** (pnpm `patchedDependencies`) are for correcting an exact
upstream version. The example needs none: everything it does is reachable
through the documented seams.

**DSH host patches** are for behaviour no composition can express — launcher
wiring before any target import, a build seam the manifest has no field for, or
catalog entries compiled into a host package. The example needs none either, and
that is the point worth taking away: **reaching for a host patch is a statement
that the plugin model cannot express the requirement, so it should be the last
resort, not the first.** If a real plugin does need one, the template's
`patches/README.md` defines the contract — one self-contained diff against a
pinned snapshot, with `pnpm run extract:patch` to regenerate and
`pnpm run patch:host` to apply.

The nearest thing to a hack here is deliberate and contained: `src/server.ts`
carries its own copy of the static-asset rules rather than importing them from
`@deepseek-ai/dsh-host-frontend-static`, because that package is host source
this plugin must not depend on. The rules are copied, not the dependency.

## Lint and type posture

The example holds the template's standard for correctness — it builds, it
typechecks under its own `tsconfig.json`, and all 115 tests pass — but it
suppresses several style and strict-typing rules under `examples/**` in
`.oxlintrc.json`, each with a written reason. The two that matter:

- **`no-unsafe-*`**: the test harness models only the Cordis members the
  companions touch, so it is deliberately a _partial_ context. The template's
  own suites fake one service at a time; faking the context itself is something
  no narrow-contract type can describe.
- **`new-cap`**: `Fastify(...)` is a callable factory, not a constructor.

The template's own `src/` and `tests/` keep every one of those rules enabled.
The override exists so the example stays readable as prose, not to relax the
package contract.

## Read this next

- `cordis.patch.yml` — the profile layer, with both patch rules explained
  inline.
- `src/guard-policy.ts` — the policy rules as a pure function.
- `src/policy.ts` — the guard/waterfall split, in one file.
- `../..` (the template root) — `AGENT.md` for the repository contract, and
  `patches/README.md` for the escalation path.
