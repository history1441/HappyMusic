import { useState, useEffect, useRef } from 'react'
import { cn } from '../utils/cn'

interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

let toastId = 0
const listeners: ((toasts: ToastItem[]) => void)[] = []
let toasts: ToastItem[] = []

function emitChange() {
  listeners.forEach(cb => cb([...toasts]))
}

export function showToast(message: string, type: ToastItem['type'] = 'info') {
  const item: ToastItem = { id: ++toastId, message, type }
  toasts = [...toasts, item]
  emitChange()
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== item.id)
    emitChange()
  }, 3000)
}

export default function Toast() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    listeners.push(setItems)
    return () => {
      const idx = listeners.indexOf(setItems)
      if (idx >= 0) listeners.splice(idx, 1)
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {items.map(item => (
        <div
          key={item.id}
          className={cn(
            'px-4 py-2.5 rounded-lg shadow-lg text-sm text-white animate-in slide-in-from-right',
            item.type === 'success' && 'bg-success',
            item.type === 'error' && 'bg-danger',
            item.type === 'info' && 'bg-text-secondary',
          )}
        >
          {item.message}
        </div>
      ))}
    </div>
  )
}
