import React, { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { usePlayerStore } from '../stores/playerStore'
import { useTheme } from '../hooks/useTheme'

// Use selectors to minimize re-renders
const useCurrentSong = (s) => s.currentSong
const useIsPlaying = (s) => s.isPlaying
const usePosition = (s) => s.position
const useDuration = (s) => s.duration
const useTogglePlay = (s) => s.togglePlay
const useNext = (s) => s.next
const useSetShowFullPlayer = (s) => s.setShowFullPlayer

export default function MiniPlayer() {
  const { colors } = useTheme()
  const currentSong = usePlayerStore(useCurrentSong)
  const isPlaying = usePlayerStore(useIsPlaying)
  const position = usePlayerStore(usePosition)
  const duration = usePlayerStore(useDuration)
  const togglePlay = usePlayerStore(useTogglePlay)
  const next = usePlayerStore(useNext)
  const setShowFullPlayer = usePlayerStore(useSetShowFullPlayer)
  const navigation = useNavigation<any>()
  const rotation = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (isPlaying) {
      rotation.setValue(0)
      const anim = Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 10000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      )
      anim.start()
      return () => { anim.stop() }
    } else {
      rotation.stopAnimation()
    }
  }, [isPlaying, currentSong?.song_identifier])

  if (!currentSong) return null

  const progress = duration > 0 ? position / duration : 0
  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  const openPlayer = () => {
    setShowFullPlayer(true)
    navigation.navigate('FullPlayer')
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={[styles.progressWrap, { backgroundColor: colors.borderLight }]}>
        <View style={[styles.progressFill, { width: (progress * 100) + '%' as any, backgroundColor: colors.primary }]} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity style={styles.touchArea} onPress={openPlayer} activeOpacity={0.7}>
          {/* Rotating cover */}
          <Animated.View style={[styles.vinylOuter, { transform: [{ rotate: spin }] }]}>
            <View style={[styles.vinylInner, { backgroundColor: colors.primary }]}>
              {currentSong.cover_url ? (
                <Image source={{ uri: currentSong.cover_url }} style={styles.coverImage} />
              ) : (
                <Text style={styles.coverText}>{currentSong.song_name[0]}</Text>
              )}
            </View>
          </Animated.View>

          <View style={styles.textInfo}>
            <Text style={[styles.songName, { color: colors.text }]} numberOfLines={1}>{currentSong.song_name}</Text>
            <Text style={[styles.singer, { color: colors.textTertiary }]} numberOfLines={1}>{currentSong.singers}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.controls}>
          <TouchableOpacity style={[styles.playBtn, { borderColor: colors.border }]} onPress={togglePlay} activeOpacity={0.7}>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={16}
              color={colors.text}
              style={isPlaying ? undefined : { marginLeft: 2 }}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.nextBtn} onPress={next} activeOpacity={0.7}>
            <Ionicons name="play-skip-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { height: -1, width: 0 },
  },
  progressWrap: {
    height: 1,
    width: '100%',
  },
  progressFill: {
    height: '100%',
  },
  content: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 8,
  },
  touchArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  vinylOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  vinylInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  coverImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  coverText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  textInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  songName: {
    fontSize: 15,
    fontWeight: '400',
  },
  singer: {
    fontSize: 12,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  nextBtn: {
    padding: 4,
  },
})
