/**
 * Get the date that is offset from today by the given delta.
 *
 * @param {number} delta - the number of days to add or subtract from today
 */
export function todayOffset (delta: number = 0): Date {
  const now = new Date()
  const then = new Date()
  then.setDate(now.getDate() + delta)
  return then
}
