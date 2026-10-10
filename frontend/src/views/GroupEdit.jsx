import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { DAYN, uid, exCount, fmtDate, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { dayAssignSheet, confirmSheet } from '../sheets.jsx'
import { generatorSheet } from '../Generator.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { programFor, activateProgram, groupRoutines, isExpired, unschedule } from '../lib/programs.js'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// One group: its name, end date, week schedule and routines. New routines are made here, so
// every routine has a home and the Plan list stays a short list of groups.
export default function GroupEdit() {
  const nav = useNavigate()
  const { id } = useParams()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const g = (S.programs || []).find(p => p.id === id)
  useEffect(() => { if (!g) nav('/plan') }, [!!g])
  if (!g) return null

  const today = todayISO()
  const routines = groupRoutines(S, id)
  const cur = programFor(S, today)
  const inUse = cur && cur.id === id
  const ended = isExpired(g, today)
  const setG = fn => update(s => { fn(s.programs.find(p => p.id === id)) })

  const addRoutine = () => {
    const used = new Set(routines.map(r => r.name))
    const l = [...LETTERS].find(c => !used.has(t('Routine {0}', c))) || routines.length + 1
    const r = { id: uid(), name: t('Routine {0}', l), emoji: DEFAULT_GLYPH, ex: [], group: id }
    update(s => { s.routines.push(r) })
    nav('/plan/r/' + r.id)
  }
  const duplicate = () => {
    const map = {}
    const copies = routines.map(r => { const c = JSON.parse(JSON.stringify(r)); c.id = uid(); map[r.id] = c.id; return c })
    const ng = { id: uid(), name: t('{0} copy', g.name), week: {} }
    Object.entries(g.week || {}).forEach(([d, rid]) => { ng.week[d] = map[rid] || rid })
    copies.forEach(c => { c.group = ng.id })
    update(s => {
      s.programs.splice(s.programs.findIndex(p => p.id === id) + 1, 0, ng)
      s.routines.push(...copies)
    })
    nav('/plan/g/' + ng.id)
  }
  const remove = () => confirmSheet({
    title: t('Delete group?'),
    message: routines.length ? t('“{0}” and its {1} routines will be removed. Past workouts are kept.', g.name, routines.length) : t('“{0}” will be removed.', g.name),
    confirmText: t('Delete'), danger: true,
    onConfirm: () => {
      update(s => {
        // Keep the rotation anchored on the group in use (or its successor) so removing one
        // does not shift which group the following weeks land on.
        let c = programFor(s, todayISO())
        const i = s.programs.findIndex(p => p.id === id)
        if (c && c.id === id) c = s.programs[(i + 1) % s.programs.length]
        const gone = s.routines.filter(r => r.group === id).map(r => r.id)
        s.routines = s.routines.filter(r => r.group !== id)
        gone.forEach(rid => unschedule(s, rid))
        Object.keys(s.dayPlan).forEach(k => { if (gone.includes(s.dayPlan[k])) delete s.dayPlan[k] })
        s.programs.splice(i, 1)
        if (!s.programs.length) { s.program = null; s.programFrom = null; s.rotate = 0; s.week = {} }
        else activateProgram(s, c.id === id ? s.programs[0].id : c.id)
      })
      nav('/plan')
    }
  })

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/plan')} aria-label={t('Plan')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, margin: '0 12px' }}>
        <input className="input" defaultValue={g.name} style={{ fontWeight: 600, fontSize: 20, letterSpacing: '-.021em' }}
          onChange={e => setG(p => { p.name = e.target.value.trim() || t('Group') })} />
      </div>
      <button className="iconbtn" onClick={duplicate} aria-label={t('Duplicate group')} title={t('Duplicate group')}><Icon name="clipboard" /></button>
    </div>

    <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="item">
        <span className="lrow-i" style={inUse && !ended ? undefined : { background: 'var(--surface-3)' }}><Icon name={inUse && !ended ? 'checkCircle' : 'moon'} /></span>
        <div className="grow"><div className="tt">{ended ? t('Ended') : inUse ? t('In use this week') : t('Not in use this week')}</div></div>
      </div>
      <div className="item">
        <span className="lrow-i"><Icon name="calendar" /></span>
        <div className="grow"><div className="tt">{t('Valid until')}</div></div>
        <input type="date" className="input date-in" value={g.until || ''} min={today}
          onChange={e => setG(p => { if (e.target.value) p.until = e.target.value; else delete p.until })} />
      </div>
    </div>
    <div className="dim small" style={{ margin: '7px 2px 0', lineHeight: 1.4 }}>
      {g.until ? t('After {0} the next group in your list takes over.', fmtDate(g.until, true)) : t('No end date — set one and the next group takes over by itself.')}
    </div>
    {!inUse && !ended && <><div style={{ height: 10 }} /><Button variant="tinted" icon="play" onClick={() => update(s => { activateProgram(s, id) })}>{t('Use this group from this week')}</Button></>}

    <h4 className="sec">{t('Week schedule')}</h4>
    <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
      {[1, 2, 3, 4, 5, 6, 0].map(d => {
        const r = S.routines.find(x => x.id === (g.week || {})[d])
        return <div key={d} className="item" onClick={() => dayAssignSheet(d, id)}>
          <div className="grow"><div className="tt">{t(DAYN[d])}</div></div>
          {r ? <span className="tag acc"><Icon name={glyphOf(r.emoji)} />{r.name}</span> : <span className="tag">{t('Rest')}</span>}
          <Icon name="chevronRight" className="chev" /></div>
      })}
    </div>

    <div className="row between" style={{ marginTop: 22, marginBottom: 10 }}>
      <h4 className="sec" style={{ margin: 0 }}>{t('Routines')}</h4>
      <div className="row" style={{ gap: 6 }}>
        <Button size="sm" variant="tinted" icon="sparkles" onClick={() => generatorSheet(id)}>{t('Generate')}</Button>
        <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New')}</Button>
      </div>
    </div>
    {routines.length ? <div className="list">{routines.map(r => <div key={r.id} className="item" onClick={() => nav('/plan/r/' + r.id)}>
      <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
      <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
      <Icon name="chevronRight" className="chev" /></div>)}</div>
      : <div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('No routines in this group yet.')}</div>}

    <div style={{ height: 18 }} />
    <Button variant="danger" icon="trash" onClick={remove}>{t('Delete group')}</Button>
    <div style={{ height: 30 }} />
  </div>
}
