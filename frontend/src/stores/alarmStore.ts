import { create } from 'zustand'
import type { Song } from '../types'

export interface Alarm {
  id: string
  label: string
  time: string          // "HH:MM" 24h
  days: number[]        // 周几 [0=周日..6=周六],空数组=每天
  enabled: boolean
  song: Song | null     // 闹钟铃声(为空则播放收藏/最近第一首)
}

const STORAGE_KEY = 'happymusic_alarms'

function load(): Alarm[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function persist(alarms: Alarm[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms))
}

interface AlarmState {
  alarms: Alarm[]
  addAlarm: (a: Omit<Alarm, 'id'>) => void
  updateAlarm: (id: string, patch: Partial<Alarm>) => void
  removeAlarm: (id: string) => void
  toggleAlarm: (id: string) => void
}

export const useAlarmStore = create<AlarmState>((set, get) => ({
  alarms: load(),

  addAlarm: (a) => {
    const alarm: Alarm = { ...a, id: `alarm_${Date.now()}` }
    const next = [...get().alarms, alarm]
    persist(next)
    set({ alarms: next })
  },

  updateAlarm: (id, patch) => {
    const next = get().alarms.map((x) => (x.id === id ? { ...x, ...patch } : x))
    persist(next)
    set({ alarms: next })
  },

  removeAlarm: (id) => {
    const next = get().alarms.filter((x) => x.id !== id)
    persist(next)
    set({ alarms: next })
  },

  toggleAlarm: (id) => {
    const next = get().alarms.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x))
    persist(next)
    set({ alarms: next })
  },
}))
