import { useState, useEffect } from 'react'
import { useIsMobile } from '../hooks/useBreakpoint'
import api from '../services/api'
import { usePlayerStore } from '../stores/playerStore'
import { Flame, Play, Music2, Globe, Clock } from 'lucide-react'

const HOT_TAGS = ['周杰伦','陈奕迅','林俊杰','薛之谦','邓紫棋','Taylor Swift','抖音热歌','经典老歌','粤语金曲','宝藏歌曲']
const PERIODS = [{key:'day',label:'今日'},{key:'week',label:'本周'},{key:'month',label:'本月'},{key:'all',label:'全部'}]

export default function HotCharts() {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<'platform' | 'global'>('global')
  const [songs, setSongs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTag, setActiveTag] = useState(HOT_TAGS[0])
  const [period, setPeriod] = useState('week')
  const [globalHot, setGlobalHot] = useState<any[]>([])
  const { play } = usePlayerStore()

  const fetchPlatform = async (tag?: string) => {
    setLoading(true)
    try {
      const { data } = await api.get('/hot-songs', { params: { keyword: tag || activeTag } })
      setSongs(data.results || [])
    } catch { setSongs([]) }
    setLoading(false)
  }

  const fetchGlobal = async (p?: string) => {
    setLoading(true)
    try {
      const { data } = await api.get('/global-hot', { params: { period: p || period } })
      setGlobalHot(data)
    } catch { setGlobalHot([]) }
    setLoading(false)
  }

  useEffect(() => { fetchPlatform() }, [activeTag])
  useEffect(() => { if (tab === 'global') fetchGlobal() }, [period, tab])

  const playAll = () => { if (songs.length > 0) play(songs[0], songs) }
  const fmt = (s: number) => { if (!s) return '--:--'; const m = Math.floor(s/60); return `${m}:${Math.floor(s%60).toString().padStart(2,'0')}` }

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 32px', paddingBottom: isMobile ? 132 : 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Flame size={24} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: 24, fontWeight: 700 }}>热搜榜单</h2>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setTab('global')} style={{ padding:'6px 14px', borderRadius:'var(--radius-sm)', background:tab==='global'?'var(--accent)':'var(--bg-secondary)', color:tab==='global'?'#fff':'var(--text-secondary)', border:'none', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', gap:4 }}>
            <Globe size={13}/>全局热搜
          </button>
          <button onClick={() => setTab('platform')} style={{ padding:'6px 14px', borderRadius:'var(--radius-sm)', background:tab==='platform'?'var(--accent)':'var(--bg-secondary)', color:tab==='platform'?'#fff':'var(--text-secondary)', border:'none', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', gap:4 }}>
            <Clock size={13}/>平台热歌
          </button>
        </div>
      </div>

      {tab === 'global' && (
        <div>
          <div style={{ display:'flex', gap:4, marginBottom:16 }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} style={{ padding:'6px 14px', borderRadius:'var(--radius-sm)', background:period===p.key?'var(--accent)':'var(--bg-secondary)', color:period===p.key?'#fff':'var(--text-secondary)', border:'none', cursor:'pointer', fontSize:13 }}>
                {p.label}
              </button>
            ))}
          </div>
          {loading ? <div style={{textAlign:'center',padding:48,color:'var(--text-tertiary)'}}>加载中...</div> : (
            globalHot.length > 0 ? globalHot.map((item: any) => (
              <div key={item.rank} style={{ display:'grid', gridTemplateColumns:'40px 1fr 80px', padding:'10px 16px', alignItems:'center', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:16, fontWeight:800, color: item.rank<=3 ? 'var(--accent)' : 'var(--text-tertiary)' }}>{item.rank}</span>
                <div><div style={{fontWeight:500,fontSize:14}}>{item.song_name}</div><div style={{fontSize:12,color:'var(--text-tertiary)'}}>{item.singers}</div></div>
                <span style={{fontSize:12,color:'var(--text-tertiary)',textAlign:'right'}}>{item.plays}次</span>
              </div>
            )) : <div style={{textAlign:'center',padding:48,color:'var(--text-tertiary)'}}>暂无数据</div>
          )}
        </div>
      )}

      {tab === 'platform' && (
        <div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 }}>
            {HOT_TAGS.map(tag => (
              <button key={tag} onClick={() => setActiveTag(tag)} style={{ padding:'5px 14px', borderRadius:20, background:activeTag===tag?'var(--accent)':'var(--bg-secondary)', color:activeTag===tag?'#fff':'var(--text-secondary)', border:'none', cursor:'pointer', fontSize:13 }}>
                {tag}
              </button>
            ))}
          </div>
          {songs.length > 0 && <button onClick={playAll} style={{padding:'8px 20px',background:'var(--accent)',border:'none',borderRadius:'var(--radius-sm)',color:'#fff',cursor:'pointer',fontWeight:600,fontSize:14,marginBottom:12,display:'flex',alignItems:'center',gap:6}}><Play size={14}/>播放全部</button>}
          {loading ? <div style={{textAlign:'center',padding:48,color:'var(--text-tertiary)'}}>加载中...</div> : songs.map((song:any,idx:number) => (
            <div key={idx} onClick={() => play(song, songs)} style={{display:'grid',gridTemplateColumns:'32px 40px 1fr 80px 60px',padding:'8px 12px',alignItems:'center',gap:12,borderRadius:'var(--radius-sm)',cursor:'pointer'}} onMouseEnter={e=>(e.currentTarget.style.background='var(--bg-secondary)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
              <span style={{fontSize:14,fontWeight:700,color:idx<3?'var(--accent)':'var(--text-tertiary)'}}>{idx+1}</span>
              <div style={{width:40,height:40,borderRadius:6,background:'var(--bg-tertiary)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>{song.cover_url?<img src={song.cover_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<Music2 size={16} style={{color:'var(--text-tertiary)'}}/>}</div>
              <div style={{overflow:'hidden'}}><div style={{fontSize:14,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{song.song_name}</div><div style={{fontSize:12,color:'var(--text-tertiary)'}}>{song.singers}</div></div>
              <span style={{fontSize:12,color:'var(--text-tertiary)'}}>{song.source}</span>
              <span style={{fontSize:12,color:'var(--text-tertiary)'}}>{fmt(song.duration_s)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
