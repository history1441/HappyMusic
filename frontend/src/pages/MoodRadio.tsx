import { useState, useEffect, useRef, useMemo } from 'react'
import { useIsMobile } from '../hooks/useBreakpoint'
import api from '../services/api'
import { usePlayerStore } from '../stores/playerStore'
import type { Song } from '../types'
import { Play, Music2, RefreshCw, Sparkles, Zap } from 'lucide-react'

interface MoodSong {
  song_name: string
  singers: string
  source?: string
  song_identifier?: string
  cover_url?: string
  ext?: string
  duration_s?: number
}

const MOODS = [
  { key: 'happy', label: '开心', emoji: '\u{1F60A}', color: '#FFD93D', desc: '欢快动感，心情满分' },
  { key: 'sad', label: '伤感', emoji: '\u{1F622}', color: '#6C9BCF', desc: '安静抒情，释放情绪' },
  { key: 'relax', label: '放松', emoji: '\u{1F60C}', color: '#95E1D3', desc: '轻柔治愈，放空自我' },
  { key: 'sport', label: '运动', emoji: '\u{1F3CB}', color: '#FF6B6B', desc: '热血摇滚，燃烧能量' },
  { key: 'focus', label: '专注', emoji: '\u{1F3AF}', color: '#A8D8EA', desc: '纯音乐钢琴，沉浸心流' },
  { key: 'romantic', label: '浪漫', emoji: '\u{1F495}', color: '#F8A5C2', desc: '甜蜜情歌，心动时刻' },
]

const PHASE_TEXTS = [
  '正在分析你的音乐品味...',
  '正在为你寻找歌曲...',
  '正在准备播放列表...',
]

const NOTES = ['♪', '♫', '♬', '♩', '♭', '♮']

// ---- Loading Animation Component ----
function MoodLoadingAnimation({ phase, moodColor }: { phase: 1 | 2 | 3; moodColor: string }) {
  const useWave = useMemo(() => Math.random() > 0.5, [])

  return (
    <div style={{ textAlign: 'center', padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <div style={{ position: 'relative', width: 240, height: 120, overflow: 'hidden' }}>
        {useWave ? (
          // Wave animation
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                position: 'absolute', bottom: 20 + i * 20, left: '-10%', width: '120%', height: 4,
                borderRadius: 2, backgroundColor: moodColor, opacity: 0.6 - i * 0.15,
                animation: `happymusic-wave ${2.5 + i * 0.5}s ease-in-out infinite alternate`,
                animationDelay: `${i * 0.3}s`,
              }} />
            ))}
          </>
        ) : (
          // Floating notes animation
          NOTES.map((note, i) => (
            <span key={i} style={{
              position: 'absolute',
              left: `${15 + i * 14}%`,
              fontSize: 20 + (i % 3) * 8,
              color: moodColor,
              animation: `happymusic-float ${2 + (i % 3) * 0.8}s ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`,
              opacity: 0.7,
            }}>
              {note}
            </span>
          ))
        )}
      </div>
      <div style={{ fontSize: 15, color: 'var(--text-tertiary)', fontWeight: 500 }}>
        {PHASE_TEXTS[phase - 1]}
      </div>
    </div>
  )
}

