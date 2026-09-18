import { defineConfig } from 'tsdown'

/**
 * Build the published host entries directly from `src/`. TypeScript performs
 * the separate no-emit checks; tsdown owns runtime and declaration output.
 */
export default defineConfig({
  entry: {
    commands: 'src/commands.ts',
    index: 'src/index.ts',
    invariant: 'src/invariant.ts',
    routes: 'src/routes.ts',
    server: 'src/server.ts',
    skills: 'src/skills.ts',
    tools: 'src/tools.ts',
  },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: true,
  clean: true,
  /*
   * `neverBundle` keeps a package as an import in the output instead of
   * inlining it. `fastify` must stay external: it is a declared runtime
   * `dependency` the consumer resolves, and bundling it would ship a private
   * copy whose plugins a consumer could not share. This is the opposite of the
   * browser face, where dependencies *are* bundled because the host supplies no
   * loader for them.
   */
  deps: {
    dts: { neverBundle: true },
    neverBundle: ['fastify', '@deepseek-ai/cordis', '@deepseek-ai/schemastery'],
  },
  tsconfig: 'tsconfig.json',
})
