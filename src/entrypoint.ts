import * as core from '@actions/core'

import { Octokit } from '@octokit/rest'

import { getClient } from './client'
import { fileIssues } from './functions'

async function main (): Promise<void> {
  try {
    const opts: core.InputOptions = { required: true }

    const accessToken: string = core.getInput('ACCESS_TOKEN', opts)
    core.debug(`Access token: ${accessToken.length === 40 ? 'OK' : 'Not OK'}`)

    const orgName: string = core.getInput('ORG_NAME', opts)
    core.debug(`Org name: ${orgName}`)

    const projectNumber: number = parseInt(core.getInput('PROJECT_NUMBER', opts))
    core.debug(`Project number: ${projectNumber}`)

    const columnName: string = core.getInput('COLUMN_NAME', opts)
    core.debug(`Column name: ${columnName}`)

    let excludedProjectNumber: number | null = parseInt(core.getInput('EXCLUDED_PROJECT_NUMBER') || '-1')
    if (excludedProjectNumber === -1) {
      excludedProjectNumber = null
    }
    core.debug(`Excluded project number: ${excludedProjectNumber === null ? 'NA' : excludedProjectNumber}`)

    let issueType: string = core.getInput('ISSUE_TYPE') || 'any'
    if (!['any', 'issue', 'pr'].includes(issueType)) {
      throw new Error('Invalid issue type specified')
    }
    core.debug(`Issue type: ${issueType}`)

    let interval: number = parseInt(core.getInput('INTERVAL') || '1')
    core.debug(`Interval: ${interval}`)

    // Prepare Octokit client
    const client: Octokit = getClient(accessToken)
    // Perform wonders with the client
    await fileIssues(client, orgName, projectNumber, columnName, excludedProjectNumber, issueType, interval)
  } catch (ex) {
    core.setFailed(ex.message)
  }
}

main()
