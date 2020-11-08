import core from '@actions/core'

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

    const projectName: string = core.getInput('PROJECT_NAME', opts)
    core.debug(`Project name: ${projectName}`)

    const columnName: string = core.getInput('COLUMN_NAME', opts)
    core.debug(`Column name: ${columnName}`)

    let interval: number = parseInt(core.getInput('INTERVAL') || '1')
    core.debug(`Interval: ${interval}`)

    // Prepare Octokit client
    const client: Octokit = getClient(accessToken)
    // Perform wonders with the client
    await fileIssues(client, orgName, projectName, columnName, interval)
  } catch (ex) {
    core.setFailed(ex.message)
  }
}

main()
