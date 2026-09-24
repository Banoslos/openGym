// Routine generator: muscles + time + equipment + likes/dislikes in, a normal routine out.
//
// The dataset is 1,300 exercises, most of them variations nobody programs ("dumbbell
// incline breeding", "pectoralis stretch with stability ball"), so picking from it blindly
// produces nonsense. Each group therefore has a curated list of staples in priority order,
// tagged compound (c) or isolation (i); the raw dataset is only a fallback when the chosen
// equipment rules every staple out. Pure and seeded, so it is testable and "regenerate"
// gives a different but equally sane session.
import { EXIDX, EXDB, isBodyweightEq } from './exercises.js'

export const GROUPS = {
  chest:      { w: 3,   tg: ['pectorals'] },
  back:       { w: 3,   tg: ['lats', 'upper back', 'traps'] },
  shoulders:  { w: 2,   tg: ['delts'] },
  biceps:     { w: 1.5, tg: ['biceps'] },
  triceps:    { w: 1.5, tg: ['triceps'] },
  quads:      { w: 3,   tg: ['quads'] },
  hamstrings: { w: 2,   tg: ['hamstrings'] },
  glutes:     { w: 2,   tg: ['glutes'] },
  calves:     { w: 1,   tg: ['calves'] },
  abs:        { w: 1,   tg: ['abs'] },
}
export const GROUP_KEYS = Object.keys(GROUPS)

export const PRESETS = {
  push:  ['chest', 'shoulders', 'triceps'],
  pull:  ['back', 'biceps'],
  legs:  ['quads', 'hamstrings', 'glutes', 'calves'],
  upper: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
  full:  ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'abs'],
}

// [id, compound|isolation, movement family]. Families are global, so one session never
// gets a front squat *and* a back squat, or a barbell lunge on legs plus a reverse lunge on
// glutes.
const STAPLES = {
  chest: [['0025', 'c', 'flat'], ['0289', 'c', 'flat'], ['0047', 'c', 'incline'], ['0314', 'c', 'incline'], ['0577', 'c', 'flat'],
    ['0757', 'c', 'incline'], ['0251', 'c', 'dip'], ['0662', 'c', 'pushup'],
    ['0308', 'i', 'fly'], ['0596', 'i', 'fly'], ['0227', 'i', 'fly'], ['0319', 'i', 'fly2'], ['0179', 'i', 'fly2']],
  back: [['0652', 'c', 'vpull'], ['2330', 'c', 'pulldown'], ['0027', 'c', 'row'], ['0293', 'c', 'row'], ['0861', 'c', 'crow'],
    ['1326', 'c', 'vpull'], ['0606', 'c', 'row'], ['1350', 'c', 'crow'], ['0499', 'c', 'crow'],
    ['0238', 'i', 'pullover'], ['0375', 'i', 'pullover'], ['0406', 'i', 'shrug'], ['0095', 'i', 'shrug']],
  shoulders: [['0405', 'c', 'ohp'], ['0091', 'c', 'ohp'], ['2137', 'c', 'ohp'], ['0603', 'c', 'ohp'], ['0426', 'c', 'ohp'], ['0766', 'c', 'ohp'],
    ['0334', 'i', 'lateral'], ['0178', 'i', 'lateral'], ['0602', 'i', 'rear'], ['0378', 'i', 'rear'], ['0584', 'i', 'lateral'], ['0310', 'i', 'front']],
  biceps: [['0031', 'i', 'curl'], ['0294', 'i', 'curl'], ['0313', 'i', 'hammer'], ['0447', 'i', 'curl'], ['0318', 'i', 'inclcurl'],
    ['0868', 'i', 'curl'], ['0372', 'i', 'preacher'], ['0592', 'i', 'preacher'], ['0297', 'i', 'conc']],
  triceps: [['0030', 'c', 'cgbp'], ['0814', 'c', 'dip'], ['0283', 'c', 'pushup'],
    ['0241', 'i', 'pushdown'], ['0201', 'i', 'pushdown'], ['0060', 'i', 'skull'], ['1722', 'i', 'ohext'], ['0430', 'i', 'ohext'],
    ['0607', 'i', 'skull'], ['0333', 'i', 'kick']],
  quads: [['0043', 'c', 'squat'], ['0739', 'c', 'legpress'], ['0042', 'c', 'squat'], ['0743', 'c', 'legpress'], ['1760', 'c', 'goblet'],
    ['0770', 'c', 'squat'], ['0336', 'c', 'lunge'], ['1460', 'c', 'lunge'], ['0534', 'c', 'goblet'], ['2368', 'c', 'lunge'],
    ['0585', 'i', 'legext'], ['1489', 'i', 'sissy']],
  hamstrings: [['0085', 'c', 'hinge'], ['1459', 'c', 'hinge'], ['0032', 'c', 'hinge'], ['0044', 'c', 'hinge'], ['3193', 'c', 'ghr'],
    ['0586', 'i', 'legcurl'], ['0599', 'i', 'legcurl'], ['0496', 'i', 'legcurl']],
  glutes: [['1409', 'c', 'bridge'], ['0078', 'c', 'lunge'], ['0381', 'c', 'lunge'], ['0117', 'c', 'hinge'], ['0549', 'c', 'swing'],
    ['0228', 'i', 'hipext'], ['0593', 'i', 'hipext'], ['3013', 'i', 'bridge']],
  calves: [['0605', 'i', 'calfst'], ['0594', 'i', 'calfse'], ['2289', 'i', 'calfst'], ['0417', 'i', 'calfst'], ['1372', 'i', 'calfst'], ['1373', 'i', 'calfst']],
  abs: [['0472', 'i', 'hang'], ['0212', 'i', 'crunch'], ['0872', 'i', 'revcrunch'], ['1452', 'i', 'crunch'], ['0620', 'i', 'hang'],
    ['0276', 'i', 'core'], ['0274', 'i', 'crunch']],
}
const TYPE = {}, FAM = {}
for (const g in STAPLES) for (const [id, k, f] of STAPLES[g]) { TYPE[id] = k; FAM[id] = f }
const famOf = id => FAM[id] || id

