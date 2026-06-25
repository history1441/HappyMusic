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

/** 文件大小格式化(别名,与 formatSize 一致,命名更清晰) */
export function formatFileSize(bytes: number): string {
  return formatSize(bytes)
}

/** 比特率格式化:320000 → "320 kbps" */
export function formatBitrate(bps: number): string {
  if (!bps || isNaN(bps)) return '未知'
  const kbps = Math.round(bps / 1000)
  return `${kbps} kbps`
}

/** 时间戳格式化:毫秒 → "YYYY-MM-DD HH:mm" */
export function formatTimestamp(ms: number): string {
  if (!ms || isNaN(ms)) return ''
  const d = new Date(ms)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 邮箱格式校验 */
export function validateEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

/** 文件名清理:过滤非法字符(用于下载命名) */
export function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().substring(0, 200)
}

/** 数字千分位:12345 → "12,345" */
export function formatNumber(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
