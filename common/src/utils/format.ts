export function formatDuration(s: number): string {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + 'GB'
}

export function parseLyric(raw: string): { time: number; text: string; translation?: string }[] {
  const lines = raw.split('\n')
  const parsed: { time: number; text: string; translation?: string }[] = []
  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/)
    if (match) {
      const time = parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / (match[3].length === 3 ? 1000 : 100)
      let text = match[4].trim()
      let translation: string | undefined
      const transIdx = text.indexOf('//')
      if (transIdx >= 0) {
        translation = text.substring(transIdx + 2).trim()
        text = text.substring(0, transIdx).trim()
      }
      parsed.push({ time, text, translation })
    }
  }
  return parsed
}
