// Groups ("programs" in the code): named week schedules — "September 2026" — that own their
// routines (r.group), with an optional end date (p.until) and an optional rotation so the plan
// switches group every N weeks by itself.
//
// Every routine belongs to a group; ensureGroups (run on every save) creates a first group for
// a plan that has none and files any loose routine into the group in use. Temporary routines
// (r.temp = the ISO day they are for) belong to no group and are cleared once their day passed.
//
// State: S.programs = [{ id, name, week: { 0..6: routineId } }], S.program = id of the program
// in use, S.programFrom = ISO date it was put in use, S.rotate = weeks per program (0 = off).
// With no programs S.week is the one schedule, exactly as before. With programs, S.week is kept
// as a mirror of this week's program (see syncWeek) so everything that reads it stays correct.
import { isoOf, todayISO, uid } from './format.js'
import { t } from './i18n.js'

const WEEK_MS = 7 * 864e5

export function mondayOf(iso) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() - (d.getDay() + 6) % 7)
  return isoOf(d)
}
// Whole weeks from the Monday of `a` to the Monday of `b` (negative when b is earlier).
// Rounded, so a DST change inside the span can't shave off an hour and drop a week.
export const weeksBetween = (a, b) =>
  Math.round((new Date(mondayOf(b) + 'T12:00:00') - new Date(mondayOf(a) + 'T12:00:00')) / WEEK_MS)

export const isExpired = (p, iso) => !!(p && p.until && iso > p.until)

export function programFor(S, iso) {
  const ps = S.programs || []
  if (!ps.length) return null
  let i = Math.max(0, ps.findIndex(p => p.id === S.program))
  if (S.rotate > 0 && ps.length > 1 && S.programFrom) {
    const k = Math.floor(weeksBetween(S.programFrom, iso) / S.rotate)
    i = (((i + k) % ps.length) + ps.length) % ps.length
  }
  // Past its end date a group hands over to the next one in the list that is still running —
  // "September" ends, "October" takes over without anyone having to switch.
  if (isExpired(ps[i], iso)) {
    for (let j = 1; j < ps.length; j++) {
      const q = ps[(i + j) % ps.length]
      if (!isExpired(q, iso)) return q
    }
  }
  return ps[i]
}

// An expired group with nothing to hand over to schedules nothing: the plan has run out.
export function weekFor(S, iso) {
  const p = programFor(S, iso)
  if (!p) return S.week || {}
  return isExpired(p, iso) ? {} : p.week
}

export const groupRoutines = (S, gid) => (S.routines || []).filter(r => !r.temp && r.group === gid)
export const listedRoutines = S => (S.routines || []).filter(r => !r.temp)

export function ensureGroups(S) {
  if (!S.routines) return S
  const today = todayISO()
  // Temporary routines live only for their day (and any day still ahead they were put on).
  const keep = r => !r.temp || r.temp >= today || Object.entries(S.dayPlan || {}).some(([d, v]) => v === r.id && d >= today)
  const gone = S.routines.filter(r => !keep(r)).map(r => r.id)
  if (gone.length) {
    S.routines = S.routines.filter(keep)
    Object.keys(S.dayPlan || {}).forEach(d => { if (gone.includes(S.dayPlan[d])) delete S.dayPlan[d] })
  }
  const real = S.routines.filter(r => !r.temp)
  if (!real.length) return S
  S.programs = S.programs || []
  if (!S.programs.length) {
    const g = { id: uid(), name: t('My plan'), week: { ...(S.week || {}) } }
    S.programs.push(g)
    S.program = g.id
    S.programFrom = mondayOf(today)
  }
  const ids = new Set(S.programs.map(p => p.id))
  const cur = programFor(S, today) || S.programs[0]
  real.forEach(r => {
    if (r.group && ids.has(r.group)) return
    const home = S.programs.find(p => Object.values(p.week || {}).includes(r.id))
    r.group = (home || cur).id
  })
  return S
}

// The schedule code should write into when it edits "the week" (starter plan, plan import).
export const editableWeek = S => programFor(S, todayISO())?.week || S.week

// Re-anchors the rotation so `id` is the program in use from this week on.
export function activateProgram(S, id) {
  S.program = id
  S.programFrom = mondayOf(todayISO())
}

export function syncWeek(S) {
  ensureGroups(S)
  if (S.programs?.length) S.week = { ...weekFor(S, todayISO()) }
  return S
}

// Drops a deleted routine from every schedule it was on.
export function unschedule(S, rid) {
  const clear = w => Object.keys(w || {}).forEach(k => { if (w[k] === rid) delete w[k] })
  clear(S.week);
  (S.programs || []).forEach(p => clear(p.week))
}

// The program in use this week, and which one takes over next and when (null with no rotation).
export function rotationInfo(S, today = todayISO()) {
  const cur = programFor(S, today)
  if (!cur || !(S.rotate > 0) || S.programs.length < 2) return { cur, next: null, inWeeks: 0 }
  const k = weeksBetween(S.programFrom || today, today)
  const inWeeks = S.rotate - (((k % S.rotate) + S.rotate) % S.rotate)
  const d = new Date(mondayOf(today) + 'T12:00:00')
  d.setDate(d.getDate() + inWeeks * 7)
  return { cur, next: programFor(S, isoOf(d)), inWeeks }
}
