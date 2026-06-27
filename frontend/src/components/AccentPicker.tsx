import { ACCENT_PRESETS, useThemeStore as useCommonThemeStore } from '@common/stores/themeStore'

/** 强调色选择器:点击预设切换全局主题色(CSS 变量由 App.tsx 注入) */
export default function AccentPicker() {
  const accentColor = useCommonThemeStore(s => s.accentColor)
  const setAccentColor = useCommonThemeStore(s => s.setAccentColor)

  return (
    <div style={{
      padding: '12px 14px', background: 'var(--bg-secondary)',
      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>🎨</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>主题色</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>个性化应用强调色</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {ACCENT_PRESETS.map((p) => {
          const selected = accentColor.toLowerCase() === p.color.toLowerCase()
          return (
            <button
              key={p.id}
              onClick={() => setAccentColor(p.color)}
              title={p.label}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: p.color, border: selected ? '2px solid var(--text-primary)' : '2px solid transparent',
                cursor: 'pointer', padding: 0, transition: 'transform 0.15s',
                transform: selected ? 'scale(1.15)' : 'scale(1)',
                boxShadow: selected ? `0 0 0 2px ${p.color}40` : 'none',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
