import { describe, it, expect } from 'vitest'
import { EXIDX } from './exercises.js'
import { generateRoutine, swapExercise, groupOf, PRESETS, EQUIPMENT, EQUIPMENT_KEYS } from './generator.js'

const S = { restSec: 90 }

describe('generateRoutine', () => {
  it('resolves every staple to a real exercise', () => {
    for (const p of Object.values(PRESETS)) {
      const { ex } = generateRoutine({ groups: p, minutes: 120 }, S)
      for (const c of ex) expect(EXIDX[c.id], c.id).toBeTruthy()
    }
  })

  it('fits more exercises into more time', () => {
    const short = generateRoutine({ groups: PRESETS.push, minutes: 30 }, S).ex.length
    const long = generateRoutine({ groups: PRESETS.push, minutes: 90 }, S).ex.length
    expect(short).toBeGreaterThanOrEqual(2)
    expect(long).toBeGreaterThan(short)
  })

  it('stays close to the time budget', () => {
    const r = generateRoutine({ groups: PRESETS.full, minutes: 60 }, S)
    expect(r.minutes).toBeLessThanOrEqual(60)
    expect(r.minutes).toBeGreaterThan(40)
  })

  it('opens with a compound and never repeats an exercise', () => {
    const { ex } = generateRoutine({ groups: ['chest'], minutes: 60 }, S)
    expect(['0025', '0289', '0047']).toContain(ex[0].id)
    expect(new Set(ex.map(c => c.id)).size).toBe(ex.length)
  })

  it('respects equipment', () => {
    const { ex } = generateRoutine({ groups: PRESETS.upper, minutes: 60, equipment: ['bodyweight'] }, S)
    expect(ex.length).toBeGreaterThan(0)
    for (const c of ex) expect(EQUIPMENT.bodyweight).toContain(EXIDX[c.id].eq)
    for (const c of ex) expect(!!c.bodyweight).toBe(EXIDX[c.id].eq === 'body weight')
  })

  it('puts liked exercises in and keeps avoided ones out', () => {
    const { ex } = generateRoutine({ groups: ['chest'], minutes: 45, like: ['0308'], avoid: ['0025'] }, S)
    const ids = ex.map(c => c.id)
    expect(ids).toContain('0308')
    expect(ids).not.toContain('0025')
  })

  it('ignores liked exercises from groups that were not asked for', () => {
    const { ex } = generateRoutine({ groups: ['chest'], minutes: 45, like: ['0031'] }, S)
    expect(ex.map(c => c.id)).not.toContain('0031')
  })

  it('same seed, same routine', () => {
    const a = generateRoutine({ groups: PRESETS.legs, minutes: 60, seed: 7 }, S)
    const b = generateRoutine({ groups: PRESETS.legs, minutes: 60, seed: 7 }, S)
    expect(a).toEqual(b)
  })

  it('omits restSec when it matches the app default', () => {
    const { ex } = generateRoutine({ groups: ['chest'], minutes: 45, goal: 'hypertrophy' }, S)
    expect(ex[0].restSec).toBeUndefined()
    expect(ex[ex.length - 1].restSec).toBe(60)
  })
})

describe('swapExercise', () => {
  it('walks the list instead of bouncing back', () => {
    const opts = { groups: ['chest'], minutes: 30, equipment: EQUIPMENT_KEYS }
    let { ex } = generateRoutine(opts, S)
    const seen = [ex[0].id]
    for (let k = 0; k < 3; k++) {
      ex = swapExercise(ex, 0, opts, S, seen)
      expect(seen).not.toContain(ex[0].id)
      expect(groupOf(ex[0].id)).toBe('chest')
      seen.push(ex[0].id)
    }
  })
})
