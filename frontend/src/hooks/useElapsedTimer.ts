import { useState, useRef, useEffect } from 'react'

export function useElapsedTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0)
  const startRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    if (running) {
      startRef.current = Date.now()
      setSeconds(0)
      const tick = () => {
        setSeconds(Math.floor((Date.now() - startRef.current) / 1000))
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } else {
      cancelAnimationFrame(rafRef.current)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [running])

  return seconds
}
