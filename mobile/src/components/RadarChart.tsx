import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Polygon, Line, Circle, Text as SvgText } from 'react-native-svg'

interface RadarDataItem {
  label: string
  value: number
}

interface Props {
  data: RadarDataItem[]
  size?: number
  color?: string
}

export default function RadarChart({
  data,
  size = 250,
  color = '#EC4141',
}: Props) {
  const n = data.length
  if (n < 3) return null

  const center = size / 2
  const radius = size * 0.35
  const labelRadius = radius + 24

  // Angle step in radians; start from top (-90 degrees)
  const angleStep = (2 * Math.PI) / n
  const startAngle = -Math.PI / 2

  // Get x, y from polar coordinates
  const polarToCartesian = (
    angle: number,
    r: number,
  ): { x: number; y: number } => ({
    x: center + r * Math.cos(angle),
    y: center + r * Math.sin(angle),
  })

  // Build polygon points string for a given radius percentage (0-1)
  const buildGridPoints = (percentage: number): string => {
    const points: string[] = []
    for (let i = 0; i < n; i++) {
      const angle = startAngle + i * angleStep
      const { x, y } = polarToCartesian(angle, radius * percentage)
      points.push(`${x},${y}`)
    }
    return points.join(' ')
  }

  // Build data polygon points
  const buildDataPoints = (): string => {
    const points: string[] = []
    for (let i = 0; i < n; i++) {
      const value = Math.max(0, Math.min(1, data[i].value))
      const angle = startAngle + i * angleStep
      const { x, y } = polarToCartesian(angle, radius * value)
      points.push(`${x},${y}`)
    }
    return points.join(' ')
  }

  // Grid levels: 20%, 40%, 60%, 80%, 100%
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0]

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        {/* Concentric pentagon grid lines */}
        {gridLevels.map((level, idx) => (
          <Polygon
            key={`grid-${idx}`}
            points={buildGridPoints(level)}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={1}
          />
        ))}

        {/* Axis lines from center to each vertex */}
        {data.map((_, i) => {
          const angle = startAngle + i * angleStep
          const { x, y } = polarToCartesian(angle, radius)
          return (
            <Line
              key={`axis-${i}`}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
          )
        })}

        {/* Data polygon - filled */}
        <Polygon
          points={buildDataPoints()}
          fill={color}
          fillOpacity={0.2}
          stroke={color}
          strokeWidth={2}
        />

        {/* Data points at vertices */}
        {data.map((item, i) => {
          const value = Math.max(0, Math.min(1, item.value))
          const angle = startAngle + i * angleStep
          const { x, y } = polarToCartesian(angle, radius * value)
          return (
            <Circle
              key={`point-${i}`}
              cx={x}
              cy={y}
              r={4}
              fill={color}
            />
          )
        })}

        {/* Labels at each vertex */}
        {data.map((item, i) => {
          const angle = startAngle + i * angleStep
          const { x, y } = polarToCartesian(angle, labelRadius)
          // Adjust text anchor based on position
          let textAnchor: 'start' | 'middle' | 'end' = 'middle'
          if (Math.abs(x - center) > 5) {
            textAnchor = x > center ? 'start' : 'end'
          }
          return (
            <SvgText
              key={`label-${i}`}
              x={x}
              y={y + 4}
              fontSize={12}
              fill="#64748b"
              textAnchor={textAnchor}
              fontWeight="500"
            >
              {item.label}
            </SvgText>
          )
        })}
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
