// Pure helpers over the state object S (ported 1:1 from the vanilla app).
import { todayISO, isoOf, weekKey, fmtNum } from './format.js'
import { isCardio, isBodyweightEq } from './exercises.js'
import { t } from './i18n.js'
import { weekFor } from './programs.js'

// How an exercise is logged (issue #16). This used to be derived from the body part alone,
// which meant a plank or a farmer's carry could only be timed by filing it under cardio.
// A routine entry can now say so explicitly:
//   reps   — weight × reps      sets look like { w, r }
//   time   — a work duration    sets look like { sec, w }   (w = 0 for bodyweight)
//   cardio — duration + speed   sets look like { min, speed }
// An entry without `mode` behaves exactly as before, so every existing plan, workout and
// plan file is read unchanged and nothing needs migrating.
export function modeOf(cfg) {
  const m = cfg && cfg.mode
  if (m === 'reps' || m === 'time' || m === 'cardio') return m
  return isCardio(cfg && cfg.id) ? 'cardio' : 'reps'
}
export const isTimed = cfg => modeOf(cfg) === 'time'

// Two flags that ride on top of a mode rather than making new ones (issues #31/#32), because
// "bodyweight" and "per side" are true of a rep set and of a timed hold alike:
//   bodyweight — the exercise carries no load of its own, so `w` means *added* weight and is
//                asked for only once you say there is some. Seeded from the equipment field.
//                Spelled out rather than `bw`, which a workout already uses for the weigh-in
//                it was logged at — two different things one letter apart is a bug waiting.
//   side       — the exercise is unilateral. You still log what you did: 16, the total across
//                both sides. The split is derived for planning ("8 per side"), never entered
//                — a number that sometimes means one side and sometimes both is the thing
//                that made this ambiguous in the first place, and one rep count that always
//                means the same thing beats two that need a legend.
// Both are absent on every plan, workout and backup written before they existed, and absent
// reads as false, so nothing needs migrating.
export const isBw = cfg => (cfg && cfg.bodyweight != null ? !!cfg.bodyweight : isBodyweightEq(cfg && cfg.id))
export const isPerSide = cfg => !!(cfg && cfg.side)
// What one side did, for display only. Half of an odd total is shown as it falls (8.5) rather
// than rounded away: it means the sides were not even, which is worth seeing.
export const sideReps = reps => (reps || 0) / 2
// Unilateral work moves in pairs, so its rep target steps by two — 16, 18, 20 — and a total
// that stayed odd would put a rep on one side and not the other.
// A rep target of 0 means "to failure": no fixed count, you log what you got. Only a real 0
// counts — a missing target still falls back to the usual default wherever one applies.
export const toFailure = cfg => !!cfg && cfg.reps === 0 && modeOf(cfg) === 'reps'
export const repsText = reps => (reps === 0 ? t('to failure') : String(reps ?? 10))
export const repStep = cfg => (isPerSide(cfg) ? 2 : 1)

// mm:ss for a work duration — seconds alone read badly past a minute ("90 s" vs "1:30").
export function fmtSec(sec) {
  const n = Math.max(0, Math.round(Number(sec) || 0))
  return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0')
}

// How hard a set felt, if the profile logs it at all. Two scales for the same thing, kept in
// their own fields: RIR counts the reps still in the tank, RPE reads the same effort off a
// 10-point scale from the top (RPE 8 ≈ RIR 2). A set logged on one scale is never silently
// rewritten as the other — switching the setting changes what new sets ask for, nothing else.
// `min`..`max` is the range the stepper walks. RIR bottoms out at 0 (a set taken to failure);
// RPE bottoms out at 6, since the scale is only meaningful for working sets and anything
// lighter is a warm-up nobody rates.
export const EFFORT = {
  rir: { f: 'rir', hd: 'RIR', step: 0.5, min: 0, max: 10 },
  rpe: { f: 'rpe', hd: 'RPE', step: 0.5, min: 6, max: 10 }
}
// One tap of an effort stepper. Empty is not 0 — an unlogged effort must not become "went to
// failure" from one stray tap — so − on an empty cell leaves it empty, and + starts at the
// bottom of the scale and walks up from there in even steps. Stepping back off the bottom
// clears the cell again, so a mistap is undoable. null means "nothing logged"; the caller
// stores that by dropping the key rather than writing a null.
export function stepEffort(kind, cur, dir) {
  const e = EFFORT[kind]
  if (!e) return cur ?? null
  if (cur == null) return dir < 0 ? null : e.min
  const n = Math.round((cur + dir * e.step) * 100) / 100
  if (dir < 0 && n < e.min) return null
  // only the ceiling is enforced on the way up: a value typed below the floor (nothing stops
  // someone entering RPE 3) still steps in even increments instead of snapping to the floor.
  return dir > 0 ? Math.min(e.max, n) : Math.max(e.min, n)
}
// A typed effort is capped but not floored — clamping up while someone types "10" would turn
// the first keystroke into the floor and fight the input.
export const capEffort = (kind, v) =>
  (v == null || !EFFORT[kind] ? v : Math.min(EFFORT[kind].max, v))
