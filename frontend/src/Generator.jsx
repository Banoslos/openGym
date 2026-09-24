import { useState } from 'react'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { EXIDX } from './lib/exercises.js'
import { exLine } from './lib/history.js'
import { uid, exCount } from './lib/format.js'
import { t } from './lib/i18n.js'
import { nav } from './lib/nav.js'
import { generateRoutine, swapExercise, estimateMinutes, PRESETS, GROUP_KEYS, EQUIPMENT_KEYS } from './lib/generator.js'
import { exercisePicker, exerciseDetailSheet, startFlow } from './sheets.jsx'
import { Thumb } from './components/Media.jsx'
import Icon from './components/Icon.jsx'
import { Button, Slider, Segmented } from './components/ui.jsx'
import { DEFAULT_GLYPH } from './lib/glyphs.js'

const update = (...a) => useStore.getState().update(...a)
const ui = () => useUI.getState()
const toast = m => ui().toast(m)

const GOALS = [['strength', 'Strength'], ['hypertrophy', 'Muscle'], ['endurance', 'Endurance']]
const PRESET_LABELS = [['push', 'Push'], ['pull', 'Pull'], ['legs', 'Legs'], ['upper', 'Upper body'], ['full', 'Full body']]
const EQUIPMENT_LABELS = { barbell: 'barbell', dumbbell: 'dumbbell', machine: 'Machines', cable: 'cable', kettlebell: 'kettlebell', bodyweight: 'body weight' }
const DEFAULTS = { groups: PRESETS.push, minutes: 60, goal: 'hypertrophy', equipment: EQUIPMENT_KEYS, like: [], avoid: [] }
const LEGS = ['quads', 'hamstrings', 'glutes', 'calves']

const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x))
const exName = id => (EXIDX[id] || { n: t('Unknown exercise') }).n

function glyphFor(groups) {
  if (groups.filter(g => LEGS.includes(g)).length * 2 >= groups.length) return 'legs'
  if (groups.length === 1 && groups[0] === 'abs') return 'abs'
  if (groups.every(g => g === 'biceps' || g === 'triceps')) return 'arm'
  if (groups.includes('back') && !groups.includes('chest')) return 'pullup'
  return DEFAULT_GLYPH
}
function nameFor(groups) {
  const p = PRESET_LABELS.find(([k]) => sameSet(PRESETS[k], groups))
  if (p) return t(p[1])
  const names = groups.map(g => { const s = t(g); return s.charAt(0).toUpperCase() + s.slice(1) })
  return names.slice(0, 3).join(' · ') + (names.length > 3 ? ' +' : '')
}

function ExPrefList({ title, ids, onAdd, onRemove }) {
  return <>
    <h4 className="sec">{title}</h4>
    <div className="gen-chips">
      {ids.map(id => <button key={id} className="tag gen-tag" onClick={() => onRemove(id)} aria-label={t('Remove')}>
        <span className="capitalize">{exName(id)}</span><Icon name="xmark" /></button>)}
      <button className="tag acc" onClick={onAdd}><Icon name="plus" />{t('Add')}</button>
    </div>
  </>
}

