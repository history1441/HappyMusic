// Patterns for music platform URLs
const PATTERNS: { pattern: RegExp; platform: string; extract: (m: RegExpMatchArray) => string }[] = [
  // Netease: https://music.163.com/#/song?id=12345 or https://music.163.com/song?id=12345
  {
    pattern: /music\.163\.com\/(?:#\/)?song[?/].*id=(\d+)/,
    platform: 'netease',
    extract: (m) => m[1],
  },
  // QQ Music: https://y.qq.com/n/ryqq/songDetail/001ABC
  {
    pattern: /y\.qq\.com\/.*songDetail\/(\w+)/,
    platform: 'qqmusic',
    extract: (m) => m[1],
  },
  // Kugou: https://www.kugou.com/song/#hash=xxx
  {
    pattern: /kugou\.com\/song.*hash=([a-fA-F0-9]+)/,
    platform: 'kugou',
    extract: (m) => m[1],
  },
  // Kuwo: https://www.kuwo.cn/play_detail/12345
  {
    pattern: /kuwo\.cn\/play_detail\/(\d+)/,
    platform: 'kuwo',
    extract: (m) => m[1],
  },
]

export interface ParsedMusicUrl {
  platform: string
  id: string
  keyword?: string
}

export function parseMusicUrl(text: string): ParsedMusicUrl | null {
  for (const { pattern, platform, extract } of PATTERNS) {
    const m = text.match(pattern)
    if (m) {
      return { platform, id: extract(m) }
    }
  }
  return null
}

// Extract meaningful keyword from pasted URL for search fallback
export function extractSearchKeyword(text: string): string {
  // If it's a URL, return empty - we'll use platform+id for search
  if (/^https?:\/\//.test(text.trim())) return ''
  // Otherwise treat as plain text search
  return text.trim()
}
