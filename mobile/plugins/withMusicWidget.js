const fs = require('fs')
const path = require('path')
const {
  withDangerousMod,
  withAndroidManifest,
} = require('@expo/config-plugins')

const PKG = 'com.happymusic.app'
const TARGET_PKG_DIR = path.join('app', 'src', 'main', 'java', ...PKG.split('.'))
const SRC_DIR = path.join(__dirname, '..', 'native-src', 'music-widget')
const RES_SRC = path.join(SRC_DIR, 'res')

const KOTLIN_FILES = ['MusicWidgetProvider.kt', 'WidgetControlModule.kt', 'WidgetControlPackage.kt']

// res 文件相对 android project 的目标路径
const RES_FILES = [
  ['layout', 'widget_music.xml'],
  ['xml', 'music_widget_info.xml'],
  ['drawable', 'widget_bg.xml'],
]

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function withMusicWidget(config) {
  // 1. AndroidManifest: 注册小组件 receiver
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application[0]
    if (!application.receiver) application.receiver = []

    const hasWidget = application.receiver.some(
      (r) => r.$['android:name'] === '.MusicWidgetProvider'
    )
    if (!hasWidget) {
      application.receiver.push({
        $: {
          'android:name': '.MusicWidgetProvider',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': '@xml/music_widget_info',
            },
          },
        ],
      })
    }
    return config
  })

  // 2. 复制 Kotlin + 资源 + 改 MainApplication + 加字符串
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const androidRoot = config.modRequest.platformProjectRoot
      const pkgDir = path.join(androidRoot, TARGET_PKG_DIR)
      const resDir = path.join(androidRoot, 'app', 'src', 'main', 'res')

      // 复制 Kotlin
      ensureDir(pkgDir)
      for (const file of KOTLIN_FILES) {
        const src = path.join(SRC_DIR, file)
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(pkgDir, file))
      }

      // 复制 res 资源
      for (const [type, file] of RES_FILES) {
        const src = path.join(RES_SRC, type, file)
        const destDir = path.join(resDir, type)
        if (fs.existsSync(src)) {
          ensureDir(destDir)
          fs.copyFileSync(src, path.join(destDir, file))
        }
      }

      // 注入 widget_description 字符串到 strings.xml
      const stringsPath = path.join(resDir, 'values', 'strings.xml')
      if (fs.existsSync(stringsPath)) {
        let s = fs.readFileSync(stringsPath, 'utf-8')
        if (!s.includes('widget_description')) {
          s = s.replace(
            /<\/resources>/,
            '  <string name="widget_description">桌面音乐播放控制</string>\n</resources>'
          )
          fs.writeFileSync(stringsPath, s, 'utf-8')
        }
      }

      // 改 MainApplication.kt:注册 WidgetControlPackage
      const mainAppPath = path.join(pkgDir, 'MainApplication.kt')
      if (fs.existsSync(mainAppPath)) {
        let content = fs.readFileSync(mainAppPath, 'utf-8')
        if (!content.includes('import com.happymusic.app.WidgetControlPackage')) {
          content = content.replace(
            'import expo.modules.ApplicationLifecycleDispatcher',
            'import expo.modules.ApplicationLifecycleDispatcher\nimport com.happymusic.app.WidgetControlPackage'
          )
        }
        if (!content.includes('add(WidgetControlPackage())')) {
          // 兼容两种占位:既有 DesktopLyricsPackage 注册则在其后追加,否则用默认注释占位
          if (content.includes('add(DesktopLyricsPackage())')) {
            content = content.replace(
              'add(DesktopLyricsPackage())',
              'add(DesktopLyricsPackage())\n              add(WidgetControlPackage())'
            )
          } else {
            content = content.replace(
              '// add(MyReactNativePackage())',
              '// add(MyReactNativePackage())\n              add(WidgetControlPackage())'
            )
          }
        }
        fs.writeFileSync(mainAppPath, content, 'utf-8')
      }

      return config
    },
  ])

  return config
}

module.exports = { withMusicWidget }