export const EQUIPMENT = {
  barbell:  ['barbell', 'ez barbell', 'olympic barbell', 'trap bar'],
  dumbbell: ['dumbbell'],
  machine:  ['leverage machine', 'smith machine', 'sled machine'],
  cable:    ['cable'],
  kettlebell: ['kettlebell'],
  bodyweight: ['body weight', 'weighted', 'assisted'],
}
export const EQUIPMENT_KEYS = Object.keys(EQUIPMENT)

export const GOALS = {
  strength:    { sets: 4, reps: 5,  repsIso: 8,  rest: 150 },
  hypertrophy: { sets: 3, reps: 8,  repsIso: 12, rest: 90 },
  endurance:   { sets: 3, reps: 15, repsIso: 15, rest: 45 },
}

const WORK_SEC = 40
const CHANGEOVER_SEC = 90
const WARMUP_SEC = 300
const JUNK = /stretch|assisted|variation|kneeling|exercise ball|stability|bosu|roller|\bband\b|\bpov\b|\(male\)|\(female\)|arm blaster|one arm|one leg|single/i

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function groupOf(id) {
  for (const g in STAPLES) if (STAPLES[g].some(([x]) => x === id)) return g
  const tg = EXIDX[id]?.tg
  return GROUP_KEYS.find(g => GROUPS[g].tg.includes(tg)) || null
}
const typeOf = id => TYPE[id] || 'i'

export function prescriptionFor(id, goal, S) {
  const G = GOALS[goal] || GOALS.hypertrophy
  const iso = typeOf(id) === 'i'
  const g = groupOf(id)
  const reps = g === 'abs' || g === 'calves' ? Math.max(G.repsIso, 12) : iso ? G.repsIso : G.reps
  const restSec = Math.round((iso ? Math.max(45, G.rest * 0.66) : G.rest) / 5) * 5
  return { id, sets: G.sets, reps, weight: 0, mode: 'reps', ...(isBodyweightEq(id) ? { bodyweight: true } : {}), ...(restSec !== S?.restSec ? { restSec } : {}) }
}

export function exerciseSeconds(cfg, S) {
  const rest = cfg.restSec || S?.restSec || 90
  return cfg.sets * WORK_SEC + (cfg.sets - 1) * rest + CHANGEOVER_SEC
}
export function estimateMinutes(list, S) {
  return Math.round((WARMUP_SEC + list.reduce((n, c) => n + exerciseSeconds(c, S), 0)) / 60)
}

// Candidates for one slot, best first. Liked exercises jump the queue; avoided ones and
// anything the chosen equipment can't do never appear.
export function candidates(group, type, { equipment, avoid = [], like = [], used = [], fams = [] }) {
  const eqOk = id => { const e = EXIDX[id]; return !!e && equipment.includes(e.eq) }
  const free = id => eqOk(id) && !avoid.includes(id) && !used.includes(id) && !fams.includes(famOf(id))
  const liked = like.filter(id => eqOk(id) && !avoid.includes(id) && !used.includes(id) && groupOf(id) === group)
  const staples = STAPLES[group].map(([id]) => id).filter(id => free(id) && !liked.includes(id))
  const typed = type ? staples.filter(id => TYPE[id] === type) : staples
  const rest = staples.filter(id => !typed.includes(id))
  const out = [...liked, ...typed, ...rest]
  if (out.length) return out
  return EXDB.filter(e => GROUPS[group].tg.includes(e.tg) && free(e.id) && !JUNK.test(e.n)).map(e => e.id)
}

