import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, FlatList, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import api from '../services/api'
import RadarChart from '../components/RadarChart'
import BarChart from '../components/BarChart'
import { useHeaderPadding } from '../hooks/useHeaderPadding'
import { useTheme } from '../hooks/useTheme'

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

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export default function StatsScreen() {
  const navigation = useNavigation()
  const headerPad = useHeaderPadding()
  const { colors } = useTheme()
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

  const tabs: { key: Tab; icon: string; label: string }[] = [
    { key: 'overview', icon: 'stats-chart', label: '概览' },
    { key: 'ranking', icon: 'trophy', label: '排行' },
    { key: 'radar', icon: 'radio', label: '偏好' },
    { key: 'annual', icon: 'calendar', label: '年度' },
  ]

  const rankData = rankType === 'song' ? songRank : rankType === 'artist' ? artistRank : sourceRank
  const rankLabel = rankType === 'song' ? '歌曲' : rankType === 'artist' ? '歌手' : '来源'

  const StatCard = ({ icon, label, value, sub }: { icon: string; label: string; value: string | number; sub?: string }) => (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
      <View style={styles.statIconRow}>
        <Ionicons name={icon as any} size={16} color={colors.primary} />
        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
      {sub && <Text style={[styles.statSub, { color: colors.textTertiary }]}>{sub}</Text>}
    </View>
  )

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: headerPad, backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>听歌统计</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: headerPad, backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>听歌统计</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
        {tabs.map(({ key, icon, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key ? [styles.tabActive, { backgroundColor: colors.primary }] : { backgroundColor: colors.borderLight }]}
            onPress={() => setTab(key)}
          >
            <Ionicons name={icon as any} size={14} color={tab === key ? '#fff' : colors.textSecondary} />
            <Text style={[styles.tabText, tab === key && styles.tabTextActive, tab !== key && { color: colors.textSecondary }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Overview */}
        {tab === 'overview' && summary && (
          <View>
            <View style={styles.statsGrid}>
              <StatCard icon="musical-notes" label="总播放" value={summary.total_plays || 0} sub="首歌曲" />
              <StatCard icon="time" label="听歌时长" value={`${summary.total_time_hours || 0}h`} />
              <StatCard icon="disc" label="不同歌曲" value={summary.unique_songs || 0} />
              <StatCard icon="person" label="不同歌手" value={summary.unique_artists || 0} />
            </View>
            <View style={styles.topSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>你的最爱</Text>
              <View style={styles.topRow}>
                <View style={[styles.topCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
                  <Ionicons name="trending-up" size={16} color={colors.primary} />
                  <Text style={[styles.topLabel, { color: colors.textTertiary }]}>最爱歌曲</Text>
                  <Text style={[styles.topValue, { color: colors.text }]} numberOfLines={1}>{summary.top_song || '--'}</Text>
                </View>
                <View style={[styles.topCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
                  <Ionicons name="person" size={16} color={colors.primary} />
                  <Text style={[styles.topLabel, { color: colors.textTertiary }]}>最爱歌手</Text>
                  <Text style={[styles.topValue, { color: colors.text }]} numberOfLines={1}>{summary.top_artist || '--'}</Text>
                </View>
                <View style={[styles.topCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
                  <Ionicons name="disc" size={16} color={colors.primary} />
                  <Text style={[styles.topLabel, { color: colors.textTertiary }]}>常用来源</Text>
                  <Text style={[styles.topValue, { color: colors.text }]} numberOfLines={1}>{summary.top_source || '--'}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Ranking */}
        {tab === 'ranking' && (
          <View>
            <View style={styles.rankTabs}>
              {(['song', 'artist', 'source'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.rankTab, rankType === t ? [styles.rankTabActive, { backgroundColor: colors.primary }] : { backgroundColor: colors.borderLight }]}
                  onPress={() => setRankType(t)}
                >
                  <Text style={[styles.rankTabText, rankType === t ? [styles.rankTabTextActive, { color: '#fff' }] : { color: colors.textSecondary }]}>
                    {t === 'song' ? '歌曲' : t === 'artist' ? '歌手' : '来源'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{rankLabel}排行</Text>
              {rankData.length > 0 ? (
                <BarChart items={rankData} maxBars={15} />
              ) : (
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无数据，播放一些歌曲吧</Text>
              )}
            </View>
          </View>
        )}

        {/* Preferences radar */}
        {tab === 'radar' && (
          <View>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>音乐偏好雷达图</Text>
              {prefs.length >= 3 ? (
                <RadarChart data={prefs.map(p => ({ label: p.label, value: p.value / 100 }))} size={280} />
              ) : (
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>数据不足，至少需要3个维度</Text>
              )}
            </View>
            <View style={styles.prefGrid}>
              {prefs.map((d) => (
                <View key={d.label} style={[styles.prefCard, { backgroundColor: colors.borderLight }]}>
                  <Text style={[styles.prefLabel, { color: colors.textSecondary }]}>{d.label}</Text>
                  <Text style={[styles.prefValue, { color: colors.text }]}>{d.value}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Annual report */}
        {tab === 'annual' && annual && (
          <View>
            <View style={styles.annualHeader}>
              <Text style={[styles.annualTitle, { color: colors.text }]}>{annual.year} 年度音乐报告</Text>
              <Text style={[styles.annualSub, { color: colors.textTertiary }]}>你的音乐之旅</Text>
            </View>
            <View style={styles.statsGrid}>
              <StatCard icon="musical-notes" label="播放次数" value={annual.total_plays} />
              <StatCard icon="time" label="总时长" value={`${annual.total_hours}h`} />
              <StatCard icon="disc" label="歌曲数" value={annual.unique_songs} />
              <StatCard icon="person" label="歌手数" value={annual.unique_artists} />
            </View>

            {/* Monthly chart */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>月度趋势</Text>
              <MonthlyChart data={annual.monthly} colors={colors} />
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>最爱歌曲 Top 10</Text>
              {annual.top_songs.length > 0 ? (
                <BarChart items={annual.top_songs} maxBars={10} />
              ) : (
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无数据</Text>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>最爱歌手 Top 10</Text>
              {annual.top_artists.length > 0 ? (
                <BarChart items={annual.top_artists} maxBars={10} />
              ) : (
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无数据</Text>
              )}
            </View>
          </View>
        )}

        {tab === 'annual' && !annual && (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无年度报告数据</Text>
        )}

        {tab === 'overview' && !summary && (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无统计数据</Text>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

function MonthlyChart({ data, colors }: { data: MonthlyData[]; colors: any }) {
  const max = Math.max(...data.map(d => d.plays), 1)
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
  const map = new Map(data.map(d => [d.month, d]))

  return (
    <View style={monthlyStyles.container}>
      {months.map(m => {
        const d = map.get(m)
        const h = d ? (d.plays / max) * 100 : 0
        return (
          <View key={m} style={monthlyStyles.col}>
            <Text style={[monthlyStyles.count, { color: colors.textTertiary }]}>{d?.plays || ''}</Text>
            <View style={[monthlyStyles.bar, { height: Math.max(h, 2), backgroundColor: h > 0 ? colors.primary : colors.borderLight }]} />
            <Text style={[monthlyStyles.label, { color: colors.textTertiary }]}>{m}</Text>
          </View>
        )
      })}
    </View>
  )
}

const monthlyStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', height: 120, paddingHorizontal: 4, gap: 2 },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  count: { fontSize: 9 },
  bar: { width: '100%', borderRadius: 2 },
  label: { fontSize: 9 },
})

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  tabBar: { flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  tabActive: {},
  tabText: { fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statCard: { width: '48%', borderRadius: 12, padding: 14, borderWidth: 1 },
  statIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  statLabel: { fontSize: 12, fontWeight: '600' },
  statValue: { fontSize: 24, fontWeight: '800' },
  statSub: { fontSize: 12, marginTop: 2 },
  topSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  topRow: { gap: 8 },
  topCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 12, borderWidth: 1 },
  topLabel: { fontSize: 12 },
  topValue: { fontSize: 14, fontWeight: '600', flex: 1 },
  card: { borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  emptyText: { textAlign: 'center', paddingVertical: 32, fontSize: 14 },
  rankTabs: { flexDirection: 'row', gap: 4, marginBottom: 12 },
  rankTab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  rankTabActive: {},
  rankTabText: { fontSize: 13 },
  rankTabTextActive: { fontWeight: '500' },
  prefGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prefCard: { width: '31%', borderRadius: 10, padding: 10, alignItems: 'center' },
  prefLabel: { fontSize: 12, marginBottom: 2 },
  prefValue: { fontSize: 18, fontWeight: '700' },
  annualHeader: { alignItems: 'center', marginBottom: 16 },
  annualTitle: { fontSize: 24, fontWeight: '800' },
  annualSub: { fontSize: 13, marginTop: 4 },
})
