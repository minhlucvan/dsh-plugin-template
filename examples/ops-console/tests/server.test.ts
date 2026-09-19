/**
 * Server companion tests.
 *
 * Two layers, because they fail for different reasons. The static rules are
 * pure and asserted directly; the listener is then mounted through a fake
 * Cordis context on an ephemeral port and driven over real HTTP, because
 * binding, routing and releasing a port are properties of the running server
 * and nothing else can demonstrate them.
 *
 * The artifact root is a temporary directory per test rather than the example's
 * `lib/`, so this suite does not depend on a build having run first.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CLIENT_PATH,
  HEALTH_PATH,
  apply,
  contentTypeFor,
  originOf,
  resolveServerConfig,
  resolveStatic,
} from '#example/server'

import { asContext, fakeContext } from './harness.ts'

const TEST_TIMEOUT = 10_000
const FIRST_INDEX = 0

/** Port 0 takes whatever the OS assigns, so parallel runs cannot collide. */
const EPHEMERAL_PORT = 0

/** The artifact root most pure cases share. */
const ROOT = { artifactRoot: '/srv', indexFile: 'index.html' }

const directories: string[] = []

/**
 * Create an artifact root holding the named files.
 *
 * @param files - File name to contents.
 * @returns The absolute artifact directory.
 */
async function artifactRoot(files: Record<string, string>): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'ops-console-'))
  directories.push(directory)
  await Promise.all(
    Object.entries(files).map(async ([file, body]) => {
      await writeFile(path.join(directory, file), body)
    }),
  )
  const created = directory
  return created
}

/**
 * Mount the listener on an ephemeral port and wait for it to answer.
 *
 * @param artifactRootPath - Directory the listener serves.
 * @returns The bound origin and a disposer.
 */
async function mount(artifactRootPath: string): Promise<{
  origin: string
  dispose: () => Promise<void>
}> {
  const ctx = fakeContext()
  apply(asContext(ctx), {
    artifactRoot: artifactRootPath,
    port: EPHEMERAL_PORT,
  })

  const origin = await vi.waitFor(() => {
    const line = ctx.infos.find((info) => info.includes('listening on'))
    if (line === undefined) {
      throw new Error('the server has not reported an origin yet')
    }
    const match = /http:\/\/\S+/u.exec(line)
    if (match === null) {
      throw new Error(`no origin in: ${line}`)
    }
    return match[FIRST_INDEX]
  })

  return { origin, dispose: ctx.dispose }
}

function testServesTheIndexForTheRootPath(): void {
  expect.hasAssertions()
  const decision = resolveStatic('/', 'GET', ROOT)
  expect(decision.status).toBe(200)
  expect(decision.file).toBe('/srv/index.html')
}

function testRejectsTraversal(): void {
  expect.hasAssertions()
  const root = { artifactRoot: '/srv/lib', indexFile: 'index.html' }
  expect(resolveStatic('/../secret', 'GET', root).status).toBe(403)
}

function testRejectsASharedPrefixSibling(): void {
  expect.hasAssertions()
  /*
   * `/srv/lib-private` starts with `/srv/lib`, so a bare prefix check would call
   * it contained. Anchoring on the separator is what makes the check mean
   * containment rather than string similarity.
   */
  const root = { artifactRoot: '/srv/lib', indexFile: 'index.html' }
  expect(resolveStatic('/../lib-private/secret', 'GET', root).status).toBe(403)
}

function testRejectsUnreadMethods(): void {
  expect.hasAssertions()
  for (const method of ['POST', 'PUT', 'DELETE'] as const) {
    expect(resolveStatic(CLIENT_PATH, method, ROOT).status).toBe(405)
  }
}

function testDeclaresContentTypesAndFallsBack(): void {
  expect.hasAssertions()
  expect(contentTypeFor('/srv/client.js')).toBe(
    'text/javascript; charset=utf-8',
  )
  expect(contentTypeFor('/srv/index.html')).toBe('text/html; charset=utf-8')
  // No extension and an unlisted one both fall back rather than guess. Spelled
  // As a literal rather than through the constant so the assertion also pins the
  // Wire value a client sees.
  expect(contentTypeFor('/srv/LICENSE')).toBe('application/octet-stream')
  expect(contentTypeFor('/srv/archive.weird')).toBe('application/octet-stream')
}

function testResolvesDefaults(): void {
  expect.hasAssertions()
  const resolved = resolveServerConfig({}, '/srv')
  expect(resolved.host).toBe('127.0.0.1')
  expect(resolved.port).toBe(EPHEMERAL_PORT)
  expect(resolved.artifactRoot).toBe('/srv')
  expect(resolved.indexFile).toBe('index.html')
}