// d'Hondt over group weights: a chest day gets more slots than its triceps finisher, and
// adding time adds exercises to the big groups first.
// Capped per group, so a long pull day doesn't fill up with a second and third shrug.
const capOf = g => (GROUPS[g].w >= 3 ? 4 : GROUPS[g].w >= 2 ? 3 : 2)
function allocate(groups) {
  const count = Object.fromEntries(groups.map(g => [g, 0]))
  const order = []
  for (;;) {
    const open = groups.filter(g => count[g] < capOf(g))
    if (!open.length) return order
    const g = open.reduce((b, x) => (GROUPS[x].w / (count[x] + 1) > GROUPS[b].w / (count[b] + 1) ? x : b))
    order.push([g, count[g]])
    count[g]++
  }
}

export function generateRoutine(opts, S) {
  const { groups, minutes = 60, goal = 'hypertrophy', equipment: eqKeys = EQUIPMENT_KEYS, like = [], avoid = [], seed = 1 } = opts
  const sel = groups.filter(g => GROUPS[g])
  if (!sel.length) return { ex: [], minutes: 0 }
  const equipment = eqKeys.flatMap(k => EQUIPMENT[k] || [])
  const rand = rng(seed)
  const budget = minutes * 60 - WARMUP_SEC
  const used = []
  const picked = []
  let spent = 0
  for (const [g, nth] of allocate(sel)) {
    // First pick per group is the big lift; the third group-weight worth of slots on a big
    // muscle is a second compound, everything after that isolates.
    const type = nth === 0 || (nth === 1 && GROUPS[g].w >= 3) ? 'c' : 'i'
    const list = candidates(g, type, { equipment, avoid, like, used, fams: used.map(famOf) })
    if (!list.length) continue
    const likedHead = list.findIndex(id => !like.includes(id))
    const top = likedHead === 0 ? list.slice(0, Math.min(3, list.length)) : [list[0]]
    const id = top[Math.floor(rand() * top.length)]
    const cfg = prescriptionFor(id, goal, S)
    const cost = exerciseSeconds(cfg, S)
    if (picked.length >= 2 && spent + cost > budget) break
    used.push(id)
    picked.push({ cfg, g, base: cfg.sets })
    spent += cost
  }
  // Every slot filled and time left over (a long session on a small group): spend it as one
  // extra set per exercise, compounds first, rather than inventing more exercises.
  for (let grew = true; grew;) {
    grew = false
    for (const p of [...picked].sort((a, b) => (typeOf(a.cfg.id) === 'c' ? 0 : 1) - (typeOf(b.cfg.id) === 'c' ? 0 : 1))) {
      if (p.cfg.sets > p.base) continue
      const extra = WORK_SEC + (p.cfg.restSec || S?.restSec || 90)
      if (spent + extra > budget) continue
      p.cfg.sets++
      spent += extra
      grew = true
    }
  }
  // Big compounds first while fresh, then isolation; abs and calves close the session.
  const rank = ({ cfg, g }) => (g === 'abs' || g === 'calves' ? 2 : typeOf(cfg.id) === 'c' ? 0 : 1) * 10 - GROUPS[g].w
  picked.sort((a, b) => rank(a) - rank(b))
  const ex = picked.map(p => p.cfg)
  return { ex, minutes: estimateMinutes(ex, S) }
}

// `skip` holds what this slot already showed, so repeated swaps walk the list instead of
// bouncing between the same two exercises.
export function swapExercise(ex, idx, opts, S, skip = []) {
  const cur = ex[idx]
  const g = groupOf(cur.id)
  if (!g) return ex
  const equipment = (opts.equipment || EQUIPMENT_KEYS).flatMap(k => EQUIPMENT[k] || [])
  const used = [...ex.map(c => c.id), ...skip]
  const fams = ex.filter((_, i) => i !== idx).map(c => famOf(c.id))
  const list = candidates(g, typeOf(cur.id), { equipment, avoid: opts.avoid || [], like: opts.like || [], used, fams })
  if (!list.length) return ex
  const next = [...ex]
  next[idx] = prescriptionFor(list[0], opts.goal, S)
  return next
}
