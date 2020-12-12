import * as core from '@actions/core'

import { Octokit } from '@octokit/rest'

/**
 * Get an instance of the Octokit client with pre-configured authentication and
 * logging capabilities.
 *
 * @param {string} accessToken - an authorised Personal Access Token from GitHub
 */
export function getClient (accessToken: string): Octokit {
  return new Octokit({
    auth: accessToken,
    log: {
      debug: core.debug,
      info: core.info,
      warn: core.warning,
      error: core.error
    }
  })
}
