import React, { useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { getDB } from '../database/schema'
import { useHeaderPadding } from '../hooks/useHeaderPadding'

interface ImportedFile {
  id: number
  song_name: string
  singers: string
  source: string
  song_identifier: string
  file_path: string
  file_size: number
  ext: string
  downloaded_at: number
}

export default function LocalFileImportScreen() {
  const navigation = useNavigation()
  const [files, setFiles] = useState<ImportedFile[]>([])
  const [importing, setImporting] = useState(false)
  const [loading, setLoading] = useState(true)
  const headerPad = useHeaderPadding()

  const loadFiles = async () => {
    try {
      const db = await getDB()
      const rows = await db.getAllAsync<ImportedFile>(
        "SELECT * FROM downloads WHERE source = 'local' ORDER BY downloaded_at DESC"
      )
      setFiles(rows)
    } catch (e) {
      console.error('Failed to load local files:', e)
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadFiles()
    }, [])
  )

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg'],
        multiple: true,
      })

      if (result.canceled) return

      setImporting(true)
      const documentsDir = `${FileSystem.documentDirectory}music_downloads/`
      const dirInfo = await FileSystem.getInfoAsync(documentsDir)
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(documentsDir, { intermediates: true })
      }

      let importedCount = 0
      for (const asset of result.assets) {
        try {
          const filename = asset.name
          const nameWithoutExt = filename.replace(/\.[^.]+$/, '')
          const ext = filename.split('.').pop()?.toLowerCase() || 'mp3'

          // Generate unique identifier based on filename
          const identifier = `local_${nameWithoutExt.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_${Date.now()}`

          // Copy file to app documents directory
          const destPath = `${documentsDir}${identifier}.${ext}`
          await FileSystem.copyAsync({
            from: asset.uri,
            to: destPath,
          })

          // Get file size
          const fileInfo = await FileSystem.getInfoAsync(destPath)
          const fileSize = (fileInfo as any).size || 0

          // Save to database
          const db = await getDB()
          await db.runAsync(
            `INSERT OR REPLACE INTO downloads (song_name, singers, album, ext, duration, source, song_identifier, cover_url, file_path, file_size, downloaded_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [nameWithoutExt, '本地导入', '', ext, 0, 'local', identifier, '', destPath, fileSize, Date.now()]
          )

          importedCount++
        } catch (e) {
          console.error('Failed to import file:', asset.name, e)
        }
      }

      await loadFiles()
      Alert.alert('导入完成', `成功导入 ${importedCount} 个文件`)
    } catch (e) {
      Alert.alert('错误', '选择文件失败')
    } finally {
      setImporting(false)
    }
  }

  const handleDelete = (file: ImportedFile) => {
    Alert.alert('确认删除', `确定要删除 "${file.song_name}" 吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            // Delete file from filesystem
            const fileInfo = await FileSystem.getInfoAsync(file.file_path)
            if (fileInfo.exists) {
              await FileSystem.deleteAsync(file.file_path)
            }

            // Delete from database
            const db = await getDB()
            await db.runAsync(
              'DELETE FROM downloads WHERE source = ? AND song_identifier = ?',
              [file.source, file.song_identifier]
            )

            setFiles((prev) => prev.filter((f) => f.id !== file.id))
          } catch (e) {
            Alert.alert('错误', '删除失败')
          }
        },
      },
    ])
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + 'B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + 'GB'
  }

  const renderItem = ({ item }: { item: ImportedFile }) => (
    <View style={styles.fileRow}>
      <View style={styles.fileIcon}>
        <Ionicons name="musical-note" size={20} color="#EC4141" />
      </View>
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>{item.song_name}</Text>
        <Text style={styles.fileMeta}>
          {item.ext.toUpperCase()} · {formatSize(item.file_size)}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item)}
      >
        <Ionicons name="trash-outline" size={18} color="#ef4444" />
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: headerPad }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>本地导入</Text>
        <View style={{ width: 24 }} />
      </View>

      <TouchableOpacity
        style={styles.importButton}
        onPress={handlePickFile}
        disabled={importing}
      >
        {importing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="add-circle-outline" size={22} color="#fff" />
            <Text style={styles.importButtonText}>选择文件</Text>
          </>
        )}
      </TouchableOpacity>

      {importing && (
        <Text style={styles.importingHint}>正在导入文件...</Text>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#EC4141" />
        </View>
      ) : (
        <FlatList
          data={files}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={files.length === 0 ? styles.emptyList : undefined}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyText}>暂无导入文件</Text>
              <Text style={styles.emptyHint}>点击上方按钮选择音频文件导入</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EC4141',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  importButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  importingHint: {
    textAlign: 'center',
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 8,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ede9fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 2,
  },
  fileMeta: {
    fontSize: 12,
    color: '#94a3b8',
  },
  deleteButton: {
    padding: 8,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 15,
    color: '#94a3b8',
    marginTop: 12,
  },
  emptyHint: {
    fontSize: 13,
    color: '#cbd5e1',
    marginTop: 4,
  },
})
