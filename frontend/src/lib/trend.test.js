import { describe, it, expect } from 'vitest'
import { epley, metricOf, scoreOf, exerciseTrend } from './trend.js'
import { EXDB } from './exercises.js'

const LIFT = EXDB.find(e => e.bp === 'chest' && e.eq === 'barbell').id
const set = (w, r, done = true) => ({ w, r, done })
const wk = (id, d, entries) => ({ id, d, start: new Date(d + 'T10:00:00').getTime(), entries })
const S = ws => ({ workouts: ws })

describe('trend', () => {
  it('scores a loaded session by the best estimated 1RM', () => {
    const e = { id: LIFT, sets: [set(60, 10), set(70, 5), set(80, 1, false)] }
    expect(metricOf(e)).toBe('e1rm')
    // 60×10 → 80, 70×5 → 81.7; the unchecked 80×1 does not count
    expect(scoreOf(e, 'e1rm')).toBeCloseTo(81.7, 1)
    expect(epley(100, 1)).toBeCloseTo(103.3, 1)
  })
  it('scores unloaded and timed work in reps and seconds', () => {
    expect(metricOf({ id: LIFT, sets: [set(0, 12)] })).toBe('reps')
    expect(scoreOf({ sets: [set(0, 12), set(0, 15), set(0, 20, false)] }, 'reps')).toBe(15)
    const hold = { id: LIFT, target: { mode: 'time', sec: 45 }, sets: [{ sec: 50, done: true }, { sec: 40, done: true }] }
    expect(metricOf(hold)).toBe('sec')
    expect(scoreOf(hold, 'sec')).toBe(50)
  })
  it('compares the last session with the average of the three before it', () => {
    const ws = [60, 60, 62.5, 62.5, 65].map((w, i) => wk('w' + i, '2026-09-0' + (i + 1), [{ id: LIFT, sets: [set(w, 5)] }]))
    const tr = exerciseTrend(S(ws), LIFT, 'w4')
    expect(tr.points.map(p => p.id)).toEqual(['w0', 'w1', 'w2', 'w3', 'w4'])
    expect(tr.verdict).toBe('up')
    expect(tr.delta).toBeCloseTo(65 / ((60 + 62.5 + 62.5) / 3) - 1, 3)
  })
  it('stops at the workout being viewed and reports a decline', () => {
    const ws = [70, 70, 60, 80].map((w, i) => wk('w' + i, '2026-09-0' + (i + 1), [{ id: LIFT, sets: [set(w, 5)] }]))
    const tr = exerciseTrend(S(ws), LIFT, 'w2')
    expect(tr.points).toHaveLength(3)
    expect(tr.verdict).toBe('down')
  })
  it('calls a tiny change steady and a first session first', () => {
    const ws = [100, 100.5].map((w, i) => wk('w' + i, '2026-09-0' + (i + 1), [{ id: LIFT, sets: [set(w, 5)] }]))
    expect(exerciseTrend(S(ws), LIFT, 'w1').verdict).toBe('steady')
    expect(exerciseTrend(S(ws), LIFT, 'w0').verdict).toBe('first')
  })
  it('skips sessions logged on another scale', () => {
    const ws = [
      wk('a', '2026-09-01', [{ id: LIFT, sets: [set(0, 20)] }]),
      wk('b', '2026-09-02', [{ id: LIFT, sets: [set(40, 8)] }]),
      wk('c', '2026-09-03', [{ id: LIFT, sets: [set(42.5, 8)] }])
    ]
    const tr = exerciseTrend(S(ws), LIFT, 'c')
    expect(tr.metric).toBe('e1rm')
    expect(tr.points.map(p => p.id)).toEqual(['b', 'c'])
  })
})
