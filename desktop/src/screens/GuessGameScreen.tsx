import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Play, Pause, Music, ArrowLeft, Trophy, ChevronRight } from 'lucide-react'
import api from '@common/services/api'
import { showToast } from '../components/Toast'

type GameState = 'menu' | 'playing' | 'answered' | 'gameover'
type Difficulty = 'easy' | 'normal' | 'hard'

interface Question {
  question_id: string
  clip_url: string
  options: string[]
  correct_index: number
}

const DIFFICULTIES: { key: Difficulty; label: string; time: number }[] = [
  { key: 'easy', label: '简单 15s', time: 15 },
  { key: 'normal', label: '普通 8s', time: 8 },
  { key: 'hard', label: '困难 3s', time: 3 },
]

export default function GuessGameScreen() {
  const navigate = useNavigate()

  const [gameState, setGameState] = useState<GameState>('menu')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [timeLimit, setTimeLimit] = useState(8)
  const [question, setQuestion] = useState<Question | null>(null)
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

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const questionStartRef = useRef<number>(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearGameTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearGameTimer()
      stopClip()
    }
  }, [clearGameTimer])

  const stopClip = useCallback(() => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current)
      autoStopRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setIsPlaying(false)
  }, [])

  const startGame = async () => {
    setLoading(true)
    try {
      const diff = DIFFICULTIES.find((d) => d.key === difficulty)!
      setTimeLimit(diff.time)
      await loadQuestion()
      setScore(0)
      setStreak(0)
      setBestStreak(0)
      setTotalQuestions(0)
      setCorrectCount(0)
      setGameState('playing')
    } catch {
      showToast('无法启动游戏', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadQuestion = async () => {
    try {
      const { data } = await api.get('/game/start', { params: { difficulty } })
      const q: Question = {
        question_id: data.question_id,
        clip_url: data.clip_url,
        options: data.options,
        correct_index: data.correct_index,
      }
      setQuestion(q)
      setSelectedIndex(null)
      setTotalQuestions((prev) => prev + 1)
      questionStartRef.current = Date.now()

      const diff = DIFFICULTIES.find((d) => d.key === difficulty)!
      setCountdown(diff.time)
      clearGameTimer()
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearGameTimer()
            handleTimeout()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch {
      showToast('加载题目失败', 'error')
      setGameState('menu')
    }
  }

  const handleTimeout = () => {
    stopClip()
    setIsCorrect(false)
    setStreak(0)
    setGameState('answered')
  }

  const handleAnswer = async (index: number) => {
    if (selectedIndex !== null || !question) return
    clearGameTimer()

    const timeMs = Date.now() - questionStartRef.current
    setSelectedIndex(index)

    try {
      await stopClip()
      const { data } = await api.post('/game/answer', {
        question_id: question.question_id,
        answer_index: index,
        time_ms: timeMs,
      })

      const correct = data.correct === true || data.correct_index === question.correct_index
      setIsCorrect(correct)

      if (correct) {
        const points = Math.max(10, Math.floor(100 - timeMs / 100))
        setScore((prev) => prev + points)
        setStreak((prev) => {
          const newStreak = prev + 1
          setBestStreak((best) => Math.max(best, newStreak))
          return newStreak
        })
        setCorrectCount((prev) => prev + 1)
      } else {
        setStreak(0)
      }
    } catch {
      const correct = index === question.correct_index
      setIsCorrect(correct)
      if (correct) {
        setScore((prev) => prev + 50)
        setStreak((prev) => prev + 1)
        setCorrectCount((prev) => prev + 1)
      } else {
        setStreak(0)
      }
    }

    setGameState('answered')
  }

  const handleNextQuestion = () => {
    loadQuestion()
    setGameState('playing')
  }

  const handleGameOver = () => {
    setGameState('gameover')
    stopClip()
  }

  const playClip = () => {
    if (!question?.clip_url) return
    try {
      stopClip()
      setIsPlaying(true)
      const audio = new Audio(question.clip_url)
      audioRef.current = audio
      audio.play().catch(() => setIsPlaying(false))
      autoStopRef.current = setTimeout(() => {
        audio.pause()
        audio.currentTime = 0
        audioRef.current = null
        autoStopRef.current = null
        setIsPlaying(false)
      }, timeLimit * 1000)
    } catch {
      setIsPlaying(false)
    }
  }

  // ── Menu ────────────────────────────────────────────────────────────────
  if (gameState === 'menu') {
    return (
      <div className="h-full flex flex-col bg-bg">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
          <button onClick={() => navigate(-1)} className="p-1 text-text hover:text-primary transition-colors">
            <ArrowLeft size={22} />
          </button>
          <span className="text-lg font-bold">猜歌游戏</span>
          <div className="w-6" />
        </div>

        {/* Menu body */}
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <span className="text-6xl mb-3">🎵</span>
          <h1 className="text-3xl font-bold text-text mb-1">听歌识曲</h1>
          <p className="text-text-secondary mb-10">听片段，猜歌名</p>

          <p className="text-sm text-text-secondary font-semibold self-start mb-3">选择难度</p>
          <div className="flex gap-3 mb-10">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.key}
                onClick={() => setDifficulty(d.key)}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-colors ${
                  difficulty === d.key
                    ? 'bg-primary text-white'
                    : 'bg-border-light text-text-secondary hover:bg-border'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <button
            onClick={startGame}
            disabled={loading}
            className="w-full max-w-xs bg-primary text-white px-12 py-3.5 rounded-full text-base font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <div className="spinner" /> : '开始游戏'}
          </button>
        </div>
      </div>
    )
  }

  // ── Playing / Answered ──────────────────────────────────────────────────
  if (gameState === 'playing' || gameState === 'answered') {
    return (
      <div className="h-full flex flex-col bg-bg">
        {/* Score header */}
        <div className="flex items-center justify-between px-5 py-4 bg-card border-b border-border">
          <div className="text-center">
            <p className="text-[11px] text-text-tertiary mb-0.5">得分</p>
            <p className="text-xl font-bold text-primary">{score}</p>
          </div>
          <p className="text-3xl font-bold text-text">{countdown}s</p>
          <div className="text-center">
            <p className="text-[11px] text-text-tertiary mb-0.5">连胜</p>
            <p className="text-lg font-semibold text-amber-500">{streak}🔥</p>
          </div>
        </div>

        {/* Game body */}
        <div className="flex-1 flex flex-col items-center pt-8 px-5">
          <button
            onClick={playClip}
            disabled={isPlaying}
            className={`w-24 h-24 rounded-full flex items-center justify-center mb-3 shadow-lg transition-colors ${
              isPlaying ? 'bg-indigo-600' : 'bg-primary'
            }`}
            style={{ boxShadow: isPlaying ? '0 4px 24px rgba(79,70,229,0.4)' : '0 4px 24px rgba(236,65,65,0.35)' }}
          >
            {isPlaying ? <Music size={36} className="text-white" /> : <Play size={36} className="text-white" />}
          </button>
          <p className="text-sm text-text-tertiary mb-8">点击播放片段</p>

          {/* Options */}
          <div className="w-full space-y-3">
            {question?.options.map((option, idx) => {
              let cls = 'bg-card border border-border hover:border-primary/40'
              let textCls = 'text-text'
              if (gameState === 'answered') {
                if (idx === question.correct_index) {
                  cls = 'bg-green-50 dark:bg-green-950/30 border-2 border-green-500'
                  textCls = 'text-green-700 dark:text-green-400 font-semibold'
                } else if (idx === selectedIndex && !isCorrect) {
                  cls = 'bg-red-50 dark:bg-red-950/30 border-2 border-red-500'
                  textCls = 'text-red-700 dark:text-red-400 font-semibold'
                } else {
                  cls = 'bg-bg border border-border opacity-50'
                  textCls = 'text-text-tertiary'
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={gameState === 'answered' || selectedIndex !== null}
                  className={`w-full px-4 py-3.5 rounded-xl text-left transition-colors ${cls}`}
                >
                  <span className={`text-sm truncate ${textCls}`}>{option}</span>
                </button>
              )
            })}
          </div>

          {gameState === 'answered' && (
            <div className="w-full flex flex-col items-center mt-5 gap-3">
              <p className={`text-lg font-bold ${isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                {isCorrect ? '回答正确！' : '回答错误'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleNextQuestion}
                  className="px-6 py-2.5 rounded-full bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  下一题
                </button>
                <button
                  onClick={handleGameOver}
                  className="px-6 py-2.5 rounded-full bg-border-light text-text-secondary text-sm font-medium hover:bg-border transition-colors"
                >
                  结束游戏
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Game Over ───────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <button onClick={() => navigate(-1)} className="p-1 text-text hover:text-primary transition-colors">
          <ArrowLeft size={22} />
        </button>
        <span className="text-lg font-bold">游戏结束</span>
        <div className="w-6" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <Trophy size={56} className="text-amber-400 mb-2" />
        <p className="text-5xl font-bold text-primary">{score}</p>
        <p className="text-sm text-text-tertiary mt-1 mb-8">最终得分</p>

        <div className="flex gap-4 mb-10">
          <StatCard value={`${correctCount}/${totalQuestions}`} label="正确率" />
          <StatCard value={`${totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%`} label="准确率" />
          <StatCard value={String(bestStreak)} label="最佳连胜" />
        </div>

        <button
          onClick={startGame}
          className="w-full max-w-xs bg-primary text-white px-12 py-3.5 rounded-full text-base font-semibold hover:bg-primary/90 transition-colors mb-3"
        >
          再来一局
        </button>
        <button
          onClick={() => setGameState('menu')}
          className="text-primary text-sm hover:underline"
        >
          返回菜单
        </button>
      </div>
    </div>
  )
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-card border border-border rounded-xl px-5 py-4 flex flex-col items-center min-w-[90px] shadow-sm">
      <span className="text-xl font-bold text-text mb-1">{value}</span>
      <span className="text-xs text-text-tertiary">{label}</span>
    </div>
  )
}
