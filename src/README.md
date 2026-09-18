# Source Layout

> Template-only guidance. Keep this file in `plugin-template`; delete it from a
> target plugin before implementation is complete.

The baseline source entries are:

- `src/index.ts`: Loader-facing plugin namespace and public exports;
- `src/config.ts`: serializable schema, resolved defaults, and configuration
  types;
- `src/runtime.ts`: fakeable host boundary and Cordis activation;
- `src/invariant.ts`: package-owned invariant companion.

The template also ships four optional companions and one browser face. Each
companion is its own build entry and its own `exports` subpath, injects the
single host service it needs, and is isolated from the core plugin so a profile
that does not provide that service can still load the package:

- `src/tools.ts`: registers tools through `ctx.tools`;
- `src/routes.ts`: serves HTTP endpoints through `ctx.webServer`;
- `src/commands.ts`: registers a slash command through `ctx.commands`;
- `src/skills.ts`: contributes a runtime skill through `ctx.skills`;
- `src/client/`: the browser face, layered so a new field is a hook plus a
  component rather than new prop plumbing — `store.ts` (vanilla zustand, no
  React), `context.tsx` (one store per plugin instance), `hooks.ts` (the only
  read path components use), the `*.tsx` components, and `settings-page.tsx` as
  the slot-facing seam that mounts the provider. Only the seam takes slot props.

Resolve each host service through a narrow local interface plus a type guard
rather than importing the host's service type, and annotate such a lookup as
`unknown` first when the host's `Context` augmentation lives in a package this
repository does not depend on — otherwise the lookup is `any`, which is a lint
error.

Keep the baseline files focused. As the plugin grows, use these project-root
conventions:

- extend `src/config.ts` rather than hiding deployment choices in implementation
  constants;
- extend `src/runtime.ts` with fakeable process, clock, transport, or UI
  boundaries;
- add `src/<feature>/` for cohesive product capabilities such as commands,
  providers, renderers, or projections;
- add `src/services/` only when the package actually defines one or more Cordis
  services;
- add a companion only when the package has that capability, and add its build
  entry, `exports` subpath, and disposal test together.
- put client state in `src/client/store.ts` and read it through
  `src/client/hooks.ts`; keep React out of the store so its rules stay testable
  in Node.

Create a directory only when production code needs it. Name feature directories
after the capability they own rather than copying another plugin's
product-specific names. Keep `src/index.ts` as the Loader boundary instead of
turning it into an unstructured implementation file.
