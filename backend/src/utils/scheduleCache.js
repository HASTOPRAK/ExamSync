/**
 * In-memory schedule cache with TTL.
 *
 * Schedule data only changes when a teacher saves a new schedule, so we cache
 * aggressively (5 min TTL) and invalidate the entire cache on every save.
 *
 * Keys:
 *   "student:<id>"              – public + authenticated student's own schedule
 *   "teacher:<ownerId>:<id>"    – teacher's view of a specific student (filtered by owner)
 */

const TTL_MS = 5 * 60 * 1000; // 5 minutes

/** @type {Map<string, { data: unknown; expiresAt: number }>} */
const store = new Map();

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function cacheSet(key, data) {
  store.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

/** Called after every saveSchedule — wipes all cached schedules. */
export function invalidateScheduleCache() {
  store.clear();
}

/** Visible for tests / monitoring. */
export function cacheSize() {
  return store.size;
}