function Generator({ close }) {
  const st = useStore(s => s.S)
  const [o, setO] = useState(() => ({ ...DEFAULTS, ...(st.genPrefs || {}) }))
  const [seed, setSeed] = useState(() => Date.now() % 100000)
  const [res, setRes] = useState(null)
  const [skips, setSkips] = useState({})
  const [name, setName] = useState('')
  const set = patch => setO(x => ({ ...x, ...patch }))
  const toggleIn = (key, v) => setO(x => ({ ...x, [key]: x[key].includes(v) ? x[key].filter(y => y !== v) : [...x[key], v] }))

  const run = nextSeed => {
    if (!o.groups.length) { toast(t('Pick at least one muscle group')); return }
    if (!o.equipment.length) { toast(t('Pick at least one kind of equipment')); return }
    const r = generateRoutine({ ...o, seed: nextSeed }, st)
    if (!r.ex.length) { toast(t('No exercises match — try more equipment')); return }
    update(s => { s.genPrefs = { ...o } })
    setSeed(nextSeed); setSkips({}); setRes(r)
    setName(nameFor(o.groups))
  }
  const swap = i => {
    const skip = [...(skips[i] || []), res.ex[i].id]
    const ex = swapExercise(res.ex, i, o, st, skip)
    if (ex[i].id === res.ex[i].id) { toast(t('No other option for this slot')); return }
    setSkips({ ...skips, [i]: skip })
    setRes({ ex, minutes: estimateMinutes(ex, st) })
  }
  const remove = i => {
    const ex = res.ex.filter((_, k) => k !== i)
    setSkips({})
    setRes({ ex, minutes: estimateMinutes(ex, st) })
  }
  // Liking an exercise un-avoids it and vice versa — it can't be both.
  const pick = key => {
    const other = key === 'like' ? 'avoid' : 'like'
    const h = exercisePicker(ex => {
      h.close()
      setO(x => ({ ...x, [key]: x[key].includes(ex.id) ? x[key] : [...x[key], ex.id], [other]: x[other].filter(y => y !== ex.id) }))
    })
  }
  const save = start => {
    const r = { id: uid(), name: name.trim() || nameFor(o.groups), emoji: glyphFor(o.groups), ex: res.ex.map(c => ({ ...c })) }
    update(s => { s.routines.push(r) })
    close()
    if (start) startFlow(r.id)
    else { toast(t('Routine saved')); nav('/plan/r/' + r.id) }
  }

  if (res) return <>
    <h3>{t('Your routine')}</h3>
    <div className="muted small">{t('About {0} min', res.minutes)} · {exCount(res.ex.length)}</div>
    <div style={{ height: 10 }} />
    <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder={t('Routine name')} />
    <div style={{ height: 10 }} />
    <div className="list">
      {res.ex.map((c, i) => {
        const ex = EXIDX[c.id]
        return <div key={c.id} className="item">
          {ex && <Thumb ex={ex} />}
          <div className="grow" onClick={() => ex && exerciseDetailSheet(ex)}>
            <div className="tt capitalize">{exName(c.id)}</div>
            <div className="ss">{exLine(c, st.unit)} · {t('Rest {0}s', c.restSec || st.restSec)}</div>
          </div>
          <button className="iconbtn gen-ib" onClick={() => swap(i)} aria-label={t('Swap exercise')} title={t('Swap exercise')}><Icon name="shuffle" /></button>
          <button className="iconbtn gen-ib" onClick={() => remove(i)} aria-label={t('Remove')} disabled={res.ex.length <= 1}><Icon name="trash" /></button>
        </div>
      })}
    </div>
    <div style={{ height: 14 }} />
    <Button variant="primary" icon="play" onClick={() => save(true)}>{t('Save & start')}</Button>
    <div style={{ height: 8 }} />
    <Button onClick={() => save(false)}>{t('Save routine')}</Button>
    <div style={{ height: 8 }} />
    <div className="row">
      <Button variant="ghost" icon="chevronLeft" onClick={() => setRes(null)}>{t('Options')}</Button>
      <Button variant="ghost" icon="reset" onClick={() => run((seed * 7919 + 13) % 1000003)}>{t('Regenerate')}</Button>
    </div>
  </>

  return <>
    <h3>{t('Generate a routine')}</h3>
    <div className="muted small">{t('Pick what to train and how long you have — you can swap any exercise afterwards.')}</div>
    <h4 className="sec">{t('What do you want to train?')}</h4>
    <div className="gen-chips">
      {PRESET_LABELS.map(([k, label]) => <button key={k} className={'chip nocap' + (sameSet(PRESETS[k], o.groups) ? ' on' : '')} onClick={() => set({ groups: [...PRESETS[k]] })}>{t(label)}</button>)}
    </div>
    <div className="gen-chips">
      {GROUP_KEYS.map(g => <button key={g} className={'chip' + (o.groups.includes(g) ? ' on' : '')} onClick={() => toggleIn('groups', g)}>{t(g)}</button>)}
    </div>
    <h4 className="sec">{t('Time available')} · <span className="accent">{o.minutes} min</span></h4>
    <Slider value={o.minutes} min={20} max={120} step={5} onChange={v => set({ minutes: v })} />
    <h4 className="sec">{t('Goal')}</h4>
    <Segmented options={GOALS.map(([value, label]) => ({ value, label: t(label) }))} value={o.goal} onChange={v => set({ goal: v })} />
    <h4 className="sec">{t('Equipment')}</h4>
    <div className="gen-chips">
      {EQUIPMENT_KEYS.map(k => <button key={k} className={'chip' + (o.equipment.includes(k) ? ' on' : '')} onClick={() => toggleIn('equipment', k)}>{t(EQUIPMENT_LABELS[k])}</button>)}
    </div>
    <ExPrefList title={t('Exercises you like')} ids={o.like} onAdd={() => pick('like')} onRemove={id => toggleIn('like', id)} />
    <ExPrefList title={t('Exercises to avoid')} ids={o.avoid} onAdd={() => pick('avoid')} onRemove={id => toggleIn('avoid', id)} />
    <div style={{ height: 16 }} />
    <Button variant="primary" icon="sparkles" onClick={() => run(seed)}>{t('Generate')}</Button>
  </>
}

export const generatorSheet = () => ui().openSheet(close => <Generator close={close} />)
