// Per-exercise performance across sessions — the chart and "improving / declining" verdict in a
// workout's detail sheet.
//
// One number per session, chosen by how the exercise is logged, so sessions compare fairly
// even when the weight, reps and set count all moved at once:
//   · weighted reps → estimated 1RM of the best set (Epley: w · (1 + r/30)). It folds weight
//     and reps into one figure: 60×10 and 70×5 are close to the same effort, which neither
//     "heaviest weight" nor raw volume can tell you. Unlike the 1RM records (onerm.js) the rep
//     count is not refused past 12 — here only the direction matters, not the absolute value.
//   · bodyweight reps → most reps in one set
//   · timed holds     → longest hold in seconds
// Cardio has no single "better" direction worth charting and is left out.
import { modeOf } from './history.js'

// Reps beyond this add nothing to the estimate — a set of 50 is endurance, not strength.
const EPLEY_CAP = 30
// Change inside ±this fraction counts as holding steady rather than a trend.
export const STEADY = 0.01
// How many earlier sessions the latest one is compared against.
export const BASELINE = 3

export const epley = (w, r) => w * (1 + Math.min(r, EPLEY_CAP) / 30)
const round1 = v => Math.round(v * 10) / 10

// 'e1rm' | 'reps' | 'sec' | null for one logged entry.
export function metricOf(entry) {
  const cfg = { ...(entry.target || {}), id: entry.id }
  const mode = modeOf(cfg)
  if (mode === 'cardio') return null
  if (mode === 'time') return 'sec'
  const loaded = (entry.sets || []).some(s => s.done && s.w > 0)
  // No load on any set: bodyweight work, or a lift logged without a weight — reps is all there is.
  return loaded ? 'e1rm' : 'reps'
}

// The session's score under `metric`, or null when nothing counted towards it.
export function scoreOf(entry, metric) {
  const done = (entry.sets || []).filter(s => s.done)
  let best = null
  done.forEach(s => {
    let v = null
    if (metric === 'e1rm' && s.w > 0 && s.r > 0) v = epley(s.w, s.r)
    else if (metric === 'reps' && s.r > 0) v = s.r
    else if (metric === 'sec' && s.sec > 0) v = s.sec
    if (v != null && (best == null || v > best)) best = v
  })
  return best == null ? null : round1(best)
}

/**
 * History of one exercise up to and including workout `upto` (a workout id), oldest first,
 * scored with the metric of that workout's entry. `limit` keeps the chart readable.
 * Returns { metric, points: [{ t, d, y, id }], delta, verdict } — delta is the change of the
 * last point against the average of up to BASELINE points before it (a fraction, e.g. 0.04),
 * verdict one of 'up' | 'down' | 'steady' | 'first'.
 */
export function exerciseTrend(S, exId, upto, limit = 10) {
  const ws = S.workouts || []
  const end = upto ? ws.findIndex(w => w.id === upto) : ws.length - 1
  if (end < 0) return { metric: null, points: [], delta: 0, verdict: 'first' }
  const own = ws[end].entries.find(e => e.id === exId)
  const metric = own ? metricOf(own) : null
  if (!metric) return { metric: null, points: [], delta: 0, verdict: 'first' }
  const points = []
  for (let i = 0; i <= end; i++) {
    const w = ws[i]
    const e = w.entries.find(x => x.id === exId)
    // A session logged another way (loaded vs bodyweight, reps vs time) is a different number
    // on a different scale — it would read as a crash or a leap that never happened.
    if (!e || metricOf(e) !== metric) continue
    const y = scoreOf(e, metric)
    if (y != null) points.push({ t: w.start || new Date(w.d + 'T12:00:00').getTime(), d: w.d, y, id: w.id })
  }
  const shown = points.slice(-limit)
  const last = shown[shown.length - 1]
  if (!last || last.id !== ws[end].id || points.length < 2) return { metric, points: shown, delta: 0, verdict: 'first' }
  const before = points.slice(0, -1).slice(-BASELINE)
  const base = before.reduce((a, p) => a + p.y, 0) / before.length
  const delta = base > 0 ? (last.y - base) / base : 0
  const verdict = delta > STEADY ? 'up' : delta < -STEADY ? 'down' : 'steady'
  return { metric, points: shown, delta, verdict }
}
