import { describe, it, expect } from 'vitest'
import { mondayOf, weeksBetween, programFor, weekFor, syncWeek, unschedule, rotationInfo } from './programs.js'

const A = { id: 'a', name: 'A', week: { 1: 'push' } }
const B = { id: 'b', name: 'B', week: { 2: 'pull' } }
const C = { id: 'c', name: 'C', week: { 3: 'legs' } }
const base = extra => ({ week: { 5: 'old' }, programs: [A, B, C], program: 'a', programFrom: '2026-09-21', rotate: 0, ...extra })

describe('programs', () => {
  it('finds the Monday of a week', () => {
    expect(mondayOf('2026-09-24')).toBe('2026-09-21') // Thursday
    expect(mondayOf('2026-09-27')).toBe('2026-09-21') // Sunday belongs to the week before
    expect(mondayOf('2026-09-21')).toBe('2026-09-21')
  })
  it('counts weeks across a DST change', () => {
    expect(weeksBetween('2026-10-19', '2026-10-26')).toBe(1)
    expect(weeksBetween('2026-10-26', '2026-10-19')).toBe(-1)
  })
  it('falls back to S.week with no programs', () => {
    expect(programFor({ week: { 1: 'x' } }, '2026-09-24')).toBe(null)
    expect(weekFor({ week: { 1: 'x' } }, '2026-09-24')).toEqual({ 1: 'x' })
  })
  it('stays on the active program without rotation', () => {
    expect(programFor(base(), '2026-12-01').id).toBe('a')
    expect(programFor(base({ program: 'b' }), '2026-12-01').id).toBe('b')
  })
  it('rotates every N weeks, including before the anchor', () => {
    const S = base({ rotate: 1 })
    expect(['2026-09-24', '2026-09-28', '2026-10-05', '2026-10-12', '2026-09-14'].map(d => programFor(S, d).id)).toEqual(['a', 'b', 'c', 'a', 'c'])
    const S2 = base({ rotate: 2, program: 'b' })
    expect(['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-19', '2026-11-02'].map(d => programFor(S2, d).id)).toEqual(['b', 'b', 'c', 'a', 'b'])
  })
  it('mirrors the current program into S.week', () => {
    const S = syncWeek(base())
    expect(S.week).toEqual(A.week)
    expect(S.week).not.toBe(A.week)
  })
  it('unschedules a routine from every program', () => {
    const S = { week: { 1: 'push' }, programs: [{ week: { 1: 'push', 2: 'x' } }, { week: { 4: 'push' } }] }
    unschedule(S, 'push')
    expect(S.week).toEqual({})
    expect(S.programs.map(p => p.week)).toEqual([{ 2: 'x' }, {}])
  })
  it('says which program comes next and when', () => {
    const r = rotationInfo(base({ rotate: 2 }), '2026-09-24')
    expect([r.cur.id, r.next.id, r.inWeeks]).toEqual(['a', 'b', 2])
    expect(rotationInfo(base({ rotate: 2 }), '2026-09-30').inWeeks).toBe(1)
    expect(rotationInfo(base(), '2026-09-24').next).toBe(null)
  })
})
