import { useEffect, useState } from 'react'
import api from '../../services/api'
import { Cpu, HardDrive, MemoryStick } from 'lucide-react'

export default function SystemMonitor() {
  const [resources, setResources] = useState<any>(null)
  const token = localStorage.getItem('admin_token')
  const h = { headers: { Authorization: `Bearer ${token}` } }

  const fetch = () => {
    api.get('/admin/system/resources', h).then(r => setResources(r.data)).catch(() => {})
  }

  useEffect(() => { fetch(); const iv = setInterval(fetch, 10000); return () => clearInterval(iv) }, [])

  const Gauge = ({ label, percent, color, icon: Icon, detail }: any) => (
    <div style={{ padding: 20, background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon size={18} style={{ color }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${Math.min(percent, 100)}%`, background: color, borderRadius: 4, transition: 'width 0.5s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-tertiary)' }}>
        <span>{percent.toFixed(1)}%</span>
        <span>{detail}</span>
      </div>
    </div>
  )

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>系统监控</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {resources && resources.memory && (
          <>
            <Gauge label="CPU" percent={resources.cpu_percent || 0} color="#3b82f6" icon={Cpu} detail={`${resources.cpu_count || 0} 核`} />
            <Gauge label="内存" percent={resources.memory?.percent || 0} color="#10b981" icon={MemoryStick}
              detail={`${(resources.memory?.used / 1024 / 1024 / 1024).toFixed(1)}G / ${(resources.memory?.total / 1024 / 1024 / 1024).toFixed(1)}G`} />
            <Gauge label="磁盘" percent={resources.disk?.percent || 0} color="#f59e0b" icon={HardDrive}
              detail={`${(resources.disk?.used / 1024 / 1024 / 1024).toFixed(1)}G / ${(resources.disk?.total / 1024 / 1024 / 1024).toFixed(1)}G`} />
          </>
        )}
      </div>
    </div>
  )
}
