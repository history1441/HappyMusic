import { useState, useEffect, useRef } from 'react'
import { useIsMobile } from '../hooks/useBreakpoint'
import api from '../services/api'
import { Gamepad2, CheckCircle, XCircle, Trophy, RotateCcw, Zap, Volume2 } from 'lucide-react'

interface Question {
  question_id: string
  song_name: string
  singers: string
  cover_url: string
  clip_url: string
  options: string[]
  correct_index: number
  difficulty: string
}

interface Result {
  correct: boolean
  correct_answer: string
  score: number
  streak: number
}

type GameState = 'menu' | 'playing' | 'answered' | 'gameover'

export default function GuessGame() {
  const isMobile = useIsMobile()
  const [state, setState] = useState<GameState>('menu')
  const [question, setQuestion] = useState<Question | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [round, setRound] = useState(0)
  const [totalCorrect, setTotalCorrect] = useState(0)
  const [difficulty, setDifficulty] = useState('normal')
  const [selected, setSelected] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [timeLeft, setTimeLeft] = useState(15)
  const audioRef = useRef<HTMLAudioElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined)
  const startTimeRef = useRef(0)

  const maxRounds = 10

  const startGame = async () => {
    setLoading(true)
    setState('playing')
    setScore(0)
    setStreak(0)
    setRound(0)
    setTotalCorrect(0)
    await nextQuestion()
    setLoading(false)
  }

  const nextQuestion = async () => {
    setSelected(null)
    setResult(null)
    setTimeLeft(15)
    try {
      const { data } = await api.get('/game/start', { params: { difficulty } })
      setQuestion(data)
      setRound((r) => r + 1)
      startTimeRef.current = Date.now()

      // Start timer
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current)
            handleTimeout()
            return 0
          }
          return t - 1
        })
      }, 1000)
    } catch {
      setState('menu')
    }
  }

  const handleTimeout = () => {
    if (!question || selected !== null) return
    submitAnswer(-1)
  }

  const submitAnswer = async (idx: number) => {
    if (!question || selected !== null) return
    setSelected(idx)
    if (timerRef.current) clearInterval(timerRef.current)

    const timeMs = Date.now() - startTimeRef.current
    try {
      const { data } = await api.post('/game/answer', {
        question_id: question.question_id,
        answer_index: idx,
        time_ms: timeMs,
      })
      setResult(data)
      setScore(data.score)
      setStreak(data.streak)
      if (data.correct) setTotalCorrect((c) => c + 1)
    } catch {
      // ignore
    }
    setState('answered')
  }

  const handleNext = () => {
    if (round >= maxRounds) {
      setState('gameover')
    } else {
      setState('playing')
      nextQuestion()
    }
  }

  const playClip = () => {
    if (!question?.clip_url || !audioRef.current) return
    audioRef.current.src = question.clip_url
    audioRef.current.currentTime = 0
    audioRef.current.play()
    setPlaying(true)
  }

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // Menu
  if (state === 'menu') {
    return (
      <div style={{ padding: isMobile ? '16px' : '24px 32px', paddingBottom: isMobile ? 132 : 120 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <Gamepad2 size={24} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: 24, fontWeight: 700 }}>猜歌游戏</h2>
        </div>

        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎵</div>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>听听猜猜</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
            播放歌曲片段，从四个选项中猜出正确歌名
          </p>

          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>选择难度</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {[
                { key: 'easy', label: '简单', desc: '15秒' },
                { key: 'normal', label: '普通', desc: '8秒' },
                { key: 'hard', label: '困难', desc: '3秒' },
              ].map((d) => (
                <button key={d.key} onClick={() => setDifficulty(d.key)} style={{
                  padding: '12px 24px', borderRadius: 'var(--radius)',
                  background: difficulty === d.key ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: difficulty === d.key ? '#fff' : 'var(--text-secondary)',
                  border: `2px solid ${difficulty === d.key ? 'var(--accent)' : 'var(--border)'}`,
                  cursor: 'pointer',
                }}>
                  <div style={{ fontWeight: 600 }}>{d.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={startGame} disabled={loading} style={{
            padding: '14px 48px', background: 'var(--accent)',
            border: 'none', borderRadius: 'var(--radius-sm)',
            color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 16,
          }}>
            {loading ? '准备中...' : '开始游戏'}
          </button>
        </div>
      </div>
    )
  }

  // Game Over
  if (state === 'gameover') {
    const accuracy = round > 0 ? Math.round((totalCorrect / round) * 100) : 0
    return (
      <div style={{ padding: isMobile ? '16px' : '24px 32px', paddingBottom: isMobile ? 132 : 120, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <Trophy size={48} style={{ color: '#FFD700', marginBottom: 16 }} />
        <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>游戏结束</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, margin: '24px 0' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{score}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>总分</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{totalCorrect}/{round}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>正确</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{accuracy}%</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>准确率</div>
          </div>
        </div>
        <button onClick={() => setState('menu')} style={{
          padding: '12px 36px', background: 'var(--accent)',
          border: 'none', borderRadius: 'var(--radius-sm)',
          color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 15,
        }}>
          再来一局
        </button>
      </div>
    )
  }

  // Playing / Answered
  return (
    <div style={{ padding: isMobile ? '16px' : '24px 32px', paddingBottom: isMobile ? 132 : 120, maxWidth: 560, margin: '0 auto' }}>
      <audio ref={audioRef} onEnded={() => setPlaying(false)} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>第 {round}/{maxRounds} 题</span>
          {streak > 1 && (
            <span style={{
              padding: '2px 8px', background: '#FF9500', color: '#fff',
              borderRadius: 10, fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 2,
            }}>
              <Zap size={10} />{streak}连击
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>得分: {score}</span>
          <span style={{
            padding: '4px 10px', borderRadius: 'var(--radius-sm)',
            background: timeLeft <= 5 ? '#FF3B30' : 'var(--bg-secondary)',
            color: timeLeft <= 5 ? '#fff' : 'var(--text-primary)',
            fontSize: 14, fontWeight: 700, fontFamily: 'monospace',
          }}>
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Play button */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <button onClick={playClip} style={{
          width: 80, height: 80, borderRadius: '50%',
          background: playing ? 'var(--bg-secondary)' : 'var(--accent)',
          border: 'none', cursor: 'pointer', color: playing ? 'var(--text-secondary)' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto', transition: 'all 0.2s',
        }}>
          <Volume2 size={32} />
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
          {playing ? '正在播放...' : '点击播放片段'}
        </p>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {question?.options.map((opt, i) => {
          const isCorrect = i === question?.correct_index
          const isSelected = i === selected
          let bg = 'var(--card)'
          let border = 'var(--border)'
          let color = 'var(--text-primary)'
          if (state === 'answered') {
            if (isCorrect) { bg = 'rgba(52, 199, 89, 0.1)'; border = '#34C759'; color = '#34C759' }
            else if (isSelected && !isCorrect) { bg = 'rgba(255, 59, 48, 0.1)'; border = '#FF3B30'; color = '#FF3B30' }
          }
          return (
            <button key={i} disabled={selected !== null} onClick={() => submitAnswer(i)} style={{
              padding: '14px 18px', borderRadius: 'var(--radius-sm)',
              background: bg, border: `2px solid ${border}`,
              color, cursor: selected !== null ? 'default' : 'pointer',
              fontSize: 14, fontWeight: 500, textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{
                width: 28, height: 28, borderRadius: '50%',
                background: state === 'answered' && isCorrect ? '#34C759' :
                  state === 'answered' && isSelected && !isCorrect ? '#FF3B30' : 'var(--bg-tertiary)',
                color: state === 'answered' ? '#fff' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>
                {state === 'answered' && isCorrect ? <CheckCircle size={16} /> :
                  state === 'answered' && isSelected && !isCorrect ? <XCircle size={16} /> :
                  String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          )
        })}
      </div>

      {/* Result & next */}
      {state === 'answered' && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <div style={{
            fontSize: 16, fontWeight: 700,
            color: result?.correct ? '#34C759' : '#FF3B30',
            marginBottom: 12,
          }}>
            {result?.correct ? '回答正确!' : '答错了...'}
          </div>
          <button onClick={handleNext} style={{
            padding: '10px 32px', background: 'var(--accent)',
            border: 'none', borderRadius: 'var(--radius-sm)',
            color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14,
            display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto',
          }}>
            {round >= maxRounds ? '查看结果' : <><RotateCcw size={14} />下一题</>}
          </button>
        </div>
      )}
    </div>
  )
}
