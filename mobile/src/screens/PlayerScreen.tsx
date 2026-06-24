import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView, Modal, PanResponder,
  Animated, Easing, ActivityIndicator, FlatList,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePlayerStore } from '../stores/playerStore'
import { useNavigation, useRoute } from '@react-navigation/native'
import { formatDuration } from '../utils/format'
import api from '../services/api'
import AddToPlaylistModal from '../components/AddToPlaylistModal'
import PlayingQueueModal from '../components/PlayingQueueModal'
import { showToast } from '../components/Toast'
import { useDesktopLyricsStore } from '../stores/desktopLyricsStore'
import { DesktopLyricsModule } from '../native/DesktopLyrics'
import type { PlayMode } from '../types'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const TIMER_OPTIONS = [10, 15, 30, 45, 60, 90]
type LyricMode = 'normal' | 'translation'
const LYRIC_LINE_HEIGHT = 50

export default function PlayerScreen() {
  const currentSong = usePlayerStore(s => s.currentSong)
  const isPlaying = usePlayerStore(s => s.isPlaying)
  const position = usePlayerStore(s => s.position)
  const duration = usePlayerStore(s => s.duration)
  const playMode = usePlayerStore(s => s.playMode)
  const isBuffering = usePlayerStore(s => s.isBuffering)
  const togglePlay = usePlayerStore(s => s.togglePlay)
  const next = usePlayerStore(s => s.next)
  const prev = usePlayerStore(s => s.prev)
  const seekTo = usePlayerStore(s => s.seekTo)
  const setPlayMode = usePlayerStore(s => s.setPlayMode)
  const setShowFullPlayer = usePlayerStore(s => s.setShowFullPlayer)
  const navigation = useNavigation<any>()
  const insets = useSafeAreaInsets()
  const route = useRoute<any>()
  const [showLyrics, setShowLyrics] = useState(false)
  const [lyrics, setLyrics] = useState<{ time: number; text: string; translation?: string }[]>([])
  const [lyricMode, setLyricMode] = useState<LyricMode>('normal')
  const [moodResult, setMoodResult] = useState<{ mood: string; score: number; commentary: string; emoji: string; ai_enabled: boolean } | null>(null)
  const [moodLoading, setMoodLoading] = useState(false)
  const [isFav, setIsFav] = useState(false)
  const [favPlaylistId, setFavPlaylistId] = useState<number | null>(null)
  const [showTimer, setShowTimer] = useState(false)
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false)
  const [showPlayingQueue, setShowPlayingQueue] = useState(false)
  const [showDesktopLyricsPicker, setShowDesktopLyricsPicker] = useState(false)
  const [timerMinutes, setTimerMinutes] = useState<number | null>(null)
  const [remaining, setRemaining] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const endTimeRef = useRef<number | null>(null)
  // Animated progress
  const progressAnimRef = useRef(new Animated.Value(0)).current
  const thumbScaleRef = useRef(new Animated.Value(1)).current
  const progressRef = useRef<View>(null)
  const prevProgress = useRef(0)
  const lyricsAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const target = duration > 0 ? position / duration : 0
    if (Math.abs(target - prevProgress.current) < 0.15) {
      // 小变化用动画
      Animated.spring(progressAnimRef, {
        toValue: target,
        useNativeDriver: false,
        speed: 60,
        bounciness: 0,
      }).start()
    } else {
      // 大变化（切歌、seek）直接跳转
      progressAnimRef.setValue(target)
    }
    prevProgress.current = target
  }, [position, duration])

  // Tab mode detection
  const isTabMode = useMemo(() => {
    // When rendered as a Tab screen, route.name will be 'Player'
    // When rendered as a Stack modal, route.name will be 'FullPlayer'
    return route?.name === 'Player'
  }, [route?.name])

  // Vinyl rotation animation — 持续运行，通过 isPlaying 控制暂停/恢复
  const rotation = useRef(new Animated.Value(0)).current
  const rotationAnim = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    // 清理旧动画
    if (rotationAnim.current) {
      rotationAnim.current.stop()
      rotationAnim.current = null
    }
    if (isPlaying) {
      rotation.setValue(0)
      const anim = Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 20000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      )
      rotationAnim.current = anim
      anim.start()
    } else {
      rotation.stopAnimation()
    }
    return () => {
      if (rotationAnim.current) {
        rotationAnim.current.stop()
        rotationAnim.current = null
      }
    }
  }, [isPlaying, currentSong?.song_identifier])

  // AI 心情解读
  const handleMoodAnalysis = async () => {
    if (!currentSong || moodLoading) return
    setMoodLoading(true)
    setMoodResult(null)
    try {
      const { data } = await api.post('/ai/mood', {
        song_name: currentSong.song_name, singers: currentSong.singers, lyrics: '',
      }, { timeout: 15000 })
      if (data.ai_enabled === false) {
        showToast('AI 未配置，请联系管理员')
      } else {
        setMoodResult(data)
      }
    } catch {
      showToast('AI 解读失败，请稍后再试')
    }
    setMoodLoading(false)
  }

  // 切歌时清除解读结果
  useEffect(() => {
    setMoodResult(null)
  }, [currentSong?.song_identifier])

  // showLyrics 切回封面时不需要特殊处理，因为封面视图始终挂载
  const desktopLyricsMode = useDesktopLyricsStore((s) => s.mode)
  const setDesktopLyricsMode = useDesktopLyricsStore((s) => s.setMode)

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  // Seekable progress bar via PanResponder
  const progressWidth = SCREEN_WIDTH - 64
  const seekPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX
        const pct = Math.max(0, Math.min(1, x / progressWidth))
        seekTo(pct * duration)
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX
        const pct = Math.max(0, Math.min(1, x / progressWidth))
        seekTo(pct * duration)
      },
    })
  ).current

  // Parse lyrics & fetch on song change
  useEffect(() => {
    if (!currentSong) { setLyrics([]); return }

    // Cancel previous request
    lyricsAbortRef.current?.abort()
    lyricsAbortRef.current = new AbortController()
    const { signal } = lyricsAbortRef.current

    setLyrics([]) // 先清空，避免复用上一首歌的歌词
    if (currentSong.lyric && /\[\d{1,2}:\d{2}/.test(currentSong.lyric)) {
      parseLyrics(currentSong.lyric)
      return
    }
    fetchLyrics(signal)

    return () => { lyricsAbortRef.current?.abort() }
  }, [currentSong])

  const parseLyrics = (raw: string) => {
    const lines = raw.split('\n')
    const parsed: { time: number; text: string; translation?: string }[] = []
    for (const line of lines) {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/)
      if (match) {
        const time = parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / (match[3].length === 3 ? 1000 : 100)
        let text = match[4].trim()
        let translation: string | undefined
        // Check for translation separator //
        const transIdx = text.indexOf('//')
        if (transIdx >= 0) {
          translation = text.substring(transIdx + 2).trim()
          text = text.substring(0, transIdx).trim()
        }
        parsed.push({ time, text, translation })
      }
    }
    setLyrics(parsed)
  }

  const fetchLyrics = async (signal?: AbortSignal) => {
    if (!currentSong) return
    try {
      const { data } = await api.get('/lyrics', {
        params: { song_name: currentSong.song_name, singers: currentSong.singers, source: currentSong.source },
        signal,
      })
      if (data.lyric) { parseLyrics(data.lyric); return }
    } catch {}
    try {
      const { data } = await api.post('/refresh-url', {
        song_name: currentSong.song_name, singers: currentSong.singers,
        source: currentSong.source, song_identifier: currentSong.song_identifier,
      }, { signal })
      if (data.lyric) parseLyrics(data.lyric)
    } catch {}
  }

  // Check favorite
  useEffect(() => {
    if (!currentSong) return
    api.get('/playlists').then(({ data }) => {
      const playlists = data.playlists || data || []
      const fav = playlists.find((p: any) => p.is_favorite)
      if (fav) {
        setFavPlaylistId(fav.id)
        setIsFav(!!fav.songs?.some(
          (s: any) => s.source === currentSong.source && s.song_identifier === currentSong.song_identifier
        ))
      } else {
        setFavPlaylistId(null)
        setIsFav(false)
      }
    }).catch(() => setIsFav(false))
  }, [currentSong])

  const handleToggleFav = async () => {
    if (!currentSong) return
    try {
      // 如果收藏歌单不存在，先创建
      let playlistId = favPlaylistId
      if (!playlistId) {
        const { data } = await api.post('/playlists', {
          name: '我喜欢的', description: '', is_favorite: true,
        })
        playlistId = data.id
        setFavPlaylistId(playlistId)
      }
      if (isFav) {
        const { data } = await api.get(`/playlists/${playlistId}`)
        const song = (data.songs || []).find(
          (s: any) => s.source === currentSong.source && s.song_identifier === currentSong.song_identifier
        )
        if (song) {
          await api.delete(`/playlists/${playlistId}/songs/${song.id}`)
          setIsFav(false)
        }
      } else {
        await api.post(`/playlists/${playlistId}/songs`, {
          song_name: currentSong.song_name, singers: currentSong.singers,
          album: currentSong.album || '', ext: currentSong.ext || 'mp3',
          duration: currentSong.duration_s || 0, source: currentSong.source,
          song_identifier: currentSong.song_identifier,
          lyric: currentSong.lyric || '', cover_url: currentSong.cover_url || '',
        })
        setIsFav(true)
      }
    } catch {}
  }

  // Sleep timer
  const handleSetTimer = (minutes: number | null) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimerMinutes(minutes)
    setShowTimer(false)

    if (minutes) {
      endTimeRef.current = Date.now() + minutes * 60 * 1000
      timerRef.current = setInterval(() => {
        const diff = Math.max(0, (endTimeRef.current || 0) - Date.now())
        if (diff <= 0) {
          clearInterval(timerRef.current!)
          const { usePlayerStore } = require('../stores/playerStore')
          usePlayerStore.getState().togglePlay()
          setTimerMinutes(null)
          setRemaining(null)
        } else {
          const m = Math.floor(diff / 60000)
          const s = Math.floor((diff % 60000) / 1000)
          setRemaining(`${m}:${s.toString().padStart(2, '0')}`)
        }
      }, 1000)
    } else {
      endTimeRef.current = null
      setRemaining(null)
    }
  }

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  if (!currentSong) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-down" size={28} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>播放器</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="musical-note" size={64} color="#e2e8f0" />
          <Text style={styles.emptyTitle}>还没有播放音乐</Text>
          <Text style={styles.emptySubtitle}>搜索并播放一首歌曲吧</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Main', { screen: 'Search' })}>
            <Text style={styles.emptyBtnText}>去搜索</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const progress = duration > 0 ? position / duration : 0
  const modeIcons: Record<PlayMode, keyof typeof Ionicons.glyphMap> = {
    sequence: 'repeat',
    random: 'shuffle',
    single: 'repeat',
  }
  const modeLabels: Record<PlayMode, string> = { sequence: '顺序播放', random: '随机播放', single: '单曲循环' }

  const currentLyricIndex = lyrics.findIndex((l, i) => {
    if (i === lyrics.length - 1) return position >= l.time
    return position >= l.time && position < lyrics[i + 1].time
  })

  // Push current lyrics to desktop lyrics overlay/notification
  useEffect(() => {
    if (desktopLyricsMode === 'off') return
    const currentLine = currentLyricIndex >= 0 ? lyrics[currentLyricIndex]?.text || '' : ''
    const nextLine = currentLyricIndex >= 0 && currentLyricIndex + 1 < lyrics.length ? lyrics[currentLyricIndex + 1]?.text || '' : ''
    DesktopLyricsModule.updateLyrics(currentLine, nextLine)
  }, [currentLyricIndex, desktopLyricsMode, lyrics])

  // Clear desktop lyrics on song change
  useEffect(() => {
    return () => { DesktopLyricsModule.clearLyrics() }
  }, [currentSong?.song_identifier])

  // Lyrics auto-scroll with manual scroll recovery
  const lyricsListRef = useRef<FlatList>(null)
  const isUserScrolling = useRef(false)
  const scrollRecoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevLyricIndex = useRef(-1)
  const [lyricsListHeight, setLyricsListHeight] = useState(400)

  const handleLyricScrollBegin = useCallback(() => {
    isUserScrolling.current = true
    if (scrollRecoveryTimer.current) clearTimeout(scrollRecoveryTimer.current)
  }, [])

  const handleLyricScrollEnd = useCallback(() => {
    if (scrollRecoveryTimer.current) clearTimeout(scrollRecoveryTimer.current)
    scrollRecoveryTimer.current = setTimeout(() => {
      isUserScrolling.current = false
    }, 2000)
  }, [])

  const lyricPadding = useMemo(() => {
    return lyricsListHeight / 2 - LYRIC_LINE_HEIGHT / 2
  }, [lyricsListHeight])

  // 进入歌词页面时，直接跳到当前歌词位置
  useEffect(() => {
    if (showLyrics && currentLyricIndex >= 0 && lyrics.length > 0) {
      // 延迟一帧等 FlatList 渲染完成
      requestAnimationFrame(() => {
        lyricsListRef.current?.scrollToIndex({
          index: currentLyricIndex,
          animated: false,
          viewPosition: 0.5,
        })
      })
      prevLyricIndex.current = currentLyricIndex
    }
  }, [showLyrics])

  // 歌词跳动时自动滚动
  useEffect(() => {
    if (!showLyrics || isUserScrolling.current) return
    if (currentLyricIndex !== prevLyricIndex.current && currentLyricIndex >= 0) {
      prevLyricIndex.current = currentLyricIndex
      lyricsListRef.current?.scrollToIndex({
        index: currentLyricIndex,
        animated: true,
        viewPosition: 0.5,
      })
    }
  }, [currentLyricIndex, showLyrics])

  const cycleLyricMode = () => {
    setLyricMode(m => m === 'normal' ? 'translation' : 'normal')
  }

  const hasTranslations = lyrics.some(l => l.translation)

  const renderLyricLine = useCallback(({ item: line, index: i }: { item: typeof lyrics[0]; index: number }) => {
    const isActive = i === currentLyricIndex

    return (
      <TouchableOpacity
        onPress={() => seekTo(line.time)}
        style={styles.lyricLine}
        activeOpacity={0.7}
      >
        <Text style={[styles.lyricText, isActive && styles.lyricActive]}>
          {line.text}
        </Text>
        {lyricMode === 'translation' && line.translation && (
          <Text style={[styles.translationText, isActive && styles.translationActive]}>
            {line.translation}
          </Text>
        )}
      </TouchableOpacity>
    )
  }, [currentLyricIndex, lyricMode, seekTo])

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header - only show close button in modal mode */}
      <View style={styles.header}>
        {!isTabMode ? (
          <TouchableOpacity onPress={() => { setShowFullPlayer(false); navigation.goBack() }}>
            <Ionicons name="chevron-down" size={28} color="#1e293b" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 28 }} />
        )}
        <Text style={styles.headerTitle} numberOfLines={1}>{currentSong.song_name}</Text>
        <TouchableOpacity onPress={() => setShowTimer(true)}>
          <Ionicons name="timer-outline" size={24} color={remaining ? '#EC4141' : '#94a3b8'} />
        </TouchableOpacity>
      </View>

      {/* Timer badge */}
      {remaining && (
        <View style={styles.timerBadge}>
          <Ionicons name="moon" size={14} color="#EC4141" />
          <Text style={styles.timerText}>睡眠定时 {remaining}</Text>
          <TouchableOpacity onPress={() => handleSetTimer(null)}>
            <Ionicons name="close-circle" size={16} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      )}

      {/* 封面和歌词同时挂载，通过 opacity 切换 */}
      <View style={styles.viewSwitcher}>
        {/* 封面视图 */}
        <View style={[styles.coverContainer, showLyrics && styles.hiddenView]} pointerEvents={showLyrics ? 'none' : 'auto'}>
          <View style={styles.vinylContainer}>
            <Animated.View style={[styles.vinylDisc, { transform: [{ rotate: spin }] }]}>
              <View style={styles.vinylOuter}>
                <View style={styles.vinylGroove1} />
                <View style={styles.vinylGroove2} />
                <View style={styles.vinylCenter}>
                  {currentSong?.cover_url ? (
                    <Image source={{ uri: currentSong.cover_url }} style={styles.coverImage} />
                  ) : (
                    <View style={styles.coverPlaceholder}>
                      <Ionicons name="musical-note" size={40} color="#fff" />
                    </View>
                  )}
                </View>
              </View>
            </Animated.View>
          </View>
          <View style={styles.songMetaRow}>
            <Text style={styles.songTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{currentSong.song_name}</Text>
          </View>
          <Text style={styles.songArtist}>{currentSong.singers}</Text>
        </View>

        {/* 歌词视图 */}
        <View style={[styles.lyricsContainer, !showLyrics && styles.hiddenView]} pointerEvents={showLyrics ? 'auto' : 'none'}>
          <View style={styles.lyricModeBar}>
            <TouchableOpacity style={styles.lyricModeBtn} onPress={cycleLyricMode}>
              <Ionicons name={lyricMode === 'normal' ? 'document-text' : 'language'} size={16} color="#EC4141" />
              <Text style={styles.lyricModeText}>
                {lyricMode === 'normal' ? '普通' : '双语'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.lyricModeBtn} onPress={handleMoodAnalysis} disabled={moodLoading}>
              {moodLoading ? (
                <ActivityIndicator size="small" color="#EC4141" />
              ) : (
                <Ionicons name="sparkles" size={16} color="#EC4141" />
              )}
              <Text style={styles.lyricModeText}>AI解读</Text>
            </TouchableOpacity>
          </View>

          {/* AI 心情解读卡片 */}
          {moodResult && (
            <View style={styles.moodCard}>
              <Text style={styles.moodEmoji}>{moodResult.emoji}</Text>
              <View style={styles.moodInfo}>
                <Text style={styles.moodLabel}>{moodResult.mood}</Text>
                <Text style={styles.moodCommentary}>{moodResult.commentary}</Text>
              </View>
              <TouchableOpacity onPress={() => setMoodResult(null)}>
                <Ionicons name="close" size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          )}

          {lyrics.length === 0 && showLyrics ? (
            <View style={styles.noLyricsContainer}>
              <Ionicons name="document-text-outline" size={36} color="#cbd5e1" />
              <Text style={styles.noLyricsText}>暂无歌词</Text>
            </View>
          ) : (
          <FlatList
            ref={lyricsListRef}
            data={lyrics}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderLyricLine}
            getItemLayout={(_, index) => ({
              length: LYRIC_LINE_HEIGHT,
              offset: lyricPadding + LYRIC_LINE_HEIGHT * index,
              index,
            })}
            onScrollBeginDrag={handleLyricScrollBegin}
            onScrollEndDrag={handleLyricScrollEnd}
            onMomentumScrollEnd={handleLyricScrollEnd}
            onLayout={(e) => setLyricsListHeight(e.nativeEvent.layout.height)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: lyricPadding, paddingBottom: lyricPadding }}
          />
          )}
        </View>
      </View>

      {/* Progress - seekable */}
      <View style={styles.progressContainer}>
        {isBuffering && (
          <View style={styles.bufferingRow}>
            <ActivityIndicator size="small" color="#EC4141" />
            <Text style={styles.bufferingText}>缓冲中...</Text>
          </View>
        )}
        <View style={styles.progressBar} ref={progressRef} {...seekPanResponder.panHandlers}>
          <View style={styles.progressTrack} />
          <Animated.View style={[styles.progressFill, {
            width: progressAnimRef.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }]} />
          <Animated.View style={[styles.progressThumb, {
            left: progressAnimRef.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatDuration(position)}</Text>
          <Text style={styles.timeText}>{formatDuration(duration)}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={() => {
          const nextMode = playMode === 'sequence' ? 'random' : playMode === 'random' ? 'single' : 'sequence'
          setPlayMode(nextMode)
          showToast(`已切换到${modeLabels[nextMode]}`)
        }}>
          <Ionicons name={modeIcons[playMode]} size={24} color={playMode === 'sequence' ? '#94a3b8' : '#EC4141'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={prev}>
          <Ionicons name="play-skip-back" size={32} color="#1e293b" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={36} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={next}>
          <Ionicons name="play-skip-forward" size={32} color="#1e293b" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowPlayingQueue(true)}>
          <Ionicons name="list" size={24} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* Lyric button row */}
      <View style={styles.extraControls}>
        <TouchableOpacity style={styles.extraBtn} onPress={() => setShowLyrics(!showLyrics)}>
          <Ionicons name={showLyrics ? 'musical-notes' : 'document-text'} size={18} color={showLyrics ? '#EC4141' : '#94a3b8'} />
          <Text style={[styles.extraBtnText, showLyrics && styles.extraBtnActive]}>{showLyrics ? '封面' : '歌词'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.extraBtn} onPress={handleToggleFav}>
          <Ionicons name="heart" size={18} color={isFav ? '#ef4444' : '#94a3b8'} />
          <Text style={styles.extraBtnText}>{isFav ? '已收藏' : '收藏'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.extraBtn} onPress={() => setShowAddToPlaylist(true)}>
          <Ionicons name="list-outline" size={18} color="#94a3b8" />
          <Text style={styles.extraBtnText}>歌单</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.extraBtn} onPress={() => setShowDesktopLyricsPicker(true)}>
          <Ionicons name="desktop-outline" size={18} color={desktopLyricsMode !== 'off' ? '#EC4141' : '#94a3b8'} />
          <Text style={[styles.extraBtnText, desktopLyricsMode !== 'off' && styles.extraBtnActive]}>桌面歌词</Text>
        </TouchableOpacity>
      </View>

      {/* Sleep timer modal */}
      <Modal visible={showTimer} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>定时关闭</Text>
              <TouchableOpacity onPress={() => setShowTimer(false)}>
                <Ionicons name="close" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <View style={styles.timerGrid}>
              {TIMER_OPTIONS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.timerOption, timerMinutes === m && styles.timerOptionActive]}
                  onPress={() => handleSetTimer(m)}
                >
                  <Text style={[styles.timerOptionText, timerMinutes === m && styles.timerOptionTextActive]}>
                    {m} 分钟
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.timerOption}
                onPress={() => handleSetTimer(null)}
              >
                <Text style={[styles.timerOptionText, { color: '#94a3b8' }]}>取消定时</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add to playlist modal */}
      {currentSong && (
        <AddToPlaylistModal
          song={currentSong}
          visible={showAddToPlaylist}
          onClose={() => setShowAddToPlaylist(false)}
        />
      )}

      {/* Playing queue modal */}
      <PlayingQueueModal
        visible={showPlayingQueue}
        onClose={() => setShowPlayingQueue(false)}
      />

      {/* Desktop lyrics toggle */}
      <Modal visible={showDesktopLyricsPicker} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>桌面歌词</Text>
              <TouchableOpacity onPress={() => setShowDesktopLyricsPicker(false)}>
                <Ionicons name="close" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>在屏幕悬浮窗显示当前播放歌词</Text>
            {([
              { mode: 'off' as const, icon: 'close-circle-outline' as const, label: '关闭' },
              { mode: 'float' as const, icon: 'phone-portrait-outline' as const, label: '开启悬浮窗歌词' },
            ] as const).map((opt) => (
              <TouchableOpacity
                key={opt.mode}
                style={[styles.timerOption, desktopLyricsMode === opt.mode && styles.timerOptionActive, { marginBottom: 8, width: '100%' }]}
                onPress={() => {
                  setDesktopLyricsMode(opt.mode)
                  setShowDesktopLyricsPicker(false)
                  if (opt.mode === 'float') showToast('已开启悬浮窗歌词')
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name={opt.icon} size={20} color={desktopLyricsMode === opt.mode ? '#fff' : '#1e293b'} />
                  <Text style={[styles.timerOptionText, desktopLyricsMode === opt.mode && styles.timerOptionTextActive]}>
                    {opt.label}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: '#1e293b', marginHorizontal: 12 },
  timerBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6, backgroundColor: '#ede9fe', marginHorizontal: 16, borderRadius: 20, marginBottom: 4 },
  timerText: { fontSize: 12, color: '#EC4141', fontWeight: '500' },
  coverContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  viewSwitcher: { flex: 1 },
  hiddenView: { opacity: 0 },
  // Vinyl disc styles
  vinylContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  vinylDisc: {
    width: 260,
    height: 260,
  },
  vinylOuter: {
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  vinylGroove1: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  vinylGroove2: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  vinylCenter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: 'hidden',
    backgroundColor: '#EC4141',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  coverPlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#EC4141',
    alignItems: 'center',
    justifyContent: 'center',
  },
  songMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24 },
  songTitle: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', flex: 1 },
  songArtist: { fontSize: 16, color: '#64748b', marginTop: 4, textAlign: 'center' },
  progressContainer: { paddingHorizontal: 32, marginBottom: 12 },
  bufferingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 },
  bufferingText: { fontSize: 12, color: '#EC4141' },
  progressBar: { height: 28, borderRadius: 14, overflow: 'hidden', justifyContent: 'center', position: 'relative' },
  progressTrack: { height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, position: 'absolute', top: 12, left: 0, right: 0 },
  progressFill: { height: 4, backgroundColor: '#EC4141', borderRadius: 2, position: 'absolute', top: 12, left: 0,
    shadowColor: '#EC4141', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 2 },
  progressThumb: { position: 'absolute', top: 8, width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff',
    borderWidth: 2, borderColor: '#EC4141', marginLeft: -6,
    shadowColor: '#EC4141', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 3 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  timeText: { fontSize: 12, color: '#94a3b8' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 24, paddingBottom: 8 },
  playBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EC4141', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  extraControls: { flexDirection: 'row', justifyContent: 'center', gap: 32, paddingBottom: 24 },
  extraBtn: { alignItems: 'center', gap: 2 },
  extraBtnText: { fontSize: 11, color: '#94a3b8' },
  extraBtnActive: { color: '#EC4141' },
  lyricsContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  lyricModeBar: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 20, paddingVertical: 6 },
  lyricModeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#f1f5f9', borderRadius: 12 },
  lyricModeText: { fontSize: 12, color: '#EC4141', fontWeight: '500' },
  moodCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 8, padding: 12, backgroundColor: '#fef3c7', borderRadius: 10, gap: 10 },
  moodEmoji: { fontSize: 28 },
  moodInfo: { flex: 1 },
  moodLabel: { fontSize: 14, fontWeight: '600', color: '#92400e' },
  moodCommentary: { fontSize: 12, color: '#a16207', marginTop: 2 },
  noLyricsContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  noLyricsText: { fontSize: 14, color: '#94a3b8' },
  lyricLine: { height: LYRIC_LINE_HEIGHT, justifyContent: 'center' },
  lyricText: { fontSize: 16, color: '#94a3b8', textAlign: 'center' },
  lyricActive: { fontSize: 18, color: '#EC4141', fontWeight: 'bold' },
  translationText: { fontSize: 13, color: '#cbd5e1', textAlign: 'center', marginTop: 2 },
  translationActive: { color: '#fca5a5' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '80%', maxWidth: 360 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  timerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timerOption: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f1f5f9', borderRadius: 10 },
  timerOptionActive: { backgroundColor: '#EC4141' },
  timerOptionText: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  timerOptionTextActive: { color: '#fff' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#64748b', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#94a3b8', marginTop: 6 },
  emptyBtn: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#EC4141', borderRadius: 24 },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
