const { withPlugins } = require('@expo/config-plugins')
const { withDesktopLyrics } = require('./plugins/withDesktopLyrics')
const { withMusicWidget } = require('./plugins/withMusicWidget')
const { withApkInstaller } = require('./plugins/withApkInstaller')

module.exports = (config) => {
  return withPlugins(config, [
    withDesktopLyrics,
    withMusicWidget,
    withApkInstaller,
  ])
}
