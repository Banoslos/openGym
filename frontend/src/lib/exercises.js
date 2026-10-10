import { EXDB } from './exercises-data.js'
import { t } from './i18n.js'

export { EXDB }
export const EXIDX = {}
EXDB.forEach(e => { EXIDX[e.id] = e })
export const BODYPARTS = [...new Set(EXDB.map(e => e.bp))].sort()

// Equipment options present in a given list of exercises, most common first (issue #6).
// Deriving them from the *already filtered* list keeps the chip row short and means
// every body-part × equipment combination on screen has results behind it.
export function equipmentOf(list) {
  const c = {}
  list.forEach(e => { if (e.eq) c[e.eq] = (c[e.eq] || 0) + 1 })
  return Object.keys(c).sort((a, b) => c[b] - c[a] || (a < b ? -1 : 1))
}

// Custom (user-created) exercises live in synced state S.customEx (issue #11) and are
// merged into the id index here so every EXIDX[id] lookup keeps working unchanged.
let customIds = []
export function registerCustom(list) {
  customIds.forEach(id => delete EXIDX[id])
  customIds = (list || []).map(e => e.id)
  ;(list || []).forEach(e => { EXIDX[e.id] = e })
}
// Full searchable catalogue — customs first so your own exercises are easy to find.
export const allExercises = st => [...(st.customEx || []), ...EXDB]

// Search by keywords in any order: "dumbell bench" finds "dumbbell incline bench press".
// Every word has to appear somewhere — name, target, equipment, body part (also in the UI
// language) or description — but in any position and with anything in between. Text is
// folded first so the usual spelling noise doesn't matter: case, hyphens ("push up" =
// "push-up" = "pushup"), doubled letters ("dumbell" = "dumbbell") and a plural "s".
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').replace(/(.)\1+/g, '$1').trim()
export function queryWords(q) {
  return fold(q).split(' ').filter(Boolean).map(w => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
}
export function matchesQuery(e, words) {
  if (!words.length) return true
  const hay = fold([e.n, e.tg, e.eq, e.bp, t(e.tg || ''), t(e.eq || ''), t(e.bp || ''), e.desc].join(' '))
  const glued = hay.replace(/ /g, '')
  return words.every(w => hay.includes(w) || glued.includes(w))
}
// Exercises whose *name* holds every word come first — "bench" should list bench presses
// before a row whose description happens to mention a bench. Stable, so order is otherwise kept.
export function byNameHit(list, words) {
  if (!words.length) return list
  const inName = e => { const n = fold(e.n), g = n.replace(/ /g, ''); return words.every(w => n.includes(w) || g.includes(w)) }
  return [...list.filter(inName), ...list.filter(e => !inName(e))]
}

// Media normally sits next to the app (img/ and gif/, mounted into the web container).
// A build can point them somewhere else — the demo build pulls them off a CDN instead of
// shipping ~140 MB of images into the deployment.
const IMG_BASE = import.meta.env.VITE_IMG_BASE || 'img/'
const GIF_BASE = import.meta.env.VITE_GIF_BASE || 'gif/'
export const imgSrc = ex => IMG_BASE + ex.img
export const gifSrc = ex => GIF_BASE + ex.gif

// Cardio exercises log time + speed instead of weight × reps.
export const isCardio = idOrEx => (typeof idOrEx === 'string' ? EXIDX[idOrEx] : idOrEx)?.bp === 'cardio'

// Exercises the dataset already knows carry no external load (issue #32) — a quarter of the
// catalogue. This seeds the `bw` flag on a fresh config so a push-up never asks for a weight
// nobody was going to enter. It is only the default: the flag lives on the config, so a dip
// done with a belt can turn it off and a custom exercise can turn it on.
export const isBodyweightEq = idOrEx =>
  (typeof idOrEx === 'string' ? EXIDX[idOrEx] : idOrEx)?.eq === 'body weight'

// An id that resolves to nothing — a plan file built against a different exercise dataset,
// a custom exercise deleted on another device before the sync arrived — still has to
// render. A placeholder keeps it visible (and removable) instead of taking the whole view
// down on the first `ex.n`.
export const exOr = id => EXIDX[id] ||
  { id, n: t('Unknown exercise'), bp: '', tg: '', eq: '', sm: [], st: [], missing: true }
