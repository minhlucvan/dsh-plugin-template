/**
 * Shared fixture for the server companion suites.
 *
 * Both server suites need to mount the companion and clean up after themselves,
 * so that scaffolding lives here rather than being duplicated — and so the
 * suites themselves stay about behaviour.
 *
 * Only files named `*.test.ts` are collected by the `node` project, so this
 * module is support code, not a suite.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import type { Context } from '@deepseek-ai/cordis'
import { vi } from 'vitest'

import { apply } from '#src/server'
import type { ServerConfig } from '#src/server'

/** Index of the first element, named to keep it out of the magic-number rule. */
const FIRST_INDEX = 0

/** Port 0 asks the OS for a free port, so parallel runs cannot collide. */
const EPHEMERAL_PORT = 0

/** Temporary artifact roots created by `artifactRoot`. */
const temporaryDirectories: string[] = []

/** What a mounted server reports back to a suite. */
interface MountedServer {
  /** Origin the listener bound, for building request URLs. */
  origin: string
  /** Stop the listener and settle any pending bind. */
  dispose: () => Promise<void>
}

/** A logger that records the lines the companion writes. */
interface RecordingLogger {
  info: (message: string) => void
  warn: (message: string) => void
}

/** The context slice `apply` needs, plus a place to capture its disposer. */
interface FakeContext {
  logger: RecordingLogger
  effect: (execute: () => () => Promise<void>) => void
  dispose: () => Promise<void>
}

/**
 * Create an artifact root holding the named files.
 *
 * @param files - File name to contents.
 * @returns The absolute artifact directory.
 */
async function artifactRoot(files: Record<string, string>): Promise<string> {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'plugin-template-server-'),
  )
  temporaryDirectories.push(directory)
  await Promise.all(
    Object.entries(files).map(async ([file, body]) => {
      await writeFile(path.join(directory, file), body)
    }),
  )
  const created = directory
  return created
}

/**
 * Remove every artifact root created since the last call.
 *
 * @returns Nothing once each directory is gone.
 */
async function removeArtifactRoots(): Promise<void> {
  const pending = temporaryDirectories.splice(FIRST_INDEX)
  await Promise.all(
    pending.map(async (directory) => {
      await rm(directory, { recursive: true, force: true })
    }),
  )
}

/**
 * Read the origin out of the companion's startup log line.
 *
 * @param infos - Recorded info lines.
 * @returns The origin that was logged.
 * @throws {Error} When the server never reports one.
 */
async function waitForOrigin(infos: string[]): Promise<string> {
  const found = await vi.waitFor((): string => {
    const line = infos[FIRST_INDEX]
    if (line === undefined) {
      throw new Error('server has not reported an origin yet')
    }
    return line
  })
  const match = /http:\/\/\S+/u.exec(found)
  if (match === null) {
    throw new Error(`no origin in log line: ${found}`)
  }
  const origin = match[FIRST_INDEX]
  if (origin === undefined) {
    throw new Error(`no origin in log line: ${found}`)
  }
  return origin
}

/**
 * Mount the server on an ephemeral port and wait until it answers.
 *
 * @param config - Configuration overrides; the artifact root is required.
 * @returns The bound origin and a disposer.
 */
async function mount(config: ServerConfig): Promise<MountedServer> {
  const infos: string[] = []
  const context: FakeContext = {
    logger: {
      info: (message: string) => {
        infos.push(message)
      },
      warn: () => {
        // No test in these suites asserts on a warning.
      },
    },
    effect: (execute) => {
      /*
       * Capturing the disposer is how this fake models fiber ownership: the real
       * context also runs the body once and disposes it on unload.
       */
      context.dispose = execute()
    },
    dispose: async () => {
      await Promise.resolve()
    },
  }

  // oxlint-disable-next-line no-unsafe-type-assertion -- The fake implements only the members apply calls.
  apply(context as unknown as Context, config)

  const origin = await waitForOrigin(infos)
  return { origin, dispose: context.dispose }
}

export { artifactRoot, EPHEMERAL_PORT, mount, removeArtifactRoots }
