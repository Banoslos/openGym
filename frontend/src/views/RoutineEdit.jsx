import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { exOr } from '../lib/exercises.js'
import { uid, fmtDate } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { supersetUnits, cleanupSg, exLine } from '../lib/history.js'
import { unschedule, programFor } from '../lib/programs.js'
import { Thumb } from '../components/Media.jsx'
import { glyphPicker, exercisePicker, exConfigSheet, confirmSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { Button, SelectRow } from '../components/ui.jsx'
import { POLICIES_FOR, POLICY_NAME, POLICY_DESC } from '../lib/progression.js'
import BodyMap from '../components/BodyMap.jsx'
import { loadOfRoutine, rankOf, MUSCLE_NAME } from '../lib/muscles.js'

export default function RoutineEdit() {
  const nav = useNavigate()
  const { id } = useParams()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const r = S.routines.find(x => x.id === id)
  const [drag, setDrag] = useState(null)   // { from, over, dy, h } while an exercise is being dragged
  const rows = useRef([])
  useEffect(() => { if (!r) nav('/plan') }, [!!r])
  if (!r) return null

  const back = () => nav(r.group && (S.programs || []).some(p => p.id === r.group) ? '/plan/g/' + r.group : r.temp ? '/home' : '/plan')
  const edit = fn => update(s => { fn(s.routines.find(x => x.id === id).ex) })
  const remove = i => confirmSheet({
    title: t('Remove exercise?'), message: t('“{0}” will be removed from this routine.', exOr(r.ex[i].id).n),
    confirmText: t('Remove'), danger: true,
    onConfirm: () => edit(x => { x.splice(i, 1); cleanupSg(x) })
  })

  // Drag by the handle to reorder. Row rectangles are measured once at pick-up; the list
  // only moves visually while dragging and the routine is written once, on release.
  const startDrag = (i, ev) => {
    ev.preventDefault(); ev.stopPropagation()
    const rects = rows.current.slice(0, r.ex.length).map(el => el.getBoundingClientRect())
    const y0 = ev.clientY, h = rects[i].height
    const overAt = y => {
      const mid = rects[i].top + h / 2 + (y - y0)
      let o = 0
      rects.forEach((rc, j) => { if (j !== i && rc.top + rc.height / 2 < mid) o++ })
      return o
    }
    setDrag({ from: i, over: i, dy: 0, h })
    const mv = e => setDrag({ from: i, over: overAt(e.clientY), dy: e.clientY - y0, h })
    const up = e => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up)
      const to = e.type === 'pointercancel' ? i : overAt(e.clientY)
      setDrag(null)
      if (to !== i) { edit(ex => { const [m] = ex.splice(i, 1); ex.splice(to, 0, m); cleanupSg(ex) }); navigator.vibrate?.(15) }
    }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
    navigator.vibrate?.(10)
  }
  const shift = i => {
    if (!drag) return undefined
    const { from, over, dy, h } = drag
    if (i === from) return { transform: `translateY(${dy}px)`, position: 'relative', zIndex: 5, boxShadow: '0 8px 24px rgba(0,0,0,.35)', borderRadius: 12 }
    const off = from < over && i > from && i <= over ? -h : from > over && i < from && i >= over ? h : 0
    return { transform: `translateY(${off}px)`, transition: 'transform .15s' }
  }
  const toggleLink = i => edit(ex => {
    if (i < 1) return
    const cur = ex[i], prev = ex[i - 1]
    if (cur.sg && prev.sg && cur.sg === prev.sg) delete cur.sg
    else { const gid = prev.sg || ('sg' + uid()); prev.sg = gid; cur.sg = gid }
    cleanupSg(ex)
  })

  const units = supersetUnits(r.ex)
  const unitFirst = new Set(units.filter(u => u.length > 1).map(u => u[0]))
  const inSS = new Set(units.filter(u => u.length > 1).flat())

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={back} aria-label={t('Plan')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, margin: '0 12px' }}>
        <input className="input" defaultValue={r.name} style={{ fontWeight: 600, fontSize: 20, letterSpacing: '-.021em' }}
          onChange={e => update(s => { s.routines.find(x => x.id === id).name = e.target.value.trim() || t('Routine') })} />
      </div>
      <button className="iconbtn" aria-label={t('Pick an icon')} onClick={() => glyphPicker(r.emoji, g => update(s => { s.routines.find(x => x.id === id).emoji = g }))}><Icon name={glyphOf(r.emoji)} /></button>
    </div>

    {r.temp ? <div className="card" style={{ borderColor: 'var(--purple)', marginBottom: 14 }}>
      <div className="small" style={{ marginBottom: 10 }}>{t('Temporary routine for {0} — it is removed after that day.', fmtDate(r.temp, true))}</div>
      <Button size="sm" variant="tinted" icon="folder" onClick={() => update(s => {
        const x = s.routines.find(y => y.id === id)
        x.group = (programFor(s, x.temp) || {}).id   // ensureGroups files it if there is none yet
        if (x.name === t('Temporary — {0}', fmtDate(x.temp))) x.name = t('Routine {0}', fmtDate(x.temp))
        delete x.temp
      })}>{t('Keep it — add to my group')}</Button>
    </div> : (S.programs || []).length > 1 && <div className="sect-b" style={{ marginBottom: 10 }}>
      <SelectRow icon="folder" title={t('Group')} sheetTitle={t('Move to group')} value={r.group || ''}
        options={S.programs.map(p => ({ value: p.id, label: p.name }))}
        onChange={v => update(s => { s.routines.find(x => x.id === id).group = v })} />
    </div>}
    <div className="sect-b" style={{ marginBottom: 16 }}>
      <SelectRow icon="chartLine" title={t('Progression')} sheetTitle={t('Progression')}
        value={r.prog || 'linear'} onChange={v => update(s => { s.routines.find(x => x.id === id).prog = v })}
        options={POLICIES_FOR.reps.map(p => ({ value: p, label: t(POLICY_NAME[p]), subtitle: t(POLICY_DESC[p]) }))} />
    </div>
    <div className="small dim" style={{ margin: '-10px 2px 16px' }}>
      {t('Applies to every exercise in this routine that does not set its own rule.')}
    </div>

    {r.ex.length ? <div className="list">{r.ex.map((e, i) => {
      // An unresolvable id is shown rather than skipped — hiding it left an entry you
      // could neither see nor delete, but that still turned up in the workout.
      const ex = exOr(e.id)
      const linkedPrev = i > 0 && e.sg && r.ex[i - 1].sg === e.sg
      return <div key={i} ref={el => { rows.current[i] = el }} style={shift(i)}>
        {unitFirst.has(i) && <div className="ss-label"><Icon name="link" />{t('Superset')}</div>}
        <div className={'item' + (inSS.has(i) ? ' in-ss' : '')} style={drag && drag.from === i ? { background: 'var(--surface-2)' } : undefined} onClick={() => {
          if (drag) return
          exConfigSheet(ex, e, cfg => edit(x => { x[i] = { id: x[i].id, sg: x[i].sg, ...cfg } }), () => edit(x => { x.splice(i, 1); cleanupSg(x) }), r)
        }}>
          <button className="iconbtn drag-h" aria-label={t('Drag to reorder')} onPointerDown={ev => startDrag(i, ev)} onClick={ev => ev.stopPropagation()}><Icon name="grip" /></button>
          <Thumb ex={ex} />
          <div className="grow"><div className="tt capitalize">{ex.n}</div><div className="ss">{exLine(e, S.unit)}</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 'none', alignItems: 'center' }}>
            {i > 0 && <button className={'iconbtn' + (linkedPrev ? ' on-ss' : '')} title={t('Superset with exercise above')} style={{ width: 32, height: 28, borderRadius: 8, fontSize: 15 }} onClick={ev => { ev.stopPropagation(); toggleLink(i) }}><Icon name="link" /></button>}
            <button className="iconbtn" aria-label={t('Remove')} title={t('Remove')} style={{ width: 32, height: 28, borderRadius: 8, fontSize: 15, color: 'var(--red)' }} onClick={ev => { ev.stopPropagation(); remove(i) }}><Icon name="trash" /></button>
          </div>
        </div>
      </div>
    })}</div> : <div className="empty"><div className="ico"><Icon name="dumbbell" /></div>{t('No exercises yet — add your first one.')}</div>}

    {/* Coverage of the routine as planned, so a gap shows up while you're building it
        rather than after a month of training around it. */}
    {r.ex.length > 0 && (() => {
      const load = loadOfRoutine(r)
      const { worked } = rankOf(load)
      return <div className="card" style={{ marginTop: 12 }}>
        <h2>{t('What this session hits')}</h2>
        <BodyMap load={load} body={S.body} />
        <div className="mchips">
          {worked.slice(0, 6).map(m => <span key={m} className="mchip">{t(MUSCLE_NAME[m])}</span>)}
        </div>
      </div>
    })()}

    <div className="small dim row" style={{ margin: '10px 2px', gap: 5 }}><Icon name="link" style={{ fontSize: 13 }} />{t('Drag an exercise by its handle to reorder it. Tap the link button to superset it with the one above — you’ll do them back-to-back.')}</div>
    <Button variant="primary" onClick={() => exercisePicker(ex => exConfigSheet(ex, null, cfg => edit(x => { x.push({ id: ex.id, ...cfg }) }), null, r))} icon="plus">{t('Add exercise')}</Button>
    <div style={{ height: 10 }} />
    <Button variant="danger" onClick={() => confirmSheet({
      title: t('Delete routine?'), message: t('“{0}” and its exercises will be removed.', r.name), confirmText: t('Delete'), danger: true,
      onConfirm: () => {
        update(s => {
          s.routines = s.routines.filter(x => x.id !== id)
          unschedule(s, id)
          Object.keys(s.dayPlan).forEach(k => { if (s.dayPlan[k] === id) delete s.dayPlan[k] })
        })
        back()
      }
    })}>{t('Delete routine')}</Button>
  </div>
}