// Which scale a profile logs. `showRir` is the boolean this replaced and is only consulted
// when the profile has no answer of its own — an explicit 'none' has to win over it, or a
// backup or another device that still carries the old flag would switch the column back on.
export const effortOf = S => {
  const e = S && S.effort
  return e === 'none' || EFFORT[e] ? e : (S && S.showRir ? 'rir' : 'none')
}
// The "(RIR 2)" / "(RPE 8)" tail on a set summary, empty when nothing was logged.
const effortTail = s => {
  const k = s.rir != null ? 'rir' : s.rpe != null ? 'rpe' : null
  return k ? ` (${EFFORT[k].hd} ${fmtNum(s[k])})` : ''
}

// Set types (tap the set number during a workout). A plain set has no `k` and is numbered;
// the others show a coloured letter instead:
//   w — warm-up    d — drop set (stripping)    l / r — left / right side of unilateral work
// Warm-ups and drop sets are not "working" sets: progression and the trend charts judge a
// session on its working sets only, so a lighter drop set can never read as a missed rep or
// a weaker session. Left/right sets are working sets — they are the exercise.
export const SET_KINDS = ['w', 'd', 'l', 'r']
export const KIND_LETTER = { w: 'W', d: 'D', l: 'L', r: 'R' }
export const KIND_NAME = { w: 'Warm-up', d: 'Drop set', l: 'Left', r: 'Right' }
export const isWorking = s => !s || !s.k || s.k === 'l' || s.k === 'r'
const workKind = k => !k || k === 'l' || k === 'r'
// A planned set layout (one kind per set, '' for a plain set) with exactly `n` working sets.
// Missing plain sets go in after the last working set, ahead of a trailing drop set; extra
// ones come off the end, plain sets first, so the warm-up and the drop set stay where they are.
// `trim` false only ever adds — last time's layout is topped up to the plan, never cut.
export function fitLayout(layout, n, trim = true) {
  const out = [...(layout || [])]
  while (out.filter(workKind).length < n) {
    let at = out.length
    while (at > 0 && !workKind(out[at - 1])) at--
    out.splice(at > 0 ? at : out.length, 0, '')
  }
  while (trim && out.filter(workKind).length > n) {
    const plain = out.lastIndexOf('')
    let j = out.length - 1
    while (j >= 0 && !workKind(out[j])) j--
    out.splice(plain >= 0 ? plain : j, 1)
  }
  return out
}
// The badges of a layout, as the workout will show them: "W 1 2 3 D".
export const layoutBadges = layout => layout.map((k, i) => setBadge(layout.map(x => (x ? { k: x } : {})), i))
// The badge on a set: its number among the plain sets, or its type letter.
export function setBadge(sets, i) {
  const s = sets[i]
  if (s && s.k && KIND_LETTER[s.k]) return t(KIND_LETTER[s.k])
  let n = 0
  for (let j = 0; j <= i; j++) if (!sets[j].k) n++
  return String(n)
}
// setLabel with the type letter in front ("D 40×8") — for history lines that list sets.
export const setText = (id, s, cfg) => (s.k && KIND_LETTER[s.k] ? t(KIND_LETTER[s.k]) + ' ' : '') + setLabel(id, s, cfg)

