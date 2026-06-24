import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  ScrollView, Modal, RefreshControl,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import TrackPlayer from 'react-native-track-player'
import { useHeaderPadding } from '../hooks/useHeaderPadding'
import { setGameMode } from '../services/playbackService'
import { usePlayerStore } from '../stores/playerStore'
import { useAuthStore } from '../stores/authStore'
import { getDB } from '../database/schema'
import api from '../services/api'

type GameState = 'menu' | 'playing' | 'choosing' | 'answered' | 'gameover'
type Difficulty = 'easy' | 'normal' | 'hard'

interface LocalSong {
  song_name: string
  singers: string
  file_path: string
  duration: number
  source: string
  song_identifier: string
}

interface LocalQuestion {
  correctSong: LocalSong
  options: string[]
  correct_index: number
  startOffset: number
}

interface SavedPlayerState {
  song: any | null
  position: number
  isPlaying: boolean
  queue: any[]
  queueIndex: number
  playMode: string
}

interface LeaderboardItem {
  rank: number
  username: string
  score: number
  total_questions: number
  correct_count: number
  best_streak: number
  difficulty: string
  created_at: string
}

const DIFFICULTIES: { key: Difficulty; label: string; time: number; answerTime: number }[] = [
  { key: 'easy', label: '简单', time: 15, answerTime: 15 },
  { key: 'normal', label: '普通', time: 8, answerTime: 10 },
  { key: 'hard', label: '困难', time: 3, answerTime: 5 },
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function songKey(s: LocalSong) {
  return `${s.source}_${s.song_identifier}`
}

async function loadLocalSongs(): Promise<LocalSong[]> {
  const db = await getDB()
  const downloads = await db.getAllAsync<LocalSong>(
    'SELECT song_name, singers, file_path, duration, source, song_identifier FROM downloads ORDER BY downloaded_at DESC'
  )
  const cache = await db.getAllAsync<LocalSong>(
    'SELECT song_name, singers, file_path, duration, source, song_identifier FROM cache ORDER BY last_played_at DESC'
  )
  const seen = new Set<string>()
  const all: LocalSong[] = []
  for (const s of [...downloads, ...cache]) {
    const k = songKey(s)
    if (!seen.has(k)) {
      seen.add(k)
      all.push(s)
    }
  }
  return all
}

function generateQuestion(songs: LocalSong[], usedKeys: Set<string>, timeLimit: number): LocalQuestion | null {
  const available = songs.filter(s => !usedKeys.has(songKey(s)))
  if (available.length < 4) return null

  const correct = available[Math.floor(Math.random() * available.length)]
  const others = songs.filter(s => songKey(s) !== songKey(correct))
  const distractors = shuffle(others).slice(0, 3)

  const options = shuffle([
    { text: `${correct.song_name} - ${correct.singers}`, isCorrect: true },
    ...distractors.map(d => ({ text: `${d.song_name} - ${d.singers}`, isCorrect: false })),
  ])

  const correct_index = options.findIndex(o => o.isCorrect)

  const dur = correct.duration || 180
  const margin = 20
  const minStart = margin
  const maxStart = Math.max(minStart, dur - margin - timeLimit)
  const startOffset = minStart + Math.random() * (maxStart - minStart)

  return {
    correctSong: correct,
    options: options.map(o => o.text),
    correct_index,
    startOffset: Math.floor(startOffset),
  }
}

export default function GuessGameScreen() {
  const navigation = useNavigation()
  const headerPad = useHeaderPadding()
  const user = useAuthStore(s => s.user)

  const [gameState, setGameState] = useState<GameState>('menu')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [timeLimit, setTimeLimit] = useState(8)
  const [answerTimeLimit, setAnswerTimeLimit] = useState(10)
  const [question, setQuestion] = useState<LocalQuestion | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isCorrect, setIsCorrect] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [songCount, setSongCount] = useState(0)

  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardItem[]>([])
  const [lbLoading, setLbLoading] = useState(false)
  const [lbDifficulty, setLbDifficulty] = useState<Difficulty>('normal')

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedPlayerRef = useRef<SavedPlayerState | null>(null)
  const songsRef = useRef<LocalSong[]>([])
  const usedKeysRef = useRef<Set<string>>(new Set())
  const questionStartRef = useRef<number>(0)

  useEffect(() => {
    loadLocalSongs().then(songs => {
      songsRef.current = songs
      setSongCount(songs.length)
    })
  }, [])

  const fetchLeaderboard = useCallback(async (diff?: Difficulty) => {
    const d = diff || lbDifficulty
    setLbLoading(true)
    try {
      const { data } = await api.get('/game/leaderboard', { params: { difficulty: d } })
      setLeaderboardData(data)
    } catch {
      setLeaderboardData([])
    } finally {
      setLbLoading(false)
    }
  }, [lbDifficulty])

  const submitScore = useCallback(async (s: number, total: number, correct: number, streak: number, diff: string) => {
    if (!user || s <= 0) return
    try {
      await api.post('/game/score', {
        score: s, total_questions: total, correct_count: correct,
        best_streak: streak, difficulty: diff,
      })
    } catch {}
  }, [user])

  const clearGameTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const saveAndPauseMainPlayer = useCallback(async () => {
    if (savedPlayerRef.current) return
    const s = usePlayerStore.getState()
    if (!s.currentSong) return
    savedPlayerRef.current = {
      song: s.currentSong, position: s.position, isPlaying: s.isPlaying,
      queue: s.queue, queueIndex: s.queueIndex, playMode: s.playMode,
    }
    try { await TrackPlayer.pause() } catch {}
    setGameMode(true)
  }, [])

  const restoreMainPlayer = useCallback(async () => {
    setGameMode(false)
    const saved = savedPlayerRef.current
    if (!saved || !saved.song) return
    savedPlayerRef.current = null
    try {
      await TrackPlayer.reset()
      await TrackPlayer.add({
        id: `${saved.song.source}_${saved.song.song_identifier}`,
        url: saved.song.download_url || '',
        title: saved.song.song_name, artist: saved.song.singers,
        artwork: saved.song.cover_url || undefined,
        duration: saved.song.duration_s || 0,
      })
      if (saved.position > 0) await TrackPlayer.seekTo(saved.position)
      if (saved.isPlaying) await TrackPlayer.play()
    } catch (e) {
      console.warn('restoreMainPlayer failed:', e)
    }
  }, [])

  useEffect(() => {
    return () => {
      clearGameTimer()
      stopClip()
      restoreMainPlayer()
    }
  }, [clearGameTimer, restoreMainPlayer])

  const stopClip = useCallback(async () => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current)
      autoStopRef.current = null
    }
    try {
      await TrackPlayer.pause()
      await TrackPlayer.reset()
    } catch {}
    setIsPlaying(false)
  }, [])

  const handleTimeout = useCallback(() => {
    stopClip()
    setIsCorrect(false)
    setStreak(0)
    setGameState('answered')
  }, [stopClip])

  const showOptionsAndStartCountdown = useCallback(() => {
    setIsPlaying(false)
    setGameState('choosing')
    questionStartRef.current = Date.now()

    clearGameTimer()
    setCountdown(answerTimeLimit)
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearGameTimer()
          handleTimeout()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [answerTimeLimit, clearGameTimer, handleTimeout])

  const playClip = useCallback(async () => {
    if (!question) return
    try {
      await stopClip()
      setGameMode(true)
      setIsPlaying(true)

      await TrackPlayer.reset()
      await TrackPlayer.add({
        id: `game_${songKey(question.correctSong)}`,
        url: question.correctSong.file_path,
        title: '猜歌片段',
        artist: '',
      })
      await TrackPlayer.play()
      await TrackPlayer.seekTo(question.startOffset)

      autoStopRef.current = setTimeout(() => {
        autoStopRef.current = null
        showOptionsAndStartCountdown()
      }, timeLimit * 1000)
    } catch (e) {
      console.warn('playClip error:', e)
      setIsPlaying(false)
    }
  }, [question, timeLimit, stopClip, showOptionsAndStartCountdown])

  const startGame = async () => {
    const songs = songsRef.current
    if (songs.length < 4) {
      Alert.alert('歌曲不足', `需要至少 4 首本地歌曲才能开始游戏\n当前仅有 ${songs.length} 首`)
      return
    }

    setLoading(true)
    try {
      await saveAndPauseMainPlayer()
      const fresh = await loadLocalSongs()
      songsRef.current = fresh
      usedKeysRef.current = new Set()

      const diff = DIFFICULTIES.find(d => d.key === difficulty)!
      setTimeLimit(diff.time)
      setAnswerTimeLimit(diff.answerTime)

      const q = generateQuestion(fresh, usedKeysRef.current, diff.time)
      if (!q) {
        Alert.alert('歌曲不足', '需要至少 4 首不同的本地歌曲')
        setLoading(false)
        return
      }

      usedKeysRef.current.add(songKey(q.correctSong))
      setQuestion(q)
      setScore(0)
      setStreak(0)
      setBestStreak(0)
      setTotalQuestions(1)
      setCorrectCount(0)
      setSelectedIndex(null)
      setGameState('playing')
    } catch (e: any) {
      Alert.alert('错误', '无法启动游戏')
    } finally {
      setLoading(false)
    }
  }

  const loadNextQuestion = useCallback(() => {
    const q = generateQuestion(songsRef.current, usedKeysRef.current, timeLimit)
    if (!q) {
      usedKeysRef.current = new Set()
      const retry = generateQuestion(songsRef.current, usedKeysRef.current, timeLimit)
      if (!retry) {
        Alert.alert('歌曲不足', '需要至少 4 首不同的本地歌曲')
        setGameState('gameover')
        return
      }
      setQuestion(retry)
      usedKeysRef.current.add(songKey(retry.correctSong))
    } else {
      setQuestion(q)
      usedKeysRef.current.add(songKey(q.correctSong))
    }

    setSelectedIndex(null)
    setTotalQuestions(prev => prev + 1)
    setGameState('playing')
  }, [timeLimit])

  const handleAnswer = useCallback((index: number) => {
    if (selectedIndex !== null || !question) return
    clearGameTimer()
    stopClip()

    const timeMs = Date.now() - questionStartRef.current
    setSelectedIndex(index)

    const correct = index === question.correct_index
    setIsCorrect(correct)

    if (correct) {
      const points = Math.max(10, Math.floor(100 - timeMs / 100))
      setScore(prev => prev + points)
      setStreak(prev => {
        const ns = prev + 1
        setBestStreak(best => Math.max(best, ns))
        return ns
      })
      setCorrectCount(prev => prev + 1)
    } else {
      setStreak(0)
    }

    setGameState('answered')
  }, [selectedIndex, question, clearGameTimer, stopClip])

  const handleNextQuestion = useCallback(() => {
    loadNextQuestion()
  }, [loadNextQuestion])

  const handleGameOver = useCallback(() => {
    stopClip()
    clearGameTimer()
    submitScore(score, totalQuestions, correctCount, bestStreak, difficulty)
    setGameState('gameover')
  }, [stopClip, clearGameTimer, score, totalQuestions, correctCount, bestStreak, difficulty, submitScore])

  const openLeaderboard = useCallback((diff?: Difficulty) => {
    const d = diff || difficulty
    setLbDifficulty(d)
    setShowLeaderboard(true)
    fetchLeaderboard(d)
  }, [difficulty, fetchLeaderboard])

  // Menu Screen
  if (gameState === 'menu') {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: headerPad }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>猜歌游戏</Text>
          <TouchableOpacity onPress={() => openLeaderboard()} style={{ padding: 4 }}>
            <Ionicons name="trophy-outline" size={22} color="#f59e0b" />
          </TouchableOpacity>
        </View>

        <View style={styles.menuContainer}>
          <Text style={styles.gameIcon}>🎵</Text>
          <Text style={styles.menuTitle}>听歌识曲</Text>
          <Text style={styles.menuSubtitle}>
            {songCount >= 4
              ? `本地曲库 ${songCount} 首歌曲`
              : `本地歌曲不足（${songCount}/4）`}
          </Text>

          {songCount < 4 && (
            <View style={styles.warningCard}>
              <Ionicons name="information-circle" size={20} color="#f59e0b" />
              <Text style={styles.warningText}>
                需要至少 4 首已下载或已缓存的歌曲才能开始游戏
              </Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>选择难度</Text>
          <View style={styles.difficultyContainer}>
            {DIFFICULTIES.map(d => (
              <TouchableOpacity
                key={d.key}
                style={[styles.difficultyButton, difficulty === d.key && styles.difficultyActive]}
                onPress={() => setDifficulty(d.key)}
              >
                <Text style={[styles.difficultyText, difficulty === d.key && styles.difficultyTextActive]}>
                  {d.label}
                </Text>
                <Text style={[styles.difficultySubText, difficulty === d.key && styles.difficultyTextActive]}>
                  片段{d.time}s · 答题{d.answerTime}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.startButton, songCount < 4 && styles.startButtonDisabled]}
            onPress={startGame}
            disabled={loading || songCount < 4}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.startButtonText}>开始游戏</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.leaderboardEntryButton}
            onPress={() => openLeaderboard()}
          >
            <Ionicons name="trophy" size={18} color="#f59e0b" />
            <Text style={styles.leaderboardEntryText}>排行榜</Text>
          </TouchableOpacity>
        </View>

        <LeaderboardModal
          visible={showLeaderboard}
          onClose={() => setShowLeaderboard(false)}
          data={leaderboardData}
          loading={lbLoading}
          difficulty={lbDifficulty}
          headerPad={headerPad}
          onDifficultyChange={(d) => { setLbDifficulty(d); fetchLeaderboard(d) }}
          onRefresh={() => fetchLeaderboard()}
        />
      </View>
    )
  }

  // Playing Screen — 只显示播放按钮，不显示选项
  if (gameState === 'playing') {
    return (
      <View style={styles.container}>
        <View style={styles.gameHeader}>
          <View style={styles.scoreSection}>
            <Text style={styles.scoreLabel}>得分</Text>
            <Text style={styles.scoreValue}>{score}</Text>
          </View>
          <View style={styles.questionSection}>
            <Text style={styles.questionNum}>第 {totalQuestions} 题</Text>
          </View>
          <View style={styles.streakSection}>
            <Text style={styles.scoreLabel}>连胜</Text>
            <Text style={styles.streakValue}>{streak}🔥</Text>
          </View>
        </View>

        <View style={styles.gameBody}>
          <TouchableOpacity
            style={[styles.playClipButton, isPlaying && styles.playClipButtonActive]}
            onPress={playClip}
            disabled={isPlaying}
          >
            <Ionicons
              name={isPlaying ? 'musical-notes' : 'play'}
              size={48}
              color="#fff"
            />
          </TouchableOpacity>
          <Text style={styles.clipHint}>
            {isPlaying ? '正在播放片段...' : '点击播放片段'}
          </Text>
          {isPlaying && (
            <View style={styles.playingIndicator}>
              <ActivityIndicator size="small" color="#EC4141" />
              <Text style={styles.playingHint}>片段播放中，请仔细听...</Text>
            </View>
          )}
        </View>
      </View>
    )
  }

  // Choosing / Answered Screen — 显示选项
  if (gameState === 'choosing' || gameState === 'answered') {
    return (
      <View style={styles.container}>
        <View style={styles.gameHeader}>
          <View style={styles.scoreSection}>
            <Text style={styles.scoreLabel}>得分</Text>
            <Text style={styles.scoreValue}>{score}</Text>
          </View>
          <View style={styles.countdownSection}>
            {gameState === 'choosing' ? (
              <Text style={[
                styles.countdownText,
                countdown <= 3 && styles.countdownUrgent,
              ]}>{countdown}s</Text>
            ) : (
              <Text style={styles.questionNum}>第 {totalQuestions} 题</Text>
            )}
          </View>
          <View style={styles.streakSection}>
            <Text style={styles.scoreLabel}>连胜</Text>
            <Text style={styles.streakValue}>{streak}🔥</Text>
          </View>
        </View>

        <View style={styles.gameBody}>
          {gameState === 'choosing' && (
            <Text style={styles.choosingHint}>听完了，请选择答案</Text>
          )}

          <View style={styles.optionsContainer}>
            {question?.options.map((option, idx) => {
              let optionStyle: any = styles.optionButton
              let textStyle: any = styles.optionText

              if (gameState === 'answered') {
                if (idx === question.correct_index) {
                  optionStyle = styles.optionCorrect
                  textStyle = styles.optionCorrectText
                } else if (idx === selectedIndex && !isCorrect) {
                  optionStyle = styles.optionWrong
                  textStyle = styles.optionWrongText
                } else {
                  optionStyle = styles.optionDisabled
                  textStyle = styles.optionDisabledText
                }
              }

              return (
                <TouchableOpacity
                  key={idx}
                  style={optionStyle}
                  onPress={() => handleAnswer(idx)}
                  disabled={gameState === 'answered' || selectedIndex !== null}
                >
                  <Text style={textStyle} numberOfLines={1}>{option}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {gameState === 'answered' && (
            <View style={styles.answerActions}>
              <Text style={[styles.resultText, { color: isCorrect ? '#22c55e' : '#ef4444' }]}>
                {isCorrect ? '回答正确！' : '回答错误'}
              </Text>
              {question && (
                <Text style={styles.answerSong}>
                  正确答案：{question.correctSong.song_name} - {question.correctSong.singers}
                </Text>
              )}
              <View style={styles.answerButtons}>
                <TouchableOpacity style={styles.nextButton} onPress={handleNextQuestion}>
                  <Text style={styles.nextButtonText}>下一题</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.endButton} onPress={handleGameOver}>
                  <Text style={styles.endButtonText}>结束游戏</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    )
  }

  // Gameover Screen
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: headerPad }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>游戏结束</Text>
        <TouchableOpacity onPress={() => openLeaderboard()} style={{ padding: 4 }}>
          <Ionicons name="trophy-outline" size={22} color="#f59e0b" />
        </TouchableOpacity>
      </View>

      <View style={styles.gameoverContainer}>
        <Text style={styles.gameoverEmoji}>🏆</Text>
        <Text style={styles.finalScore}>{score}</Text>
        <Text style={styles.finalScoreLabel}>最终得分</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{correctCount}/{totalQuestions}</Text>
            <Text style={styles.statLabel}>正确率</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%
            </Text>
            <Text style={styles.statLabel}>准确率</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{bestStreak}</Text>
            <Text style={styles.statLabel}>最佳连胜</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.replayButton} onPress={startGame}>
          <Text style={styles.replayButtonText}>再来一局</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setGameState('menu')}>
          <Text style={styles.backMenuText}>返回菜单</Text>
        </TouchableOpacity>
      </View>

      <LeaderboardModal
        visible={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        data={leaderboardData}
        loading={lbLoading}
        difficulty={lbDifficulty}
        headerPad={headerPad}
        onDifficultyChange={(d) => { setLbDifficulty(d); fetchLeaderboard(d) }}
        onRefresh={() => fetchLeaderboard()}
      />
    </View>
  )
}

// 排行榜 Modal 组件
function LeaderboardModal({
  visible, onClose, data, loading, difficulty, headerPad, onDifficultyChange, onRefresh,
}: {
  visible: boolean
  onClose: () => void
  data: LeaderboardItem[]
  loading: boolean
  difficulty: Difficulty
  headerPad: number
  onDifficultyChange: (d: Difficulty) => void
  onRefresh: () => void
}) {
  const rankColors = ['#f59e0b', '#94a3b8', '#cd7f32']

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={lbStyles.container}>
        <View style={[lbStyles.header, { paddingTop: headerPad }]}>
          <TouchableOpacity onPress={onClose} style={lbStyles.closeBtn}>
            <Ionicons name="close" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={lbStyles.title}>排行榜</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={lbStyles.diffRow}>
          {DIFFICULTIES.map(d => (
            <TouchableOpacity
              key={d.key}
              style={[lbStyles.diffBtn, difficulty === d.key && lbStyles.diffBtnActive]}
              onPress={() => onDifficultyChange(d.key)}
            >
              <Text style={[lbStyles.diffText, difficulty === d.key && lbStyles.diffTextActive]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={lbStyles.center}>
            <ActivityIndicator size="large" color="#EC4141" />
          </View>
        ) : data.length === 0 ? (
          <View style={lbStyles.center}>
            <Ionicons name="trophy-outline" size={48} color="#cbd5e1" />
            <Text style={lbStyles.emptyText}>暂无记录</Text>
            <Text style={lbStyles.emptyHint}>完成一局游戏后你的成绩将出现在这里</Text>
          </View>
        ) : (
          <ScrollView
            style={lbStyles.list}
            contentContainerStyle={{ paddingBottom: 32 }}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} colors={['#EC4141']} />}
          >
            {data.map(item => (
              <View key={item.rank} style={lbStyles.row}>
                <View style={[lbStyles.rankBadge, item.rank <= 3 && { backgroundColor: rankColors[item.rank - 1] + '20' }]}>
                  <Text style={[lbStyles.rankText, item.rank <= 3 && { color: rankColors[item.rank - 1] }]}>
                    {item.rank}
                  </Text>
                </View>
                <View style={lbStyles.userInfo}>
                  <Text style={lbStyles.userName}>{item.username}</Text>
                  <Text style={lbStyles.userMeta}>
                    {item.correct_count}/{item.total_questions} 正确 · 连胜 {item.best_streak}
                  </Text>
                </View>
                <View style={lbStyles.scoreInfo}>
                  <Text style={lbStyles.scoreNum}>{item.score}</Text>
                  <Text style={lbStyles.scoreDate}>{item.created_at}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  )
}

const lbStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  closeBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  diffRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  diffBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: '#f1f5f9' },
  diffBtnActive: { backgroundColor: '#EC4141' },
  diffText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  diffTextActive: { color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 16, color: '#94a3b8', fontWeight: '600' },
  emptyHint: { fontSize: 13, color: '#cbd5e1' },
  list: { flex: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  rankBadge: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  rankText: { fontSize: 14, fontWeight: 'bold', color: '#94a3b8' },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  userMeta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  scoreInfo: { alignItems: 'flex-end' },
  scoreNum: { fontSize: 18, fontWeight: 'bold', color: '#EC4141' },
  scoreDate: { fontSize: 11, color: '#cbd5e1', marginTop: 2 },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  menuContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  gameIcon: { fontSize: 64, marginBottom: 12 },
  menuTitle: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  menuSubtitle: { fontSize: 15, color: '#94a3b8', marginBottom: 16 },
  warningCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fefce8',
    borderWidth: 1, borderColor: '#fde68a', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 24, width: '100%', gap: 8,
  },
  warningText: { fontSize: 13, color: '#92400e', flex: 1 },
  sectionLabel: { fontSize: 14, color: '#64748b', fontWeight: '600', marginBottom: 12, alignSelf: 'flex-start' },
  difficultyContainer: { gap: 12, marginBottom: 40 },
  difficultyButton: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  difficultyActive: { backgroundColor: '#EC4141' },
  difficultyText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  difficultySubText: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  difficultyTextActive: { color: '#fff' },
  startButton: {
    backgroundColor: '#EC4141', paddingHorizontal: 48, paddingVertical: 14,
    borderRadius: 24, width: '100%', alignItems: 'center',
  },
  startButtonDisabled: { backgroundColor: '#cbd5e1' },
  startButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  leaderboardEntryButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#fefce8',
  },
  leaderboardEntryText: { fontSize: 14, color: '#92400e', fontWeight: '500' },
  gameHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  scoreSection: { alignItems: 'center' },
  scoreLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 2 },
  scoreValue: { fontSize: 22, fontWeight: 'bold', color: '#EC4141' },
  questionSection: { alignItems: 'center' },
  questionNum: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  countdownSection: { alignItems: 'center' },
  countdownText: { fontSize: 32, fontWeight: 'bold', color: '#1e293b' },
  countdownUrgent: { color: '#ef4444' },
  streakSection: { alignItems: 'center' },
  streakValue: { fontSize: 18, fontWeight: '600', color: '#f59e0b' },
  gameBody: { flex: 1, alignItems: 'center', paddingTop: 32, paddingHorizontal: 20 },
  playClipButton: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: '#EC4141',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    shadowColor: '#EC4141', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  playClipButtonActive: { backgroundColor: '#4f46e5' },
  clipHint: { fontSize: 14, color: '#94a3b8', marginBottom: 16 },
  playingIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#ede9fe', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16,
  },
  playingHint: { fontSize: 13, color: '#7c3aed' },
  choosingHint: {
    fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 24,
  },
  optionsContainer: { width: '100%', gap: 12 },
  optionButton: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
  },
  optionText: { fontSize: 15, color: '#1e293b', fontWeight: '500' },
  optionCorrect: {
    backgroundColor: '#dcfce7', borderWidth: 2, borderColor: '#22c55e',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
  },
  optionCorrectText: { fontSize: 15, color: '#16a34a', fontWeight: '600' },
  optionWrong: {
    backgroundColor: '#fef2f2', borderWidth: 2, borderColor: '#ef4444',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
  },
  optionWrongText: { fontSize: 15, color: '#dc2626', fontWeight: '600' },
  optionDisabled: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, opacity: 0.6,
  },
  optionDisabledText: { fontSize: 15, color: '#94a3b8' },
  answerActions: { width: '100%', alignItems: 'center', marginTop: 20, gap: 10 },
  resultText: { fontSize: 18, fontWeight: 'bold' },
  answerSong: { fontSize: 13, color: '#64748b' },
  answerButtons: { flexDirection: 'row', gap: 12 },
  nextButton: { backgroundColor: '#EC4141', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  nextButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  endButton: { backgroundColor: '#f1f5f9', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  endButtonText: { color: '#64748b', fontSize: 14, fontWeight: '500' },
  gameoverContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  gameoverEmoji: { fontSize: 64, marginBottom: 8 },
  finalScore: { fontSize: 48, fontWeight: 'bold', color: '#EC4141' },
  finalScoreLabel: { fontSize: 15, color: '#94a3b8', marginBottom: 32 },
  statsGrid: { flexDirection: 'row', gap: 16, marginBottom: 40 },
  statCard: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 16,
    alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, minWidth: 90,
  },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#94a3b8' },
  replayButton: {
    backgroundColor: '#EC4141', paddingHorizontal: 48, paddingVertical: 14,
    borderRadius: 24, marginBottom: 12,
  },
  replayButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  backMenuText: { color: '#EC4141', fontSize: 14 },
})
