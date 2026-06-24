import type { FileSystemAdapter } from '@common/adapters'
import { readFile, writeFile, mkdir, exists, remove } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'

let _docDir: string | null = null

async function getDocDir(): Promise<string> {
  if (!_docDir) {
    _docDir = await appDataDir()
  }
  return _docDir
}

export const desktopFS: FileSystemAdapter = {
  get documentDir() {
    return '' // accessed async via getDocDir
  },

  async getInfo(path: string): Promise<{ exists: boolean; size?: number }> {
    try {
      const dir = await getDocDir()
      const fullPath = await join(dir, path)
      const e = await exists(fullPath)
      return { exists: e }
    } catch {
      return { exists: false }
    }
  },

  async readString(path: string): Promise<string> {
    const dir = await getDocDir()
    const fullPath = await join(dir, path)
    const data = await readFile(fullPath)
    return new TextDecoder().decode(data)
  },

  async writeString(path: string, content: string): Promise<void> {
    const dir = await getDocDir()
    const fullPath = await join(dir, path)
    const data = new TextEncoder().encode(content)
    await writeFile(fullPath, data)
  },

  async download(url: string, toPath: string): Promise<string> {
    const dir = await getDocDir()
    const fullPath = await join(dir, toPath)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Download failed: ${response.status}`)
    const blob = await response.blob()
    const buffer = await blob.arrayBuffer()
    await writeFile(fullPath, new Uint8Array(buffer))
    return fullPath
  },

  async mkdir(path: string): Promise<void> {
    const dir = await getDocDir()
    const fullPath = await join(dir, path)
    await mkdir(fullPath, { recursive: true })
  },
}
