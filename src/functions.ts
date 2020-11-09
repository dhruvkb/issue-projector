import * as core from '@actions/core'
import { Octokit } from '@octokit/rest'

import { Issue, Error } from './types'
import { todayOffset } from './util'

/**
 * Get the ID of a project with the given number in the given organisation.
 *
 * @param {Octokit} client - the pre-authenticated GitHub client
 * @param {string} orgName - the GitHub username of the organisation
 * @param {number} projectNumber - the number of the project within the org
 *
 * @return {number} - the absolute ID of the project
 */
async function getProjectId(
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
  const allIssues: Array<Issue> = []
  for await (const response of client.paginate.iterator(
      client.search.issuesAndPullRequests,
      { q }
  )) {
    const { data: issues } = response
    allIssues.push(...issues.map(issue => ({
      id: issue.id,
      title: issue.title
    })))
    core.debug(`Fetched ${allIssues.length}/${issues.total_count} issues.`)
  }

  return allIssues
}

/**
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
