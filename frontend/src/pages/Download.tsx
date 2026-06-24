import { useEffect, useState } from 'react'
import axios from 'axios'
import { Download, Smartphone, Monitor, Apple, Globe, ChevronDown, Music } from 'lucide-react'

interface Release {
  id: number
  version: string
  platform: string
  changelog: string
  filename: string
  file_size: number
  downloads: number
  completed_at: string | null
}

const PLATFORM_CONFIG: Record<string, { icon: typeof Smartphone; label: string; color: string }> = {
  android: { icon: Smartphone, label: 'Android', color: '#3ddc84' },
  windows: { icon: Monitor, label: 'Windows', color: '#0078d4' },
  ios: { icon: Apple, label: 'iOS', color: '#007aff' },
  web: { icon: Globe, label: 'Web', color: '#6366f1' },
}

export default function DownloadPage() {
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    axios.get('/api/app/releases')
      .then(res => {
        const data = res.data
        setReleases(Array.isArray(data) ? data : (data.records || data.releases || []))
        setLoading(false)
      })
      .catch(() => {
        setError('无法获取应用列表，请稍后再试')
        setLoading(false)
      })
  }, [])

  const fmtSize = (b: number) =>
    b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) : ''

  const handleDownload = (filename: string) => {
    window.open(`/api/app/releases/download/${filename}`, '_blank')
  }

  return (
    <div className="dl-page">
      <style>{`
        .dl-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .dl-header {
          text-align: center;
          padding-top: 48px;
          padding-bottom: 32px;
          color: #fff;
        }
        .dl-header-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          border-radius: 20px;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(10px);
          margin-bottom: 16px;
        }
        .dl-header h1 {
          font-size: 28px;
          font-weight: 700;
          margin: 0;
        }
        .dl-header p {
          font-size: 15px;
          opacity: 0.85;
          margin-top: 6px;
        }
        .dl-content {
          max-width: 640px;
          margin: 0 auto;
          padding: 0 16px 60px;
        }
        .dl-card {
          background: rgba(255,255,255,0.95);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          margin-bottom: 14px;
        }
        .dl-card-main {
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .dl-card-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .dl-card-info {
          flex: 1;
          min-width: 0;
        }
        .dl-card-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
          flex-wrap: wrap;
        }
        .dl-card-title .ver {
          font-size: 18px;
          font-weight: 700;
          color: #1e293b;
        }
        .dl-card-title .plat {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 16px;
          font-weight: 600;
        }
        .dl-card-meta {
          display: flex;
          gap: 12px;
          font-size: 12px;
          color: #94a3b8;
          flex-wrap: wrap;
        }
        .dl-card-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }
        .dl-btn-changelog {
          padding: 8px 12px;
          background: #f1f5f9;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          color: #64748b;
          font-size: 13px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .dl-btn-download {
          padding: 8px 16px;
          background: #6366f1;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 4px 12px rgba(99,102,241,0.3);
        }
        .dl-changelog {
          padding: 0 20px 16px;
          font-size: 13px;
          color: #475569;
          line-height: 1.8;
          white-space: pre-wrap;
          border-top: 1px solid #f1f5f9;
          margin: 0 20px;
          padding-top: 14px;
        }
        .dl-footer {
          text-align: center;
          padding: 16px 0 32px;
          color: rgba(255,255,255,0.5);
          font-size: 12px;
        }
        .dl-empty {
          text-align: center;
          padding: 48px 20px;
          background: rgba(255,255,255,0.1);
          border-radius: 14px;
          color: rgba(255,255,255,0.8);
          font-size: 14px;
        }
        .dl-loading {
          text-align: center;
          padding: 48px 20px;
          color: rgba(255,255,255,0.8);
        }
        .dl-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid rgba(255,255,255,0.2);
          border-top-color: #fff;
          border-radius: 50%;
          animation: dl-spin 1s linear infinite;
          margin: 0 auto 12px;
        }
        @keyframes dl-spin { to { transform: rotate(360deg) } }

        /* Mobile responsive */
        @media (max-width: 640px) {
          .dl-header {
            padding-top: 32px;
            padding-bottom: 20px;
          }
          .dl-header-icon {
            width: 52px;
            height: 52px;
            border-radius: 16px;
            margin-bottom: 12px;
          }
          .dl-header h1 { font-size: 24px; }
          .dl-header p { font-size: 14px; }
          .dl-content {
            padding: 0 12px 40px;
          }
          .dl-card-main {
            padding: 16px;
            gap: 12px;
            flex-wrap: wrap;
          }
          .dl-card-icon {
            width: 40px;
            height: 40px;
            border-radius: 10px;
          }
          .dl-card-info {
            flex: 1;
            min-width: calc(100% - 52px);
          }
          .dl-card-title .ver { font-size: 16px; }
          .dl-card-meta { gap: 8px; font-size: 11px; }
          .dl-card-actions {
            width: 100%;
            justify-content: flex-end;
            padding-left: 52px;
            margin-top: -4px;
          }
          .dl-btn-download {
            flex: 1;
            justify-content: center;
            padding: 10px 16px;
          }
          .dl-btn-changelog {
            padding: 10px 14px;
          }
          .dl-changelog {
            margin: 0 16px;
            padding: 12px 16px 14px;
            font-size: 12px;
          }
        }
      `}</style>

      {/* Header */}
      <div className="dl-header">
        <div className="dl-header-icon">
          <Music size={32} color="#fff" />
        </div>
        <h1>HappyMusic</h1>
        <p>下载最新版本，享受极致音乐体验</p>
      </div>

      {/* Content */}
      <div className="dl-content">
        {loading ? (
          <div className="dl-loading">
            <div className="dl-spinner" />
            加载中...
          </div>
        ) : error ? (
          <div className="dl-empty">{error}</div>
        ) : releases.length === 0 ? (
          <div className="dl-empty">暂无可下载的应用</div>
        ) : (
          releases.map(r => {
            const cfg = PLATFORM_CONFIG[r.platform] || PLATFORM_CONFIG.web
            const PI = cfg.icon
            const expanded = expandedId === r.id
            return (
              <div key={r.id} className="dl-card">
                <div className="dl-card-main">
                  <div className="dl-card-icon" style={{ background: `${cfg.color}15` }}>
                    <PI size={24} style={{ color: cfg.color }} />
                  </div>
                  <div className="dl-card-info">
                    <div className="dl-card-title">
                      <span className="ver">v{r.version}</span>
                      <span className="plat" style={{ background: `${cfg.color}15`, color: cfg.color }}>{cfg.label}</span>
                    </div>
                    <div className="dl-card-meta">
                      {r.file_size > 0 && <span>{fmtSize(r.file_size)}</span>}
                      {r.completed_at && <span>{fmtDate(r.completed_at)}</span>}
                      <span>{r.downloads} 次下载</span>
                    </div>
                  </div>
                  <div className="dl-card-actions">
                    {r.changelog && (
                      <button className="dl-btn-changelog" onClick={() => setExpandedId(expanded ? null : r.id)}>
                        更新说明
                        <ChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                      </button>
                    )}
                    <button className="dl-btn-download" onClick={() => handleDownload(r.filename)}>
                      <Download size={15} /> 下载
                    </button>
                  </div>
                </div>
                {expanded && r.changelog && (
                  <div className="dl-changelog">{r.changelog}</div>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="dl-footer">HappyMusic - 让音乐无处不在</div>
    </div>
  )
}
