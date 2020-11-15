import * as core from '@actions/core'
import { Octokit } from '@octokit/rest'

import { Issue, Error } from './types'
import { todayOffset } from './util'

/**
 * Get the details of the issue from the given API URL.
 *
 * @param {Octokit} client - the pre-authenticated GitHub client
 * @param {string} url - the API URL of the issue
 *
 * @return {Issue} - the issue described by the API URL
 */
async function getIssue (
    client: Octokit,
    url: string
): Promise<Issue> {

  const { data }: { data: Issue } = await client.request(url)
  const issue: Issue = {
    id: data.id,
    title: data.title,
    isPullRequest: Object.prototype.hasOwnProperty.call(data, 'pull_request')
  }
  core.info(`Issue: #${issue.id} ${issue.title}`)
  return issue
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
 * Get a list of issues created yesterday. This is not exactly 24 hours but
 * rather includes the entirety of 'yesterday' as well as whatever part of
 * 'today' has elapsed when this runs.
 *
 * @param {Octokit} client - the pre-authenticated GitHub client
 * @param {string} orgName - the GitHub username of the organisation
 * @param {number} interval - the number of days to check for updated issues
 *
 * @return {Array} the list of issues created in the given interval
 */
async function getIssues (
    client: Octokit,
    orgName: string,
    interval: number
): Promise<Array<Issue>> {

  // Prepare search query
  const [yesterday,] = todayOffset(-interval).toISOString().split('T')
  const q = [
    'is:open',
    'is:issue',
    `org:${orgName}`,
    `created:>=${yesterday}`
  ].join('+')

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
 * Add all issues created in the last time interval to the given project in the
 * given org under the given column. Issues that are already present in the
 * given excluded project will be ignored.
 *
 * @param {Octokit} client - the pre-authenticated GitHub client
 * @param {string} orgName - the GitHub username of the organisation
 * @param {number} projectNumber - the number of the project within the org
 * @param {string} columnName - the name of the column within the project board
 * @param {number} interval - the number of days to check for updated issues
 */
export async function fileIssues (
    client: Octokit,
    orgName: string,
    projectNumber: number,
    columnName: string,
    interval: number
): Promise<void> {

  // Find column
  const projectId: number = await getProjectId(client, orgName, projectNumber)
  const columnId: number = await getColumnId(client, projectId, columnName)
  // Find issues
  const issues: Array<Issue> = await getIssues(client, orgName, interval)

  // Add issues to column
  issues.forEach((issue: Issue): void => {
    client.projects
        .createCard({
          column_id: columnId,
          content_id: issue.id,
          content_type: 'Issue'
        })
        .then(() => {
          core.info(`Card creation succeeded for issue '${issue.title}'.`)
        })
        .catch(ex => {
          const all_errors = ex.errors.map((error: Error) => error.message)
          const false_alarm = 'Project already has the associated issue'

          if (all_errors.includes(false_alarm)) {
            core.warning(`Card already exists for issue '${issue.title}'.`)
          } else {
            core.error(`Card creation failed for issue '${issue.title}'.`)
          }
        })
  })
}