function testBuildsABrowsableOrigin(): void {
  expect.hasAssertions()
  // A wildcard bind is not browsable, so the reported origin must not be one.
  expect(originOf('0.0.0.0', 8080)).toBe('http://127.0.0.1:8080')
  expect(originOf('::', 8080)).toBe('http://127.0.0.1:8080')
  expect(originOf('127.0.0.1', 8080)).toBe('http://127.0.0.1:8080')
}

async function testAnswersTheHealthProbe(): Promise<void> {
  expect.hasAssertions()
  const directory = await artifactRoot({ 'index.html': '<!doctype html>' })
  const { origin, dispose } = await mount(directory)
  try {
    const response = await fetch(`${origin}${HEALTH_PATH}`)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toStrictEqual({
      name: 'ops-console-server',
      ok: true,
    })
  } finally {
    await dispose()
  }
}

async function testServesTheBrowserBundle(): Promise<void> {
  expect.hasAssertions()
  const body = 'window.__ModuleLoader__.load({ id: "x", factory: () => ({}) });'
  const directory = await artifactRoot({
    'client.js': body,
    'index.html': '<!doctype html>',
  })
  const { origin, dispose } = await mount(directory)
  try {
    const response = await fetch(`${origin}${CLIENT_PATH}`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(
      'text/javascript; charset=utf-8',
    )
    await expect(response.text()).resolves.toBe(body)
  } finally {
    await dispose()
  }
}

async function testAnswersMissingPathsWithNotFound(): Promise<void> {
  expect.hasAssertions()
  const directory = await artifactRoot({ 'index.html': '<!doctype html>' })
  const { origin, dispose } = await mount(directory)
  try {
    // A legal path with nothing behind it is a 404, not a 500.
    const missing = await fetch(`${origin}/absent.js`)
    expect(missing.status).toBe(404)
  } finally {
    await dispose()
  }
}

async function testDerivesHeadFromGet(): Promise<void> {
  expect.hasAssertions()
  const directory = await artifactRoot({
    'client.js': 'x'.repeat(32),
    'index.html': '<!doctype html>',
  })
  const { origin, dispose } = await mount(directory)
  try {
    // Fastify derives HEAD from the GET registration, so this also proves the
    // Two do not conflict: registering HEAD explicitly throws at startup.
    const response = await fetch(`${origin}${CLIENT_PATH}`, { method: 'HEAD' })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(
      'text/javascript; charset=utf-8',
    )
    await expect(response.text()).resolves.toBe('')
  } finally {
    await dispose()
  }
}

async function testDisposalClosesTheListener(): Promise<void> {
  expect.hasAssertions()
  const directory = await artifactRoot({ 'index.html': '<!doctype html>' })
  const { origin, dispose } = await mount(directory)
  await expect(fetch(`${origin}${HEALTH_PATH}`)).resolves.toBeDefined()

  await dispose()
  // The port must stop answering, or a reload would leak a listener per mount.
  await expect(fetch(`${origin}${HEALTH_PATH}`)).rejects.toThrow(
    /fetch failed|ECONNREFUSED/u,
  )
}

describe('ops-console server rules', () => {
  afterEach(async () => {
    await Promise.all(
      directories.splice(FIRST_INDEX).map(async (directory) => {
        await rm(directory, { recursive: true, force: true })
      }),
    )
  })

  it(
    'serves the index for the root path',
    { timeout: TEST_TIMEOUT },
    testServesTheIndexForTheRootPath,
  )

  it(
    'rejects traversal outside the root',
    { timeout: TEST_TIMEOUT },
    testRejectsTraversal,
  )

  it(
    'rejects a sibling sharing the root prefix',
    { timeout: TEST_TIMEOUT },
    testRejectsASharedPrefixSibling,
  )

  it(
    'rejects methods other than GET and HEAD',
    { timeout: TEST_TIMEOUT },
    testRejectsUnreadMethods,
  )

  it(
    'declares content types and falls back',
    { timeout: TEST_TIMEOUT },
    testDeclaresContentTypesAndFallsBack,
  )

  it('resolves its defaults', { timeout: TEST_TIMEOUT }, testResolvesDefaults)

  it(
    'builds a browsable origin',
    { timeout: TEST_TIMEOUT },
    testBuildsABrowsableOrigin,
  )
})

describe('ops-console server listener', () => {
  it(
    'answers the health probe',
    { timeout: TEST_TIMEOUT },
    testAnswersTheHealthProbe,
  )

  it(
    'serves the browser bundle',
    { timeout: TEST_TIMEOUT },
    testServesTheBrowserBundle,
  )

  it(
    'answers 404 for a missing path',
    { timeout: TEST_TIMEOUT },
    testAnswersMissingPathsWithNotFound,
  )

  it('derives HEAD from GET', { timeout: TEST_TIMEOUT }, testDerivesHeadFromGet)

  it(
    'stops listening when disposed',
    { timeout: TEST_TIMEOUT },
    testDisposalClosesTheListener,
  )
})
