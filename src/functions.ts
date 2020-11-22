import * as core from '@actions/core'
import { Octokit } from '@octokit/rest'

import { Error as GitHubError, Issue, Outcome } from './types'
import { dateOffset } from './util'

/**
 * Check if the given issue is already present in the given project.
 *
 * @param {Octokit} client - the pre-authenticated GitHub client
 * @param {number} issueId - the ID of the issue whose presence is being checked
 * @param {number} columnId - any column in the project in which to check for the presence of the issue
 */
async function isIssueInProject (
  client: Octokit,
  issueId: number,
  columnId: number
): Promise<boolean> {
  const { isSuccessful, data: cardId, errors }: Outcome<number> = await addIssueToColumn(client, issueId, columnId)
  if (isSuccessful) {
    core.debug('Card created in excluded project')
    if (cardId) {
      await client.projects
        .deleteCard({
          card_id: cardId
        })
      core.debug('Card deleted from excluded project')
    }
    return false
  } else {
    const falseAlarm = 'Project already has the associated issue'
    return errors.includes(falseAlarm)
  }
}

/**
 * Add the issue with the given ID to the given project column.
 *
 * @param {Octokit} client - the pre-authenticated GitHub client
 * @param {number} issueId - the ID of the issue to add to the given column
 * @param {number} columnId - the absolute ID of the column in which to add the issue
 */
async function addIssueToColumn (
  client: Octokit,
  issueId: number,
  columnId: number
): Promise<Outcome<number>> {
  let outcome: Outcome<number> = {
    isSuccessful: false,
    errors: []
  }
  try {
    const { data: card } = await client.projects
      .createCard({
        column_id: columnId,
        content_id: issueId,
        content_type: 'Issue'
      })
    outcome.isSuccessful = true
    outcome.data = card.id
  } catch (ex) {
    outcome.isSuccessful = false
    outcome.errors = ex.errors.map((error: GitHubError) => error.message)
  }

  return outcome
}

/**
 * Get the ID of a project with the given number in the given organisation.
 *
 * @param {Octokit} client - the pre-authenticated GitHub client
 * @param {string} orgName - the GitHub username of the organisation
 * @param {number} projectNumber - the number of the project within the org
 *
 * @return {number} - the absolute ID of the project
 */
async function getProjectId (
  client: Octokit,
  orgName: string,
  projectNumber: number
): Promise<number> {

  // Fetching projects
  const { data: projects } = await client.projects.listForOrg({ org: orgName })
  const project = projects.find(proj => proj.number === projectNumber)
  if (!project) {
    throw new Error('Project not found')
  }

  // Project found
  const { id: projectId, name: projectName }: { id: number, name: string } = project
  core.info(`Project ID: ${projectId}`)
  core.info(`Project Name: ${projectName}`)

  return projectId
}

/**
 * Get the IDs of all columns in the given project.
 *
 * @param {Octokit} client - the pre-authenticated GitHub client
 * @param {number} projectId - the absolute ID of the project
 *
 * @return {Array} - the absolute IDs of all columns
 */
async function getColumnIds (
  client: Octokit,
  projectId: number
): Promise<Array<number>> {
  const { data: columns } = await client.projects.listColumns({ project_id: projectId })
  core.info(`Retrieved ${columns.length} columns`)
  return columns.map(col => col.id)
}

/**
 * Get the ID of the column with the given name in the given project.
 *
 * @param {Octokit} client - the pre-authenticated GitHub client
 * @param {number} projectId - the absolute ID of the project
 * @param {string} columnName - the name of the column within the project board
 *
 * @return {number} - the absolute ID of the column
 */
async function getColumnId (
  client: Octokit,
  projectId: number,
  columnName: string
): Promise<number> {

  // Fetching column
  const { data: columns } = await client.projects.listColumns({ project_id: projectId })
  const column = columns.find(col => col.name === columnName)
  if (!column) {
    throw new Error('Column not found')
  }

  // Column found
  const { id: columnId }: { id: number } = column
  core.info(`Column ID: ${columnId}`)

  return columnId
}

