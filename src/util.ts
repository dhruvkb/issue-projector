/**
 * Get the date that is offset from now by the given delta.
 *
 * @param {number} delta - the time period to add or subtract from now
 * @param {string} deltaUnit - the unit of the time period to add or subtract from now
 */
export function dateOffset (delta: number = 0, deltaUnit: string = 'd'): Date {
  const now = new Date()
  const then = new Date()
  if (deltaUnit === 'd') {
    then.setDate(now.getDate() + delta)
  } else {
    then.setHours(now.getHours() + delta)
  }
  return then
}
