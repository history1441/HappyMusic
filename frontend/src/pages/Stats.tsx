import { useState, useEffect } from 'react'
import { useIsMobile } from '../hooks/useBreakpoint'
import api from '../services/api'
import { BarChart3, Trophy, Radar, Calendar, Music, Clock, Users, Disc3, TrendingUp } from 'lucide-react'

type Tab = 'overview' | 'ranking' | 'radar' | 'annual'

interface Summary {
  total_plays: number; total_time_hours: number; unique_songs: number; unique_artists: number
  top_song: string | null; top_artist: string | null; top_source: string | null
}
interface RankItem { name: string; count: number; extra: string }
interface PrefDim { label: string; value: number }
interface MonthlyData { month: string; plays: number; hours: number }
interface AnnualReport {
  year: number; total_plays: number; total_hours: number; unique_songs: number; unique_artists: number
  top_songs: RankItem[]; top_artists: RankItem[]; monthly: MonthlyData[]; source_distribution: RankItem[]
}

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      padding: 20, background: 'var(--card)', borderRadius: 'var(--radius)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={18} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function BarChart({ data, maxBars = 10 }: { data: RankItem[]; maxBars?: number }) {
  const items = data.slice(0, maxBars)
  const max = Math.max(...items.map((d) => d.count), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 24, fontSize: 13, color: i < 3 ? 'var(--accent)' : 'var(--text-tertiary)', fontWeight: 700, textAlign: 'right' }}>
            {i + 1}
          </span>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>{item.count}次</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${(item.count / max) * 100}%`,
                background: i < 3 ? 'var(--accent)' : 'var(--text-tertiary)',
                borderRadius: 3, transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>
          暂无数据，播放一些歌曲吧
        </div>
      )}
    </div>
  )
}

function RadarChart({ dims }: { dims: PrefDim[] }) {
  const cx = 150, cy = 150, r = 110
  const n = dims.length
  if (n < 3) return <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)' }}>数据不足，至少需要3个维度</div>

  const angleStep = (Math.PI * 2) / n
  const points = dims.map((d, i) => {
    const angle = angleStep * i - Math.PI / 2
    const val = Math.min(d.value, 100) / 100
    return { x: cx + r * val * Math.cos(angle), y: cy + r * val * Math.sin(angle), ...d }
  })
  const gridPoints = (level: number) => dims.map((_, i) => {
    const angle = angleStep * i - Math.PI / 2
    return { x: cx + r * level * Math.cos(angle), y: cy + r * level * Math.sin(angle) }
  })

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
      <svg width={300} height={300} viewBox="0 0 300 300">
        {[0.25, 0.5, 0.75, 1].map((level) => (
          <polygon key={level}
            points={gridPoints(level).map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none" stroke="var(--border)" strokeWidth={1}
          />
        ))}
        {dims.map((_, i) => {
          const angle = angleStep * i - Math.PI / 2
          const ex = cx + (r + 20) * Math.cos(angle)
          const ey = cy + (r + 20) * Math.sin(angle)
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={cx + r * Math.cos(angle)} y2={cy + r * Math.sin(angle)} stroke="var(--border)" strokeWidth={1} />
              <text x={ex} y={ey} textAnchor="middle" dominantBaseline="middle" fill="var(--text-secondary)" fontSize={10}>
                {dims[i].label}
              </text>
            </g>
          )
        })}
        <polygon
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="rgba(252, 60, 68, 0.15)" stroke="var(--accent)" strokeWidth={2}
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill="var(--accent)" />
        ))}
      </svg>
    </div>
  )
}

function MonthlyChart({ data }: { data: MonthlyData[] }) {
  const max = Math.max(...data.map((d) => d.plays), 1)
  const months = Array.from({ length: 12 }, (_, i) => `${String(i + 1).padStart(2, '0')}`)
  const map = new Map(data.map((d) => [d.month, d]))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, padding: '0 8px' }}>
      {months.map((m) => {
        const d = map.get(m)
        const h = d ? (d.plays / max) * 100 : 0
        return (
          <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{d?.plays || ''}</div>
            <div style={{
              width: '100%', height: Math.max(h, 2), background: h > 0 ? 'var(--accent)' : 'var(--bg-tertiary)',
              borderRadius: 2, transition: 'height 0.3s',
            }} />
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{m}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function Stats() {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<Tab>('overview')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [songRank, setSongRank] = useState<RankItem[]>([])
  const [artistRank, setArtistRank] = useState<RankItem[]>([])
  const [sourceRank, setSourceRank] = useState<RankItem[]>([])
  const [prefs, setPrefs] = useState<PrefDim[]>([])
  const [annual, setAnnual] = useState<AnnualReport | null>(null)
  const [rankType, setRankType] = useState<'song' | 'artist' | 'source'>('song')

  useEffect(() => {
    api.get('/stats/summary').then(({ data }) => setSummary(data))
    api.get('/stats/ranking', { params: { type: 'song' } }).then(({ data }) => setSongRank(data))
    api.get('/stats/ranking', { params: { type: 'artist' } }).then(({ data }) => setArtistRank(data))
    api.get('/stats/ranking', { params: { type: 'source' } }).then(({ data }) => setSourceRank(data))
    api.get('/stats/preferences').then(({ data }) => setPrefs(data))
    api.get('/stats/annual-report').then(({ data }) => setAnnual(data))
  }, [])

  const tabs: { key: Tab; icon: any; label: string }[] = [
    { key: 'overview', icon: BarChart3, label: '概览' },
    { key: 'ranking', icon: Trophy, label: '排行' },
    { key: 'radar', icon: Radar, label: '偏好' },
    { key: 'annual', icon: Calendar, label: '年度报告' },
  ]

  const rankData = rankType === 'song' ? songRank : rankType === 'artist' ? artistRank : sourceRank

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 32px', paddingBottom: isMobile ? 132 : 120 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <BarChart3 size={24} style={{ color: 'var(--accent)' }} />
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>听歌统计</h2>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {tabs.map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 'var(--radius-sm)',
            background: tab === key ? 'var(--accent)' : 'var(--bg-secondary)',
            color: tab === key ? '#fff' : 'var(--text-secondary)',
            border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {tab === 'overview' && summary && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <StatCard icon={Music} label="总播放" value={summary.total_plays} sub="首歌曲" />
            <StatCard icon={Clock} label="听歌时长" value={`${summary.total_time_hours}h`} />
            <StatCard icon={Disc3} label="不同歌曲" value={summary.unique_songs} />
            <StatCard icon={Users} label="不同歌手" value={summary.unique_artists} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <StatCard icon={TrendingUp} label="最爱歌曲" value={summary.top_song || '--'} />
            <StatCard icon={Users} label="最爱歌手" value={summary.top_artist || '--'} />
            <StatCard icon={Disc3} label="常用来源" value={summary.top_source || '--'} />
          </div>
        </div>
      )}

      {tab === 'ranking' && (
        <div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
            {(['song', 'artist', 'source'] as const).map((t) => (
              <button key={t} onClick={() => setRankType(t)} style={{
                padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                background: rankType === t ? 'var(--accent)' : 'var(--bg-secondary)',
                color: rankType === t ? '#fff' : 'var(--text-secondary)',
                border: 'none', cursor: 'pointer', fontSize: 13,
              }}>
                {t === 'song' ? '歌曲' : t === 'artist' ? '歌手' : '来源'}
              </button>
            ))}
          </div>
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', padding: 20, border: '1px solid var(--border)' }}>
            <BarChart data={rankData} />
          </div>
        </div>
      )}

      {tab === 'radar' && (
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', padding: 24, border: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 600, marginBottom: 16 }}>音乐偏好雷达图</h3>
          <RadarChart dims={prefs} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 16 }}>
            {prefs.map((d) => (
              <div key={d.label} style={{ padding: 8, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{d.value}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'annual' && annual && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h3 style={{ fontSize: 28, fontWeight: 800 }}>{annual.year} 年度音乐报告</h3>
            <p style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>你的音乐之旅</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <StatCard icon={Music} label="播放次数" value={annual.total_plays} />
            <StatCard icon={Clock} label="总时长" value={`${annual.total_hours}h`} />
            <StatCard icon={Disc3} label="歌曲数" value={annual.unique_songs} />
            <StatCard icon={Users} label="歌手数" value={annual.unique_artists} />
          </div>
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', padding: 20, border: '1px solid var(--border)', marginBottom: 24 }}>
            <h4 style={{ fontWeight: 600, marginBottom: 12 }}>月度趋势</h4>
            <MonthlyChart data={annual.monthly} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', padding: 20, border: '1px solid var(--border)' }}>
              <h4 style={{ fontWeight: 600, marginBottom: 12 }}>最爱歌曲 Top 10</h4>
              <BarChart data={annual.top_songs} maxBars={10} />
            </div>
            <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', padding: 20, border: '1px solid var(--border)' }}>
              <h4 style={{ fontWeight: 600, marginBottom: 12 }}>最爱歌手 Top 10</h4>
              <BarChart data={annual.top_artists} maxBars={10} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