export default function MoodRadio() {
  const isMobile = useIsMobile()
  const [activeMood, setActiveMood] = useState<string | null>(null)
  const [moodColor, setMoodColor] = useState('#EC4141')
  const [songs, setSongs] = useState<MoodSong[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState<1 | 2 | 3>(1)
  const [aiAvailable, setAiAvailable] = useState(false)
  const [halfFetched, setHalfFetched] = useState(false)
  const [fetchingMore, setFetchingMore] = useState(false)
  const queueIndexRef = useRef(-1)
  const { play } = usePlayerStore()

  useEffect(() => {
    checkAiStatus()
  }, [])

  // Half-way supplement logic
  useEffect(() => {
    if (!activeMood || halfFetched || fetchingMore || songs.length === 0) return
    const unsub = usePlayerStore.subscribe((state) => {
      if (halfFetched || fetchingMore) return
      const halfIndex = Math.floor(songs.length / 2)
      if (state.queueIndex >= halfIndex && state.queueIndex !== queueIndexRef.current) {
        queueIndexRef.current = state.queueIndex
        fetchMoreSongs()
      }
    })
    return () => unsub()
  }, [activeMood, halfFetched, fetchingMore, songs.length])

  const checkAiStatus = async () => {
    try {
      const { data } = await api.get('/ai/status')
      setAiAvailable(data.enabled === true)
    } catch {
      setAiAvailable(false)
    }
  }

  const loadMoodSongs = async (mood: string) => {
    const moodConfig = MOODS.find((m) => m.key === mood)!
    setActiveMood(mood)
    setMoodColor(moodConfig.color)
    setSongs([])
    setHalfFetched(false)
    setFetchingMore(false)

    if (aiAvailable) {
      await loadWithAi(mood)
    } else {
      await loadFallback(mood)
    }
  }

  const loadWithAi = async (mood: string) => {
    setLoading(true)
    try {
      // Phase 1: AI generates playlist
      setLoadingPhase(1)
      const { data: playlistData } = await api.post('/ai/mood-playlist', { mood }, { timeout: 30000 })
      const suggestions: { song_name: string; singers: string }[] = playlistData.songs || []
      if (suggestions.length === 0) {
        setLoading(false)
        return
      }

      // Phase 2: Search and match
      setLoadingPhase(2)
      const matched = await searchAndMatch(suggestions)
      if (matched.length > 0) {
        // Phase 3: Prepare playback
        setLoadingPhase(3)
        setSongs(matched)
      }
    } catch (e) {
      console.warn('AI mood radio failed:', e)
    }
    setLoading(false)
  }

  const loadFallback = async (mood: string) => {
    setLoading(true)
    try {
      const { data } = await api.get('/mood-radio', { params: { mood } })
      setSongs(data.results || data || [])
    } catch {
      setSongs([])
    }
    setLoading(false)
  }

  const searchAndMatch = async (
    suggestions: { song_name: string; singers: string }[]
  ): Promise<MoodSong[]> => {
    const results = await Promise.all(
      suggestions.map(async ({ song_name, singers }) => {
        try {
          const { data } = await api.get('/search', {
            params: { keyword: `${song_name} ${singers}` },
            timeout: 10000,
          })
          const songList: any[] = data.songs || data.results || data || []
          const match = songList.find((s: any) => {
            const nameMatch = s.song_name?.toLowerCase().includes(song_name.toLowerCase())
            const singerMatch = s.singers?.toLowerCase().includes(singers.toLowerCase())
            return nameMatch || singerMatch
          })
          return match
            ? ({
                song_name: match.song_name,
                singers: match.singers,
                source: match.source,
                song_identifier: match.song_identifier,
                cover_url: match.cover_url || '',
                ext: match.ext || 'mp3',
                duration_s: match.duration_s || 0,
              } as MoodSong)
            : null
        } catch {
          return null
        }
      })
    )
    return results.filter((r): r is MoodSong => r !== null && !!r.source && !!r.song_identifier)
  }

  const fetchMoreSongs = async () => {
    if (!activeMood || fetchingMore || halfFetched) return
    setFetchingMore(true)
    try {
      const existingNames = songs.map((s) => s.song_name)
      const { data } = await api.post(
        '/ai/mood-playlist',
        { mood: activeMood, current_list: existingNames },
        { timeout: 30000 }
      )
      const newSuggestions: { song_name: string; singers: string }[] = data.songs || []
      if (newSuggestions.length > 0) {
        const matched = await searchAndMatch(newSuggestions)
        if (matched.length > 0) {
          setSongs((prev) => [...prev, ...matched])
        }
      }
    } catch {}
    setHalfFetched(true)
    setFetchingMore(false)
  }

  const refresh = () => {
    if (activeMood) loadMoodSongs(activeMood)
  }

  const playAll = () => {
    if (songs.length === 0) return
    const playables: Song[] = songs
      .filter((s) => s.source && s.song_identifier)
      .map((s) => ({
        song_name: s.song_name,
        singers: s.singers,
        album: '',
        ext: s.ext || 'mp3',
        file_size: '',
        duration: '',
        duration_s: s.duration_s || 0,
        source: s.source!,
        song_identifier: s.song_identifier!,
        download_url: '',
        cover_url: s.cover_url || '',
        lyric: '',
        with_valid_download_url: false,
      }))
    if (playables.length > 0) play(playables[0], playables)
  }

  const handlePlaySong = (song: MoodSong) => {
    if (!song.source || !song.song_identifier) return
    const playable: Song = {
      song_name: song.song_name,
      singers: song.singers,
      album: '',
      ext: song.ext || 'mp3',
      file_size: '',
      duration: '',
      duration_s: song.duration_s || 0,
      source: song.source,
      song_identifier: song.song_identifier,
      download_url: '',
      cover_url: song.cover_url || '',
      lyric: '',
      with_valid_download_url: false,
    }
    // Build list from current songs for queue
    const allPlayables: Song[] = songs
      .filter((s) => s.source && s.song_identifier)
      .map((s) => ({
        song_name: s.song_name, singers: s.singers, album: '',
        ext: s.ext || 'mp3', file_size: '', duration: '',
        duration_s: s.duration_s || 0, source: s.source!,
        song_identifier: s.song_identifier!, download_url: '',
        cover_url: s.cover_url || '', lyric: '', with_valid_download_url: false,
      }))
    play(playable, allPlayables)
  }

  const formatDuration = (s: number) => {
    if (!s) return '--:--'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const active = MOODS.find((m) => m.key === activeMood)

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 32px', paddingBottom: isMobile ? 132 : 120 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 28 }}>📻</span>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>心情电台</h2>
        {aiAvailable && (
          <span style={{
            padding: '2px 8px', background: 'rgba(52,199,89,0.1)',
            borderRadius: 10, fontSize: 11, color: '#34C759', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <Sparkles size={10} /> AI
          </span>
        )}
      </div>
      {!aiAvailable && (
        <div style={{
          padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius)',
          border: '1px solid var(--border)', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-tertiary)',
        }}>
          <Zap size={16} style={{ color: '#FF9500' }} />
          AI 未启用，当前使用基础模式（关键词搜索）
        </div>
      )}

      {/* Mood selection */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
        {MOODS.map((mood) => (
          <button key={mood.key} onClick={() => loadMoodSongs(mood.key)} style={{
            padding: 20, borderRadius: 'var(--radius)',
            background: activeMood === mood.key ? mood.color : 'var(--card)',
            border: `2px solid ${activeMood === mood.key ? mood.color : 'var(--border)'}`,
            cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
            transform: activeMood === mood.key ? 'scale(1.02)' : 'scale(1)',
            boxShadow: activeMood === mood.key ? `0 4px 20px ${mood.color}40` : 'none',
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{mood.emoji}</div>
            <div style={{
              fontSize: 16, fontWeight: 700,
              color: activeMood === mood.key ? '#fff' : 'var(--text-primary)',
            }}>
              {mood.label}
            </div>
            <div style={{
              fontSize: 12, marginTop: 4,
              color: activeMood === mood.key ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)',
            }}>
              {mood.desc}
            </div>
          </button>
        ))}
      </div>

      {/* Results */}
      {active && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 24 }}>{active.emoji}</span>
              <span style={{ fontSize: 18, fontWeight: 700 }}>{active.label}电台</span>
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{songs.length} 首</span>
              {fetchingMore && (
                <span style={{ fontSize: 12, color: 'var(--accent)' }}>补充中...</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={refresh} disabled={loading} style={{
                padding: '8px 14px', background: 'var(--bg-secondary)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                cursor: loading ? 'not-allowed' : 'pointer', color: 'var(--text-secondary)', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />换一批
              </button>
              {songs.length > 0 && (
                <button onClick={playAll} style={{
                  padding: '8px 20px', background: 'var(--accent)',
                  border: 'none', borderRadius: 'var(--radius-sm)',
                  color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Play size={14} />播放全部
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <MoodLoadingAnimation phase={loadingPhase} moodColor={moodColor} />
          ) : songs.length > 0 ? (
            <div>
              {songs.map((song, idx) => (
                <div key={`${song.source}-${song.song_identifier}-${idx}`}
                  onClick={() => handlePlaySong(song)}
                  style={{
                    display: 'grid', gridTemplateColumns: '32px 40px 1fr 120px 60px',
                    padding: '8px 12px', alignItems: 'center', gap: 12,
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{idx + 1}</span>
                  <div style={{
                    width: 40, height: 40, borderRadius: 6, background: 'var(--bg-tertiary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}>
                    {song.cover_url ? (
                      <img src={song.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Music2 size={16} style={{ color: 'var(--text-tertiary)' }} />
                    )}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {song.song_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{song.singers}</div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{song.source}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{formatDuration(song.duration_s || 0)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)' }}>
              暂无歌曲，换个心情试试
            </div>
          )}
        </div>
      )}

      {/* No mood selected hint */}
      {!active && (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📻</div>
          选择一种心情开始收听
        </div>
      )}

      <style>{`
        @keyframes happymusic-float {
          0%, 100% { transform: translateY(0px); opacity: 0.3; }
          50% { transform: translateY(-40px); opacity: 0.8; }
        }
        @keyframes happymusic-wave {
          from { transform: translateX(-30px); }
          to { transform: translateX(30px); }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