// One-line summary of a logged set. `cfg` carries the mode when the caller has it (a routine
// entry or a workout entry); passing an id alone keeps the old body-part behaviour.
export function setLabel(id, s, cfg) {
  const c = cfg || { id }
  const mode = modeOf(c)
  if (mode === 'cardio') return `${s.min || 0} min @ ${fmtNum(s.speed || 0)} km/h`
  if (mode === 'time') return fmtSec(s.sec) + (s.w > 0 ? ` · ${fmtNum(s.w)}` : '')
  // Bodyweight reads as what you did — "12", or "+10 × 12" once there is a belt involved —
  // rather than "0×12", which says a set was performed with no weight and means nothing.
  // A per-side set needs no mark here: the number logged is the total, the same as every
  // other set in the app.
  const reps = s.r || 0
  if (isBw({ ...c, id: c.id ?? id })) {
    const load = s.w > 0 ? `+${fmtNum(s.w)} × ` : ''
    return `${load}${reps}` + effortTail(s)
  }
  return `${fmtNum(s.w || 0)}×${reps}` + effortTail(s)
}
// Rest between sets, resolved in order of specificity: a value typed on the set that was just
// finished wins over the exercise's own default, which wins over the profile-wide default in
// S.restSec. Any level left unset (0/undefined — the routine builder never writes a 0) falls
// through to the next, so a plan written before per-exercise rest existed keeps behaving exactly
// as before: every set rests for S.restSec.
export function restSecFor(S, cfg, set) {
  if (set && set.restSec > 0) return set.restSec
  if (cfg && cfg.restSec > 0) return cfg.restSec
  return S.restSec
}
// Default config for a freshly added exercise.
export function defaultConfig(id, mode) {
  const m = mode || modeOf({ id })
  if (m === 'cardio') return { sets: 1, min: 20, speed: 8 }
  // Written only when it is true, so a barbell config is byte-for-byte what it was before
  // the flag existed and a plan file gains nothing it does not need.
  const bw = isBodyweightEq(id) ? { bodyweight: true } : {}
  if (m === 'time') return { sets: 3, sec: 45, weight: 0, mode: 'time', ...bw }
  return { sets: 3, reps: 10, weight: 0, mode: 'reps', ...bw }
}
// One-line summary of a planned exercise ("3 × 10 · 60 kg"), shared by the routine editor
// and the plan export so a mode is described the same way everywhere.
export function exLine(cfg, unit) {
  const mode = modeOf(cfg)
  const n = cfg.sets || 1
  // Added weight reads as added: "+10 kg" on a dip belt, "60 kg" on a barbell.
  const load = cfg.weight ? ' · ' + (isBw(cfg) ? '+' : '') + fmtNum(cfg.weight) + ' ' + unit : ''
  if (mode === 'cardio') return `${n} × ${cfg.min || 20} min @ ${fmtNum(cfg.speed || 8)} km/h`
  if (mode === 'time') return `${n} × ${fmtSec(cfg.sec || 45)}${load}`
  // This is the line with room for it, so the split is spelled out: "3 × 16 · 8/side".
  const split = isPerSide(cfg) && !toFailure(cfg) ? ' · ' + t('{0}/side', fmtNum(sideReps(cfg.reps))) : ''
  const types = cfg.layout && cfg.layout.some(Boolean) ? ' · ' + layoutBadges(fitLayout(cfg.layout, n)).join(' ') : ''
  return `${n} × ${repsText(cfg.reps)}${load}${split}${types}`
}

// Drop superset ids that no longer have an adjacent partner (after unlink/reorder/remove).
export function cleanupSg(ex) {
  ex.forEach((e, i) => {
    if (e.sg && !(ex[i - 1]?.sg === e.sg || ex[i + 1]?.sg === e.sg)) delete e.sg
  })
}

