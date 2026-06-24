import React, { useEffect, useRef } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'

import { useAuthStore } from '../stores/authStore'
import { usePlayerStore } from '../stores/playerStore'
import { useTheme } from '../hooks/useTheme'
import LoginScreen from '../screens/LoginScreen'
import QRLoginScreen from '../screens/QRLoginScreen'
import HomeScreen from '../screens/HomeScreen'
import SearchScreen from '../screens/SearchScreen'
import PlaylistScreen from '../screens/PlaylistScreen'
import PlaylistDetailScreen from '../screens/PlaylistDetailScreen'
import LocalLibraryScreen from '../screens/LocalLibraryScreen'
import SettingsScreen from '../screens/SettingsScreen'
import StorageScreen from '../screens/StorageScreen'
import StatsScreen from '../screens/StatsScreen'
import PlayerScreen from '../screens/PlayerScreen'
import HotChartsScreen from '../screens/HotChartsScreen'
import MoodRadioScreen from '../screens/MoodRadioScreen'
import GuessGameScreen from '../screens/GuessGameScreen'
import AIRecommendScreen from '../screens/AIRecommendScreen'
import RecentPlaysScreen from '../screens/RecentPlaysScreen'
import DownloadManagerScreen from '../screens/DownloadManagerScreen'
import LoginHistoryScreen from '../screens/LoginHistoryScreen'
import RingtoneMakerScreen from '../screens/RingtoneMakerScreen'
import LocalFileImportScreen from '../screens/LocalFileImportScreen'
import ScanQRScreen from '../screens/ScanQRScreen'
import FavoritesScreen from '../screens/FavoritesScreen'
import SourceManagerScreen from '../screens/SourceManagerScreen'

const RootStack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()
const HomeStack = createNativeStackNavigator()
const PlaylistsStack = createNativeStackNavigator()
const SettingsStack = createNativeStackNavigator()

function PlayerTabIcon({ color, size }: { color: string; size: number }) {
  const currentSong = usePlayerStore(s => s.currentSong)
  const isPlaying = usePlayerStore(s => s.isPlaying)
  const rotation = useRef(new Animated.Value(0)).current
  const animRef = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    if (isPlaying && currentSong?.cover_url) {
      rotation.setValue(0)
      const anim = Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 8000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      )
      animRef.current = anim
      anim.start()
    } else {
      animRef.current?.stop()
      animRef.current = null
    }
    return () => { animRef.current?.stop() }
  }, [isPlaying, currentSong?.cover_url])

  if (!currentSong || !currentSong.cover_url) {
    return <Ionicons name="disc-outline" size={size} color={color} />
  }

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <Animated.View style={{
      width: 28, height: 28, borderRadius: 14, overflow: 'hidden',
      borderWidth: 1.5, borderColor: isPlaying ? '#EC4141' : '#ddd',
      transform: [{ rotate: spin }],
    }}>
      <Image source={{ uri: currentSong.cover_url }} style={{ width: 28, height: 28, borderRadius: 14 }} />
    </Animated.View>
  )
}

function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="HotCharts" component={HotChartsScreen} />
      <HomeStack.Screen name="LocalLibrary" component={LocalLibraryScreen} />
      <HomeStack.Screen name="LocalFileImport" component={LocalFileImportScreen} />
    </HomeStack.Navigator>
  )
}

function PlaylistsNavigator() {
  return (
    <PlaylistsStack.Navigator screenOptions={{ headerShown: false }}>
      <PlaylistsStack.Screen name="PlaylistList" component={PlaylistScreen} />
      <PlaylistsStack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
    </PlaylistsStack.Navigator>
  )
}

function SettingsNavigator() {
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="SettingsMain" component={SettingsScreen} />
      <SettingsStack.Screen name="Favorites" component={FavoritesScreen} />
      <SettingsStack.Screen name="RecentPlays" component={RecentPlaysScreen} />
      <SettingsStack.Screen name="DownloadManager" component={DownloadManagerScreen} />
      <SettingsStack.Screen name="LocalLibrary" component={LocalLibraryScreen} />
      <SettingsStack.Screen name="LocalFileImport" component={LocalFileImportScreen} />
      <SettingsStack.Screen name="Stats" component={StatsScreen} />
      <SettingsStack.Screen name="MoodRadio" component={MoodRadioScreen} />
      <SettingsStack.Screen name="GuessGame" component={GuessGameScreen} />
      <SettingsStack.Screen name="AIRecommend" component={AIRecommendScreen} />
      <SettingsStack.Screen name="LoginHistory" component={LoginHistoryScreen} />
      <SettingsStack.Screen name="HotCharts" component={HotChartsScreen} />
      <SettingsStack.Screen name="Storage" component={StorageScreen} />
      <SettingsStack.Screen name="RingtoneMaker" component={RingtoneMakerScreen} />
      <SettingsStack.Screen name="ScanQR" component={ScanQRScreen} />
      <SettingsStack.Screen name="SourceManager" component={SourceManagerScreen} />
    </SettingsStack.Navigator>
  )
}

function MainTabs() {
  const { colors } = useTheme()

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, size }) => {
            const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
              Home: 'home',
              Search: 'search',
              Player: 'disc-outline',
              Playlists: 'library',
              Settings: 'person',
            }
            return <Ionicons name={icons[route.name] || 'home'} size={size} color={color} />
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.borderLight },
          tabBarLabelStyle: { fontSize: 11 },
          headerShown: false,
        })}
      >
        <Tab.Screen name="Home" component={HomeNavigator} options={{ tabBarLabel: '发现' }} />
        <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarLabel: '搜索' }} />
        <Tab.Screen name="Player" component={PlayerScreen} options={{
          tabBarLabel: '播放',
          tabBarIcon: ({ color, size }) => <PlayerTabIcon color={color} size={size} />,
        }} />
        <Tab.Screen name="Playlists" component={PlaylistsNavigator} options={{ tabBarLabel: '歌单' }} />
        <Tab.Screen name="Settings" component={SettingsNavigator} options={{ tabBarLabel: '我的' }} />
      </Tab.Navigator>
    </View>
  )
}

export default function RootNavigator() {
  const { token, isLoading, user } = useAuthStore()
  const { colors } = useTheme()

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>加载中...</Text>
      </View>
    )
  }

  const isLoggedIn = !!token

  return (
    <NavigationContainer theme={{
      dark: colors.background === '#0f172a',
      colors: {
        primary: colors.primary,
        background: colors.background,
        card: colors.card,
        text: colors.text,
        border: colors.border,
        notification: colors.primary,
      },
      fonts: {
        regular: { fontFamily: undefined, fontWeight: 'normal' as const },
        medium: { fontFamily: undefined, fontWeight: '500' as const },
        bold: { fontFamily: undefined, fontWeight: 'bold' as const },
        heavy: { fontFamily: undefined, fontWeight: '900' as const },
      },
    }}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!isLoggedIn ? (
          <>
            <RootStack.Screen name="Login" component={LoginScreen} />
            <RootStack.Screen name="QRLogin" component={QRLoginScreen} options={{ headerShown: true, title: '扫码登录' }} />
          </>
        ) : (
          <>
            <RootStack.Screen name="Main" component={MainTabs} />
            <RootStack.Screen name="FullPlayer" component={PlayerScreen} options={{ presentation: 'modal', headerShown: false }} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
})
