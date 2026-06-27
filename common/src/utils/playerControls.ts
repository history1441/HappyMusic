/**
 * 播放器控制共享逻辑(三端复用)
 * 纯函数 + 预设常量,不依赖任何平台 API,具体播放调用由各端 playerStore 适配。
 */

// ============ 倍速播放 ============

/** 倍速预设(含 1.0) */
export const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0] as const

/** 在预设中循环切换到下一档倍速 */
export function nextSpeed(current: number): number {
  const idx = SPEED_PRESETS.findIndex((s) => Math.abs(s - current) < 0.01)
  if (idx < 0) return 1.0
  return SPEED_PRESETS[(idx + 1) % SPEED_PRESETS.length]
}

/** 格式化倍速显示:1.0 → "1.0x",1.5 → "1.5x" */
export function formatSpeed(rate: number): string {
  return `${rate.toFixed(2).replace(/\.?0+$/, '') || '1'}x`
}

// ============ 睡眠定时 ============

/** 定时关闭预设(分钟) */
export const TIMER_PRESETS = [10, 15, 30, 45, 60, 90] as const

/** 启动定时,返回结束时间戳(ms);minutes 为 0 或负数表示取消 */
export function makeTimerEndTime(minutes: number): number | null {
  if (!minutes || minutes <= 0) return null
  return Date.now() + minutes * 60 * 1000
}

/** 检查定时是否已到;返回 true 表示应触发关闭 */
export function isTimerExpired(endTime: number | null): boolean {
  return !!endTime && Date.now() >= endTime
}

/** 格式化剩余时间:mm:ss */
export function formatRemaining(endTime: number | null): string | null {
  if (!endTime) return null
  const diff = Math.max(0, endTime - Date.now())
  const m = Math.floor(diff / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ============ AB 段复读 ============

export interface AbLoop {
  a: number | null
  b: number | null
}

export const NO_AB_LOOP: AbLoop = { a: null, b: null }

/** 判断当前位置是否越过 B 点(返回 true 则应 seekTo A) */
export function shouldLoopBack(position: number, ab: AbLoop): boolean {
  return ab.a != null && ab.b != null && position >= ab.b && ab.b > ab.a
}

/** 标记 A 点;若已有 A,则第二次按设为 B 点 */
export function toggleAbPoint(position: number, ab: AbLoop): AbLoop {
  if (ab.a == null) return { a: position, b: null }
  if (ab.b == null) {
    // B 点必须大于 A 点
    if (position > ab.a) return { a: ab.a, b: position }
    // 若点在 A 之前,重置 A
    return { a: position, b: null }
  }
  // 两点都已存在,重新开始标记
  return { a: position, b: null }
}

/** 清空 AB 段 */
export function clearAbLoop(): AbLoop {
  return { ...NO_AB_LOOP }
}

// ============ 音质选择 ============

export type QualityId = 'standard' | 'high' | 'lossless'

export interface QualityPreset {
  id: QualityId
  label: string
  desc: string
}

export const QUALITY_PRESETS: QualityPreset[] = [
  { id: 'standard', label: '标准', desc: '128 kbps · 省流量' },
  { id: 'high', label: '高品质', desc: '320 kbps · 推荐' },
  { id: 'lossless', label: '无损', desc: 'FLAC · 需音源支持' },
]

/** 根据音质偏好挑选候选 URL:优先匹配后缀,回退第一个 */
export function pickQualityUrl(
  urls: { url: string; size?: number; ext?: string; br?: number | string }[] | undefined,
  quality: QualityId
): string | null {
  if (!urls || urls.length === 0) return null
  if (urls.length === 1) return urls[0].url
  // lossless 优先 flac;high 取码率最高;standard 取码率/体积最低
  const scored = [...urls].sort((a, b) => {
    const brA = typeof a.br === 'number' ? a.br : a.size || 0
    const brB = typeof b.br === 'number' ? b.br : b.size || 0
    return brA - brB
  })
  if (quality === 'lossless') {
    const flac = urls.find((u) => (u.ext || '').toLowerCase() === 'flac')
    return (flac || scored[scored.length - 1]).url
  }
  if (quality === 'high') return scored[scored.length - 1].url
  return scored[0].url
}