export function lastEntryFor(S, exId) {
  for (let i = S.workouts.length - 1; i >= 0; i--) {
    const en = S.workouts[i].entries.find(e => e.id === exId)
    // `target` is what the session prescribed; finished workouts carry it so labels and the
    // progression engine can read a session back the way it was logged. Older workouts have
    // none — modeOf() falls back to the body part for them, which is what they were.
    if (en && en.sets.some(s => s.done)) return { d: S.workouts[i].d, sets: en.sets.filter(s => s.done), target: en.target || null }
  }
  return null
}
export function bestWeightFor(S, exId) {
  let best = 0
  S.workouts.forEach(w => w.entries.forEach(e => {
    if (e.id === exId) {
      e.sets.forEach(s => { if (s.done && s.w > best) best = s.w })
      if (e.topW && e.topW > best) best = e.topW
    }
  }))
  return best
}
export function effectiveRoutineId(S, iso) {
  const ov = S.dayPlan[iso]
  if (ov === 'rest') return null
  if (ov && S.routines.some(r => r.id === ov)) return ov
  const wd = new Date(iso + 'T12:00:00').getDay()
  return weekFor(S, iso)[wd] || null
}
export function effectiveRoutine(S, iso) {
  const id = effectiveRoutineId(S, iso)
  return id ? S.routines.find(r => r.id === id) || null : null
}
export function buildSets(S, cfg) {
  const last = lastEntryFor(S, cfg.id)
  const n = Math.max(1, cfg.sets || 1)
  const mode = modeOf(cfg)
  const sets = []
  // Last time's set at the same position, falling back to its final set when the plan grew.
  const prevAt = i => (last ? (last.sets[i] || last.sets[last.sets.length - 1]) : null)

  if (mode === 'cardio') {
    for (let i = 0; i < n; i++) {
      const prev = prevAt(i)
      sets.push({ min: prev ? prev.min : (cfg.min || 20), speed: prev ? prev.speed : (cfg.speed || 8), done: false })
    }
    return sets
  }
  if (mode === 'time') {
    for (let i = 0; i < n; i++) {
      // Only carry a previous value over when it came from a timed set — switching an
      // exercise from reps to time must not seed the duration from a rep count.
      const prev = prevAt(i)
      const carried = prev && prev.sec > 0 ? prev : null
      sets.push({ sec: carried ? carried.sec : (cfg.sec || 45), w: carried ? (carried.w || 0) : (cfg.weight || 0), done: false })
    }
    return sets
  }
  // Last time's layout is kept when it used set types — the warm-up, the drop set at the end,
  // the left/right pairs — so a structure you built once comes back by itself. Plain sets are
  // topped up to the plan's count, never trimmed.
  // A layout planned in the routine wins: that is the structure you asked for.
  const planned = cfg.layout && cfg.layout.some(Boolean) ? cfg.layout : null
  const layout = planned ? fitLayout(planned, n)
    : fitLayout(last && last.sets.some(s => s.k) ? last.sets.map(s => s.k || '') : [], n, false)
  const conf = S.exWeights[cfg.id]
  const seen = {}
  layout.forEach(k => {
    // The same set last time: the n-th set of this type (the 2nd drop set ↔ the 2nd drop set),
    // else — a set the plan added — last time's final working set.
    const j = seen[k] = (seen[k] || 0) + 1
    const same = last ? last.sets.filter(x => (x.k || '') === k)[j - 1] : null
    const prev = same || (last ? [...last.sets].reverse().find(isWorking) : null)
    const usable = prev && prev.r > 0 ? prev : null
    // Weight: what you actually lifted at this position last time — a lighter last set stays
    // lighter instead of everything jumping to your all-time best. Reps: the routine's target
    // (that is the number to reach); a set to failure or a warm-up/drop set has none, so
    // last time's count is the starting point there.
    let w = usable ? usable.w : (conf && conf.w > 0 ? conf.w : cfg.weight)
    // A warm-up or drop set never done before starts from a share of the working weight
    // (half, and 70 %), rounded to a loadable 2.5, rather than at the full working load.
    if (!same && (k === 'w' || k === 'd') && w > 0) w = Math.max(0, Math.round(w * (k === 'w' ? 0.5 : 0.7) / 2.5) * 2.5)
    const ownTarget = !k || k === 'l' || k === 'r'
    const r = ownTarget && cfg.reps > 0 ? cfg.reps : (usable ? usable.r : cfg.reps)
    sets.push({ w, r, done: false, ...(k ? { k } : {}) })
  })
  return sets
}
export function workoutVolume(w) {
  let v = 0
  // No special case for unilateral work: a per-side set logs its total, so both sides are
  // already in the rep count that arrives here.
  w.entries.forEach(e => e.sets.forEach(s => { if (s.done) v += (s.w || 0) * (s.r || 0) }))
  return v
}
export function setsDone(w) {
  let n = 0
  w.entries.forEach(e => e.sets.forEach(s => { if (s.done) n++ }))
  return n
}
export function setsDoneActive(A) {
  let n = 0
  if (A) A.entries.forEach(e => e.sets.forEach(s => { if (s.done) n++ }))
  return n
}
export const lastBW = S => (S.bodyweight.length ? S.bodyweight[S.bodyweight.length - 1] : null)

// Group consecutive items sharing a superset id (sg) into "units" of indices.
// items may be routine exercises ({sg}) or active-workout entries ({sg}).
export function supersetUnits(items) {
  const units = []
  items.forEach((e, i) => {
    const prev = items[i - 1]
    if (i > 0 && e.sg && prev && prev.sg && e.sg === prev.sg) units[units.length - 1].push(i)
    else units.push([i])
  })
  return units
}
export function unitOf(units, idx) { return units.find(u => u.includes(idx)) || [idx] }

export function streakWeeks(S) {
  if (!S.workouts.length) return 0
  const weeks = new Set(S.workouts.map(w => weekKey(w.d)))
  let streak = 0
  const cur = new Date()
  for (let i = 0; i < 520; i++) {
    const wk = weekKey(isoOf(cur))
    if (weeks.has(wk)) streak++
    else if (i > 0) break
    cur.setDate(cur.getDate() - 7)
  }
  return streak
}
