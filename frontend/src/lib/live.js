// The workout in progress on the lock screen (mobile build only).
//
// A native ongoing notification (LiveWorkoutPlugin on Android) shows the current exercise
// and the next set, with a clock the OS keeps running while the WebView sleeps: the elapsed
// workout normally, the rest countdown between sets. On One UI 8 / Android 16 it is promoted
// to a Live Update, which is what lands it in Samsung's lock-screen Now Bar.
import { useEffect, useRef } from 'react'
import { registerPlugin } from '@capacitor/core'
import { MOBILE } from './mobile.js'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exOr } from './exercises.js'
import { setLabel } from './history.js'
import { t } from './i18n.js'

const Live = MOBILE ? registerPlugin('LiveWorkout') : null

// What the notification says — pure, so the hook only talks to the plugin when it changes.
export function liveContent(A, timer, work) {
  if (!A) return null
  const i = Math.min(A.cur || 0, Math.max(0, A.entries.length - 1))
  const e = A.entries[i]
  const name = e ? exOr(e.id).n : A.name
  const cap = name ? name.charAt(0).toUpperCase() + name.slice(1) : ''
  const sets = e ? e.sets : []
  const n = sets.findIndex(s => !s.done)
  const next = n >= 0 ? t('Set {0} of {1}', n + 1, sets.length) + ' · ' + setLabel(e.id, sets[n], e.target) : t('All sets done')
  if (work) return { title: cap, text: t('Hold') + ' · ' + next, when: work.endsAt, countdown: true }
  if (timer) return { title: t('Rest') + ' · ' + cap, text: next, when: timer.endsAt, countdown: true }
  return { title: cap || A.name, text: A.name + ' · ' + next, when: A.start, countdown: false }
}

export function useLiveWorkout() {
  const A = useStore(s => s.S.active)
  const timer = useUI(s => s.timer)
  const work = useUI(s => s.work)
  const last = useRef('')
  const asked = useRef(false)
  // Only the moments that change the text or the clock — not every countdown tick.
  const c = MOBILE ? liveContent(A, timer && { endsAt: timer.endsAt }, work && { endsAt: work.endsAt }) : null
  const key = c ? JSON.stringify(c) : ''
  useEffect(() => {
    if (!MOBILE || key === last.current) return
    last.current = key
    if (!c) { Live.stop().catch(() => {}); return }
    ;(async () => {
      if (!asked.current) {
        asked.current = true
        try {
          const { LocalNotifications } = await import('@capacitor/local-notifications')
          const p = await LocalNotifications.checkPermissions()
          if (p.display !== 'granted') await LocalNotifications.requestPermissions()
        } catch (e) { /* the notification just won't show */ }
      }
      Live.update(c).catch(() => {})
    })()
  }, [key])
}
