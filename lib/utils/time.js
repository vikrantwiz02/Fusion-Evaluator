/**
 * Checks whether the current moment falls within an access window defined by
 * two absolute DateTime values stored in the database.
 *
 * Rules:
 *   - Both null/undefined   → unrestricted, always accessible
 *   - Only access_start set → accessible once start has passed
 *   - Only access_end   set → accessible until end passes
 *   - Both set              → accessible within [start, end]
 *
 * @param {Date|string|null} accessStart
 * @param {Date|string|null} accessEnd
 * @returns {boolean}
 */
export function isWithinAccessWindow(accessStart, accessEnd) {
  if (accessStart == null && accessEnd == null) return true;

  const now = new Date();

  if (accessStart != null) {
    const start = new Date(accessStart);
    if (!isNaN(start.getTime()) && now < start) return false;
  }

  if (accessEnd != null) {
    const end = new Date(accessEnd);
    if (!isNaN(end.getTime()) && now > end) return false;
  }

  return true;
}
