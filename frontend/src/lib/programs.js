// Weekly programs: named week schedules ("Program A", "Program B") that group routines, with an
// optional rotation so the plan switches program every N weeks by itself.
//
// State: S.programs = [{ id, name, week: { 0..6: routineId } }], S.program = id of the program
// in use, S.programFrom = ISO date it was put in use, S.rotate = weeks per program (0 = off).
// With no programs S.week is the one schedule, exactly as before. With programs, S.week is kept
// as a mirror of this week's program (see syncWeek) so everything that reads it stays correct.
import { isoOf, todayISO } from './format.js'

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

export function programFor(S, iso) {
  const ps = S.programs || []
  if (!ps.length) return null
  let i = Math.max(0, ps.findIndex(p => p.id === S.program))
  if (S.rotate > 0 && ps.length > 1 && S.programFrom) {
    const k = Math.floor(weeksBetween(S.programFrom, iso) / S.rotate)
    i = (((i + k) % ps.length) + ps.length) % ps.length
  }
  return ps[i]
}

export const weekFor = (S, iso) => programFor(S, iso)?.week || S.week || {}

// The schedule code should write into when it edits "the week" (starter plan, plan import).
export const editableWeek = S => programFor(S, todayISO())?.week || S.week

// Re-anchors the rotation so `id` is the program in use from this week on.
export function activateProgram(S, id) {
  S.program = id
  S.programFrom = mondayOf(todayISO())
}

export function syncWeek(S) {
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
