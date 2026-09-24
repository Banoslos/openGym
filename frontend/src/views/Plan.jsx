import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { DAYN, uid, exCount, fmtDate, todayISO, isoOf } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { dayAssignSheet, loadStarterPlan, planToolsSheet, confirmSheet } from '../sheets.jsx'
import { generatorSheet } from '../Generator.jsx'
import Icon from '../components/Icon.jsx'
import { Button, SelectRow } from '../components/ui.jsx'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { programFor, activateProgram, rotationInfo, mondayOf } from '../lib/programs.js'

const ROTATE = [[0, 'Never'], [1, 'Every week'], [2, 'Every 2 weeks'], [3, 'Every 3 weeks'], [4, 'Every 4 weeks'], [6, 'Every 6 weeks'], [8, 'Every 8 weeks']]
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// First unused "Program X" name — deleting B then adding again gives B back, not D.
function nextName(programs) {
  const used = new Set(programs.map(p => p.name))
  const l = [...LETTERS].find(c => !used.has(t('Program {0}', c)))
  return t('Program {0}', l || programs.length + 1)
}

// Rename / duplicate / delete one program.
function ProgramSheet({ id, close, onSelect }) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const p = S.programs.find(x => x.id === id)
  const [name, setName] = useState(p ? p.name : '')
  if (!p) return null
  const save = () => { const n = name.trim(); if (n && n !== p.name) update(s => { s.programs.find(x => x.id === id).name = n }) }
  const duplicate = () => {
    save()
    const c = { id: uid(), name: t('{0} copy', name.trim() || p.name), week: { ...p.week } }
    update(s => { s.programs.splice(s.programs.findIndex(x => x.id === id) + 1, 0, c) })
    close(); onSelect(c.id)
  }
  const remove = () => confirmSheet({
    title: t('Delete program?'), message: t('“{0}” and its week schedule will be removed. Routines are kept.', p.name), confirmText: t('Delete'), danger: true,
    onConfirm: () => {
      update(s => {
        // Keep the rotation anchored on the program in use this week (or its successor) so
        // removing one doesn't shift which program the following weeks land on.
        const today = todayISO()
        let cur = programFor(s, today)
        const i = s.programs.findIndex(x => x.id === id)
        if (cur.id === id) cur = s.programs[(i + 1) % s.programs.length]
        s.programs.splice(i, 1)
        if (s.programs.length <= 1) { s.week = { ...(s.programs[0]?.week || {}) }; s.programs = []; s.program = null; s.programFrom = null; s.rotate = 0 }
        else activateProgram(s, cur.id)
      })
      close(); onSelect(null)
    }
  })
  return <>
    <h3>{t('Program')}</h3>
    <input className="input" value={name} onChange={e => setName(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') { save(); close() } }} placeholder={t('Program name')} />
    <div style={{ height: 12 }} />
    <Button variant="primary" icon="check" onClick={() => { save(); close() }}>{t('Done')}</Button>
    <div style={{ height: 8 }} />
    <Button icon="clipboard" onClick={duplicate}>{t('Duplicate program')}</Button>
    <div style={{ height: 8 }} />
    <Button variant="danger" icon="trash" onClick={remove}>{t('Delete program')}</Button>
  </>
}

function Programs({ S, sel, onSelect }) {
  const update = useStore(s => s.update)
  const { cur, next, inWeeks } = rotationInfo(S)

  const add = () => {
    const p = { id: uid(), name: nextName(S.programs), week: {} }
    update(s => { s.programs.push(p) })
    onSelect(p.id)
  }
  const use = id => update(s => { activateProgram(s, id) })
  const setRotate = v => update(s => {
    // Re-anchor on this week's program so turning rotation on/changing its pace never jumps
    // straight to a different program mid-week.
    activateProgram(s, programFor(s, todayISO()).id)
    s.rotate = v
  })
  const edit = id => useUI.getState().openSheet(close => <ProgramSheet id={id} close={close} onSelect={onSelect} />)

  let nextLine = null
  if (next && next.id !== cur.id) {
    const d = new Date(mondayOf(todayISO()) + 'T12:00:00')
    d.setDate(d.getDate() + inWeeks * 7)
    nextLine = inWeeks === 1 ? t('Next week: {0}', next.name) : t('{0} from {1}', next.name, fmtDate(isoOf(d)))
  }

  return <>
    <div className="row between" style={{ marginTop: 4, marginBottom: 10 }}>
      <h4 className="sec" style={{ margin: 0 }}>{t('Programs')}</h4>
      <Button size="sm" variant="tinted" icon="plus" onClick={add}>{t('New')}</Button>
    </div>
    <div className="gen-chips prog-chips">
      {S.programs.map(p => <button key={p.id} className={'chip nocap' + (sel.id === p.id ? ' on' : '')} onClick={() => onSelect(p.id)}>
        {cur.id === p.id && <Icon name="dot" className="prog-dot" />}{p.name}</button>)}
    </div>
    <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="item">
        <span className="lrow-i"><Icon name="calendar" /></span>
        <div className="grow">
          <div className="tt">{sel.name}</div>
          <div className="ss">{sel.id === cur.id ? t('In use this week') : t('Not in use this week')}{nextLine && sel.id === cur.id ? ' · ' + nextLine : ''}</div>
        </div>
        <button className="iconbtn" onClick={() => edit(sel.id)} aria-label={t('Edit program')} title={t('Edit program')}><Icon name="pencil" /></button>
      </div>
    </div>
    {sel.id !== cur.id && <><div style={{ height: 8 }} /><Button variant="tinted" icon="play" onClick={() => use(sel.id)}>{t('Use this program from this week')}</Button></>}
    <div className="sect-b" style={{ marginTop: 8 }}>
      <SelectRow icon="shuffle" title={t('Switch program')} sheetTitle={t('Switch to the next program')} value={S.rotate || 0}
        options={ROTATE.map(([value, label]) => ({ value, label: t(label), ...(value ? {} : { subtitle: t('Switch by hand') }) }))} onChange={setRotate} />
    </div>
    {!S.rotate && <div className="dim small" style={{ margin: '7px 2px 0', lineHeight: 1.4 }}>{t('Turn this on to alternate programs automatically — e.g. Program A one week, Program B the next.')}</div>}
  </>
}

export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [selId, setSelId] = useState(null)
  const programs = S.programs || []
  const sel = programs.find(p => p.id === selId) || programFor(S, todayISO())
  const week = sel ? sel.week : S.week

  const addRoutine = () => {
    const r = { id: uid(), name: t('New routine'), emoji: DEFAULT_GLYPH, ex: [] }
    update(s => { s.routines.push(r) })
    nav('/plan/r/' + r.id)
  }
  // Turns the single schedule into Program A and adds an empty Program B to fill in.
  const startPrograms = () => {
    const a = { id: uid(), name: t('Program {0}', 'A'), week: { ...S.week } }
    const b = { id: uid(), name: t('Program {0}', 'B'), week: {} }
    update(s => { s.programs = [a, b]; activateProgram(s, a.id); s.rotate = 0 })
    setSelId(b.id)
    useUI.getState().toast(t('Program B created — assign its days below'))
  }

  return <>
    <div className="hdr">
      <div><h1>{t('Plan')}</h1><div className="sub">{t('Your weekly routine')}</div></div>
      <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>
    </div>
    <div className="cols"><div>
      {sel ? <Programs S={S} sel={sel} onSelect={setSelId} /> : null}
      <h4 className="sec">{sel ? t('Week schedule — {0}', sel.name) : t('Week schedule')}</h4>
      <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
        {[1, 2, 3, 4, 5, 6, 0].map(d => {
          const r = S.routines.find(x => x.id === week[d])
          return <div key={d} className="item" onClick={() => dayAssignSheet(d, sel?.id)}>
            <div className="grow"><div className="tt">{t(DAYN[d])}</div></div>
            {r ? <span className="tag acc"><Icon name={glyphOf(r.emoji)} />{r.name}</span> : <span className="tag">{t('Rest')}</span>}
            <Icon name="chevronRight" className="chev" /></div>
        })}
      </div>
      {!sel && S.routines.length > 0 && <div className="list" style={{ marginTop: 10, display: 'flex', flexDirection: 'column' }}>
        <div className="item" onClick={startPrograms}>
          <span className="lrow-i"><Icon name="shuffle" /></span>
          <div className="grow"><div className="tt">{t('Weekly programs')}</div><div className="ss">{t('Group your routines into programs (A, B…) and alternate them week by week')}</div></div>
          <Icon name="plus" className="chev" />
        </div>
      </div>}
    </div><div>
      <div className="row between" style={{ marginTop: 22, marginBottom: 10 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Routines')}</h4>
        <div className="row" style={{ gap: 6 }}>
          <Button size="sm" variant="tinted" icon="sparkles" onClick={generatorSheet}>{t('Generate')}</Button>
          <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New')}</Button>
        </div>
      </div>
      {S.routines.length ? <div className="list">{S.routines.map(r => <div key={r.id} className="item" onClick={() => nav('/plan/r/' + r.id)}>
        <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
        <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
        <Icon name="chevronRight" className="chev" /></div>)}</div> : <>
        <div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('No routines yet.')}<br />{t('Create one or load the starter plan.')}</div>
        <Button icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (Push / Pull / Legs)')}</Button>
        <div style={{ height: 8 }} />
        <Button icon="sparkles" onClick={generatorSheet}>{t('Generate a routine')}</Button>
      </>}
    </div></div>
  </>
}
