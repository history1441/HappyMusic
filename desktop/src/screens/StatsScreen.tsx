import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import api from '@common/services/api'
import {
  ArrowLeft, BarChart3, Trophy, Radio, Calendar,
  Music, Clock, Disc3, User, TrendingUp,
} from 'lucide-react'
import { cn } from '../utils/cn'

type Tab = 'overview' | 'ranking' | 'radar' | 'annual'

interface Summary {
  total_plays: number; total_time_hours: number; unique_songs: number; unique_artists: number
  top_song: string | null; top_artist: string | null; top_source: string | null
}
interface RankItem { name: string; count: number; extra?: string }
interface PrefDim { label: string; value: number }
interface MonthlyData { month: string; plays: number; hours: number }
interface AnnualReport {
  year: number; total_plays: number; total_hours: number; unique_songs: number; unique_artists: number
  top_songs: RankItem[]; top_artists: RankItem[]; monthly: MonthlyData[]; source_distribution: RankItem[]
}

export default function StatsScreen() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [songRank, setSongRank] = useState<RankItem[]>([])
  const [artistRank, setArtistRank] = useState<RankItem[]>([])
  const [sourceRank, setSourceRank] = useState<RankItem[]>([])
  const [prefs, setPrefs] = useState<PrefDim[]>([])
  const [annual, setAnnual] = useState<AnnualReport | null>(null)
  const [rankType, setRankType] = useState<'song' | 'artist' | 'source'>('song')

  useEffect(() => {
    Promise.all([
      api.get('/stats/summary').then(({ data }) => setSummary(data)).catch(() => {}),
      api.get('/stats/ranking', { params: { type: 'song' } }).then(({ data }) => setSongRank(data)).catch(() => {}),
      api.get('/stats/ranking', { params: { type: 'artist' } }).then(({ data }) => setArtistRank(data)).catch(() => {}),
      api.get('/stats/ranking', { params: { type: 'source' } }).then(({ data }) => setSourceRank(data)).catch(() => {}),
      api.get('/stats/preferences').then(({ data }) => setPrefs(data)).catch(() => {}),
      api.get('/stats/annual-report').then(({ data }) => setAnnual(data)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const tabs: { key: Tab; icon: typeof BarChart3; label: string }[] = [
    { key: 'overview', icon: BarChart3, label: '概览' },
    { key: 'ranking', icon: Trophy, label: '排行' },
    { key: 'radar', icon: Radio, label: '偏好' },
    { key: 'annual', icon: Calendar, label: '年度' },
  ]

  const rankData = rankType === 'song' ? songRank : rankType === 'artist' ? artistRank : sourceRank
  const rankLabel = rankType === 'song' ? '歌曲' : rankType === 'artist' ? '歌手' : '来源'

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
          <button onClick={() => navigate(-1)} className="p-1.5 text-text-secondary hover:text-text transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="flex-1 text-center text-base font-bold text-text">听歌统计</h1>
          <div className="w-5" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 text-text-secondary hover:text-text transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-1 text-center text-base font-bold text-text">听歌统计</h1>
        <div className="w-5" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 py-2.5 bg-card border-b border-border flex-shrink-0">
        {tabs.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors',
              tab === key ? 'bg-primary text-white' : 'bg-border-light text-text-secondary hover:text-text'
            )}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-3">
        {/* Overview */}
        {tab === 'overview' && summary && (
          <div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <StatCard icon={Music} label="总播放" value={summary.total_plays || 0} sub="首歌曲" />
              <StatCard icon={Clock} label="听歌时长" value={`${summary.total_time_hours || 0}h`} />
              <StatCard icon={Disc3} label="不同歌曲" value={summary.unique_songs || 0} />
              <StatCard icon={User} label="不同歌手" value={summary.unique_artists || 0} />
            </div>
            <div className="mb-4">
              <h3 className="text-sm font-bold text-text mb-2.5">你的最爱</h3>
              <div className="space-y-2">
                <TopRow icon={TrendingUp} label="最爱歌曲" value={summary.top_song || '--'} />
                <TopRow icon={User} label="最爱歌手" value={summary.top_artist || '--'} />
                <TopRow icon={Disc3} label="常用来源" value={summary.top_source || '--'} />
              </div>
            </div>
          </div>
        )}

        {tab === 'overview' && !summary && (
          <p className="text-center text-text-tertiary py-8 text-sm">暂无统计数据</p>
        )}

        {/* Ranking */}
        {tab === 'ranking' && (
          <div>
            <div className="flex gap-1 mb-3">
              {(['song', 'artist', 'source'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setRankType(t)}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-sm transition-colors',
                    rankType === t ? 'bg-primary text-white font-medium' : 'bg-border-light text-text-secondary'
                  )}
                >
                  {t === 'song' ? '歌曲' : t === 'artist' ? '歌手' : '来源'}
                </button>
              ))}
            </div>
            <div className="bg-card rounded-xl p-4 border border-border-light">
              <h3 className="text-sm font-semibold text-text mb-3">{rankLabel}排行</h3>
              {rankData.length > 0 ? (
                <BarChart items={rankData} maxBars={15} />
              ) : (
                <p className="text-center text-text-tertiary py-8 text-sm">暂无数据，播放一些歌曲吧</p>
              )}
            </div>
          </div>
        )}

        {/* Preferences radar */}
        {tab === 'radar' && (
          <div>
            <div className="bg-card rounded-xl p-4 border border-border-light mb-3">
              <h3 className="text-sm font-semibold text-text mb-3">音乐偏好</h3>
              {prefs.length >= 3 ? (
                <PreferenceGrid prefs={prefs} />
              ) : (
                <p className="text-center text-text-tertiary py-8 text-sm">数据不足，至少需要3个维度</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {prefs.map((d) => (
                <div key={d.label} className="w-[31%] bg-border-light rounded-xl p-2.5 text-center">
                  <p className="text-xs text-text-secondary mb-0.5">{d.label}</p>
                  <p className="text-lg font-bold text-text">{d.value}%</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Annual report */}
        {tab === 'annual' && annual && (
          <div>
            <div className="text-center mb-4">
              <h2 className="text-2xl font-extrabold text-text">{annual.year} 年度音乐报告</h2>
              <p className="text-xs text-text-tertiary mt-1">你的音乐之旅</p>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <StatCard icon={Music} label="播放次数" value={annual.total_plays} />
              <StatCard icon={Clock} label="总时长" value={`${annual.total_hours}h`} />
              <StatCard icon={Disc3} label="歌曲数" value={annual.unique_songs} />
              <StatCard icon={User} label="歌手数" value={annual.unique_artists} />
            </div>

            {/* Monthly chart */}
            <div className="bg-card rounded-xl p-4 border border-border-light mb-3">
              <h3 className="text-sm font-semibold text-text mb-3">月度趋势</h3>
              <MonthlyChart data={annual.monthly} />
            </div>

            <div className="bg-card rounded-xl p-4 border border-border-light mb-3">
              <h3 className="text-sm font-semibold text-text mb-3">最爱歌曲 Top 10</h3>
              {annual.top_songs.length > 0 ? (
                <BarChart items={annual.top_songs} maxBars={10} />
              ) : (
                <p className="text-center text-text-tertiary py-6 text-sm">暂无数据</p>
              )}
            </div>

            <div className="bg-card rounded-xl p-4 border border-border-light mb-3">
              <h3 className="text-sm font-semibold text-text mb-3">最爱歌手 Top 10</h3>
              {annual.top_artists.length > 0 ? (
                <BarChart items={annual.top_artists} maxBars={10} />
              ) : (
                <p className="text-center text-text-tertiary py-6 text-sm">暂无数据</p>
              )}
            </div>
          </div>
        )}

        {tab === 'annual' && !annual && (
          <p className="text-center text-text-tertiary py-8 text-sm">暂无年度报告数据</p>
        )}

        <div className="h-10" />
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub }: { icon: typeof Music; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card rounded-xl p-3.5 border border-border-light">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={16} className="text-primary" />
        <span className="text-xs font-semibold text-text-tertiary">{label}</span>
      </div>
      <p className="text-2xl font-extrabold text-text truncate">{value}</p>
      {sub && <p className="text-xs text-text-tertiary mt-0.5">{sub}</p>}
    </div>
  )
}

function TopRow({ icon: Icon, label, value }: { icon: typeof TrendingUp; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 bg-card rounded-xl px-3 py-3 border border-border-light">
      <Icon size={16} className="text-primary flex-shrink-0" />
      <span className="text-xs text-text-tertiary flex-shrink-0">{label}</span>
      <span className="text-sm font-semibold text-text truncate">{value}</span>
    </div>
  )
}

function BarChart({ items, maxBars }: { items: RankItem[]; maxBars: number }) {
  const shown = items.slice(0, maxBars)
  const max = Math.max(...shown.map(i => i.count), 1)

  return (
    <div className="space-y-2">
      {shown.map((item, idx) => (
        <div key={`${item.name}_${idx}`} className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary w-5 text-right flex-shrink-0">{idx + 1}</span>
          <span className="text-xs text-text truncate w-24 flex-shrink-0" title={item.name}>{item.name}</span>
          <div className="flex-1 h-5 bg-border-light rounded overflow-hidden">
            <div
              className="h-full bg-primary rounded transition-all"
              style={{ width: `${Math.max((item.count / max) * 100, 2)}%` }}
            />
          </div>
          <span className="text-xs text-text-tertiary w-10 text-right flex-shrink-0">{item.count}</span>
        </div>
      ))}
    </div>
  )
}

function PreferenceGrid({ prefs }: { prefs: PrefDim[] }) {
  return (
    <div className="space-y-2">
      {prefs.map((p) => (
        <div key={p.label} className="flex items-center gap-3">
          <span className="text-xs text-text-secondary w-20 truncate">{p.label}</span>
          <div className="flex-1 h-4 bg-border-light rounded overflow-hidden">
            <div
              className="h-full bg-primary rounded"
              style={{ width: `${p.value}%` }}
            />
          </div>
          <span className="text-xs font-bold text-text w-12 text-right">{p.value}%</span>
        </div>
      ))}
    </div>
  )
}

function MonthlyChart({ data }: { data: MonthlyData[] }) {
  const max = Math.max(...data.map(d => d.plays), 1)
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
  const map = new Map(data.map(d => [d.month, d]))

  return (
    <div className="flex items-end h-28 px-1 gap-0.5">
      {months.map(m => {
        const d = map.get(m)
        const pct = d ? (d.plays / max) * 100 : 0
        return (
          <div key={m} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] text-text-tertiary">{d?.plays || ''}</span>
            <div className="w-full flex-1 flex items-end">
              <div
                className={cn('w-full rounded-sm min-h-[2px]', pct > 0 ? 'bg-primary' : 'bg-border-light')}
                style={{ height: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <span className="text-[9px] text-text-tertiary">{m}</span>
          </div>
        )
      })}
    </div>
  )
}