/**
 * Get a list of issues created in the specified time interval.
 *
 * @param {Octokit} client - the pre-authenticated GitHub client
 * @param {string} orgName - the GitHub username of the organisation
 * @param {string} issueType - whether to find new issues, PRs or both
 * @param {number} interval - the time period to check for updated issues
 * @param {string} intervalUnit - the unit of the time period to check for updated issues
 *
 * @return {Array} the list of issues created in the given interval
 */
async function getNewIssues (
  client: Octokit,
  orgName: string,
  issueType: string,
  interval: number,
  intervalUnit: string
): Promise<Array<Issue>> {

  // Prepare search query
  let startTime = dateOffset(-interval, intervalUnit).toISOString()
  const criteria = [
    'is:open',
    `org:${orgName}`,
    `created:>=${startTime}`
  ]
  if (issueType != 'any') {
    criteria.push(`is:${issueType}`)
  }
  const q = criteria.join('+')

  // Fetch issues
  const newIssues: Array<Issue> = []
  for await (const response of client.paginate.iterator(
    client.search.issuesAndPullRequests,
    {
      q,
      per_page: 100
    }
  )) {
    const { data: issues } = response
    newIssues.push(...issues.map((issue): Issue => ({
      id: issue.id,
      title: issue.title,
      isPullRequest: Object.prototype.hasOwnProperty.call(issue, 'pull_request')
    })))
    core.debug(`Fetched ${newIssues.length}/${issues.total_count} issues.`)
  }

  core.info(`Retrieved ${newIssues.length} new issues`)
  return newIssues
}

/**
 * Add the given new issues to the given project column. This skips over issues
 * that are present in the excluded project.
 *
 * @param {Octokit} client - the pre-authenticated GitHub client
 * @param {string} columnId - the absolute ID of the column within the project board
 * @param {string} excludedColumnId - the absolute ID of the column
 * @param {Array} newIssues - the list of issues created in the given interval
 */
async function performFiling (
  client: Octokit,
  columnId: number,
  excludedColumnId: number | null,
  newIssues: Array<Issue>
): Promise<void> {

  for (const issue of newIssues) {
    if (excludedColumnId && await isIssueInProject(client, issue.id, excludedColumnId)) {
      core.warning(`Ignoring issue '${issue.title}' as it belongs to excluded project`)
      continue
    }

    const { isSuccessful, errors } = await addIssueToColumn(client, issue.id, columnId)
    if (isSuccessful) {
      core.info(`Card creation succeeded for issue '${issue.title}'.`)
    } else {
      const falseAlarm = 'Project already has the associated issue'
      if (errors.includes(falseAlarm)) {
        core.warning(`Card already exists for issue '${issue.title}'.`)
      } else {
        core.error(`Card creation failed for issue '${issue.title}'.`)
      }
    }
  }
}

/**
 * Add all issues created in the last time interval to the given project in the
 * given org under the given column. Issues that are already present in the
 * given excluded project will be ignored.
 *
 * @param {Octokit} client - the pre-authenticated GitHub client
 * @param {string} orgName - the GitHub username of the organisation
 * @param {number} projectNumber - the number of the project within the org
 * @param {string} columnName - the name of the column within the project board
 * @param {number} excludedProjectNumber - the number of the excluded project within the org
 * @param {string} issueType - whether to find new issues, PRs or both
 * @param {number} interval - the time period to check for updated issues
 * @param {string} intervalUnit - the unit of the time period to check for updated issues
 */
export async function fileIssues (
  client: Octokit,
  orgName: string,
  projectNumber: number,
  columnName: string,
  excludedProjectNumber: number | null,
  issueType: string,
  interval: number,
  intervalUnit: string
): Promise<void> {

  // Find column
  const projectId: number = await getProjectId(client, orgName, projectNumber)
  const columnId: number = await getColumnId(client, projectId, columnName)

  // Find excluded column
  let excludedProjectId: number | null = null
  let excludedColumnId: number | null = null
  if (excludedProjectNumber) {
    excludedProjectId = await getProjectId(client, orgName, excludedProjectNumber)
    excludedColumnId = (await getColumnIds(client, excludedProjectId))[0]
    core.info(`Column ID: ${excludedColumnId}`)
  }

  // Find new issues
  const newIssues: Array<Issue> = await getNewIssues(client, orgName, issueType, interval, intervalUnit)

  // File new issues
  await performFiling(client, columnId, excludedColumnId, newIssues)
}
