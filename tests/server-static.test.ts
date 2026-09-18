/**
 * Server static-rule tests.
 *
 * These cover the decisions the server makes about a request — which path
 * answers, with which status, and with which content type — without starting a
 * listener. They are the rules that decide whether a traversal is refused and
 * whether an unknown extension is served as a guess, so they are worth pinning
 * independently of the framework wiring that calls them.
 */
import { describe, expect, it } from 'vitest'

import {
  DEFAULT_CONTENT_TYPE,
  STATUS_FORBIDDEN,
  STATUS_METHOD_NOT_ALLOWED,
  STATUS_OK,
  contentTypeFor,
  resolveStatic,
} from '#src/server-static'

const TEST_TIMEOUT = 5000

/** An unlisted, extensionless file name used to check the binary fallback. */
const BINARY_FALLBACK_FILE = '/srv/LICENSE'

/** A file whose extension the server does not declare. */
const UNKNOWN_EXTENSION_FILE = '/srv/archive.weird'

/** The artifact root most cases share. */
const ROOT = { artifactRoot: '/srv', indexFile: 'index.html' }

function testServesTheIndexForTheRootPath(): void {
  expect.hasAssertions()
  const decision = resolveStatic('/', 'GET', {
    artifactRoot: '/srv',
    indexFile: 'index.html',
  })
  expect(decision.status).toBe(STATUS_OK)
  expect(decision.file).toBe('/srv/index.html')
}

function testRejectsTraversalOutsideTheRoot(): void {
  expect.hasAssertions()
  const root = { artifactRoot: '/srv/lib', indexFile: 'index.html' }
  expect(resolveStatic('/../secret', 'GET', root).status).toBe(STATUS_FORBIDDEN)
}

function testRejectsSiblingWithSharedPrefix(): void {
  expect.hasAssertions()
  /*
   * A bare `startsWith(root)` check accepts `/srv/lib-private` as living inside
   * `/srv/lib`, because the string starts with the root. Anchoring on the
   * separator is what makes the containment check mean containment.
   */
  const root = { artifactRoot: '/srv/lib', indexFile: 'index.html' }
  expect(resolveStatic('/../lib-private/secret', 'GET', root).status).toBe(
    STATUS_FORBIDDEN,
  )
}

function testRejectsNonReadMethods(): void {
  expect.hasAssertions()
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    expect(resolveStatic('/client.js', method, ROOT).status).toBe(
      STATUS_METHOD_NOT_ALLOWED,
    )
  }
}

function testAcceptsReadMethods(): void {
  expect.hasAssertions()
  expect(resolveStatic('/client.js', 'GET', ROOT).status).toBe(STATUS_OK)
  expect(resolveStatic('/client.js', 'HEAD', ROOT).status).toBe(STATUS_OK)
}

function testUnknownExtensionsShipAsBinary(): void {
  expect.hasAssertions()
  expect(contentTypeFor('/srv/client.js')).toBe(
    'text/javascript; charset=utf-8',
  )
  expect(contentTypeFor('/srv/index.html')).toBe('text/html; charset=utf-8')
  expect(contentTypeFor('/srv/logo.svg')).toBe('image/svg+xml')
  // No extension and an unlisted one must both fall back rather than guess.
  expect(contentTypeFor(BINARY_FALLBACK_FILE)).toBe(DEFAULT_CONTENT_TYPE)
  expect(contentTypeFor(UNKNOWN_EXTENSION_FILE)).toBe(DEFAULT_CONTENT_TYPE)
}

function testResolvesNestedPathsInsideTheRoot(): void {
  expect.hasAssertions()
  const decision = resolveStatic('/nested/deep.js', 'GET', ROOT)
  expect(decision.status).toBe(STATUS_OK)
  expect(decision.file).toBe('/srv/nested/deep.js')
}

describe('server static rules', () => {
  it(
    'serves the index for the root path',
    { timeout: TEST_TIMEOUT },
    testServesTheIndexForTheRootPath,
  )

  it(
    'rejects traversal outside the artifact root',
    { timeout: TEST_TIMEOUT },
    testRejectsTraversalOutsideTheRoot,
  )

  it(
    'rejects a sibling directory sharing the root prefix',
    { timeout: TEST_TIMEOUT },
    testRejectsSiblingWithSharedPrefix,
  )

  it(
    'rejects methods other than GET and HEAD',
    { timeout: TEST_TIMEOUT },
    testRejectsNonReadMethods,
  )

  it('accepts GET and HEAD', { timeout: TEST_TIMEOUT }, testAcceptsReadMethods)

  it(
    'falls back to a binary type for unknown extensions',
    { timeout: TEST_TIMEOUT },
    testUnknownExtensionsShipAsBinary,
  )

  it(
    'resolves nested paths inside the root',
    { timeout: TEST_TIMEOUT },
    testResolvesNestedPathsInsideTheRoot,
  )
})
