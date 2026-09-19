import { defineConfig } from 'tsdown'

/**
 * Browser-face build for the example plugin.
 *
 * Same two constraints the template documents: the artifact is CommonJS inside a
 * `__ModuleLoader__` envelope, and React stays external because the host
 * supplies it. zustand is deliberately *not* external — the host does not
 * provide it, so it must be bundled.
 */
export default defineConfig({
  entry: { client: 'src/client/index.tsx' },
  outDir: 'lib',
  format: ['cjs'],
  platform: 'browser',
  target: 'es2022',
  fixedExtension: false,
  dts: true,
  clean: false,
  deps: { neverBundle: ['react', 'react/jsx-runtime', '@deepseek-ai/cordis'] },
  tsconfig: 'tsconfig.json',
})
