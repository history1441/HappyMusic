import React, { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'

interface Props {
  phase: 1 | 2 | 3
  moodColor: string
}

const PHASE_TEXTS = [
  '正在分析你的音乐品味...',
  '正在为你寻找歌曲...',
  '正在准备播放列表...',
]

const NOTES = ['♪', '♫', '♬', '♩', '♭', '♮']

function NoteFloating({ color }: { color: string }) {
  const notes = useRef(
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      note: NOTES[i % NOTES.length],
      startY: 120 + Math.random() * 60,
      x: 30 + Math.random() * 240,
      size: 20 + Math.random() * 24,
      duration: 2000 + Math.random() * 2000,
      delay: Math.random() * 2000,
    }))
  ).current

  return (
    <View style={styles.animContainer}>
      {notes.map((n) => (
        <FloatingNote key={n.id} {...n} color={color} />
      ))}
    </View>
  )
}

function FloatingNote({ note, startY, x, size, duration, delay, color }: {
  note: string; startY: number; x: number; size: number; duration: number; delay: number; color: string
}) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = () => {
      translateY.setValue(startY)
      opacity.setValue(0)
      Animated.parallel([
        Animated.timing(translateY, { toValue: -40, duration, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(opacity, { toValue: 0.8, duration: 400, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: duration - 400 - delay, useNativeDriver: true }),
        ]),
      ]).start(() => loop())
    }
    loop()
  }, [])

  return (
    <Animated.Text style={{ position: 'absolute', left: x, top: 0, transform: [{ translateY }], opacity, fontSize: size, color }}>
      {note}
    </Animated.Text>
  )
}

function WaveAnimation({ color }: { color: string }) {
  const phase1 = useRef(new Animated.Value(0)).current
  const phase2 = useRef(new Animated.Value(0)).current
  const phase3 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animate = (val: Animated.Value, to: number) =>
      Animated.loop(Animated.timing(val, { toValue: to, duration: 2000 + Math.random() * 1000, useNativeDriver: true }))
    animate(phase1, 1).start()
    animate(phase2, 1.5).start()
    animate(phase3, 2).start()
  }, [])

  const renderWave = (val: Animated.Value, opacity: number, offset: number) => (
    <Animated.View
      style={{
        position: 'absolute', bottom: 60 + offset,
        left: 0, right: 0, height: 40,
        opacity,
        transform: [{ translateX: val.interpolate({ inputRange: [0, 1, 2], outputRange: [-60, 0, 60] }) }],
      }}
    >
      <View style={[styles.waveBar, { backgroundColor: color }]} />
    </Animated.View>
  )

  return (
    <View style={styles.animContainer}>
      {renderWave(phase1, 0.6, 40)}
      {renderWave(phase2, 0.4, 20)}
      {renderWave(phase3, 0.3, 0)}
    </View>
  )
}

export default function MoodLoadingAnimation({ phase, moodColor }: Props) {
  const useWave = useRef(Math.random() > 0.5).current

  return (
    <View style={styles.container}>
      {useWave ? <WaveAnimation color={moodColor} /> : <NoteFloating color={moodColor} />}
      <Text style={styles.phaseText}>{PHASE_TEXTS[phase - 1]}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  animContainer: { width: 300, height: 200, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  phaseText: { fontSize: 16, color: '#64748b', marginTop: 20, fontWeight: '500' },
  waveBar: { width: '120%', height: 4, borderRadius: 2, marginLeft: '-10%' },
})
