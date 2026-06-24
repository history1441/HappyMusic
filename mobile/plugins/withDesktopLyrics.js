const fs = require('fs')
const path = require('path')
const {
  withDangerousMod,
  withAndroidManifest,
} = require('@expo/config-plugins')

const KOTLIN_SRC_DIR = path.join(__dirname, '..', 'native-src', 'desktop-lyrics')
const TARGET_PKG_DIR = path.join('app', 'src', 'main', 'java', 'com', 'happymusic', 'app')

const KOTLIN_FILES = [
  'LyricsManager.kt',
  'DesktopLyricsModule.kt',
  'DesktopLyricsPackage.kt',
  'FloatingLyricsService.kt',
]

function withDesktopLyrics(config) {
  // 1. Add service declarations and permissions to AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest
    const application = manifest.application[0]

    // Add FOREGROUND_SERVICE_SPECIAL_USE permission
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = []
    }
    const hasSpecialUse = manifest['uses-permission'].some(
      (p) => p.$['android:name'] === 'android.permission.FOREGROUND_SERVICE_SPECIAL_USE'
    )
    if (!hasSpecialUse) {
      manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.FOREGROUND_SERVICE_SPECIAL_USE' },
      })
    }

    if (!application.service) {
      application.service = []
    }

    // Check if already added
    const hasFloating = application.service.some(
      (s) => s.$['android:name'] === '.FloatingLyricsService'
    )

    if (!hasFloating) {
      application.service.push({
        $: {
          'android:name': '.FloatingLyricsService',
          'android:exported': 'false',
          'android:foregroundServiceType': 'specialUse',
        },
      })
    }

    return config
  })

  // 2. Copy Kotlin files and modify MainApplication.kt
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const androidRoot = config.modRequest.platformProjectRoot
      const targetDir = path.join(androidRoot, TARGET_PKG_DIR)

      // Copy Kotlin files
      for (const file of KOTLIN_FILES) {
        const src = path.join(KOTLIN_SRC_DIR, file)
        const dest = path.join(targetDir, file)
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest)
        }
      }

      // Modify MainApplication.kt to register the package
      const mainAppPath = path.join(targetDir, 'MainApplication.kt')
      if (fs.existsSync(mainAppPath)) {
        let content = fs.readFileSync(mainAppPath, 'utf-8')

        // Add import if not already present
        if (!content.includes('import com.happymusic.app.DesktopLyricsPackage')) {
          content = content.replace(
            'import expo.modules.ApplicationLifecycleDispatcher',
            'import expo.modules.ApplicationLifecycleDispatcher\nimport com.happymusic.app.DesktopLyricsPackage'
          )
        }

        // Register package if not already registered
        if (!content.includes('add(DesktopLyricsPackage())')) {
          content = content.replace(
            '// add(MyReactNativePackage())',
            '// add(MyReactNativePackage())\n              add(DesktopLyricsPackage())'
          )
        }

        fs.writeFileSync(mainAppPath, content, 'utf-8')
      }

      return config
    },
  ])

  return config
}

module.exports = { withDesktopLyrics }
