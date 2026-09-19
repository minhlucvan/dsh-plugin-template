import { defineConfig } from 'tsdown'

/**
 * Host-entry build for the example plugin.
 *
 * Deliberately a sibling of the template's `tsdown.config.ts` rather than an
 * import of it: the example must be readable as a standalone plugin, and the
 * template's config names the template's entries. The shape — ESM, one entry per
 * public subpath, declarations on, host packages external — is the template's.
 */
export default defineConfig({
  entry: {
    commands: 'src/commands.ts',
    index: 'src/index.ts',
    policy: 'src/policy.ts',
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
  deps: {
    dts: { neverBundle: true },
    neverBundle: ['fastify', '@deepseek-ai/cordis', '@deepseek-ai/schemastery', '@deepseek-ai/dsh-tools'],
  },
  tsconfig: 'tsconfig.json',
})
