/**
 * Reduced form of a GitHub issue
 */
export interface Issue {
  id: number
  title: string
}

/**
 * Error returned from the GitHub API
 */
export interface Error {
  resource: string
  code: string
  field: string
  message: string
}
