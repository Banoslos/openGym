import { describe, it, expect } from 'vitest'
import { EXDB, queryWords, matchesQuery, byNameHit } from './exercises.js'

const find = q => { const w = queryWords(q); return byNameHit(EXDB.filter(e => matchesQuery(e, w)), w).map(e => e.n) }

describe('exercise search', () => {
  it('matches words in any order with words in between', () => {
    const r = find('bench dumbell')
    expect(r.length).toBeGreaterThan(0)
    expect(r).toContain('dumbbell incline bench press')
  })
  it('ignores hyphens, spacing and plurals', () => {
    expect(find('diamond push up')).toContain('diamond push-up')
    expect(find('diamond pushups')).toContain('diamond push-up')
  })
  it('an empty query matches everything', () => {
    expect(find('  ').length).toBe(EXDB.length)
  })
})
