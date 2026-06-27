const fs = require('fs')
const path = require('path')
const { withDangerousMod, withAndroidManifest } = require('@expo/config-plugins')

const PKG = 'com.happymusic.app'
const TARGET_PKG_DIR = path.join('app', 'src', 'main', 'java', ...PKG.split('.'))
const SRC_DIR = path.join(__dirname, '..', 'native-src', 'apk-installer')

const KOTLIN_FILES = ['ApkInstallerModule.kt', 'ApkInstallerPackage.kt']

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }) }

function withApkInstaller(config) {
  // 1. AndroidManifest: 安装权限 + FileProvider
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest

    if (!manifest['uses-permission']) manifest['uses-permission'] = []
    const hasInstall = manifest['uses-permission'].some(
      (p) => p.$['android:name'] === 'android.permission.REQUEST_INSTALL_PACKAGES'
    )
    if (!hasInstall) {
      manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.REQUEST_INSTALL_PACKAGES' },
      })
    }

    const application = manifest.application[0]
    if (!application.provider) application.provider = []
    const hasProvider = application.provider.some(
      (pr) => pr.$['android:authorities'] === '${applicationId}.apkprovider'
    )
    if (!hasProvider) {
      application.provider.push({
        $: {
          'android:name': 'androidx.core.content.FileProvider',
          'android:authorities': '${applicationId}.apkprovider',
          'android:exported': 'false',
          'android:grantUriPermissions': 'true',
        },
        'meta-data': [
          {
            $: {
              'android:name': 'android.support.FILE_PROVIDER_PATHS',
              'android:resource': '@xml/apk_file_paths',
            },
          },
        ],
      })
    }
    return config
  })

  // 2. 复制 Kotlin + file_paths xml + 注册 Package
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const androidRoot = config.modRequest.platformProjectRoot
      const pkgDir = path.join(androidRoot, TARGET_PKG_DIR)
      const resDir = path.join(androidRoot, 'app', 'src', 'main', 'res')

      ensureDir(pkgDir)
      for (const file of KOTLIN_FILES) {
        const src = path.join(SRC_DIR, file)
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(pkgDir, file))
      }

      // res/xml/apk_file_paths.xml
      const xmlSrc = path.join(SRC_DIR, 'res', 'xml', 'apk_file_paths.xml')
      if (fs.existsSync(xmlSrc)) {
        ensureDir(path.join(resDir, 'xml'))
        fs.copyFileSync(xmlSrc, path.join(resDir, 'xml', 'apk_file_paths.xml'))
      }

      // 注册 ApkInstallerPackage 到 MainApplication.kt
      const mainAppPath = path.join(pkgDir, 'MainApplication.kt')
      if (fs.existsSync(mainAppPath)) {
        let content = fs.readFileSync(mainAppPath, 'utf-8')
        if (!content.includes('import com.happymusic.app.ApkInstallerPackage')) {
          content = content.replace(
            'import expo.modules.ApplicationLifecycleDispatcher',
            'import expo.modules.ApplicationLifecycleDispatcher\nimport com.happymusic.app.ApkInstallerPackage'
          )
        }
        if (!content.includes('add(ApkInstallerPackage())')) {
          if (content.includes('add(WidgetControlPackage())')) {
            content = content.replace(
              'add(WidgetControlPackage())',
              'add(WidgetControlPackage())\n              add(ApkInstallerPackage())'
            )
          } else if (content.includes('add(DesktopLyricsPackage())')) {
            content = content.replace(
              'add(DesktopLyricsPackage())',
              'add(DesktopLyricsPackage())\n              add(ApkInstallerPackage())'
            )
          } else {
            content = content.replace(
              '// add(MyReactNativePackage())',
              '// add(MyReactNativePackage())\n              add(ApkInstallerPackage())'
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

module.exports = { withApkInstaller }
