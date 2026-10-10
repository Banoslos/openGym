import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { uid, fmtDate, todayISO, isoOf } from '../lib/format.js'
import { t, dateLocale } from '../lib/i18n.js'
import { loadStarterPlan, planToolsSheet } from '../sheets.jsx'
import { generatorSheet } from '../Generator.jsx'
import Icon from '../components/Icon.jsx'
import { Button, SelectRow } from '../components/ui.jsx'
import { programFor, activateProgram, rotationInfo, mondayOf, groupRoutines, isExpired } from '../lib/programs.js'

const ROTATE = [[0, 'Never'], [1, 'Every week'], [2, 'Every 2 weeks'], [3, 'Every 3 weeks'], [4, 'Every 4 weeks'], [6, 'Every 6 weeks'], [8, 'Every 8 weeks']]

// "October 2026" — a group is usually a block of training, and the month it starts names it.
export function newGroupName(S) {
  const m = new Date().toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' })
  const base = m.charAt(0).toUpperCase() + m.slice(1)
  const used = new Set((S.programs || []).map(p => p.name))
  if (!used.has(base)) return base
  let n = 2
  while (used.has(base + ' (' + n + ')')) n++
  return base + ' (' + n + ')'
}

// Plan = the list of groups (macro plans). A group owns its routines and its week schedule;
// opening one is where routines are created and days assigned (GroupEdit).
export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [q, setQ] = useState('')
  const groups = S.programs || []
  const today = todayISO()
  const cur = programFor(S, today)
  const { next, inWeeks } = rotationInfo(S)

  const ql = q.trim().toLowerCase()
  const shown = groups.filter(g => !ql || g.name.toLowerCase().includes(ql) ||
    groupRoutines(S, g.id).some(r => r.name.toLowerCase().includes(ql)))

  const addGroup = () => {
    const g = { id: uid(), name: newGroupName(S), week: {} }
    update(s => {
      s.programs = s.programs || []
      s.programs.push(g)
      if (!s.programs.some(p => p.id === s.program)) activateProgram(s, g.id)
    })
    nav('/plan/g/' + g.id)
  }
  const setRotate = v => update(s => {
    // Re-anchor on this week's group so changing the pace never jumps mid-week.
    activateProgram(s, programFor(s, todayISO()).id)
    s.rotate = v
  })

  let nextLine = null
  if (next && cur && next.id !== cur.id) {
    const d = new Date(mondayOf(today) + 'T12:00:00')
    d.setDate(d.getDate() + inWeeks * 7)
    nextLine = inWeeks === 1 ? t('Next week: {0}', next.name) : t('{0} from {1}', next.name, fmtDate(isoOf(d)))
  }

  return <div className="narrow">
    <div className="hdr">
      <div><h1>{t('Plan')}</h1><div className="sub">{cur ? t('In use: {0}', cur.name) : t('Your weekly routine')}</div></div>
      <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>
    </div>

    {groups.length > 0 ? <>
      {groups.length > 3 && <div className="search" style={{ marginBottom: 12 }}><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input className="input" placeholder={t('Search groups and routines…')} value={q} onChange={e => setQ(e.target.value)} /></div>}
      <div className="row between" style={{ marginBottom: 10 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Groups')}</h4>
        <Button size="sm" variant="tinted" icon="plus" onClick={addGroup}>{t('New group')}</Button>
      </div>
      <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
        {shown.map(g => {
          const rs = groupRoutines(S, g.id)
          const ended = isExpired(g, today)
          return <div key={g.id} className="item" onClick={() => nav('/plan/g/' + g.id)}>
            <span className="lrow-i" style={ended ? { background: 'var(--surface-3)' } : undefined}><Icon name="folder" /></span>
            <div className="grow">
              <div className="tt">{g.name}</div>
              <div className="ss">{t(rs.length === 1 ? '{0} routine' : '{0} routines', rs.length)}{g.until ? ' · ' + t(ended ? 'ended {0}' : 'until {0}', fmtDate(g.until)) : ''}</div>
              {ql && rs.some(r => r.name.toLowerCase().includes(ql)) && <div className="ss accent">{rs.filter(r => r.name.toLowerCase().includes(ql)).map(r => r.name).join(', ')}</div>}
            </div>
            {cur && cur.id === g.id && !ended && <span className="tag acc">{t('In use')}</span>}
            {ended && <span className="tag">{t('Ended')}</span>}
            <Icon name="chevronRight" className="chev" />
          </div>
        })}
        {!shown.length && <div className="empty">{t('Nothing matches “{0}”.', q.trim())}</div>}
      </div>
      {groups.length > 1 && <>
        <div className="sect-b" style={{ marginTop: 12 }}>
          <SelectRow icon="shuffle" title={t('Switch group')} sheetTitle={t('Switch to the next group')} value={S.rotate || 0}
            options={ROTATE.map(([value, label]) => ({ value, label: t(label), ...(value ? {} : { subtitle: t('Switch by hand') }) }))} onChange={setRotate} />
        </div>
        <div className="dim small" style={{ margin: '7px 2px 0', lineHeight: 1.4 }}>
          {nextLine || (S.rotate ? '' : t('Turn this on to alternate groups automatically — or give each group an end date and the next one takes over.'))}
        </div>
      </>}
    </> : <>
      <div className="empty"><div className="ico"><Icon name="folder" /></div>{t('No routines yet.')}<br />{t('Create a group (e.g. “September 2026”), then add its routines.')}</div>
      <Button variant="primary" icon="plus" onClick={addGroup}>{t('New group')}</Button>
      <div style={{ height: 8 }} />
      <Button icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (Push / Pull / Legs)')}</Button>
      <div style={{ height: 8 }} />
      <Button icon="sparkles" onClick={() => generatorSheet()}>{t('Generate a routine')}</Button>
    </>}
  </div>
}
