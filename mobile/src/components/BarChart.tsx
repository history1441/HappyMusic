import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

interface BarItem {
  name: string
  count: number
}

interface Props {
  items: BarItem[]
  maxBars?: number
}

export default function BarChart({ items, maxBars = 10 }: Props) {
  const displayItems = items.slice(0, maxBars)
  if (displayItems.length === 0) return null

  const maxCount = Math.max(...displayItems.map(item => item.count), 1)

  return (
    <View style={styles.container}>
      {displayItems.map((item, index) => {
        const percentage = (item.count / maxCount) * 100
        const isTop3 = index < 3
        const barColor = isTop3 ? '#EC4141' : '#94a3b8'
        const textColor = isTop3 ? '#1e293b' : '#64748b'

        return (
          <View key={`${item.name}-${index}`} style={styles.row}>
            <Text
              style={[styles.nameLabel, { color: textColor }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <View style={styles.barContainer}>
              <View
                style={[
                  styles.bar,
                  {
                    width: `${percentage}%`,
                    backgroundColor: barColor,
                  },
                ]}
              />
            </View>
            <Text style={[styles.countLabel, { color: textColor }]}>
              {item.count}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  nameLabel: {
    width: 80,
    fontSize: 13,
    fontWeight: '500',
    marginRight: 10,
    textAlign: 'right',
  },
  barContainer: {
    flex: 1,
    height: 20,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 4,
    minWidth: 2,
  },
  countLabel: {
    width: 40,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 10,
    textAlign: 'left',
  },
})
