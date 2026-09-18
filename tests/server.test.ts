/**
 * Server listener tests.
 *
 * These mount the companion through a real Cordis context on an ephemeral port
 * and hit it over real HTTP, because "the server works" is not a claim a unit
 * test can make: binding, routing, the bound port, and releasing the listener
 * on disposal are all properties of the running server.
 *
 * The artifact root is a temporary directory written per test rather than the
 * package's `lib/`, so the suite does not depend on a build having run first.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { STATUS_NOT_FOUND, STATUS_OK } from '#src/server-static'

import {
  EPHEMERAL_PORT,
  artifactRoot,
  mount,
  removeArtifactRoots,
} from './server.fixtures.ts'

const TEST_TIMEOUT = 10_000
const HEALTH_NAME = 'plugin-template-server'

/** Body size used to prove HEAD reports a length without sending bytes. */
const HEAD_BODY_LENGTH = 64

async function testAnswersTheHealthProbe(): Promise<void> {
  expect.hasAssertions()
  const directory = await artifactRoot({ 'index.html': '<!doctype html>' })
  const { origin, dispose } = await mount({
    artifactRoot: directory,
    port: EPHEMERAL_PORT,
  })
  try {
    const response = await fetch(`${origin}/health`)
    expect(response.status).toBe(STATUS_OK)
    await expect(response.json()).resolves.toStrictEqual({
      name: HEALTH_NAME,
      ok: true,
    })
  } finally {
    await dispose()
  }
}

async function testServesTheClientBundle(): Promise<void> {
  expect.hasAssertions()
  const body = 'window.__ModuleLoader__.load({ id: "x", factory: () => ({}) });'
  const directory = await artifactRoot({
    'client.js': body,
    'index.html': '<!doctype html>',
  })
  const { origin, dispose } = await mount({
    artifactRoot: directory,
    port: EPHEMERAL_PORT,
  })
  try {
    const response = await fetch(`${origin}/client.js`)
    expect(response.status).toBe(STATUS_OK)
    expect(response.headers.get('content-type')).toBe(
      'text/javascript; charset=utf-8',
    )
    await expect(response.text()).resolves.toBe(body)
  } finally {
    await dispose()
  }
}

async function testServesTheIndexPage(): Promise<void> {
  expect.hasAssertions()
  const directory = await artifactRoot({
    'index.html': '<!doctype html><title>t</title>',
  })
  const { origin, dispose } = await mount({
    artifactRoot: directory,
    port: EPHEMERAL_PORT,
  })
  try {
    const response = await fetch(`${origin}/`)
    expect(response.status).toBe(STATUS_OK)
    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8',
    )
    await expect(response.text()).resolves.toContain('<!doctype html>')
  } finally {
    await dispose()
  }
}

async function testMissingIndexIsNotFound(): Promise<void> {
  expect.hasAssertions()
  const directory = await artifactRoot({ 'client.js': '// nothing' })
  const { origin, dispose } = await mount({
    artifactRoot: directory,
    port: EPHEMERAL_PORT,
  })
  try {
    const response = await fetch(`${origin}/`)
    // A legal path with no file behind it is a 404, not a 500.
    expect(response.status).toBe(STATUS_NOT_FOUND)
  } finally {
    await dispose()
  }
}

async function testUnknownPathIsNotFound(): Promise<void> {
  expect.hasAssertions()
  const directory = await artifactRoot({ 'index.html': '<!doctype html>' })
  const { origin, dispose } = await mount({
    artifactRoot: directory,
    port: EPHEMERAL_PORT,
  })
  try {
    const response = await fetch(`${origin}/absent.js`)
    expect(response.status).toBe(STATUS_NOT_FOUND)
  } finally {
    await dispose()
  }
}

async function testHeadReportsTheTypeWithoutABody(): Promise<void> {
  expect.hasAssertions()
  const directory = await artifactRoot({
    'client.js': 'x'.repeat(HEAD_BODY_LENGTH),
    'index.html': '<!doctype html>',
  })
  const { origin, dispose } = await mount({
    artifactRoot: directory,
    port: EPHEMERAL_PORT,
  })
  try {
    /*
     * HEAD is derived by Fastify from the GET registration, so this also proves
     * the two do not conflict — registering HEAD explicitly throws at startup.
     */
    const response = await fetch(`${origin}/client.js`, { method: 'HEAD' })
    expect(response.status).toBe(STATUS_OK)
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
  const { origin, dispose } = await mount({
    artifactRoot: directory,
    port: EPHEMERAL_PORT,
  })
  await expect(fetch(`${origin}/health`)).resolves.toBeDefined()

  await dispose()
  // The port must stop answering, or a reload would leak a listener per mount.
  await expect(fetch(`${origin}/health`)).rejects.toThrow(
    /fetch failed|ECONNREFUSED/u,
  )
}

describe('server listener', () => {
  afterEach(removeArtifactRoots)

  it(
    'answers the health probe over HTTP',
    { timeout: TEST_TIMEOUT },
    testAnswersTheHealthProbe,
  )

  it(
    'serves the browser bundle as javascript',
    { timeout: TEST_TIMEOUT },
    testServesTheClientBundle,
  )

  it(
    'serves the index page at the root',
    { timeout: TEST_TIMEOUT },
    testServesTheIndexPage,
  )

  it(
    'answers 404 for a missing index',
    { timeout: TEST_TIMEOUT },
    testMissingIndexIsNotFound,
  )

  it(
    'answers 404 for an unknown asset',
    { timeout: TEST_TIMEOUT },
    testUnknownPathIsNotFound,
  )

  it(
    'answers HEAD with the type and no body',
    { timeout: TEST_TIMEOUT },
    testHeadReportsTheTypeWithoutABody,
  )

  it(
    'stops listening when its fiber is disposed',
    { timeout: TEST_TIMEOUT },
    testDisposalClosesTheListener,
  )
})
